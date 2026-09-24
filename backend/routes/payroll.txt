// ============================================================
// routes/payroll.js
// THIRD PARTY PAYROLL API
//
// Attendance source: third_party_attendance_summary
// (recalculated on demand by services/attendanceSummary.js)
// ============================================================

const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

const supabase = require("../config/supabase");
const { generatePayslipPDF } = require("../utils/Payslippdf");
const { recalculateMonthlySummary } = require("../services/attendanceSummary");

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

const ATTENDANCE_TABLE = "third_party_attendance_summary";
const ATTENDANCE_COLUMNS = `
    id, employee_id, client_id, deployment_id, billing_month,
    total_days, present_days, absent_days, leave_days, half_days,
    lop_days, payable_days, overtime_hours, created_at, updated_at
`;

// third_party_payroll has no `status` column, so it is not selected anywhere.
const PAYROLL_COLUMNS = `
    id, employee_name, salary_month, basic_salary, allowances, overtime,
    bonus, gross_salary, pf, esic, tax, lop, net_salary, bank_name,
    account_number, ifsc_code, created_at, employee_ref_id, attendance_id,
    deployment_id, payroll_batch_id, client_id, professional_tax,
    total_deductions, employer_pf, employer_esic,
    total_employer_contribution, total_employer_cost, hra, conveyance,
    medical_allowance, other_allowance, gratuity, joining_date, pran,
    pf_wages
`;

const CANDIDATE_COLUMNS = `
    id, full_name, email, phone, designation, gender, department, pay_rate,
    bank_name, bank_account_number, ifsc_code, pan_number, uan_number,
    esic_number, date_of_joining
`;

const SALARY_DIVISOR = 26; // overtime divisor
const CONVEYANCE = 1200;
const MEDICAL_ALLOWANCE = 1000;

// ============================================================
// HELPERS
// ============================================================

const getId = (value) => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const sendError = (res, status, message, details = null) =>
    res.status(status).json({
        success: false,
        message,
        ...(details ? { details } : {}),
    });

const num = (v) => Number(v || 0);
const r2 = (v) => Number(Number(v).toFixed(2));

function validateSalaryMonth(value) {
    if (!value) throw new Error("salary_month is required");

    const month = String(value).trim();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error("salary_month must be in YYYY-MM format");
    }

    return month;
}

function getDaysInMonth(salaryMonth) {
    const [year, monthNumber] = validateSalaryMonth(salaryMonth)
        .split("-")
        .map(Number);
    return new Date(year, monthNumber, 0).getDate();
}

function calcProfessionalTax(gross, gender) {
    const g = String(gender || "").trim().toLowerCase();
    return gross > 25000 && (g === "male" || g === "female") ? 200 : 0;
}

// ============================================================
// ATTENDANCE (summary table)
// ============================================================

// Read-only: what is stored right now.
async function getAttendanceForPayroll(payroll) {
    if (!payroll?.employee_ref_id || !payroll?.salary_month) {
        return { attendance: null };
    }

    const { data, error } = await supabase
        .from(ATTENDANCE_TABLE)
        .select(ATTENDANCE_COLUMNS)
        .eq("employee_id", payroll.employee_ref_id)
        .eq("billing_month", payroll.salary_month)
        .maybeSingle();

    if (error) throw error;

    return { attendance: data };
}

// Recalculates first so absences are current. Use when CREATING payroll.
async function getFreshAttendance(employeeId, month) {
    try {
        return await recalculateMonthlySummary(employeeId, month);
    } catch (err) {
        console.error("Summary recalculation failed:", err.message);

        const { data, error } = await supabase
            .from(ATTENDANCE_TABLE)
            .select(ATTENDANCE_COLUMNS)
            .eq("employee_id", employeeId)
            .eq("billing_month", month)
            .maybeSingle();

        if (error) throw error;
        return data;
    }
}

// ============================================================
// FORMAT PAYROLL (for API responses)
// ============================================================

const NUMERIC_FIELDS = [
    "basic_salary", "allowances", "overtime", "bonus", "gross_salary",
    "pf", "esic", "tax", "professional_tax", "lop", "total_deductions",
    "net_salary", "employer_pf", "employer_esic",
    "total_employer_contribution", "total_employer_cost",
];

