// ============================================================
// routes/payroll.js
// THIRD PARTY PAYROLL API
// ============================================================


const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

const supabase = require("../config/supabase");

const { generatePayslipPDF } = require("../utils/Payslippdf");
// ============================================================
// ENVIRONMENT
// ============================================================

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// ============================================================
// HELPERS
// ============================================================

const getId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const sendError = (res, status, message, details = null) => {
    return res.status(status).json({
        success: false,
        message,
        ...(details ? { details } : {})
    });
};

// ============================================================
// MONTH HELPERS
// ============================================================



function validateSalaryMonth(value) {
    if (!value) {
        throw new Error("salary_month is required");
    }

    const month = String(value).trim();

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        throw new Error(
            "salary_month must be in YYYY-MM format"
        );
    }

    return month;
}

function getDaysInMonth(salaryMonth) {
    const month = validateSalaryMonth(salaryMonth);

    const [year, monthNumber] = month
        .split("-")
        .map(Number);

    return new Date(
        year,
        monthNumber,
        0
    ).getDate();
}

function convertSalaryMonthToDate(salaryMonth) {
    return `${validateSalaryMonth(salaryMonth)}-01`;
}

// ============================================================
// GET ATTENDANCE FOR PAYROLL
//
// IMPORTANT:
// ONLY third_party_emp_attendance IS USED.
//
// NO:
// - third_party_attendance_approval
// - third_party_attendance_summary
// ============================================================

async function getAttendanceForPayroll(payroll) {

    let attendance = null;

    // --------------------------------------------------------
    // FIRST: attendance_id
    // --------------------------------------------------------

    if (payroll?.attendance_id) {

        const {
            data,
            error
        } = await supabase
            .from("third_party_emp_attendance")
            .select(`
                id,
                employee_name,
                billing_month,
                status,
                present_days,
                absent_days,
                leave_days,
                overtime_hours,
                created_at,
                deployment_id,
                employee_id,
                half_days,
                lop_days,
                payable_days
            `)
            .eq(
                "id",
                payroll.attendance_id
            )
            .maybeSingle();

        if (error) {
            throw error;
        }

        attendance = data;
    }

    // --------------------------------------------------------
    // FALLBACK:
    // employee + deployment + month
    // --------------------------------------------------------

    if (
        !attendance &&
        payroll?.employee_ref_id &&
        payroll?.deployment_id &&
        payroll?.salary_month
    ) {

        const {
            data,
            error
        } = await supabase
            .from("third_party_emp_attendance")
            .select(`
                id,
                employee_name,
                billing_month,
                status,
                present_days,
                absent_days,
                leave_days,
                overtime_hours,
                created_at,
                deployment_id,
                employee_id,
                half_days,
                lop_days,
                payable_days
            `)
            .eq(
                "employee_id",
                payroll.employee_ref_id
            )
            .eq(
                "deployment_id",
                payroll.deployment_id
            )
            .eq(
                "billing_month",
                payroll.salary_month
            )
            .order("id", {
                ascending: false
            })
            .limit(1);

        if (error) {
            throw error;
        }

        attendance =
            data?.[0] ||
            null;
    }

    // --------------------------------------------------------
    // FALLBACK:
    // employee + month
    // --------------------------------------------------------

    if (
        !attendance &&
        payroll?.employee_ref_id &&
        payroll?.salary_month
    ) {

        const {
            data,
            error
        } = await supabase
            .from("third_party_emp_attendance")
            .select(`
                id,
                employee_name,
                billing_month,
                status,
                present_days,
                absent_days,
                leave_days,
                overtime_hours,
                created_at,
                deployment_id,
                employee_id,
                half_days,
                lop_days,
                payable_days
            `)
            .eq(
                "employee_id",
                payroll.employee_ref_id
            )
            .eq(
                "billing_month",
                payroll.salary_month
            )
            .order("id", {
                ascending: false
            })
            .limit(1);

        if (error) {
            throw error;
        }

        attendance =
            data?.[0] ||
            null;
    }

    return {
        attendance
    };
}

// ============================================================
// FORMAT PAYROLL
// ============================================================

function formatPayroll(
    row,
    attendance = null
) {

    const totalDays = Number(
        attendance?.present_days != null ||
        attendance?.absent_days != null ||
        attendance?.leave_days != null
            ? (
                Number(attendance?.present_days || 0) +
                Number(attendance?.absent_days || 0) +
                Number(attendance?.leave_days || 0)
            )
            : getDaysInMonth(row.salary_month)
    );

    const presentDays = Number(
        attendance?.present_days ??
        0
    );

    const absentDays = Number(
        attendance?.absent_days ??
        0
    );

    const leaveDays = Number(
        attendance?.leave_days ??
        0
    );

    const halfDays = Number(
        attendance?.half_days ??
        0
    );

    const lopDays = Number(
        attendance?.lop_days ??
        0
    );

    const payableDays = Number(
        attendance?.payable_days ??
        Math.max(
            0,
            presentDays +
            leaveDays +
            halfDays * 0.5
        )
    );

    const overtimeHours = Number(
        attendance?.overtime_hours ??
        0
    );

    return {
        ...row,

        employee_id:
            row.employee_ref_id,

        employee_ref_id:
            row.employee_ref_id,

        candidate_id:
            row.employee_ref_id,

        employee_name:
            row.employee_name ||
            attendance?.employee_name ||
            "N/A",

        client_id:
            row.client_id,

        deployment_id:
            row.deployment_id,

        attendance_id:
            row.attendance_id,

        total_days:
            totalDays,

        present_days:
            presentDays,

        absent_days:
            absentDays,

        leave_days:
            leaveDays,

        half_days:
            halfDays,

        lop_days:
            lopDays,

        payable_days:
            payableDays,

        overtime_hours:
            overtimeHours,

        attendance_status:
            attendance?.status ||
            null,

        attendance_created_at:
            attendance?.created_at ||
            null,

        attendance_billing_month:
            attendance?.billing_month ||
            null,

        salary_month:
            row.salary_month,

        basic_salary:
            Number(
                row.basic_salary || 0
            ),

        allowances:
            Number(
                row.allowances || 0
            ),

        overtime:
            Number(
                row.overtime || 0
            ),

        overtime_amount:
            Number(
                row.overtime || 0
            ),

        bonus:
            Number(
                row.bonus || 0
            ),

        gross_salary:
            Number(
                row.gross_salary || 0
            ),

        pf:
            Number(
                row.pf || 0
            ),

        employee_pf:
            Number(
                row.pf || 0
            ),

        esic:
            Number(
                row.esic || 0
            ),

        employee_esic:
            Number(
                row.esic || 0
            ),

        tax:
            Number(
                row.tax || 0
            ),

        tds:
            Number(
                row.tax || 0
            ),

        professional_tax:
            Number(
                row.professional_tax || 0
            ),

        lop:
            Number(
                row.lop || 0
            ),

        lop_deduction:
            Number(
                row.lop || 0
            ),

        total_deductions:
            Number(
                row.total_deductions || 0
            ),

        net_salary:
            Number(
                row.net_salary || 0
            ),

        employer_pf:
            Number(
                row.employer_pf || 0
            ),

        employer_esic:
            Number(
                row.employer_esic || 0
            ),

        total_employer_contribution:
            Number(
                row.total_employer_contribution || 0
            ),

        total_employer_cost:
            Number(
                row.total_employer_cost || 0
            ),

        status:
            row.status ||
            "Pending"
    };
}
// ============================================================
// GET ALL PAYROLL
// GET /api/payroll
// GET /api/payroll?client_id=1
// GET /api/payroll?salary_month=2026-08
// ============================================================

router.get("/", async (req, res) => {
    try {

        let clientId = null;
        let salaryMonth = null;

        // --------------------------------------------------------
        // CLIENT FILTER
        // --------------------------------------------------------

        if (
            req.query.client_id !== undefined
        ) {

            clientId =
                getId(
                    req.query.client_id
                );

            if (!clientId) {
                return sendError(
                    res,
                    400,
                    "Invalid client_id"
                );
            }
        }

        // --------------------------------------------------------
        // MONTH FILTER
        // --------------------------------------------------------

        if (
            req.query.salary_month
        ) {

            try {

                salaryMonth =
                    validateSalaryMonth(
                        req.query.salary_month
                    );

            } catch (error) {

                return sendError(
                    res,
                    400,
                    error.message
                );
            }
        }

        // --------------------------------------------------------
        // PAYROLL QUERY
        // --------------------------------------------------------

        let query =
            supabase
                .from("third_party_payroll")
                .select(`
                    id,
                    employee_name,
                    salary_month,
                    basic_salary,
                    allowances,
                    overtime,
                    bonus,
                    gross_salary,
                    pf,
                    esic,
                    tax,
                    lop,
                    net_salary,
                    bank_name,
                    account_number,
                    ifsc_code,
                    created_at,
                    employee_ref_id,
                    attendance_id,
                    deployment_id,
                    payroll_batch_id,
                    client_id,
                    professional_tax,
                    total_deductions,
                    employer_pf,
                    employer_esic,
                    total_employer_contribution,
                    total_employer_cost,
                    hra,
                    conveyance,
                    medical_allowance,
                    other_allowance,
                    gratuity,
                    joining_date,
                    pran,
                    pf_wages
                `)
                .order("id", {
                    ascending: false
                });

        // --------------------------------------------------------
        // APPLY MONTH FILTER
        // --------------------------------------------------------

        if (salaryMonth) {

            query =
                query.eq(
                    "salary_month",
                    salaryMonth
                );
        }

        // --------------------------------------------------------
        // APPLY CLIENT FILTER
        // --------------------------------------------------------

        if (clientId) {

            query =
                query.eq(
                    "client_id",
                    clientId
                );
        }

        // --------------------------------------------------------
        // EXECUTE QUERY
        // --------------------------------------------------------

        const {
            data,
            error
        } = await query;

        if (error) {
            throw error;
        }

        // --------------------------------------------------------
        // ENRICH PAYROLL
        // --------------------------------------------------------

        const records = [];

        for (const row of data || []) {

            try {

                const {
                    attendance
                } =
                    await getAttendanceForPayroll(
                        row
                    );

                records.push(
                    formatPayroll(
                        row,
                        attendance
                    )
                );

            } catch (error) {

                console.error(
                    `Attendance enrichment failed for payroll ${row.id}:`,
                    error.message
                );

                records.push(
                    formatPayroll(
                        row,
                        null
                    )
                );
            }
        }

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.json({

            success: true,

            count:
                records.length,

            data:
                records,

            payroll:
                records
        });

    } catch (error) {

        console.error(
            "GET /api/payroll ERROR:",
            error
        );

        return sendError(
            res,
            500,
            "Failed to fetch payroll",
            error.message
        );
    }
});


// ============================================================
// GET SINGLE PAYROLL
// GET /api/payroll/:id
// ============================================================