function formatPayroll(row, attendance = null) {
    const totalDays =
        attendance?.total_days != null
            ? num(attendance.total_days)
            : getDaysInMonth(row.salary_month);

    const halfDays = num(attendance?.half_days);
    const lopDays = num(attendance?.lop_days);

    const payableDays =
        attendance?.payable_days != null
            ? num(attendance.payable_days)
            : Math.max(0, totalDays - lopDays - halfDays * 0.5);

    const numbers = Object.fromEntries(
        NUMERIC_FIELDS.map((f) => [f, num(row[f])])
    );

    return {
        ...row,
        ...numbers,

        employee_id: row.employee_ref_id,
        candidate_id: row.employee_ref_id,
        employee_name: row.employee_name || "N/A",

        total_days: totalDays,
        present_days: num(attendance?.present_days),
        absent_days: num(attendance?.absent_days),
        leave_days: num(attendance?.leave_days),
        half_days: halfDays,
        lop_days: lopDays,
        payable_days: payableDays,
        overtime_hours: num(attendance?.overtime_hours),

        attendance_status: null,
        attendance_created_at: attendance?.created_at || null,
        attendance_billing_month: attendance?.billing_month || null,

        // aliases used by the frontend
        overtime_amount: numbers.overtime,
        employee_pf: numbers.pf,
        employee_esic: numbers.esic,
        tds: numbers.tax,
        lop_deduction: numbers.lop,

        status: row.status || "Pending",
    };
}

// ============================================================
// SALARY CALCULATION (shared by /generate and POST /)
// ============================================================

function calculatePayroll({ candidate, attendance, salaryMonth, clientId, deploymentId }) {
    const calendarDays = getDaysInMonth(salaryMonth);
    const monthlyBasic = Math.round(num(candidate.pay_rate));

    let payableDays = Number(attendance?.payable_days);
    if (!Number.isFinite(payableDays)) {
        payableDays =
            calendarDays -
            num(attendance?.lop_days) -
            num(attendance?.half_days) * 0.5;
    }
    payableDays = Math.max(0, Math.min(calendarDays, payableDays));

    const monthlyHRA = Math.round(monthlyBasic * 0.5);
    const earn = (amount) => Math.round((amount / calendarDays) * payableDays);

    const earnedBasic = earn(monthlyBasic);
    const earnedHRA = earn(monthlyHRA);
    const earnedConveyance = earn(CONVEYANCE);
    const earnedMedical = earn(MEDICAL_ALLOWANCE);
    const earnedOther = 0;

    const overtimeHours = Math.max(0, num(attendance?.overtime_hours));
    const overtime = Math.round(
        (monthlyBasic / SALARY_DIVISOR / 8) * 1.5 * overtimeHours
    );

    const earnedFixedGross =
        earnedBasic + earnedHRA + earnedConveyance + earnedMedical + earnedOther;

    const department = String(candidate.department || "").trim().toLowerCase();
    const bonus = ["admin", "accounts"].includes(department)
        ? Math.round(earnedFixedGross * 0.0833)
        : 0;

    const grossSalary = earnedFixedGross + overtime + bonus;

    const pfWages = Math.max(0, grossSalary - earnedHRA);
    const pf = Math.round(Math.min(pfWages, 15000) * 0.12);

    const esicApplicable = !!candidate.esic_number && grossSalary <= 21000;
    const esic = esicApplicable ? Math.round(grossSalary * 0.0075) : 0;
    const employerESIC = esicApplicable ? Math.round(grossSalary * 0.0325) : 0;

    const professionalTax = calcProfessionalTax(grossSalary, candidate.gender);

    const tax = 0; // TDS not calculated yet
    const lop = 0; // LOP already reflected through payable days

    const totalDeductions = pf + esic + tax + professionalTax + lop;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    const gratuity = Math.round(earnedBasic * 0.0481);
    const employerPF = pf;
    const totalEmployerContribution = employerPF + employerESIC;
    const totalEmployerCost = grossSalary + totalEmployerContribution + gratuity;

    const row = {
        employee_name: candidate.full_name,
        employee_ref_id: candidate.id,
        salary_month: salaryMonth,

        basic_salary: r2(earnedBasic),
        hra: r2(earnedHRA),
        conveyance: r2(earnedConveyance),
        medical_allowance: r2(earnedMedical),
        other_allowance: r2(earnedOther),
        allowances: r2(earnedHRA + earnedConveyance + earnedMedical + earnedOther),

        overtime: r2(overtime),
        bonus: r2(bonus),
        gross_salary: r2(grossSalary),

        pf: r2(pf),
        esic: r2(esic),
        tax: r2(tax),
        professional_tax: r2(professionalTax),
        lop: r2(lop),
        total_deductions: r2(totalDeductions),
        net_salary: r2(netSalary),

        employer_pf: r2(employerPF),
        employer_esic: r2(employerESIC),
        total_employer_contribution: r2(totalEmployerContribution),
        gratuity: r2(gratuity),
        total_employer_cost: r2(totalEmployerCost),
        pf_wages: r2(pfWages),

        joining_date: candidate.date_of_joining || null,
        pran: null, // do NOT use UAN as PRAN

        bank_name: candidate.bank_name || null,
        account_number: candidate.bank_account_number || null,
        ifsc_code: candidate.ifsc_code
            ? String(candidate.ifsc_code).trim().toUpperCase()
            : null,

        attendance_id: attendance?.id || null,
        deployment_id: deploymentId,
        payroll_batch_id: null,
        client_id: clientId,
    };

    const meta = {
        calendar_days: calendarDays,
        payable_days: payableDays,
        monthly_basic: monthlyBasic,
        monthly_hra: monthlyHRA,
        overtime_hours: overtimeHours,
    };

    return { row, meta };
}

// ============================================================
// GET ALL PAYROLL
// GET /api/payroll?client_id=1&salary_month=2026-09
// ============================================================

router.get("/", async (req, res) => {
    try {
        let clientId = null;
        let salaryMonth = null;

        if (req.query.client_id !== undefined) {
            clientId = getId(req.query.client_id);
            if (!clientId) return sendError(res, 400, "Invalid client_id");
        }

        if (req.query.salary_month) {
            try {
                salaryMonth = validateSalaryMonth(req.query.salary_month);
            } catch (error) {
                return sendError(res, 400, error.message);
            }
        }

        let query = supabase
            .from("third_party_payroll")
            .select(PAYROLL_COLUMNS)
            .order("id", { ascending: false });

        if (salaryMonth) query = query.eq("salary_month", salaryMonth);
        if (clientId) query = query.eq("client_id", clientId);

        const { data, error } = await query;
        if (error) throw error;

        const records = [];

        for (const row of data || []) {
            try {
                const { attendance } = await getAttendanceForPayroll(row);
                records.push(formatPayroll(row, attendance));
            } catch (err) {
                console.error(
                    `Attendance enrichment failed for payroll ${row.id}:`,
                    err.message
                );
                records.push(formatPayroll(row, null));
            }
        }

        return res.json({
            success: true,
            count: records.length,
            data: records,
            payroll: records,
        });
    } catch (error) {
        console.error("GET /api/payroll ERROR:", error);
        return sendError(res, 500, "Failed to fetch payroll", error.message);
    }
});

// ============================================================
// GENERATE PAYROLL
// POST /api/payroll/generate   { client_id, salary_month }
//
// Starts from the client's Active deployments and recalculates
// each summary first, so employees who never opened the
// dashboard are included with correct absences.
// ============================================================