router.get("/:id", async (req, res) => {

    try {

        const id =
            getId(
                req.params.id
            );

        if (!id) {
            return sendError(
                res,
                400,
                "Invalid payroll ID"
            );
        }

        // --------------------------------------------------------
        // PAYROLL
        // --------------------------------------------------------

        const {
            data: payroll,
            error
        } = await supabase
            .from("third_party_payroll")
            .select(`
                id,
                employee_name,
                salary_month,
                basic_salary,
                allowances,
                overtime,
                bonus,
                gross_salary,
                pf,
                esic,
                tax,
                lop,
                net_salary,
                bank_name,
                account_number,
                ifsc_code,
                created_at,
                employee_ref_id,
                attendance_id,
                deployment_id,
                payroll_batch_id,
                client_id,
                professional_tax,
                total_deductions,
                employer_pf,
                employer_esic,
                total_employer_contribution,
                total_employer_cost,
                hra,
                conveyance,
                medical_allowance,
                other_allowance,
                gratuity,
                joining_date,
                pran,
                pf_wages
            `)
            .eq(
                "id",
                id
            )
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!payroll) {
            return sendError(
                res,
                404,
                "Payroll record not found"
            );
        }

        // --------------------------------------------------------
        // ATTENDANCE
        // --------------------------------------------------------

        const {
            attendance
        } =
            await getAttendanceForPayroll(
                payroll
            );

        // --------------------------------------------------------
        // DEPLOYMENT
        // --------------------------------------------------------

        let deployment = null;

        if (
            payroll.deployment_id
        ) {

            const {
                data,
                error
            } = await supabase
                .from("deployments")
                .select(`
                    id,
                    candidate_id,
                    client_id,
                    pay_rate,
                    bill_rate,
                    project_name,
                    billing_model,
                    start_date,
                    end_date,
                    status
                `)
                .eq(
                    "id",
                    payroll.deployment_id
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            deployment = data;
        }

        // --------------------------------------------------------
        // CLIENT
        // --------------------------------------------------------

        let client = null;

        const clientId =
            payroll.client_id ??
            deployment?.client_id ??
            null;

        if (clientId) {

            const {
                data,
                error
            } = await supabase
                .from("clients")
                .select(`
                    id,
                    company_name
                `)
                .eq(
                    "id",
                    clientId
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            client = data;
        }

        // --------------------------------------------------------
        // CANDIDATE
        // --------------------------------------------------------

        let candidate = null;

        const employeeId =
            payroll.employee_ref_id ??
            deployment?.candidate_id ??
            null;

        if (employeeId) {

            const {
                data,
                error
            } = await supabase
                .from("candidates")
                .select(`
                    id,
                    full_name,
                    email,
                    phone,
                    designation,
                    department,
                    date_of_joining,
                    bank_name,
                    bank_account_number,
                    ifsc_code,
                    pan_number,
                    uan_number,
                    esic_number,
                    gender,
                    pay_rate
                `)
                .eq(
                    "id",
                    employeeId
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            candidate = data;
        }

        // --------------------------------------------------------
        // FORMAT
        // --------------------------------------------------------

        const formatted =
            formatPayroll(
                {
                    ...payroll,

                    client_id:
                        clientId,

                    employee_ref_id:
                        employeeId,

                    employee_name:
                        payroll.employee_name ||
                        candidate?.full_name ||
                        attendance?.employee_name ||
                        "N/A"
                },
                attendance
            );

        // --------------------------------------------------------
        // ADD CLIENT DETAILS
        // --------------------------------------------------------

        formatted.client_name =
            client?.company_name ||
            "N/A";

        formatted.company_name =
            client?.company_name ||
            "N/A";

        // --------------------------------------------------------
        // ADD EMPLOYEE DETAILS
        // --------------------------------------------------------

        formatted.employee_email =
            candidate?.email ||
            "";

        formatted.phone =
            candidate?.phone ||
            "";

        formatted.designation =
            candidate?.designation ||
            "";

        formatted.department =
            candidate?.department ||
            "";

        formatted.joining_date =
            payroll.joining_date ||
            candidate?.date_of_joining ||
            null;

        formatted.pan_number =
            candidate?.pan_number ||
            "";

        formatted.uan_number =
            candidate?.uan_number ||
            "";

        formatted.esic_number =
            candidate?.esic_number ||
            "";

        formatted.gender =
            candidate?.gender ||
            "";

        // --------------------------------------------------------
        // BANK DETAILS
        // --------------------------------------------------------

        formatted.bank_name =
            payroll.bank_name ||
            candidate?.bank_name ||
            "";

        formatted.account_number =
            payroll.account_number ||
            candidate?.bank_account_number ||
            "";

        formatted.ifsc_code =
            payroll.ifsc_code ||
            candidate?.ifsc_code ||
            "";

        // --------------------------------------------------------
        // DEPLOYMENT DETAILS
        // --------------------------------------------------------

        formatted.project_name =
            deployment?.project_name ||
            null;

        formatted.pay_rate =
            Number(
                deployment?.pay_rate ||
                candidate?.pay_rate ||
                0
            );

        formatted.bill_rate =
            Number(
                deployment?.bill_rate ||
                0
            );

        formatted.billing_model =
            deployment?.billing_model ||
            null;

        formatted.deployment_status =
            deployment?.status ||
            null;

        formatted.start_date =
            deployment?.start_date ||
            null;

        formatted.end_date =
            deployment?.end_date ||
            null;

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.json({

            success: true,

            data:
                formatted
        });

    } catch (error) {

        console.error(
            "GET /api/payroll/:id:",
            error
        );

        return sendError(
            res,
            500,
            "Failed to fetch payroll",
            error.message
        );
    }
});

// ============================================================
// GENERATE PAYROLL
//
// POST /api/payroll/generate
//
// {
//   client_id: 1,
//   salary_month: "2026-08"
// }
//
// Salary source:
// candidates.pay_rate
//
// Attendance source:
// third_party_emp_attendance
//
// Deployment pay_rate is NOT used for payroll.
// Deployment bill_rate is NOT used for employee salary.
// ============================================================

router.post("/generate", async (req, res) => {

    try {

        // ========================================================
        // CLIENT ID
        // ========================================================

        const clientId =
            getId(
                req.body.client_id
            );

        if (!clientId) {

            return sendError(
                res,
                400,
                "Valid client_id is required"
            );
        }

        // ========================================================
        // SALARY MONTH
        // ========================================================

        let validMonth;

        try {

            validMonth =
                validateSalaryMonth(
                    req.body.salary_month
                );

        } catch (error) {

            return sendError(
                res,
                400,
                error.message
            );
        }

        // ========================================================
        // CLIENT
        // ========================================================

        const {
            data: client,
            error: clientError
        } = await supabase
            .from("clients")
            .select(`
                id,
                company_name
            `)
            .eq(
                "id",
                clientId
            )
            .maybeSingle();

        if (clientError) {
            throw clientError;
        }

        if (!client) {

            return sendError(
                res,
                404,
                "Client not found"
            );
        }

        // ========================================================
        // ATTENDANCE
        //
        // Source:
        // third_party_emp_attendance
        //
        // No attendance approval table.
        // ========================================================

        const {
            data: attendanceRows,
            error: attendanceError
        } = await supabase
            .from("third_party_emp_attendance")
            .select(`
                id,
                employee_name,
                billing_month,
                status,
                present_days,
                absent_days,
                leave_days,
                overtime_hours,
                created_at,
                deployment_id,
                employee_id,
                half_days,
                lop_days,
                payable_days
            `)
            .eq(
                "billing_month",
                validMonth
            );

        if (attendanceError) {
            throw attendanceError;
        }

        // ========================================================
        // NO ATTENDANCE
        // ========================================================

        if (
            !attendanceRows ||
            attendanceRows.length === 0
        ) {

            return res.json({

                success: true,

                message:
                    `No attendance found for ${validMonth}`,

                client_id:
                    clientId,

                client_name:
                    client.company_name,

                salary_month:
                    validMonth,

                records_generated:
                    0,

                data: []
            });
        }

        // ========================================================
        // CALENDAR DAYS
        // ========================================================

        const calendarDays =
            getDaysInMonth(
                validMonth
            );

        // ========================================================
        // OVERTIME DIVISOR
        //
        // Existing project rule:
        // 26 working days
        // ========================================================

        const salaryDivisor = 26;

        const generated = [];

        const skipped = [];

        // ========================================================
        // PROCESS EACH ATTENDANCE RECORD
        // ========================================================

        for (
            const attendance of attendanceRows
        ) {

            try {

                // ==================================================
                // EMPLOYEE ID
                // ==================================================

                const employeeId =
                    getId(
                        attendance.employee_id
                    );

                if (!employeeId) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        reason:
                            "Employee ID missing"
                    });

                    continue;
                }

                // ==================================================
                // DEPLOYMENT ID
                // ==================================================

                const deploymentId =
                    getId(
                        attendance.deployment_id
                    );

                if (!deploymentId) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Deployment ID missing"
                    });

                    continue;
                }

                // ==================================================
                // DEPLOYMENT
                //
                // pay_rate is intentionally NOT selected.
                //
                // Employee salary comes from:
                // candidates.pay_rate
                // ==================================================

                const {
                    data: deployment,
                    error: deploymentError
                } = await supabase
                    .from("deployments")
                    .select(`
                        id,
                        candidate_id,
                        client_id,
                        bill_rate,
                        project_name,
                        billing_model,
                        status
                    `)
                    .eq(
                        "id",
                        deploymentId
                    )
                    .maybeSingle();

                if (deploymentError) {
                    throw deploymentError;
                }

                if (!deployment) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Deployment not found"
                    });

                    continue;
                }

                // ==================================================
                // CLIENT VALIDATION
                // ==================================================

                if (
                    Number(
                        deployment.client_id
                    ) !== clientId
                ) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Attendance deployment does not belong to selected client"
                    });

                    continue;
                }

                // ==================================================
                // EMPLOYEE VALIDATION
                // ==================================================

                if (
                    Number(
                        deployment.candidate_id
                    ) !== employeeId
                ) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Employee does not belong to deployment"
                    });

                    continue;
                }

                // ==================================================
                // ACTIVE DEPLOYMENT
                // ==================================================

                if (
                    deployment.status &&
                    String(
                        deployment.status
                    )
                        .trim()
                        .toLowerCase() !==
                    "active"
                ) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Deployment is not Active"
                    });

                    continue;
                }

                // ==================================================
                // DUPLICATE PAYROLL CHECK
                // ==================================================

                const {
                    data: existingRows,
                    error: existingError
                } = await supabase
                    .from(
                        "third_party_payroll"
                    )
                    .select(`
                        id,
                        status
                    `)
                    .eq(
                        "employee_ref_id",
                        employeeId
                    )
                    .eq(
                        "deployment_id",
                        deploymentId
                    )
                    .eq(
                        "salary_month",
                        validMonth
                    )
                    .limit(1);

                if (existingError) {
                    throw existingError;
                }

                if (
                    existingRows &&
                    existingRows.length > 0
                ) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        payroll_id:
                            existingRows[0].id,

                        reason:
                            "Payroll already exists"
                    });

                    continue;
                }

                // ==================================================
                // CANDIDATE
                //
                // pay_rate is the ONLY salary source.
                // ==================================================

                const {
                    data: candidate,
                    error: candidateError
                } = await supabase
                    .from("candidates")
                    .select(`
                        id,
                        full_name,
                        email,
                        phone,
                        designation,
                        gender,
                        department,
                        pay_rate,
                        bank_account_number,
                        bank_name,
                        ifsc_code,
                        pan_number,
                        uan_number,
                        esic_number,
                        date_of_joining
                    `)
                    .eq(
                        "id",
                        employeeId
                    )
                    .maybeSingle();

                if (candidateError) {
                    throw candidateError;
                }

                if (!candidate) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Candidate not found"
                    });

                    continue;
                }

                // ==================================================
                // BASIC SALARY
                //
                // IMPORTANT:
                //
                // candidates.pay_rate
                // is the employee's monthly basic salary.
                //
                // deployment.pay_rate is NOT used.
                // ==================================================

                const basicSalary =
                    Number(
                        candidate.pay_rate || 0
                    );

                if (
                    !Number.isFinite(
                        basicSalary
                    ) ||
                    basicSalary <= 0
                ) {

                    skipped.push({

                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Invalid employee pay rate in candidates table"
                    });

                    continue;
                }

                // ==================================================
                // ATTENDANCE VALUES
                // ==================================================

                const totalDays =
                    calendarDays;

                const presentDays =
                    Number(
                        attendance.present_days || 0
                    );

                const absentDays =
                    Number(
                        attendance.absent_days || 0
                    );

                const leaveDays =
                    Number(
                        attendance.leave_days || 0
                    );

                const halfDays =
                    Number(
                        attendance.half_days || 0
                    );

                const overtimeHours =
                    Math.max(
                        0,
                        Number(
                            attendance.overtime_hours || 0
                        )
                    );

                const lopDays =
                    Math.max(
                        0,
                        Number(
                            attendance.lop_days || 0
                        )
                    );

                // ==================================================
                // PAYABLE DAYS
                //
                // Prefer attendance.payable_days.
                //
                // If unavailable, calculate from:
                // present + leave + half days
                // ==================================================

                let payableDays =
                    Number(
                        attendance.payable_days
                    );

                if (
                    !Number.isFinite(
                        payableDays
                    )
                ) {

                    payableDays =
                        Math.max(
                            0,
                            presentDays +
                            leaveDays +
                            (
                                halfDays * 0.5
                            )
                        );
                }

                payableDays =
                    Math.min(
                        totalDays,
                        Math.max(
                            0,
                            payableDays
                        )
                    );

                // ==================================================
                // SALARY STRUCTURE
                //
                // Basic       = candidates.pay_rate
                // HRA         = 50% of Basic
                // Conveyance  = ₹1200
                // Medical     = ₹1000
                // Other       = ₹0
                //
                // These are system-defined payroll components.
                // ==================================================

                const monthlyBasic =
                    Math.round(
                        basicSalary
                    );

                const monthlyHRA =
                    Math.round(
                        monthlyBasic *
                        0.5
                    );

                const monthlyConveyance =
                    1200;

                const monthlyMedicalAllowance =
                    1000;

                const monthlyOtherAllowance =
                    0;

                // ==================================================
                // EARNED BASIC
                // ==================================================

                const earnBasicSalary =
                    Math.round(
                        (
                            monthlyBasic /
                            totalDays
                        ) *
                        payableDays
                    );

                // ==================================================
                // EARNED HRA
                // ==================================================

                const earnHRA =
                    Math.round(
                        (
                            monthlyHRA /
                            totalDays
                        ) *
                        payableDays
                    );

                // ==================================================
                // EARNED CONVEYANCE
                // ==================================================

                const earnConveyance =
                    Math.round(
                        (
                            monthlyConveyance /
                            totalDays
                        ) *
                        payableDays
                    );

                // ==================================================
                // EARNED MEDICAL
                // ==================================================

                const earnMedicalAllowance =
                    Math.round(
                        (
                            monthlyMedicalAllowance /
                            totalDays
                        ) *
                        payableDays
                    );

                // ==================================================
                // EARNED OTHER ALLOWANCE
                // ==================================================

                const earnOtherAllowance =
                    Math.round(
                        (
                            monthlyOtherAllowance /
                            totalDays
                        ) *
                        payableDays
                    );

                // ==================================================
                // OVERTIME
                //
                // Basic / 26 / 8 × 1.5 × OT hours
                // ==================================================

                const normalHourlyRate =
                    monthlyBasic /
                    salaryDivisor /
                    8;

                const overtimeRate =
                    normalHourlyRate *
                    1.5;

                const overtimeAmount =
                    Math.round(
                        overtimeHours *
                        overtimeRate
                    );

                // ==================================================
                // DEPARTMENT
                // ==================================================

                const department =
                    String(
                        candidate.department || ""
                    )
                        .trim()
                        .toLowerCase();

                // ==================================================
                // EARNED FIXED GROSS
                //
                // Does not include overtime or bonus.
                // ==================================================

                const earnedFixedGross =
                    earnBasicSalary +
                    earnHRA +
                    earnConveyance +
                    earnMedicalAllowance +
                    earnOtherAllowance;

                // ==================================================
                // BONUS
                //
                // Existing project rule:
                // Admin / Accounts = 8.33%
                // ==================================================

                const bonus =
                    (
                        department === "admin" ||
                        department === "accounts"
                    )
                        ? Math.round(
                            earnedFixedGross *
                            0.0833
                        )
                        : 0;

                // ==================================================
                // GROSS SALARY
                // ==================================================

                const grossSalary =
                    earnedFixedGross +
                    overtimeAmount +
                    bonus;

                // ==================================================
                // PF WAGES
                //
                // Gross excluding HRA.
                //
                // Overtime and bonus remain included.
                // ==================================================

                const pfWages =
                    Math.max(
                        0,
                        grossSalary -
                        earnHRA
                    );

                // ==================================================
                // PF BASE
                //
                // Maximum PF wage considered = ₹15,000.
                // ==================================================

                const pfBase =
                    Math.min(
                        pfWages,
                        15000
                    );

                // ==================================================
                // EMPLOYEE PF
                //
                // 12%
                // ==================================================

                const employeePF =
                    Math.round(
                        pfBase *
                        0.12
                    );

                // ==================================================
                // ESIC APPLICABILITY
                //
                // Candidate must have ESIC number.
                // ==================================================

                const esicApplicable =
                    !!candidate.esic_number;

                // ==================================================
                // EMPLOYEE ESIC
                //
                // 0.75% when gross <= ₹21,000.
                // ==================================================

                const employeeESIC =
                    (
                        esicApplicable &&
                        grossSalary <= 21000
                    )
                        ? Math.round(
                            grossSalary *
                            0.0075
                        )
                        : 0;

                // ==================================================
                // PROFESSIONAL TAX
                //
                // ₹200 when gross > ₹25,000.
                // ==================================================

                const gender =
                    String(
                        candidate.gender || ""
                    )
                        .trim()
                        .toLowerCase();

                const professionalTax =
                    (
                        grossSalary > 25000 &&
                        (
                            gender === "female" ||
                            gender === "male"
                        )
                    )
                        ? 200
                        : 0;

                // ==================================================
                // TDS
                //
                // Currently zero.
                // ==================================================

                const taxTds =
                    0;

                // ==================================================
                // LOP
                //
                // Payable days already prorate salary.
                // Therefore do not deduct LOP again.
                // ==================================================

                const lopDeduction =
                    0;

                // ==================================================
                // TOTAL EMPLOYEE DEDUCTIONS
                // ==================================================

                const totalDeductions =
                    employeePF +
                    employeeESIC +
                    taxTds +
                    professionalTax +
                    lopDeduction;

                // ==================================================
                // NET SALARY
                // ==================================================

                const netSalary =
                    Math.max(
                        0,
                        grossSalary -
                        totalDeductions
                    );

                // ==================================================
                // GRATUITY
                //
                // 4.81% of earned basic.
                // ==================================================

                const gratuity =
                    Math.round(
                        earnBasicSalary *
                        0.0481
                    );

                // ==================================================
                // EMPLOYER PF
                //
                // Same PF base and 12%.
                // ==================================================

                const employerPF =
                    Math.round(
                        pfBase *
                        0.12
                    );

                // ==================================================
                // EMPLOYER ESIC
                //
                // 3.25% when ESIC applicable
                // and gross <= ₹21,000.
                // ==================================================

                const employerESIC =
                    (
                        esicApplicable &&
                        grossSalary <= 21000
                    )
                        ? Math.round(
                            grossSalary *
                            0.0325
                        )
                        : 0;

                // ==================================================
                // TOTAL EMPLOYER CONTRIBUTION
                // ==================================================

                const totalEmployerContribution =
                    employerPF +
                    employerESIC;

                // ==================================================
                // TOTAL EMPLOYER COST
                // ==================================================

                const totalEmployerCost =
                    grossSalary +
                    totalEmployerContribution +
                    gratuity;

                // ==================================================
                // PAYROLL OBJECT
                // ==================================================

                generated.push({

                    // ------------------------------------------------
                    // EMPLOYEE
                    // ------------------------------------------------

                    employee_name:
                        candidate.full_name ||
                        attendance.employee_name,

                    employee_ref_id:
                        employeeId,

                    // ------------------------------------------------
                    // MONTH
                    // ------------------------------------------------

                    salary_month:
                        validMonth,

                    // ------------------------------------------------
                    // BASIC
                    // ------------------------------------------------

                    basic_salary:
                        Number(
                            earnBasicSalary.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // TOTAL ALLOWANCES
                    //
                    // HRA + Conveyance + Medical + Other
                    // ------------------------------------------------

                    allowances:
                        Number(
                            (
                                earnHRA +
                                earnConveyance +
                                earnMedicalAllowance +
                                earnOtherAllowance
                            ).toFixed(2)
                        ),

                    // ------------------------------------------------
                    // HRA
                    // ------------------------------------------------

                    hra:
                        Number(
                            earnHRA.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // CONVEYANCE
                    // ------------------------------------------------

                    conveyance:
                        Number(
                            earnConveyance.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // MEDICAL
                    // ------------------------------------------------

                    medical_allowance:
                        Number(
                            earnMedicalAllowance.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // OTHER
                    // ------------------------------------------------

                    other_allowance:
                        Number(
                            earnOtherAllowance.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // OVERTIME
                    // ------------------------------------------------

                    overtime:
                        Number(
                            overtimeAmount.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // BONUS
                    // ------------------------------------------------

                    bonus:
                        Number(
                            bonus.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // GROSS
                    // ------------------------------------------------

                    gross_salary:
                        Number(
                            grossSalary.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // EMPLOYEE PF
                    // ------------------------------------------------

                    pf:
                        Number(
                            employeePF.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // EMPLOYEE ESIC
                    // ------------------------------------------------

                    esic:
                        Number(
                            employeeESIC.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // TDS
                    // ------------------------------------------------

                    tax:
                        Number(
                            taxTds.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // PROFESSIONAL TAX
                    // ------------------------------------------------

                    professional_tax:
                        Number(
                            professionalTax.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // LOP
                    // ------------------------------------------------

                    lop:
                        Number(
                            lopDeduction.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // TOTAL DEDUCTIONS
                    // ------------------------------------------------

                    total_deductions:
                        Number(
                            totalDeductions.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // NET SALARY
                    // ------------------------------------------------

                    net_salary:
                        Number(
                            netSalary.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // EMPLOYER PF
                    // ------------------------------------------------

                    employer_pf:
                        Number(
                            employerPF.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // EMPLOYER ESIC
                    // ------------------------------------------------

                    employer_esic:
                        Number(
                            employerESIC.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // TOTAL EMPLOYER CONTRIBUTION
                    // ------------------------------------------------

                    total_employer_contribution:
                        Number(
                            totalEmployerContribution.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // GRATUITY
                    // ------------------------------------------------

                    gratuity:
                        Number(
                            gratuity.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // TOTAL EMPLOYER COST
                    // ------------------------------------------------

                    total_employer_cost:
                        Number(
                            totalEmployerCost.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // PF WAGES
                    // ------------------------------------------------

                    pf_wages:
                        Number(
                            pfWages.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // JOINING DATE
                    // ------------------------------------------------

                    joining_date:
                        candidate.date_of_joining ||
                        null,

                    // ------------------------------------------------
                    // PRAN
                    //
                    // Do NOT use UAN as PRAN.
                    // Candidate table currently has no PRAN field.
                    // ------------------------------------------------

                    pran:
                        null,

                    // ------------------------------------------------
                    // BANK
                    // ------------------------------------------------

                    bank_name:
                        candidate.bank_name ||
                        null,

                    account_number:
                        candidate.bank_account_number ||
                        null,

                    ifsc_code:
                        candidate.ifsc_code ||
                        null,

                    // ------------------------------------------------
                    // RELATIONSHIPS
                    // ------------------------------------------------

                    attendance_id:
                        attendance.id,

                    deployment_id:
                        deploymentId,

                    payroll_batch_id:
                        null,

                    client_id:
                        clientId
                });

            } catch (error) {

                console.error(
                    `Payroll generation failed for attendance ${attendance.id}:`,
                    error
                );

                skipped.push({

                    attendance_id:
                        attendance.id,

                    employee_id:
                        attendance.employee_id,

                    reason:
                        error.message
                });
            }
        }

        // ========================================================
        // NOTHING GENERATED
        // ========================================================

        if (
            generated.length === 0
        ) {

            return res.json({

                success: true,

                message:
                    "No new payroll records were generated",

                client_id:
                    clientId,

                client_name:
                    client.company_name,

                salary_month:
                    validMonth,

                records_generated:
                    0,

                records_skipped:
                    skipped.length,

                data: [],

                skipped
            });
        }

        // ========================================================
        // INSERT PAYROLL
        // ========================================================

        const {
            data: insertedPayroll,
            error: insertError
        } = await supabase
            .from(
                "third_party_payroll"
            )
            .insert(
                generated
            )
            .select();

        if (insertError) {
            throw insertError;
        }

        // ========================================================
        // RESPONSE
        // ========================================================

        return res.status(201).json({

            success: true,

            message:
                `Payroll generated successfully for ${validMonth}`,

            salary_month:
                validMonth,

            calendar_days:
                calendarDays,

            salary_divisor:
                salaryDivisor,

            client_id:
                clientId,

            client_name:
                client.company_name,

            records_generated:
                insertedPayroll?.length || 0,

            records_skipped:
                skipped.length,

            data:
                insertedPayroll || [],

            skipped
        });

    } catch (error) {

        console.error(
            "POST /api/payroll/generate:",
            error
        );

        return sendError(
            res,
            500,
            "Payroll generation failed",
            error.message
        );
    }
});
// ============================================================
// UPDATE PAYROLL STATUS
//
// Pending -> Approved
// Approved -> Locked
// Locked -> Cannot change
//
// NO ATTENDANCE APPROVAL CHECK
// ============================================================

router.patch(
    "/:id/status",
    async (req, res) => {

        try {

            const id =
                getId(
                    req.params.id
                );

            const status =
                String(
                    req.body.status || ""
                ).trim();

            if (!id) {
                return sendError(
                    res,
                    400,
                    "Invalid payroll ID"
                );
            }

            const allowedStatuses = [
                "Pending",
                "Approved",
                "Locked"
            ];

            if (
                !allowedStatuses.includes(
                    status
                )
            ) {

                return sendError(
                    res,
                    400,
                    "Invalid payroll status"
                );
            }

            // ----------------------------------------------------
            // GET PAYROLL
            // ----------------------------------------------------

            const {
                data: payroll,
                error
            } = await supabase
                .from(
                    "third_party_payroll"
                )
                .select(`
                    id,
                    employee_name,
                    employee_ref_id,
                    attendance_id,
                    deployment_id,
                    client_id,
                    salary_month,
                    basic_salary,
                    allowances,
                    overtime,
                    bonus,
                    gross_salary,
                    pf,
                    esic,
                    tax,
                    professional_tax,
                    lop,
                    total_deductions,
                    net_salary,
                    employer_pf,
                    employer_esic,
                    total_employer_contribution,
                    total_employer_cost,
                    status
                `)
                .eq(
                    "id",
                    id
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (!payroll) {

                return sendError(
                    res,
                    404,
                    "Payroll record not found"
                );
            }

            const currentStatus =
                payroll.status ||
                "Pending";

            // ----------------------------------------------------
            // LOCKED
            // ----------------------------------------------------

            if (
                currentStatus ===
                "Locked"
            ) {

                return sendError(
                    res,
                    400,
                    "Cannot modify a Locked payroll record"
                );
            }

            // ----------------------------------------------------
            // STATUS FLOW
            // ----------------------------------------------------

            if (
                currentStatus ===
                "Pending" &&
                status !== "Approved"
            ) {

                return sendError(
                    res,
                    400,
                    "Pending payroll can only be changed to Approved"
                );
            }

            if (
                currentStatus ===
                "Approved" &&
                status !== "Locked"
            ) {

                return sendError(
                    res,
                    400,
                    "Approved payroll can only be changed to Locked"
                );
            }

            // ----------------------------------------------------
            // NO ATTENDANCE APPROVAL CHECK
            //
            // Payroll can be approved directly.
            // Attendance data comes from
            // third_party_emp_attendance only.
            // ----------------------------------------------------

            // ----------------------------------------------------
            // RECALCULATE
            // ----------------------------------------------------

            let updateData = {
                status
            };

            if (
                currentStatus ===
                "Pending" &&
                status === "Approved"
            ) {

                const grossSalary =
                    Number(
                        payroll.gross_salary || 0
                    );

                const employeePF =
                    Number(
                        payroll.pf || 0
                    );

                const employeeESIC =
                    Number(
                        payroll.esic || 0
                    );

                const tax =
                    Number(
                        payroll.tax || 0
                    );

                const professionalTax =
                    Number(
                        payroll.professional_tax || 0
                    );

                const lop =
                    Number(
                        payroll.lop || 0
                    );

                const totalDeductions =
                    employeePF +
                    employeeESIC +
                    tax +
                    professionalTax +
                    lop;

                const netSalary =
                    Math.max(
                        0,
                        grossSalary -
                        totalDeductions
                    );

                const employerPF =
                    Number(
                        payroll.employer_pf || 0
                    );

                const employerESIC =
                    Number(
                        payroll.employer_esic || 0
                    );

                const employerContribution =
                    employerPF +
                    employerESIC;

                const employerCost =
                    grossSalary +
                    employerContribution;

                updateData = {

                    status:
                        "Approved",

                    total_deductions:
                        Number(
                            totalDeductions.toFixed(2)
                        ),

                    net_salary:
                        Number(
                            netSalary.toFixed(2)
                        ),

                    employer_pf:
                        Number(
                            employerPF.toFixed(2)
                        ),

                    employer_esic:
                        Number(
                            employerESIC.toFixed(2)
                        ),

                    total_employer_contribution:
                        Number(
                            employerContribution.toFixed(2)
                        ),

                    total_employer_cost:
                        Number(
                            employerCost.toFixed(2)
                        )
                };
            }

            // ----------------------------------------------------
            // UPDATE
            // ----------------------------------------------------

            const {
                data: updatedPayroll,
                error: updateError
            } = await supabase
                .from(
                    "third_party_payroll"
                )
                .update(
                    updateData
                )
                .eq(
                    "id",
                    id
                )
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            // ----------------------------------------------------
            // DEDUCTION RECORD
            // ----------------------------------------------------

            if (
                currentStatus ===
                "Pending" &&
                status ===
                "Approved"
            ) {

                const {
                    data: existingDeduction,
                    error:
                        deductionCheckError
                } = await supabase
                    .from("deductions")
                    .select("id")
                    .eq(
                        "payroll_id",
                        payroll.id
                    )
                    .limit(1);

                if (deductionCheckError) {
                    throw deductionCheckError;
                }

                if (
                    !existingDeduction ||
                    existingDeduction.length === 0
                ) {

                    // ------------------------------------------------
                    // GET LOP FROM SAME ATTENDANCE TABLE
                    // ------------------------------------------------

                    let attendance = null;

                    if (
                        payroll.attendance_id
                    ) {

                        const {
                            data,
                            error:
                                attendanceError
                        } = await supabase
                            .from(
                                "third_party_emp_attendance"
                            )
                            .select(
                                "lop_days"
                            )
                            .eq(
                                "id",
                                payroll.attendance_id
                            )
                            .maybeSingle();

                        if (attendanceError) {
                            throw attendanceError;
                        }

                        attendance = data;
                    }

                    // ------------------------------------------------
                    // FALLBACK
                    // ------------------------------------------------

                    if (!attendance) {

                        const {
                            data,
                            error:
                                attendanceError
                        } = await supabase
                            .from(
                                "third_party_emp_attendance"
                            )
                            .select(
                                "lop_days"
                            )
                            .eq(
                                "employee_id",
                                payroll.employee_ref_id
                            )
                            .eq(
                                "deployment_id",
                                payroll.deployment_id
                            )
                            .eq(
                                "billing_month",
                                payroll.salary_month
                            )
                            .order(
                                "id",
                                {
                                    ascending: false
                                }
                            )
                            .limit(1);

                        if (attendanceError) {
                            throw attendanceError;
                        }

                        attendance =
                            data?.[0] ||
                            null;
                    }

                    const lopDays =
                        Number(
                            attendance?.lop_days ||
                            0
                        );

                    const {
                        data: deduction,
                        error:
                            deductionError
                    } = await supabase
                        .from("deductions")
                        .insert({

                            payroll_id:
                                payroll.id,

                            candidate_id:
                                payroll.employee_ref_id,

                            deduction_month:
                                convertSalaryMonthToDate(
                                    payroll.salary_month
                                ),

                            lop_days:
                                lopDays,

                            lop_deduction:
                                Number(
                                    payroll.lop || 0
                                ),

                            employee_pf:
                                Number(
                                    payroll.pf || 0
                                ),

                            employee_esic:
                                Number(
                                    payroll.esic || 0
                                ),

                            tax_tds:
                                Number(
                                    payroll.tax || 0
                                ),

                            professional_tax:
                                Number(
                                    payroll.professional_tax || 0
                                ),

                            other_deductions:
                                0
                        })
                        .select()
                        .single();

                    if (deductionError) {
                        throw deductionError;
                    }

                    return res.json({

                        success: true,

                        message:
                            "Payroll approved successfully",

                        data:
                            updatedPayroll,

                        deduction
                    });
                }
            }

            return res.json({

                success: true,

                message:
                    `Payroll status changed from ${currentStatus} to ${status}`,

                data:
                    updatedPayroll
            });

        } catch (error) {

            console.error(
                "PATCH /api/payroll/:id/status:",
                error
            );

            return sendError(
                res,
                500,
                "Failed to update payroll status",
                error.message
            );
        }
    }
);

router.post("/:id/email", async (req, res) => {
    try {
        // ========================================================
        // ID
        // ========================================================

        const payrollId = getId(req.params.id);

        if (!payrollId) {
            return sendError(
                res,
                400,
                "Invalid payroll ID"
            );
        }

        // ========================================================
        // EMAIL CONFIG
        // ========================================================

        if (!EMAIL_USER || !EMAIL_PASS) {
            console.error(
                "EMAIL_USER or EMAIL_PASS is missing"
            );

            return sendError(
                res,
                500,
                "Email service is not configured. Please check EMAIL_USER and EMAIL_PASS."
            );
        }

        // ========================================================
        // GET PAYROLL
        // ========================================================

        const {
            data: payroll,
            error: payrollError
        } = await supabase
            .from("third_party_payroll")
            .select(`
                id,
                employee_name,
                salary_month,
                basic_salary,
                allowances,
                overtime,
                bonus,
                gross_salary,
                pf,
                esic,
                tax,
                professional_tax,
                lop,
                net_salary,
                status,
                employee_ref_id,
                attendance_id,
                deployment_id,
                client_id,
                bank_name,
                account_number,
                ifsc_code,
                total_deductions,
                employer_pf,
                employer_esic,
                total_employer_contribution,
                total_employer_cost,
                hra,
                conveyance,
                medical_allowance,
                other_allowance,
                gratuity,
                joining_date,
                pran,
                pf_wages,
                created_at
            `)
            .eq("id", payrollId)
            .maybeSingle();

        if (payrollError) {
            console.error(
                "Payroll fetch error:",
                payrollError
            );

            throw payrollError;
        }

        if (!payroll) {
            return sendError(
                res,
                404,
                "Payroll record not found"
            );
        }

        // ========================================================
        // EMPLOYEE ID
        // ========================================================

        const candidateId = Number(
            payroll.employee_ref_id
        );

        if (!candidateId) {
            return sendError(
                res,
                400,
                "Employee reference ID is missing from payroll record."
            );
        }

        // ========================================================
        // GET CANDIDATE
        // ========================================================

        const {
            data: candidate,
            error: candidateError
        } = await supabase
            .from("candidates")
            .select(`
                id,
                full_name,
                designation,
                employee_code,
                date_of_joining,
                city,
                state,
                pan_number,
                uan_number,
                esic_number,
                gender,
                department,
                pay_rate
            `)
            .eq("id", candidateId)
            .maybeSingle();

        if (candidateError) {
            console.error(
                "Candidate fetch error:",
                candidateError
            );

            throw candidateError;
        }

        if (!candidate) {
            return sendError(
                res,
                404,
                `Candidate ${candidateId} not found.`
            );
        }

        // ========================================================
        // GET EMPLOYEE USER
        // EMAIL COMES FROM employee_users
        // ========================================================

        const {
            data: employeeUser,
            error: employeeUserError
        } = await supabase
            .from("employee_users")
            .select(`
                id,
                employee_id,
                name,
                email,
                role,
                status
            `)
            .eq("employee_id", candidateId)
            .maybeSingle();

        if (employeeUserError) {
            console.error(
                "Employee user fetch error:",
                employeeUserError
            );

            throw employeeUserError;
        }

        if (!employeeUser) {
            return sendError(
                res,
                404,
                `Employee account not found for employee ID ${candidateId}.`
            );
        }

        // ========================================================
        // EMPLOYEE EMAIL
        // ========================================================

        const employeeEmail = String(
            employeeUser.email || ""
        ).trim();

        if (!employeeEmail) {
            return sendError(
                res,
                400,
                `Employee email address is not available for ${candidate.full_name || "this employee"}.`
            );
        }

        // ========================================================
        // EMAIL VALIDATION
        // ========================================================

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(employeeEmail)) {
            return sendError(
                res,
                400,
                `Invalid employee email address: ${employeeEmail}`
            );
        }

        // ========================================================
        // EMPLOYEE NAME
        // ========================================================

        const employeeName =
            candidate.full_name ||
            employeeUser.name ||
            payroll.employee_name ||
            "Employee";

        // ========================================================
        // DEPLOYMENT
        // ========================================================

        let deployment = null;

        if (payroll.deployment_id) {
            const {
                data: deploymentData,
                error: deploymentError
            } = await supabase
                .from("deployments")
                .select(`
                    id,
                    employee_id,
                    client_id,
                    project_name,
                    pay_rate,
                    bill_rate,
                    start_date,
                    end_date,
                    status,
                    work_location
                `)
                .eq("id", payroll.deployment_id)
                .maybeSingle();

            if (deploymentError) {
                console.error(
                    "Deployment fetch error:",
                    deploymentError
                );
            }

            deployment = deploymentData || null;
        }

        // ========================================================
        // ATTENDANCE
        // ========================================================

        let attendance = null;

        try {
            const attendanceResult =
                await getAttendanceForPayroll(payroll);

            attendance =
                attendanceResult?.attendance || null;
        } catch (attendanceError) {
            console.error(
                "Attendance fetch error:",
                attendanceError
            );

            // Attendance is not required to display
            // the already-generated payroll values.
            attendance = null;
        }

        // ========================================================
        // EMPLOYEE DETAILS
        // ========================================================

        const employeeNumber =
            candidate.employee_code ||
            candidate.id ||
            "N/A";

        const location =
            deployment?.work_location ||
            candidate.city ||
            "Head Office";

        // ========================================================
        // SALARY MONTH
        // ========================================================

        const salaryMonth =
    payroll.salary_month ||
    new Date().toISOString().slice(0, 7);

        // ========================================================
        // PREPARE DATA FOR SAME PAYSLIP PDF
        // ========================================================

        const payslipData = {
            ...payroll,

            // Employee information
            employee_name:
                employeeName,

            employee_code:
                employeeNumber,

            designation:
                candidate.designation ||
                "N/A",

            location:
                location,

            pan_number:
                candidate.pan_number ||
                "N/A",

            uan_number:
                candidate.uan_number ||
                payroll.pran ||
                "N/A",

            esic_number:
                candidate.esic_number ||
                "N/A",

            joining_date:
                candidate.date_of_joining ||
                payroll.joining_date ||
                null,

            // Bank information
            bank_name:
                payroll.bank_name ||
                "N/A",

            account_number:
                payroll.account_number ||
                "N/A",

            ifsc_code:
                payroll.ifsc_code ||
                "N/A",

            // Salary components
            basic_salary:
                Number(payroll.basic_salary || 0),

            hra:
                Number(payroll.hra || 0),

            conveyance:
                Number(payroll.conveyance || 0),

            medical_allowance:
                Number(
                    payroll.medical_allowance || 0
                ),

            other_allowance:
                Number(
                    payroll.other_allowance || 0
                ),

            gratuity:
                Number(payroll.gratuity || 0),

            overtime:
                Number(payroll.overtime || 0),

            bonus:
                Number(payroll.bonus || 0),

            // Deductions
            pf:
                Number(payroll.pf || 0),

            esic:
                Number(payroll.esic || 0),

            professional_tax:
                Number(
                    payroll.professional_tax || 0
                ),

            tax:
                Number(payroll.tax || 0),

            lop:
                Number(payroll.lop || 0),

            total_deductions:
                Number(
                    payroll.total_deductions || 0
                ),

            // Salary totals
            gross_salary:
                Number(
                    payroll.gross_salary || 0
                ),

            net_salary:
                Number(
                    payroll.net_salary || 0
                ),

            // PRAN / PF
            pran:
                payroll.pran ||
                candidate.uan_number ||
                "N/A",

            pf_wages:
                Number(
                    payroll.pf_wages || 0
                ),

            // Salary structure
            pay_rate:
                Number(
                    deployment?.pay_rate ||
                    candidate.pay_rate ||
                    0
                ),
        };

        // ========================================================
        // GENERATE PDF
        // SAME FORMAT AS PAYSLIP IMAGE
        // ========================================================

        console.log(
            "Generating payslip PDF using generatePayslipPDF..."
        );

        const pdfBuffer =
            await generatePayslipPDF(
                payslipData
            );

        if (!pdfBuffer) {
            throw new Error(
                "Payslip PDF generation returned no data."
            );
        }

        console.log(
            "Payslip PDF generated successfully."
        );

        // ========================================================
        // FILE NAME
        // ========================================================

        const cleanName =
            String(employeeName)
                .replace(
                    /[^a-zA-Z0-9]+/g,
                    "_"
                )
                .replace(
                    /^_+|_+$/g,
                    ""
                );

        const fileName =
            `Payslip_${cleanName}_${salaryMonth}.pdf`;

        // ========================================================
        // MAIL TRANSPORTER
        // ========================================================

        const transporter =
            nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: EMAIL_USER,
                    pass: EMAIL_PASS
                }
            });

        // ========================================================
        // VERIFY SMTP
        // ========================================================

        console.log(
            "Checking SMTP connection..."
        );

        await transporter.verify();

        console.log(
            "SMTP connection verified successfully."
        );

        // ========================================================
        // EMAIL BODY
        // NO CSS
        // ========================================================

        const safeEmployeeName =
            String(employeeName)
                .replace(
                    /&/g,
                    "&amp;"
                )
                .replace(
                    /</g,
                    "&lt;"
                )
                .replace(
                    />/g,
                    "&gt;"
                );

        const emailHtml = `
            <p>
                Dear <strong>${safeEmployeeName}</strong>,
            </p>

            <p>
                Please find attached your payslip for
                <strong>${salaryMonth}</strong>.
            </p>

            <p>
                Regards,<br>
                <strong>
                    Talent Corner HR Services Pvt Ltd.
                </strong>
            </p>
        `;

        // ========================================================
        // SEND EMAIL
        // ========================================================

        console.log(
            "Sending payslip email:",
            {
                payrollId,
                candidateId,
                employeeName,
                employeeEmail,
                salaryMonth,
                fileName
            }
        );

        const mailResult =
            await transporter.sendMail({
                from:
                    `"Talent Corner HR Services Pvt Ltd." <${EMAIL_USER}>`,

                to:
                    employeeEmail,

                subject:
                    `Payslip - ${salaryMonth} - ${employeeName}`,

                html:
                    emailHtml,

                attachments: [
                    {
                        filename:
                            fileName,

                        content:
                            pdfBuffer,

                        contentType:
                            "application/pdf"
                    }
                ]
            });

        // ========================================================
        // SUCCESS
        // ========================================================

        console.log(
            `Payslip ${payrollId} sent successfully to ${employeeEmail}`
        );

        console.log(
            "Message ID:",
            mailResult.messageId
        );

        return res.json({
            success: true,

            message:
                `Payslip emailed successfully to ${employeeEmail}`,

            payroll_id:
                payrollId,

            candidate_id:
                candidateId,

            employee_name:
                employeeName,

            employee_email:
                employeeEmail,

            salary_month:
                salaryMonth,

            file_name:
                fileName,

            message_id:
                mailResult.messageId
        });

    } catch (error) {

        console.error(
            "EMAIL PAYSLIP ERROR:",
            error
        );

        return sendError(
            res,
            500,
            "Failed to generate and send payslip",
            error.message
        );
    }
});
// // ============================================================
// LOOKUP: EMPLOYEES FOR A CLIENT (for the "Create Payroll" picker)
//
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
            .select(`
                id,
                candidate_id,
                client_id,
                pay_rate,
                bill_rate,
                project_name,
                status
            `)
            .eq("client_id", clientId)
            .order("id", { ascending: false });

        if (deploymentError) throw deploymentError;

        if (!deployments || deployments.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const candidateIds = [
            ...new Set(
                deployments
                    .map((d) => d.candidate_id)
                    .filter((id) => id !== null && id !== undefined)
            )
        ];

        let candidatesById = {};

        if (candidateIds.length > 0) {
            const { data: candidates, error: candidateError } = await supabase
                .from("candidates")
                .select("id, full_name, email, designation")
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
                pay_rate: Number(d.pay_rate || 0),
                bill_rate: Number(d.bill_rate || 0),
                deployment_status: d.status || null
            };
        });

        return res.json({ success: true, data: result });

    } catch (error) {
        console.error("GET /api/payroll/lookup/employees:", error);
        return sendError(res, 500, "Failed to fetch employees", error.message);
    }
});
// ============================================================
// LOOKUP: PREFILL DATA FOR ONE EMPLOYEE + MONTH
//
// GET /api/payroll/lookup/prefill
//     ?deployment_id=5
//     &salary_month=2026-08
//
// Returns:
// - Employee details
// - Deployment details
// - Pay rate
// - Attendance
// - Statutory information
// - Existing payroll check
// ============================================================

router.get("/lookup/prefill", async (req, res) => {
    try {
        // ========================================================
        // DEPLOYMENT ID
        // ========================================================

        const deploymentId = getId(
            req.query.deployment_id
        );

        if (!deploymentId) {
            return sendError(
                res,
                400,
                "Valid deployment_id is required"
            );
        }

        // ========================================================
        // SALARY MONTH
        // ========================================================

        let salaryMonth;

        try {
            salaryMonth = validateSalaryMonth(
                req.query.salary_month
            );
        } catch (err) {
            return sendError(
                res,
                400,
                err.message
            );
        }

        // ========================================================
        // FETCH DEPLOYMENT
        // ========================================================

        const {
            data: deployment,
            error: deploymentError
        } = await supabase
            .from("deployments")
            .select(`
                id,
                candidate_id,
                client_id,
                pay_rate,
                bill_rate,
                project_name,
                status
            `)
            .eq("id", deploymentId)
            .maybeSingle();

        if (deploymentError) {
            throw deploymentError;
        }

        if (!deployment) {
            return sendError(
                res,
                404,
                "Deployment not found"
            );
        }

        // ========================================================
        // FETCH EMPLOYEE
        // ========================================================

        const {
            data: candidate,
            error: candidateError
        } = await supabase
            .from("candidates")
            .select(`
                id,
                full_name,
                email,
                phone,
                designation,
                gender,
                department,
                pay_rate,
                bank_name,
                bank_account_number,
                ifsc_code,
                pan_number,
                uan_number,
                esic_number,
                date_of_joining
            `)
            .eq(
                "id",
                deployment.candidate_id
            )
            .maybeSingle();

        if (candidateError) {
            throw candidateError;
        }

        if (!candidate) {
            return sendError(
                res,
                404,
                "Employee not found"
            );
        }

        // ========================================================
        // FETCH ATTENDANCE
        //
        // IMPORTANT:
        // No third_party_attendance_approval table is used.
        // ========================================================

        const {
            data: attendanceRows,
            error: attendanceError
        } = await supabase
            .from("third_party_emp_attendance")
            .select(`
                id,
                employee_name,
                billing_month,
                status,
                present_days,
                absent_days,
                leave_days,
                overtime_hours,
                deployment_id,
                employee_id,
                half_days,
                lop_days,
                payable_days
            `)
            .eq(
                "employee_id",
                deployment.candidate_id
            )
            .eq(
                "deployment_id",
                deploymentId
            )
            .eq(
                "billing_month",
                salaryMonth
            )
            .order("id", {
                ascending: false
            })
            .limit(1);

        if (attendanceError) {
            throw attendanceError;
        }

        const attendance =
            attendanceRows?.[0] || null;

        // ========================================================
        // EXISTING PAYROLL CHECK
        //
        // IMPORTANT:
        // third_party_payroll.status was deleted.
        // Therefore DO NOT select or use status here.
        // ========================================================

        const {
            data: existingPayroll,
            error: existingError
        } = await supabase
            .from("third_party_payroll")
            .select(`
                id
            `)
            .eq(
                "employee_ref_id",
                deployment.candidate_id
            )
            .eq(
                "deployment_id",
                deploymentId
            )
            .eq(
                "salary_month",
                salaryMonth
            )
            .limit(1);

        if (existingError) {
            throw existingError;
        }

        // ========================================================
        // DAYS IN MONTH
        // ========================================================

        const calendarDays =
            getDaysInMonth(
                salaryMonth
            );

        // ========================================================
        // PAY RATE
        //
        // Deployment pay_rate has priority.
        // Candidate pay_rate is fallback.
        // ========================================================

        const payRate = Number(
            deployment.pay_rate ??
            candidate.pay_rate ??
            0
        );

        // ========================================================
        // ATTENDANCE VALUES
        // ========================================================

        const presentDays = Number(
            attendance?.present_days || 0
        );

        const absentDays = Number(
            attendance?.absent_days || 0
        );

        const leaveDays = Number(
            attendance?.leave_days || 0
        );

        const halfDays = Number(
            attendance?.half_days || 0
        );

        const lopDays = Number(
            attendance?.lop_days || 0
        );

        const overtimeHours = Number(
            attendance?.overtime_hours || 0
        );

        // ========================================================
        // PAYABLE DAYS
        //
        // Use stored payable_days when available.
        // Otherwise:
        //
        // Present + Leave + Half Day × 0.5
        // ========================================================

        let payableDays;

        if (
            attendance?.payable_days !== null &&
            attendance?.payable_days !== undefined
        ) {
            payableDays = Number(
                attendance.payable_days
            );
        } else {
            payableDays =
                presentDays +
                leaveDays +
                halfDays * 0.5;
        }

        payableDays = Math.max(
            0,
            Math.min(
                payableDays,
                calendarDays
            )
        );

        // ========================================================
        // RESPONSE
        // ========================================================

        return res.json({
            success: true,

            data: {
                // ==================================================
                // EMPLOYEE
                // ==================================================

                employee_id:
                    Number(candidate.id),

                employee_name:
                    candidate.full_name || "N/A",

                email:
                    candidate.email || "",

                phone:
                    candidate.phone || "",

                designation:
                    candidate.designation || "",

                gender:
                    candidate.gender || "",

                department:
                    candidate.department || "",

                pan_number:
                    candidate.pan_number || null,

                uan_number:
                    candidate.uan_number || null,

                esic_number:
                    candidate.esic_number || null,

                joining_date:
                    candidate.date_of_joining || null,

                // ==================================================
                // BANK
                // ==================================================

                bank_name:
                    candidate.bank_name || "",

                account_number:
                    candidate.bank_account_number || "",

                bank_account_number:
                    candidate.bank_account_number || "",

                ifsc_code:
                    candidate.ifsc_code || "",

                // ==================================================
                // DEPLOYMENT
                // ==================================================

                deployment_id:
                    Number(deployment.id),

                client_id:
                    Number(deployment.client_id),

                candidate_id:
                    Number(deployment.candidate_id),

                project_name:
                    deployment.project_name || "",

                // IMPORTANT:
                // This is deployment status, NOT payroll status.
                deployment_status:
                    deployment.status || null,

                pay_rate:
                    payRate,

                bill_rate:
                    Number(
                        deployment.bill_rate || 0
                    ),

                // ==================================================
                // ATTENDANCE
                // ==================================================

                attendance_id:
                    attendance?.id
                        ? Number(attendance.id)
                        : null,

                attendance_status:
                    attendance?.status || null,

                present_days:
                    presentDays,

                absent_days:
                    absentDays,

                leave_days:
                    leaveDays,

                half_days:
                    halfDays,

                lop_days:
                    lopDays,

                payable_days:
                    payableDays,

                overtime_hours:
                    overtimeHours,

                total_days:
                    calendarDays,

                // ==================================================
                // MONTH
                // ==================================================

                salary_month:
                    salaryMonth,

                // ==================================================
                // EXISTING PAYROLL
                //
                // No payroll status because the column was deleted.
                // ==================================================

                already_exists:
                    !!(
                        existingPayroll &&
                        existingPayroll.length > 0
                    ),

                existing_payroll_id:
                    existingPayroll?.[0]?.id ||
                    null
            }
        });

    } catch (error) {
        console.error(
            "GET /api/payroll/lookup/prefill:",
            error
        );

        return sendError(
            res,
            500,
            "Failed to fetch prefill data",
            error.message
        );
    }
});


// ============================================================
// EDIT PAYROLL
//
// PATCH /api/payroll/:id
//
// Editable only when payroll status is:
// - Pending
// - Approved
//
// Locked payroll cannot be edited.
//
// Editable fields:
// PF, ESIC, Tax, Professional Tax, LOP,
// Basic Salary, Allowances, Overtime, Bonus,
// Employer PF, Employer ESIC,
// Bank Name, Account Number, IFSC
// ============================================================

router.patch("/:id", async (req, res) => {
    try {
        const id = getId(req.params.id);

        if (!id) {
            return sendError(res, 400, "Invalid payroll ID");
        }

        // --------------------------------------------------------
        // GET EXISTING PAYROLL
        // --------------------------------------------------------

        const {
            data: payroll,
            error: payrollError
        } = await supabase
            .from("third_party_payroll")
            .select(`
                id,
                status,
                basic_salary,
                allowances,
                overtime,
                bonus,
                pf,
                esic,
                tax,
                professional_tax,
                lop,
                gross_salary,
                total_deductions,
                net_salary,
                employer_pf,
                employer_esic,
                total_employer_contribution,
                total_employer_cost,
                bank_name,
                account_number,
                ifsc_code
            `)
            .eq("id", id)
            .maybeSingle();

        if (payrollError) {
            throw payrollError;
        }

        if (!payroll) {
            return sendError(
                res,
                404,
                "Payroll record not found"
            );
        }

        // --------------------------------------------------------
        // LOCKED CHECK
        // --------------------------------------------------------

        const currentStatus =
            String(
                payroll.status || "Pending"
            ).trim();

        if (currentStatus === "Locked") {
            return sendError(
                res,
                400,
                "Locked payroll records cannot be edited"
            );
        }

        if (
            currentStatus !== "Pending" &&
            currentStatus !== "Approved"
        ) {
            return sendError(
                res,
                400,
                "Only Pending or Approved payroll records can be edited"
            );
        }

        // --------------------------------------------------------
        // NUMBER HELPER
        // --------------------------------------------------------

        const numberValue = (
            fieldName,
            fallback
        ) => {

            if (
                req.body[fieldName] ===
                    undefined ||
                req.body[fieldName] ===
                    null ||
                req.body[fieldName] === ""
            ) {
                return Number(
                    fallback || 0
                );
            }

            const value =
                Number(
                    req.body[fieldName]
                );

            if (
                !Number.isFinite(value) ||
                value < 0
            ) {
                throw new Error(
                    `Invalid value for ${fieldName}`
                );
            }

            return value;
        };

        // --------------------------------------------------------
        // SALARY / DEDUCTIONS
        // --------------------------------------------------------

        let basicSalary;
        let allowances;
        let overtime;
        let bonus;

        let pf;
        let esic;
        let tax;
        let professionalTax;
        let lop;

        let employerPF;
        let employerESIC;

        try {

            basicSalary =
                numberValue(
                    "basic_salary",
                    payroll.basic_salary
                );

            allowances =
                numberValue(
                    "allowances",
                    payroll.allowances
                );

            overtime =
                numberValue(
                    "overtime",
                    payroll.overtime
                );

            bonus =
                numberValue(
                    "bonus",
                    payroll.bonus
                );

            pf =
                numberValue(
                    "pf",
                    payroll.pf
                );

            esic =
                numberValue(
                    "esic",
                    payroll.esic
                );

            tax =
                numberValue(
                    "tax",
                    payroll.tax
                );

            professionalTax =
                numberValue(
                    "professional_tax",
                    payroll.professional_tax
                );

            lop =
                numberValue(
                    "lop",
                    payroll.lop
                );

            employerPF =
                numberValue(
                    "employer_pf",
                    payroll.employer_pf
                );

            employerESIC =
                numberValue(
                    "employer_esic",
                    payroll.employer_esic
                );

        } catch (error) {

            return sendError(
                res,
                400,
                error.message
            );
        }

        // --------------------------------------------------------
        // BANK DETAILS
        // --------------------------------------------------------

        const bankName =
            req.body.bank_name !== undefined
                ? (
                    req.body.bank_name
                        ? String(
                            req.body.bank_name
                        ).trim()
                        : null
                )
                : payroll.bank_name;

        const accountNumber =
            req.body.account_number !== undefined
                ? (
                    req.body.account_number
                        ? String(
                            req.body.account_number
                        ).trim()
                        : null
                )
                : payroll.account_number;

        const ifscCode =
            req.body.ifsc_code !== undefined
                ? (
                    req.body.ifsc_code
                        ? String(
                            req.body.ifsc_code
                        ).trim().toUpperCase()
                        : null
                )
                : payroll.ifsc_code;

        // --------------------------------------------------------
        // RECALCULATE GROSS
        // --------------------------------------------------------

        const grossSalary =
            basicSalary +
            allowances +
            overtime +
            bonus;

        // --------------------------------------------------------
        // TOTAL DEDUCTIONS
        // --------------------------------------------------------

        const totalDeductions =
            pf +
            esic +
            tax +
            professionalTax +
            lop;

        // --------------------------------------------------------
        // NET SALARY
        // --------------------------------------------------------

        const netSalary =
            Math.max(
                0,
                grossSalary -
                totalDeductions
            );

        // --------------------------------------------------------
        // EMPLOYER CONTRIBUTIONS
        // --------------------------------------------------------

        const totalEmployerContribution =
            employerPF +
            employerESIC;

        const totalEmployerCost =
            grossSalary +
            totalEmployerContribution;

        // --------------------------------------------------------
        // UPDATE
        // --------------------------------------------------------

        const updateData = {

            basic_salary:
                Number(
                    basicSalary.toFixed(2)
                ),

            allowances:
                Number(
                    allowances.toFixed(2)
                ),

            overtime:
                Number(
                    overtime.toFixed(2)
                ),

            bonus:
                Number(
                    bonus.toFixed(2)
                ),

            gross_salary:
                Number(
                    grossSalary.toFixed(2)
                ),

            pf:
                Number(
                    pf.toFixed(2)
                ),

            esic:
                Number(
                    esic.toFixed(2)
                ),

            tax:
                Number(
                    tax.toFixed(2)
                ),

            professional_tax:
                Number(
                    professionalTax.toFixed(2)
                ),

            lop:
                Number(
                    lop.toFixed(2)
                ),

            total_deductions:
                Number(
                    totalDeductions.toFixed(2)
                ),

            net_salary:
                Number(
                    netSalary.toFixed(2)
                ),

            employer_pf:
                Number(
                    employerPF.toFixed(2)
                ),

            employer_esic:
                Number(
                    employerESIC.toFixed(2)
                ),

            total_employer_contribution:
                Number(
                    totalEmployerContribution.toFixed(2)
                ),

            total_employer_cost:
                Number(
                    totalEmployerCost.toFixed(2)
                ),

            bank_name:
                bankName,

            account_number:
                accountNumber,

            ifsc_code:
                ifscCode
        };

        const {
            data: updatedPayroll,
            error: updateError
        } = await supabase
            .from("third_party_payroll")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        return res.json({

            success: true,

            message:
                "Payroll updated successfully",

            data:
                updatedPayroll
        });

    } catch (error) {

        console.error(
            "PATCH /api/payroll/:id:",
            error
        );

        return sendError(
            res,
            500,
            "Failed to update payroll",
            error.message
        );
    }
});
// ============================================================
// CREATE PAYROLL
//
// POST /api/payroll
//
// Admin selects:
// - Client
// - Employee / Deployment
// - Salary Month
//
// Automatically gets:
// - Employee details
// - Basic Salary from candidates.pay_rate
// - Attendance
// - Salary components
// - Overtime
// - PF
// - ESIC
// - Professional Tax
// - Gratuity
// - Employer contributions
// - Bank details
//
// New payroll always starts as Pending.
// ============================================================

router.post("/", async (req, res) => {

    try {

        // ========================================================
        // IDS
        // ========================================================

        const clientId =
            getId(
                req.body.client_id
            );

        const deploymentId =
            getId(
                req.body.deployment_id
            );

        const employeeId =
            getId(
                req.body.employee_ref_id
            );

        if (!clientId) {
            return sendError(
                res,
                400,
                "Valid client_id is required"
            );
        }

        if (!deploymentId) {
            return sendError(
                res,
                400,
                "Valid deployment_id is required"
            );
        }

        if (!employeeId) {
            return sendError(
                res,
                400,
                "Valid employee_ref_id is required"
            );
        }


        // ========================================================
        // MONTH
        // ========================================================

        let salaryMonth;

        try {

            salaryMonth =
                validateSalaryMonth(
                    req.body.salary_month
                );

        } catch (error) {

            return sendError(
                res,
                400,
                error.message
            );
        }


        // ========================================================
        // DEPLOYMENT
        // ========================================================

        const {
            data: deployment,
            error: deploymentError
        } = await supabase
            .from("deployments")
            .select(`
                id,
                candidate_id,
                client_id,
                pay_rate,
                bill_rate,
                project_name,
                billing_model,
                status
            `)
            .eq(
                "id",
                deploymentId
            )
            .maybeSingle();

        if (deploymentError) {
            throw deploymentError;
        }

        if (!deployment) {

            return sendError(
                res,
                404,
                "Deployment not found"
            );
        }


        // ========================================================
        // VALIDATE CLIENT
        // ========================================================

        if (
            Number(
                deployment.client_id
            ) !== clientId
        ) {

            return sendError(
                res,
                400,
                "Deployment does not belong to selected client"
            );
        }


        // ========================================================
        // VALIDATE EMPLOYEE
        // ========================================================

        if (
            Number(
                deployment.candidate_id
            ) !== employeeId
        ) {

            return sendError(
                res,
                400,
                "Employee does not belong to selected deployment"
            );
        }


        // ========================================================
        // CANDIDATE
        //
        // IMPORTANT:
        // candidates.pay_rate = BASIC SALARY
        // ========================================================

        const {
            data: candidate,
            error: candidateError
        } = await supabase
            .from("candidates")
            .select(`
                id,
                full_name,
                email,
                phone,
                designation,
                pay_rate,
                gender,
                department,
                bank_name,
                bank_account_number,
                ifsc_code,
                pan_number,
                uan_number,
                esic_number,
                date_of_joining
            `)
            .eq(
                "id",
                employeeId
            )
            .maybeSingle();

        if (candidateError) {
            throw candidateError;
        }

        if (!candidate) {

            return sendError(
                res,
                404,
                "Employee not found"
            );
        }


        // ========================================================
        // BASIC SALARY
        //
        // ALWAYS FETCHED FROM candidates.pay_rate
        //
        // Example:
        // Priya Sharma -> pay_rate = 40000
        // Basic Salary = 40000
        // ========================================================

        const basicSalary =
            Math.round(
                Number(
                    candidate.pay_rate || 0
                )
            );

        if (basicSalary <= 0) {

            return sendError(
                res,
                400,
                "Basic Salary is not configured for this employee in candidates.pay_rate"
            );
        }


        // ========================================================
        // DUPLICATE CHECK
        //
        // IMPORTANT:
        // third_party_payroll.status was deleted.
        // Only check the payroll ID.
        // ========================================================

        const {
            data: existingRows,
            error: existingError
        } = await supabase
            .from("third_party_payroll")
            .select(`
                id
            `)
            .eq(
                "employee_ref_id",
                employeeId
            )
            .eq(
                "deployment_id",
                deploymentId
            )
            .eq(
                "salary_month",
                salaryMonth
            )
            .limit(1);

        if (existingError) {
            throw existingError;
        }

        if (
            existingRows &&
            existingRows.length > 0
        ) {

            return sendError(
                res,
                409,
                "Payroll already exists for this employee, deployment and month",
                {
                    existing_payroll_id:
                        existingRows[0].id
                }
            );
        }


        // ========================================================
        // ATTENDANCE
        //
        // Attendance does NOT determine Basic Salary.
        //
        // It is currently used for:
        // - payable_days
        // - overtime_hours
        // ========================================================

        const {
            data: attendanceRows,
            error: attendanceError
        } = await supabase
            .from(
                "third_party_emp_attendance"
            )
            .select(`
                id,
                employee_name,
                billing_month,
                status,
                present_days,
                absent_days,
                leave_days,
                overtime_hours,
                deployment_id,
                employee_id,
                half_days,
                lop_days,
                payable_days
            `)
            .eq(
                "employee_id",
                employeeId
            )
            .eq(
                "deployment_id",
                deploymentId
            )
            .eq(
                "billing_month",
                salaryMonth
            )
            .order(
                "id",
                {
                    ascending: false
                }
            )
            .limit(1);

        if (attendanceError) {
            throw attendanceError;
        }

        const attendance =
            attendanceRows?.[0] ||
            null;


        // ========================================================
        // CALENDAR DAYS
        // ========================================================

        const salaryYear =
            Number(
                salaryMonth.substring(
                    0,
                    4
                )
            );

        const salaryMonthNumber =
            Number(
                salaryMonth.substring(
                    5,
                    7
                )
            );

        const calendarDays =
            new Date(
                salaryYear,
                salaryMonthNumber,
                0
            ).getDate();


        // ========================================================
        // PAYABLE DAYS
        //
        // If attendance has payable_days,
        // use it.
        //
        // Otherwise use calendar days.
        // ========================================================

        const attendancePayableDays =
            Number(
                attendance?.payable_days || 0
            );

        const payableDays =
            attendancePayableDays > 0
                ? Math.min(
                    attendancePayableDays,
                    calendarDays
                )
                : calendarDays;


        // ========================================================
        // OVERTIME HOURS
        // ========================================================

        const overtimeHours =
            Math.max(
                0,
                Number(
                    attendance?.overtime_hours || 0
                )
            );


        // ========================================================
        // SALARY COMPONENTS
        //
        // Basic = candidates.pay_rate
        //
        // HRA = 50% Basic
        // Conveyance = 1200
        // Medical = 1000
        // Other Allowance = 0
        // ========================================================

        const hra =
            Math.round(
                basicSalary * 0.50
            );

        const conveyance =
            1200;

        const medicalAllowance =
            1000;

        const otherAllowance =
            0;


        // ========================================================
        // EARNED SALARY
        //
        // Salary is prorated according to payable days.
        // ========================================================

        const earnedBasicSalary =
            Math.round(
                (
                    basicSalary /
                    calendarDays
                ) *
                payableDays
            );

        const earnedHRA =
            Math.round(
                (
                    hra /
                    calendarDays
                ) *
                payableDays
            );

        const earnedConveyance =
            Math.round(
                (
                    conveyance /
                    calendarDays
                ) *
                payableDays
            );

        const earnedMedicalAllowance =
            Math.round(
                (
                    medicalAllowance /
                    calendarDays
                ) *
                payableDays
            );

        const earnedOtherAllowance =
            Math.round(
                (
                    otherAllowance /
                    calendarDays
                ) *
                payableDays
            );


        // ========================================================
        // TOTAL ALLOWANCES
        // ========================================================

        const allowances =
            earnedHRA +
            earnedConveyance +
            earnedMedicalAllowance +
            earnedOtherAllowance;


        // ========================================================
        // OVERTIME CALCULATION
        //
        // Basic / 26 / 8 × 1.5 × OT hours
        // ========================================================

        const overtime =
            Math.round(
                (
                    basicSalary /
                    26 /
                    8
                ) *
                1.5 *
                overtimeHours
            );


        // ========================================================
        // BONUS
        //
        // 8.33% of earned fixed gross
        // for Admin / Accounts departments.
        // ========================================================

        const department =
            String(
                candidate.department || ""
            )
                .trim()
                .toLowerCase();

        const earnedFixedGross =
            earnedBasicSalary +
            earnedHRA +
            earnedConveyance +
            earnedMedicalAllowance +
            earnedOtherAllowance;

        const bonus =
            [
                "admin",
                "accounts"
            ].includes(
                department
            )
                ? Math.round(
                    earnedFixedGross *
                    0.0833
                )
                : 0;


        // ========================================================
        // GROSS SALARY
        // ========================================================

        const grossSalary =
            earnedFixedGross +
            overtime +
            bonus;


        // ========================================================
        // PF WAGES
        //
        // PF wages = Gross - Earned HRA
        // ========================================================

        const pfWages =
            Math.max(
                0,
                Math.round(
                    grossSalary -
                    earnedHRA
                )
            );


        // ========================================================
        // EMPLOYEE PF
        //
        // 12% of PF wages
        // Maximum PF wage considered = 15000
        // ========================================================

        const pf =
            Math.round(
                Math.min(
                    pfWages,
                    15000
                ) *
                0.12
            );


        // ========================================================
        // ESIC
        //
        // Employee must have ESIC number
        // AND gross salary must be <= 21000
        // ========================================================

        const esicApplicable =
            !!candidate.esic_number;

        const esic =
            (
                esicApplicable &&
                grossSalary <= 21000
            )
                ? Math.round(
                    grossSalary *
                    0.0075
                )
                : 0;


        // ========================================================
        // PROFESSIONAL TAX
        //
        // Current rule:
        // ₹200 when gross > ₹25,000
        // ========================================================

        const professionalTax =
            grossSalary > 25000
                ? 200
                : 0;


        // ========================================================
        // TAX
        //
        // Currently no TDS calculation.
        // ========================================================

        const tax =
            0;


        // ========================================================
        // LOP
        //
        // LOP is already reflected through payable_days.
        // Therefore no second deduction is applied.
        // ========================================================

        const lop =
            0;


        // ========================================================
        // EMPLOYER PF
        // ========================================================

        const employerPF =
            pf;


        // ========================================================
        // EMPLOYER ESIC
        // ========================================================

        const employerESIC =
            (
                esicApplicable &&
                grossSalary <= 21000
            )
                ? Math.round(
                    grossSalary *
                    0.0325
                )
                : 0;


        // ========================================================
        // GRATUITY
        //
        // 4.81% of earned Basic
        // ========================================================

        const gratuity =
            Math.round(
                earnedBasicSalary *
                0.0481
            );


        // ========================================================
        // TOTAL DEDUCTIONS
        // ========================================================

        const totalDeductions =
            pf +
            esic +
            tax +
            professionalTax +
            lop;


        // ========================================================
        // NET SALARY
        // ========================================================

        const netSalary =
            Math.max(
                0,
                grossSalary -
                totalDeductions
            );


        // ========================================================
        // EMPLOYER CONTRIBUTION
        // ========================================================

        const totalEmployerContribution =
            employerPF +
            employerESIC;


        // ========================================================
        // TOTAL EMPLOYER COST
        // ========================================================

        const totalEmployerCost =
            grossSalary +
            totalEmployerContribution +
            gratuity;


        // ========================================================
        // BANK DETAILS
        //
        // Automatically fetched from candidates.
        // ========================================================

        const bankName =
            candidate.bank_name ||
            null;

        const accountNumber =
            candidate.bank_account_number ||
            null;

        const ifscCode =
            candidate.ifsc_code
                ? String(
                    candidate.ifsc_code
                )
                    .trim()
                    .toUpperCase()
                : null;


        // ========================================================
        // ATTENDANCE ID
        // ========================================================

        const attendanceId =
            attendance?.id ||
            null;


        // ========================================================
        // INSERT PAYROLL
        //
        // IMPORTANT:
        // No status field because it was deleted
        // from third_party_payroll.
        // ========================================================

        const {
            data: insertedPayroll,
            error: insertError
        } = await supabase
            .from(
                "third_party_payroll"
            )
            .insert({

                // ------------------------------------------------
                // EMPLOYEE
                // ------------------------------------------------

                employee_name:
                    candidate.full_name,

                employee_ref_id:
                    employeeId,


                // ------------------------------------------------
                // MONTH
                // ------------------------------------------------

                salary_month:
                    salaryMonth,


                // ------------------------------------------------
                // BASIC
                // ------------------------------------------------

                basic_salary:
                    Number(
                        basicSalary.toFixed(2)
                    ),


                // ------------------------------------------------
                // HRA
                // ------------------------------------------------

                hra:
                    Number(
                        earnedHRA.toFixed(2)
                    ),


                // ------------------------------------------------
                // CONVEYANCE
                // ------------------------------------------------

                conveyance:
                    Number(
                        earnedConveyance.toFixed(2)
                    ),


                // ------------------------------------------------
                // MEDICAL
                // ------------------------------------------------

                medical_allowance:
                    Number(
                        earnedMedicalAllowance.toFixed(2)
                    ),


                // ------------------------------------------------
                // OTHER ALLOWANCE
                // ------------------------------------------------

                other_allowance:
                    Number(
                        earnedOtherAllowance.toFixed(2)
                    ),


                // ------------------------------------------------
                // TOTAL ALLOWANCES
                // ------------------------------------------------

                allowances:
                    Number(
                        allowances.toFixed(2)
                    ),


                // ------------------------------------------------
                // OVERTIME
                // ------------------------------------------------

                overtime:
                    Number(
                        overtime.toFixed(2)
                    ),


                // ------------------------------------------------
                // BONUS
                // ------------------------------------------------

                bonus:
                    Number(
                        bonus.toFixed(2)
                    ),


                // ------------------------------------------------
                // GROSS
                // ------------------------------------------------

                gross_salary:
                    Number(
                        grossSalary.toFixed(2)
                    ),


                // ------------------------------------------------
                // PF
                // ------------------------------------------------

                pf:
                    Number(
                        pf.toFixed(2)
                    ),


                // ------------------------------------------------
                // ESIC
                // ------------------------------------------------

                esic:
                    Number(
                        esic.toFixed(2)
                    ),


                // ------------------------------------------------
                // TAX
                // ------------------------------------------------

                tax:
                    Number(
                        tax.toFixed(2)
                    ),


                // ------------------------------------------------
                // PROFESSIONAL TAX
                // ------------------------------------------------

                professional_tax:
                    Number(
                        professionalTax.toFixed(2)
                    ),


                // ------------------------------------------------
                // LOP
                // ------------------------------------------------

                lop:
                    Number(
                        lop.toFixed(2)
                    ),


                // ------------------------------------------------
                // PF WAGES
                // ------------------------------------------------

                pf_wages:
                    Number(
                        pfWages.toFixed(2)
                    ),


                // ------------------------------------------------
                // GRATUITY
                // ------------------------------------------------

                gratuity:
                    Number(
                        gratuity.toFixed(2)
                    ),


                // ------------------------------------------------
                // TOTAL DEDUCTIONS
                // ------------------------------------------------

                total_deductions:
                    Number(
                        totalDeductions.toFixed(2)
                    ),


                // ------------------------------------------------
                // NET SALARY
                // ------------------------------------------------

                net_salary:
                    Number(
                        netSalary.toFixed(2)
                    ),


                // ------------------------------------------------
                // EMPLOYER PF
                // ------------------------------------------------

                employer_pf:
                    Number(
                        employerPF.toFixed(2)
                    ),


                // ------------------------------------------------
                // EMPLOYER ESIC
                // ------------------------------------------------

                employer_esic:
                    Number(
                        employerESIC.toFixed(2)
                    ),


                // ------------------------------------------------
                // TOTAL EMPLOYER CONTRIBUTION
                // ------------------------------------------------

                total_employer_contribution:
                    Number(
                        totalEmployerContribution.toFixed(2)
                    ),


                // ------------------------------------------------
                // TOTAL EMPLOYER COST
                // ------------------------------------------------

                total_employer_cost:
                    Number(
                        totalEmployerCost.toFixed(2)
                    ),


                // ------------------------------------------------
                // JOINING DATE
                // ------------------------------------------------

                joining_date:
                    candidate.date_of_joining ||
                    null,


                // ------------------------------------------------
                // PRAN
                //
                // Do NOT put UAN here.
                // ------------------------------------------------

                pran:
                    null,


                // ------------------------------------------------
                // BANK
                // ------------------------------------------------

                bank_name:
                    bankName,

                account_number:
                    accountNumber,

                ifsc_code:
                    ifscCode,


                // ------------------------------------------------
                // RELATIONSHIPS
                // ------------------------------------------------

                attendance_id:
                    attendanceId,

                deployment_id:
                    deploymentId,

                payroll_batch_id:
                    null,

                client_id:
                    clientId
            })
            .select()
            .single();


        // ========================================================
        // INSERT ERROR
        // ========================================================

        if (insertError) {
            throw insertError;
        }


        // ========================================================
        // RESPONSE
        // ========================================================

        return res.status(201).json({

            success:
                true,

            message:
                "Payroll created successfully",

            data: {

                ...insertedPayroll,


                // ------------------------------------------------
                // EMPLOYEE INFORMATION
                // ------------------------------------------------

                employee_email:
                    candidate.email ||
                    "",

                phone:
                    candidate.phone ||
                    "",

                designation:
                    candidate.designation ||
                    "",


                // ------------------------------------------------
                // BASIC SALARY
                //
                // FROM candidates.pay_rate
                // ------------------------------------------------

                pay_rate:
                    Number(
                        candidate.pay_rate ||
                        0
                    ),

                basic_salary:
                    Number(
                        basicSalary ||
                        0
                    ),


                // ------------------------------------------------
                // ATTENDANCE
                // ------------------------------------------------

                attendance: {

                    id:
                        attendance?.id ||
                        null,

                    present_days:
                        Number(
                            attendance?.present_days ||
                            0
                        ),

                    absent_days:
                        Number(
                            attendance?.absent_days ||
                            0
                        ),

                    leave_days:
                        Number(
                            attendance?.leave_days ||
                            0
                        ),

                    half_days:
                        Number(
                            attendance?.half_days ||
                            0
                        ),

                    lop_days:
                        Number(
                            attendance?.lop_days ||
                            0
                        ),

                    overtime_hours:
                        Number(
                            attendance?.overtime_hours ||
                            0
                        ),

                    payable_days:
                        Number(
                            attendance?.payable_days ||
                            0
                        )
                },


                // ------------------------------------------------
                // CALCULATION INFORMATION
                // ------------------------------------------------

                calculation: {

                    calendar_days:
                        calendarDays,

                    payable_days:
                        payableDays,

                    basic_salary:
                        basicSalary,

                    monthly_hra:
                        hra,

                    earned_hra:
                        earnedHRA,

                    monthly_conveyance:
                        conveyance,

                    earned_conveyance:
                        earnedConveyance,

                    monthly_medical_allowance:
                        medicalAllowance,

                    earned_medical_allowance:
                        earnedMedicalAllowance,

                    earned_other_allowance:
                        earnedOtherAllowance,

                    overtime_hours:
                        overtimeHours,

                    overtime:
                        overtime,

                    bonus:
                        bonus,

                    gross_salary:
                        grossSalary,

                    pf_wages:
                        pfWages,

                    pf:
                        pf,

                    esic:
                        esic,

                    professional_tax:
                        professionalTax,

                    tax:
                        tax,

                    lop:
                        lop,

                    total_deductions:
                        totalDeductions,

                    net_salary:
                        netSalary,

                    employer_pf:
                        employerPF,

                    employer_esic:
                        employerESIC,

                    gratuity:
                        gratuity,

                    total_employer_contribution:
                        totalEmployerContribution,

                    total_employer_cost:
                        totalEmployerCost
                }
            }
        });

    } catch (error) {

        console.error(
            "POST /api/payroll:",
            error
        );

        return sendError(
            res,
            500,
            "Failed to create payroll",
            error.message
        );
    }
});

// ============================================================
// GET SINGLE PAYROLL
// GET /api/payroll/:id
// ============================================================

router.get("/:id", async (req, res) => {

    try {

        const id =
            getId(
                req.params.id
            );

        if (!id) {
            return sendError(
                res,
                400,
                "Invalid payroll ID"
            );
        }

        // --------------------------------------------------------
        // PAYROLL
        // --------------------------------------------------------

        const {
            data: payroll,
            error
        } = await supabase
            .from("third_party_payroll")
            .select(`
                id,
                employee_name,
                salary_month,
                basic_salary,
                allowances,
                overtime,
                bonus,
                gross_salary,
                pf,
                esic,
                tax,
                lop,
                net_salary,
                bank_name,
                account_number,
                ifsc_code,
                created_at,
                employee_ref_id,
                attendance_id,
                deployment_id,
                payroll_batch_id,
                client_id,
                professional_tax,
                total_deductions,
                employer_pf,
                employer_esic,
                total_employer_contribution,
                total_employer_cost,
                hra,
                conveyance,
                medical_allowance,
                other_allowance,
                gratuity,
                joining_date,
                pran,
                pf_wages
            `)
            .eq(
                "id",
                id
            )
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!payroll) {
            return sendError(
                res,
                404,
                "Payroll record not found"
            );
        }

        // --------------------------------------------------------
        // ATTENDANCE
        // --------------------------------------------------------

        const {
            attendance
        } =
            await getAttendanceForPayroll(
                payroll
            );

        // --------------------------------------------------------
        // DEPLOYMENT
        // --------------------------------------------------------

        let deployment = null;

        if (
            payroll.deployment_id
        ) {

            const {
                data,
                error
            } = await supabase
                .from("deployments")
                .select(`
                    id,
                    candidate_id,
                    client_id,
                    pay_rate,
                    bill_rate,
                    project_name,
                    billing_model,
                    start_date,
                    end_date,
                    status
                `)
                .eq(
                    "id",
                    payroll.deployment_id
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            deployment = data;
        }

        // --------------------------------------------------------
        // CLIENT
        // --------------------------------------------------------

        let client = null;

        const clientId =
            payroll.client_id ??
            deployment?.client_id ??
            null;

        if (clientId) {

            const {
                data,
                error
            } = await supabase
                .from("clients")
                .select(`
                    id,
                    company_name
                `)
                .eq(
                    "id",
                    clientId
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            client = data;
        }

        // --------------------------------------------------------
        // CANDIDATE
        // --------------------------------------------------------

        let candidate = null;

        const employeeId =
            payroll.employee_ref_id ??
            deployment?.candidate_id ??
            null;

        if (employeeId) {

            const {
                data,
                error
            } = await supabase
                .from("candidates")
                .select(`
                    id,
                    full_name,
                    email,
                    phone,
                    designation,
                    department,
                    date_of_joining,
                    bank_name,
                    bank_account_number,
                    ifsc_code,
                    pan_number,
                    uan_number,
                    esic_number,
                    gender,
                    pay_rate
                `)
                .eq(
                    "id",
                    employeeId
                )
                .maybeSingle();

            if (error) {
                throw error;
            }

            candidate = data;
        }

        // --------------------------------------------------------
        // FORMAT
        // --------------------------------------------------------

        const formatted =
            formatPayroll(
                {
                    ...payroll,

                    client_id:
                        clientId,

                    employee_ref_id:
                        employeeId,

                    employee_name:
                        payroll.employee_name ||
                        candidate?.full_name ||
                        attendance?.employee_name ||
                        "N/A"
                },
                attendance
            );

        // --------------------------------------------------------
        // ADD CLIENT DETAILS
        // --------------------------------------------------------

        formatted.client_name =
            client?.company_name ||
            "N/A";

        formatted.company_name =
            client?.company_name ||
            "N/A";

        // --------------------------------------------------------
        // ADD EMPLOYEE DETAILS
        // --------------------------------------------------------

        formatted.employee_email =
            candidate?.email ||
            "";

        formatted.phone =
            candidate?.phone ||
            "";

        formatted.designation =
            candidate?.designation ||
            "";

        formatted.department =
            candidate?.department ||
            "";

        formatted.joining_date =
            payroll.joining_date ||
            candidate?.date_of_joining ||
            null;

        formatted.pan_number =
            candidate?.pan_number ||
            "";

        formatted.uan_number =
            candidate?.uan_number ||
            "";

        formatted.esic_number =
            candidate?.esic_number ||
            "";

        formatted.gender =
            candidate?.gender ||
            "";

        // --------------------------------------------------------
        // BANK DETAILS
        // --------------------------------------------------------

        formatted.bank_name =
            payroll.bank_name ||
            candidate?.bank_name ||
            "";

        formatted.account_number =
            payroll.account_number ||
            candidate?.bank_account_number ||
            "";

        formatted.ifsc_code =
            payroll.ifsc_code ||
            candidate?.ifsc_code ||
            "";

        // --------------------------------------------------------
        // DEPLOYMENT DETAILS
        // --------------------------------------------------------

        formatted.project_name =
            deployment?.project_name ||
            null;

        formatted.pay_rate =
            Number(
                deployment?.pay_rate ||
                candidate?.pay_rate ||
                0
            );

        formatted.bill_rate =
            Number(
                deployment?.bill_rate ||
                0
            );

        formatted.billing_model =
            deployment?.billing_model ||
            null;

        formatted.deployment_status =
            deployment?.status ||
            null;

        formatted.start_date =
            deployment?.start_date ||
            null;

        formatted.end_date =
            deployment?.end_date ||
            null;

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.json({

            success: true,

            data:
                formatted
        });

    } catch (error) {

        console.error(
            "GET /api/payroll/:id:",
            error
        );

        return sendError(
            res,
            500,
            "Failed to fetch payroll",
            error.message
        );
    }
});

// ============================================================
// EXPORT
// ============================================================

module.exports = router;