router.post("/generate", async (req, res) => {
    try {
        const clientId = getId(req.body.client_id);

        if (!clientId) {
            return sendError(res, 400, "Valid client_id is required");
        }

        let validMonth;

        try {
            validMonth = validateSalaryMonth(req.body.salary_month);
        } catch (error) {
            return sendError(res, 400, error.message);
        }

        const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("id, company_name")
            .eq("id", clientId)
            .maybeSingle();

        if (clientError) throw clientError;
        if (!client) return sendError(res, 404, "Client not found");

        const { data: deployments, error: deploymentsError } = await supabase
            .from("deployments")
            .select("id, candidate_id, client_id, status")
            .eq("client_id", clientId)
            .eq("status", "Active");

        if (deploymentsError) throw deploymentsError;

        if (!deployments || deployments.length === 0) {
            return res.json({
                success: true,
                message: `No active deployments found for ${client.company_name}`,
                client_id: clientId,
                client_name: client.company_name,
                salary_month: validMonth,
                records_generated: 0,
                data: [],
            });
        }

        const generated = [];
        const skipped = [];

        for (const d of deployments) {
            const employeeId = getId(d.candidate_id);

            try {
                if (!employeeId) {
                    skipped.push({ deployment_id: d.id, reason: "Employee ID missing" });
                    continue;
                }

                // ---- duplicate check ----
                const { data: existingRows, error: existingError } = await supabase
                    .from("third_party_payroll")
                    .select("id")
                    .eq("employee_ref_id", employeeId)
                    .eq("deployment_id", d.id)
                    .eq("salary_month", validMonth)
                    .limit(1);

                if (existingError) throw existingError;

                if (existingRows && existingRows.length > 0) {
                    skipped.push({
                        deployment_id: d.id,
                        employee_id: employeeId,
                        payroll_id: existingRows[0].id,
                        reason: "Payroll already exists",
                    });
                    continue;
                }

                // ---- attendance (fresh) ----
                const attendance = await getFreshAttendance(employeeId, validMonth);

                if (!attendance) {
                    skipped.push({
                        deployment_id: d.id,
                        employee_id: employeeId,
                        reason: "No attendance summary",
                    });
                    continue;
                }

                if (num(attendance.payable_days) <= 0) {
                    skipped.push({
                        deployment_id: d.id,
                        employee_id: employeeId,
                        reason: "No payable days in this month",
                    });
                    continue;
                }

                // ---- candidate (pay_rate = monthly basic) ----
                const { data: candidate, error: candidateError } = await supabase
                    .from("candidates")
                    .select(CANDIDATE_COLUMNS)
                    .eq("id", employeeId)
                    .maybeSingle();

                if (candidateError) throw candidateError;

                if (!candidate) {
                    skipped.push({
                        deployment_id: d.id,
                        employee_id: employeeId,
                        reason: "Candidate not found",
                    });
                    continue;
                }

                if (!(num(candidate.pay_rate) > 0)) {
                    skipped.push({
                        deployment_id: d.id,
                        employee_id: employeeId,
                        reason: "Invalid employee pay rate in candidates table",
                    });
                    continue;
                }

                const { row } = calculatePayroll({
                    candidate,
                    attendance,
                    salaryMonth: validMonth,
                    clientId,
                    deploymentId: d.id,
                });

                generated.push(row);
            } catch (err) {
                console.error(`Payroll generation failed for deployment ${d.id}:`, err);
                skipped.push({
                    deployment_id: d.id,
                    employee_id: employeeId,
                    reason: err.message,
                });
            }
        }

        if (generated.length === 0) {
            return res.json({
                success: true,
                message: "No new payroll records were generated",
                client_id: clientId,
                client_name: client.company_name,
                salary_month: validMonth,
                records_generated: 0,
                records_skipped: skipped.length,
                data: [],
                skipped,
            });
        }

        const { data: insertedPayroll, error: insertError } = await supabase
            .from("third_party_payroll")
            .insert(generated)
            .select();

        if (insertError) throw insertError;

        return res.status(201).json({
            success: true,
            message: `Payroll generated successfully for ${validMonth}`,
            salary_month: validMonth,
            calendar_days: getDaysInMonth(validMonth),
            salary_divisor: SALARY_DIVISOR,
            client_id: clientId,
            client_name: client.company_name,
            records_generated: insertedPayroll?.length || 0,
            records_skipped: skipped.length,
            data: insertedPayroll || [],
            skipped,
        });
    } catch (error) {
        console.error("POST /api/payroll/generate:", error);
        return sendError(res, 500, "Payroll generation failed", error.message);
    }
});

// ============================================================
// EMAIL PAYSLIP
// POST /api/payroll/:id/email
// ============================================================

router.post("/:id/email", async (req, res) => {
    try {
        const payrollId = getId(req.params.id);

        if (!payrollId) return sendError(res, 400, "Invalid payroll ID");

        if (!EMAIL_USER || !EMAIL_PASS) {
            console.error("EMAIL_USER or EMAIL_PASS is missing");
            return sendError(
                res,
                500,
                "Email service is not configured. Please check EMAIL_USER and EMAIL_PASS."
            );
        }

        const { data: payroll, error: payrollError } = await supabase
            .from("third_party_payroll")
            .select(PAYROLL_COLUMNS)
            .eq("id", payrollId)
            .maybeSingle();

        if (payrollError) throw payrollError;
        if (!payroll) return sendError(res, 404, "Payroll record not found");

        const candidateId = Number(payroll.employee_ref_id);

        if (!candidateId) {
            return sendError(res, 400, "Employee reference ID is missing from payroll record.");
        }

        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select(`
                id, full_name, designation, employee_code, date_of_joining,
                city, state, pan_number, uan_number, esic_number, gender,
                department, pay_rate
            `)
            .eq("id", candidateId)
            .maybeSingle();

        if (candidateError) throw candidateError;
        if (!candidate) return sendError(res, 404, `Candidate ${candidateId} not found.`);

        const { data: employeeUser, error: employeeUserError } = await supabase
            .from("employee_users")
            .select("id, employee_id, name, email, role, status")
            .eq("employee_id", candidateId)
            .maybeSingle();

        if (employeeUserError) throw employeeUserError;

        if (!employeeUser) {
            return sendError(
                res,
                404,
                `Employee account not found for employee ID ${candidateId}.`
            );
        }

        const employeeEmail = String(employeeUser.email || "").trim();
        const employeeName =
            candidate.full_name || employeeUser.name || payroll.employee_name || "Employee";

        if (!employeeEmail) {
            return sendError(
                res,
                400,
                `Employee email address is not available for ${employeeName}.`
            );
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeEmail)) {
            return sendError(res, 400, `Invalid employee email address: ${employeeEmail}`);
        }

        const salaryMonth =
            payroll.salary_month || new Date().toISOString().slice(0, 7);

        const numbers = Object.fromEntries(
            [
                ...NUMERIC_FIELDS,
                "hra", "conveyance", "medical_allowance",
                "other_allowance", "gratuity", "pf_wages",
            ].map((f) => [f, num(payroll[f])])
        );

        const payslipData = {
            ...payroll,
            ...numbers,

            employee_name: employeeName,
            employee_code: candidate.employee_code || candidate.id || "N/A",
            designation: candidate.designation || "N/A",
            location: candidate.city || "Head Office",
            pan_number: candidate.pan_number || "N/A",
            uan_number: candidate.uan_number || "N/A",
            esic_number: candidate.esic_number || "N/A",
            joining_date: candidate.date_of_joining || payroll.joining_date || null,

            bank_name: payroll.bank_name || "N/A",
            account_number: payroll.account_number || "N/A",
            ifsc_code: payroll.ifsc_code || "N/A",

            pran: payroll.pran || "N/A",
            pay_rate: num(candidate.pay_rate),
        };

        const pdfBuffer = await generatePayslipPDF(payslipData);

        if (!pdfBuffer) {
            throw new Error("Payslip PDF generation returned no data.");
        }

        const cleanName = String(employeeName)
            .replace(/[^a-zA-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");

        const fileName = `Payslip_${cleanName}_${salaryMonth}.pdf`;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: EMAIL_USER, pass: EMAIL_PASS },
        });

        await transporter.verify();

        const safeName = String(employeeName)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        const mailResult = await transporter.sendMail({
            from: `"Talent Corner HR Services Pvt Ltd." <${EMAIL_USER}>`,
            to: employeeEmail,
            subject: `Payslip - ${salaryMonth} - ${employeeName}`,
            html: `
                <p>Dear <strong>${safeName}</strong>,</p>
                <p>Please find attached your payslip for <strong>${salaryMonth}</strong>.</p>
                <p>Regards,<br><strong>Talent Corner HR Services Pvt Ltd.</strong></p>
            `,
            attachments: [
                {
                    filename: fileName,
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        });

        return res.json({
            success: true,
            message: `Payslip emailed successfully to ${employeeEmail}`,
            payroll_id: payrollId,
            candidate_id: candidateId,
            employee_name: employeeName,
            employee_email: employeeEmail,
            salary_month: salaryMonth,
            file_name: fileName,
            message_id: mailResult.messageId,
        });
    } catch (error) {
        console.error("EMAIL PAYSLIP ERROR:", error);
        return sendError(res, 500, "Failed to generate and send payslip", error.message);
    }
});

// ============================================================
// LOOKUP: EMPLOYEES FOR A CLIENT
// GET /api/payroll/lookup/employees?client_id=1
// ============================================================

router.get("/lookup/employees", async (req, res) => {
    try {
        const clientId = getId(req.query.client_id);

        if (!clientId) {
            return sendError(res, 400, "Valid client_id is required");
        }

        const { data: deployments, error: deploymentError } = await supabase
            .from("deployments")
            .select("id, candidate_id, client_id, pay_rate, bill_rate, project_name, status")
            .eq("client_id", clientId)
            .order("id", { ascending: false });

        if (deploymentError) throw deploymentError;

        if (!deployments || deployments.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const candidateIds = [
            ...new Set(
                deployments.map((d) => d.candidate_id).filter((v) => v != null)
            ),
        ];

        let candidatesById = {};

        if (candidateIds.length > 0) {
            const { data: candidates, error: candidateError } = await supabase
                .from("candidates")
                .select("id, full_name, email, designation, pay_rate")
                .in("id", candidateIds);

            if (candidateError) throw candidateError;

            candidatesById = Object.fromEntries(
                (candidates || []).map((c) => [c.id, c])
            );
        }

        const result = deployments.map((d) => {
            const candidate = candidatesById[d.candidate_id] || null;

            return {
                deployment_id: d.id,
                employee_id: d.candidate_id,
                employee_name: candidate?.full_name || "N/A",
                email: candidate?.email || "",
                designation: candidate?.designation || "",
                project_name: d.project_name || null,
                pay_rate: num(candidate?.pay_rate ?? d.pay_rate),
                bill_rate: num(d.bill_rate),
                deployment_status: d.status || null,
            };
        });

        return res.json({ success: true, data: result });
    } catch (error) {
        console.error("GET /api/payroll/lookup/employees:", error);
        return sendError(res, 500, "Failed to fetch employees", error.message);
    }
});

// ============================================================
// LOOKUP: PREFILL FOR ONE EMPLOYEE + MONTH
// GET /api/payroll/lookup/prefill?deployment_id=5&salary_month=2026-09
// ============================================================

router.get("/lookup/prefill", async (req, res) => {
    try {
        const deploymentId = getId(req.query.deployment_id);

        if (!deploymentId) {
            return sendError(res, 400, "Valid deployment_id is required");
        }

        let salaryMonth;

        try {
            salaryMonth = validateSalaryMonth(req.query.salary_month);
        } catch (err) {
            return sendError(res, 400, err.message);
        }

        const { data: deployment, error: deploymentError } = await supabase
            .from("deployments")
            .select("id, candidate_id, client_id, pay_rate, bill_rate, project_name, status")
            .eq("id", deploymentId)
            .maybeSingle();

        if (deploymentError) throw deploymentError;
        if (!deployment) return sendError(res, 404, "Deployment not found");

        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select(CANDIDATE_COLUMNS)
            .eq("id", deployment.candidate_id)
            .maybeSingle();

        if (candidateError) throw candidateError;
        if (!candidate) return sendError(res, 404, "Employee not found");

        const attendance = await getFreshAttendance(deployment.candidate_id, salaryMonth);

        const { data: existingPayroll, error: existingError } = await supabase
            .from("third_party_payroll")
            .select("id")
            .eq("employee_ref_id", deployment.candidate_id)
            .eq("deployment_id", deploymentId)
            .eq("salary_month", salaryMonth)
            .limit(1);

        if (existingError) throw existingError;

        const calendarDays = getDaysInMonth(salaryMonth);
        const halfDays = num(attendance?.half_days);
        const lopDays = num(attendance?.lop_days);

        const payableDays = Math.max(
            0,
            Math.min(
                attendance?.payable_days != null
                    ? num(attendance.payable_days)
                    : calendarDays - lopDays - halfDays * 0.5,
                calendarDays
            )
        );

        return res.json({
            success: true,
            data: {
                employee_id: Number(candidate.id),
                employee_name: candidate.full_name || "N/A",
                email: candidate.email || "",
                phone: candidate.phone || "",
                designation: candidate.designation || "",
                gender: candidate.gender || "",
                department: candidate.department || "",
                pan_number: candidate.pan_number || null,
                uan_number: candidate.uan_number || null,
                esic_number: candidate.esic_number || null,
                joining_date: candidate.date_of_joining || null,

                bank_name: candidate.bank_name || "",
                account_number: candidate.bank_account_number || "",
                bank_account_number: candidate.bank_account_number || "",
                ifsc_code: candidate.ifsc_code || "",

                deployment_id: Number(deployment.id),
                client_id: Number(deployment.client_id),
                candidate_id: Number(deployment.candidate_id),
                project_name: deployment.project_name || "",
                deployment_status: deployment.status || null,

                // Same source as payroll calculation: candidates.pay_rate
                pay_rate: num(candidate.pay_rate ?? deployment.pay_rate),
                bill_rate: num(deployment.bill_rate),

                attendance_id: attendance?.id ? Number(attendance.id) : null,
                attendance_status: null,
                present_days: num(attendance?.present_days),
                absent_days: num(attendance?.absent_days),
                leave_days: num(attendance?.leave_days),
                half_days: halfDays,
                lop_days: lopDays,
                payable_days: payableDays,
                overtime_hours: num(attendance?.overtime_hours),
                total_days: calendarDays,

                salary_month: salaryMonth,

                already_exists: !!(existingPayroll && existingPayroll.length > 0),
                existing_payroll_id: existingPayroll?.[0]?.id || null,
            },
        });
    } catch (error) {
        console.error("GET /api/payroll/lookup/prefill:", error);
        return sendError(res, 500, "Failed to fetch prefill data", error.message);
    }
});

// ============================================================
// EDIT PAYROLL
// PATCH /api/payroll/:id
// ============================================================

router.patch("/:id", async (req, res) => {
    try {
        const id = getId(req.params.id);

        if (!id) return sendError(res, 400, "Invalid payroll ID");

        const { data: payroll, error: payrollError } = await supabase
            .from("third_party_payroll")
            .select(`
                id, basic_salary, allowances, overtime, bonus,
                pf, esic, tax, professional_tax, lop, employer_pf,
                employer_esic, gratuity, bank_name, account_number, ifsc_code
            `)
            .eq("id", id)
            .maybeSingle();

        if (payrollError) throw payrollError;
        if (!payroll) return sendError(res, 404, "Payroll record not found");

        const numberValue = (field, fallback) => {
            const raw = req.body[field];

            if (raw === undefined || raw === null || raw === "") {
                return num(fallback);
            }

            const value = Number(raw);

            if (!Number.isFinite(value) || value < 0) {
                throw new Error(`Invalid value for ${field}`);
            }

            return value;
        };

        let v;

        try {
            v = {
                basic: numberValue("basic_salary", payroll.basic_salary),
                allowances: numberValue("allowances", payroll.allowances),
                overtime: numberValue("overtime", payroll.overtime),
                bonus: numberValue("bonus", payroll.bonus),
                pf: numberValue("pf", payroll.pf),
                esic: numberValue("esic", payroll.esic),
                tax: numberValue("tax", payroll.tax),
                pt: numberValue("professional_tax", payroll.professional_tax),
                lop: numberValue("lop", payroll.lop),
                employerPF: numberValue("employer_pf", payroll.employer_pf),
                employerESIC: numberValue("employer_esic", payroll.employer_esic),
            };
        } catch (error) {
            return sendError(res, 400, error.message);
        }

        const textValue = (field, current, transform = (s) => s) =>
            req.body[field] !== undefined
                ? req.body[field]
                    ? transform(String(req.body[field]).trim())
                    : null
                : current;

        const grossSalary = v.basic + v.allowances + v.overtime + v.bonus;
        const totalDeductions = v.pf + v.esic + v.tax + v.pt + v.lop;
        const employerContribution = v.employerPF + v.employerESIC;

        const updateData = {
            basic_salary: r2(v.basic),
            allowances: r2(v.allowances),
            overtime: r2(v.overtime),
            bonus: r2(v.bonus),
            gross_salary: r2(grossSalary),
            pf: r2(v.pf),
            esic: r2(v.esic),
            tax: r2(v.tax),
            professional_tax: r2(v.pt),
            lop: r2(v.lop),
            total_deductions: r2(totalDeductions),
            net_salary: r2(Math.max(0, grossSalary - totalDeductions)),
            employer_pf: r2(v.employerPF),
            employer_esic: r2(v.employerESIC),
            total_employer_contribution: r2(employerContribution),
            total_employer_cost: r2(
                grossSalary + employerContribution + num(payroll.gratuity)
            ),
            bank_name: textValue("bank_name", payroll.bank_name),
            account_number: textValue("account_number", payroll.account_number),
            ifsc_code: textValue("ifsc_code", payroll.ifsc_code, (s) => s.toUpperCase()),
        };

        const { data: updatedPayroll, error: updateError } = await supabase
            .from("third_party_payroll")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (updateError) throw updateError;

        return res.json({
            success: true,
            message: "Payroll updated successfully",
            data: updatedPayroll,
        });
    } catch (error) {
        console.error("PATCH /api/payroll/:id:", error);
        return sendError(res, 500, "Failed to update payroll", error.message);
    }
});

// ============================================================
// CREATE PAYROLL (single employee)
// POST /api/payroll
// { client_id, deployment_id, employee_ref_id, salary_month }
// ============================================================

router.post("/", async (req, res) => {
    try {
        const clientId = getId(req.body.client_id);
        const deploymentId = getId(req.body.deployment_id);
        const employeeId = getId(req.body.employee_ref_id);

        if (!clientId) return sendError(res, 400, "Valid client_id is required");
        if (!deploymentId) return sendError(res, 400, "Valid deployment_id is required");
        if (!employeeId) return sendError(res, 400, "Valid employee_ref_id is required");

        let salaryMonth;

        try {
            salaryMonth = validateSalaryMonth(req.body.salary_month);
        } catch (error) {
            return sendError(res, 400, error.message);
        }

        const { data: deployment, error: deploymentError } = await supabase
            .from("deployments")
            .select("id, candidate_id, client_id, status")
            .eq("id", deploymentId)
            .maybeSingle();

        if (deploymentError) throw deploymentError;
        if (!deployment) return sendError(res, 404, "Deployment not found");

        if (Number(deployment.client_id) !== clientId) {
            return sendError(res, 400, "Deployment does not belong to selected client");
        }

        if (Number(deployment.candidate_id) !== employeeId) {
            return sendError(res, 400, "Employee does not belong to selected deployment");
        }

        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select(CANDIDATE_COLUMNS)
            .eq("id", employeeId)
            .maybeSingle();

        if (candidateError) throw candidateError;
        if (!candidate) return sendError(res, 404, "Employee not found");

        if (!(num(candidate.pay_rate) > 0)) {
            return sendError(
                res,
                400,
                "Basic Salary is not configured for this employee in candidates.pay_rate"
            );
        }

        const { data: existingRows, error: existingError } = await supabase
            .from("third_party_payroll")
            .select("id")
            .eq("employee_ref_id", employeeId)
            .eq("deployment_id", deploymentId)
            .eq("salary_month", salaryMonth)
            .limit(1);

        if (existingError) throw existingError;

        if (existingRows && existingRows.length > 0) {
            return sendError(
                res,
                409,
                "Payroll already exists for this employee, deployment and month",
                { existing_payroll_id: existingRows[0].id }
            );
        }

        const attendance = await getFreshAttendance(employeeId, salaryMonth);

        if (!attendance) {
            return sendError(
                res,
                400,
                "No attendance summary found for this employee and month"
            );
        }

        const { row, meta } = calculatePayroll({
            candidate,
            attendance,
            salaryMonth,
            clientId,
            deploymentId,
        });

        const { data: insertedPayroll, error: insertError } = await supabase
            .from("third_party_payroll")
            .insert(row)
            .select()
            .single();

        if (insertError) throw insertError;

        return res.status(201).json({
            success: true,
            message: "Payroll created successfully",
            data: {
                ...insertedPayroll,
                employee_email: candidate.email || "",
                phone: candidate.phone || "",
                designation: candidate.designation || "",
                pay_rate: num(candidate.pay_rate),
                attendance: {
                    id: attendance.id || null,
                    present_days: num(attendance.present_days),
                    absent_days: num(attendance.absent_days),
                    leave_days: num(attendance.leave_days),
                    half_days: num(attendance.half_days),
                    lop_days: num(attendance.lop_days),
                    overtime_hours: num(attendance.overtime_hours),
                    payable_days: num(attendance.payable_days),
                },
                calculation: { ...meta },
            },
        });
    } catch (error) {
        console.error("POST /api/payroll:", error);
        return sendError(res, 500, "Failed to create payroll", error.message);
    }
});

// ============================================================
// GET SINGLE PAYROLL
// GET /api/payroll/:id   (keep LAST so it never shadows other routes)
// ============================================================

router.get("/:id", async (req, res) => {
    try {
        const id = getId(req.params.id);

        if (!id) return sendError(res, 400, "Invalid payroll ID");

        const { data: payroll, error } = await supabase
            .from("third_party_payroll")
            .select(PAYROLL_COLUMNS)
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;
        if (!payroll) return sendError(res, 404, "Payroll record not found");

        const { attendance } = await getAttendanceForPayroll(payroll);

        let deployment = null;

        if (payroll.deployment_id) {
            const { data, error: depError } = await supabase
                .from("deployments")
                .select(`
                    id, candidate_id, client_id, pay_rate, bill_rate,
                    project_name, billing_model, start_date, end_date, status
                `)
                .eq("id", payroll.deployment_id)
                .maybeSingle();

            if (depError) throw depError;
            deployment = data;
        }

        const clientId = payroll.client_id ?? deployment?.client_id ?? null;
        let client = null;

        if (clientId) {
            const { data, error: clientError } = await supabase
                .from("clients")
                .select("id, company_name")
                .eq("id", clientId)
                .maybeSingle();

            if (clientError) throw clientError;
            client = data;
        }

        const employeeId = payroll.employee_ref_id ?? deployment?.candidate_id ?? null;
        let candidate = null;

        if (employeeId) {
            const { data, error: candError } = await supabase
                .from("candidates")
                .select(CANDIDATE_COLUMNS)
                .eq("id", employeeId)
                .maybeSingle();

            if (candError) throw candError;
            candidate = data;
        }

        const formatted = formatPayroll(
            {
                ...payroll,
                client_id: clientId,
                employee_ref_id: employeeId,
                employee_name: payroll.employee_name || candidate?.full_name || "N/A",
            },
            attendance
        );

        Object.assign(formatted, {
            client_name: client?.company_name || "N/A",
            company_name: client?.company_name || "N/A",

            employee_email: candidate?.email || "",
            phone: candidate?.phone || "",
            designation: candidate?.designation || "",
            department: candidate?.department || "",
            joining_date: payroll.joining_date || candidate?.date_of_joining || null,
            pan_number: candidate?.pan_number || "",
            uan_number: candidate?.uan_number || "",
            esic_number: candidate?.esic_number || "",
            gender: candidate?.gender || "",

            bank_name: payroll.bank_name || candidate?.bank_name || "",
            account_number: payroll.account_number || candidate?.bank_account_number || "",
            ifsc_code: payroll.ifsc_code || candidate?.ifsc_code || "",

            project_name: deployment?.project_name || null,
            pay_rate: num(candidate?.pay_rate ?? deployment?.pay_rate),
            bill_rate: num(deployment?.bill_rate),
            billing_model: deployment?.billing_model || null,
            deployment_status: deployment?.status || null,
            start_date: deployment?.start_date || null,
            end_date: deployment?.end_date || null,
        });

        return res.json({ success: true, data: formatted });
    } catch (error) {
        console.error("GET /api/payroll/:id:", error);
        return sendError(res, 500, "Failed to fetch payroll", error.message);
    }
});

module.exports = router;