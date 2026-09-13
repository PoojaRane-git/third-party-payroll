// ============================================================
// routes/payroll.js
// THIRD PARTY PAYROLL API
// ============================================================

const express = require("express");
const nodemailer = require("nodemailer");
const router = express.Router();

const supabase = require("../config/supabase");

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
//
// GET /api/payroll
// GET /api/payroll?client_id=1
// GET /api/payroll?client_id=1&salary_month=2026-08
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
                    status,
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
                    total_employer_cost
                `)
                .order("id", {
                    ascending: false
                });

        if (salaryMonth) {
            query =
                query.eq(
                    "salary_month",
                    salaryMonth
                );
        }

        if (clientId) {
            query =
                query.eq(
                    "client_id",
                    clientId
                );
        }

        const {
            data,
            error
        } = await query;

        if (error) {
            throw error;
        }

        // --------------------------------------------------------
        // ENRICH
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
//
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
                status,
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
                total_employer_cost
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

        if (payroll.deployment_id) {

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
                    designation
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

        formatted.client_name =
            client?.company_name ||
            "N/A";

        formatted.company_name =
            client?.company_name ||
            "N/A";

        formatted.employee_email =
            candidate?.email ||
            "";

        formatted.phone =
            candidate?.phone ||
            "";

        formatted.designation =
            candidate?.designation ||
            "";

        formatted.project_name =
            deployment?.project_name ||
            null;

        formatted.pay_rate =
            Number(
                deployment?.pay_rate || 0
            );

        formatted.bill_rate =
            Number(
                deployment?.bill_rate || 0
            );

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
// ============================================================

router.post("/generate", async (req, res) => {

    try {

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

        // --------------------------------------------------------
        // CLIENT
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // ATTENDANCE FROM
        // third_party_emp_attendance
        //
        // NO ATTENDANCE APPROVAL
        // --------------------------------------------------------

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

        const calendarDays =
            getDaysInMonth(
                validMonth
            );

        // --------------------------------------------------------
        // PAYROLL DIVISOR
        // --------------------------------------------------------

        const salaryDivisor = 26;

        const generated = [];
        const skipped = [];

        // --------------------------------------------------------
        // PROCESS ATTENDANCE
        // --------------------------------------------------------

        for (const attendance of attendanceRows) {

            try {

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

                // ------------------------------------------------
                // DEPLOYMENT
                // ------------------------------------------------

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

                // ------------------------------------------------
                // CLIENT VALIDATION
                // ------------------------------------------------

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

                // ------------------------------------------------
                // EMPLOYEE VALIDATION
                // ------------------------------------------------

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

                // ------------------------------------------------
                // ACTIVE DEPLOYMENT
                // ------------------------------------------------

                if (
                    deployment.status &&
                    String(
                        deployment.status
                    ).toLowerCase() !==
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

                // ------------------------------------------------
                // DUPLICATE PAYROLL CHECK
                // ------------------------------------------------

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

                // ------------------------------------------------
                // PAY RATE
                // ------------------------------------------------

                const payRate =
                    Number(
                        deployment.pay_rate || 0
                    );

                if (payRate <= 0) {

                    skipped.push({
                        attendance_id:
                            attendance.id,

                        employee_id:
                            employeeId,

                        reason:
                            "Invalid pay rate"
                    });

                    continue;
                }

                // ------------------------------------------------
                // ATTENDANCE
                // ------------------------------------------------

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
                    Number(
                        attendance.overtime_hours || 0
                    );

                const lopDays =
                    Math.max(
                        0,
                        Number(
                            attendance.lop_days || 0
                        )
                    );

                const payableDays =
                    Number(
                        attendance.payable_days ??
                        Math.max(
                            0,
                            presentDays +
                            leaveDays +
                            halfDays * 0.5
                        )
                    );

                // ------------------------------------------------
                // SALARY
                // ------------------------------------------------

                const basicSalary =
                    payRate;

                const allowances = 0;

                const bonus = 0;

                // ------------------------------------------------
                // LOP
                // ------------------------------------------------

                const dailyBasicRate =
                    basicSalary /
                    salaryDivisor;

                const lopDeduction =
                    Math.round(
                        dailyBasicRate *
                        lopDays
                    );

                // ------------------------------------------------
                // OVERTIME
                // ------------------------------------------------

                const normalHourlyRate =
                    basicSalary /
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

                // ------------------------------------------------
                // GROSS
                // ------------------------------------------------

                const grossSalary =
                    basicSalary +
                    allowances +
                    overtimeAmount +
                    bonus;

                // ------------------------------------------------
                // PF
                // ------------------------------------------------

                const pfBase =
                    Math.min(
                        basicSalary,
                        15000
                    );

                const employeePF =
                    Math.round(
                        pfBase * 0.12
                    );

                // ------------------------------------------------
                // ESIC
                // ------------------------------------------------

                const employeeESIC =
                    grossSalary <= 21000
                        ? Math.round(
                            grossSalary *
                            0.0075
                        )
                        : 0;

                // ------------------------------------------------
                // PT
                // ------------------------------------------------

                const professionalTax =
                    200;

                // ------------------------------------------------
                // TDS
                // ------------------------------------------------

                const taxTds = 0;

                // ------------------------------------------------
                // TOTAL DEDUCTIONS
                // ------------------------------------------------

                const totalDeductions =
                    employeePF +
                    employeeESIC +
                    taxTds +
                    professionalTax +
                    lopDeduction;

                // ------------------------------------------------
                // NET
                // ------------------------------------------------

                const netSalary =
                    Math.max(
                        0,
                        grossSalary -
                        totalDeductions
                    );

                // ------------------------------------------------
                // EMPLOYER PF
                // ------------------------------------------------

                const employerPF =
                    Math.round(
                        pfBase * 0.12
                    );

                // ------------------------------------------------
                // EMPLOYER ESIC
                // ------------------------------------------------

                const employerESIC =
                    grossSalary <= 21000
                        ? Math.round(
                            grossSalary *
                            0.0325
                        )
                        : 0;

                const totalEmployerContribution =
                    employerPF +
                    employerESIC;

                const totalEmployerCost =
                    grossSalary +
                    totalEmployerContribution;

                // ------------------------------------------------
                // CANDIDATE
                // ------------------------------------------------

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
                        designation
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

                // ------------------------------------------------
                // PAYROLL OBJECT
                // ------------------------------------------------

                generated.push({

                    employee_name:
                        candidate.full_name ||
                        attendance.employee_name,

                    salary_month:
                        validMonth,

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
                            overtimeAmount.toFixed(2)
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
                            employeePF.toFixed(2)
                        ),

                    esic:
                        Number(
                            employeeESIC.toFixed(2)
                        ),

                    tax:
                        Number(
                            taxTds.toFixed(2)
                        ),

                    lop:
                        Number(
                            lopDeduction.toFixed(2)
                        ),

                    net_salary:
                        Number(
                            netSalary.toFixed(2)
                        ),

                    bank_name:
                        null,

                    account_number:
                        null,

                    ifsc_code:
                        null,

                    status:
                        "Pending",

                    employee_ref_id:
                        employeeId,

                    attendance_id:
                        attendance.id,

                    deployment_id:
                        deploymentId,

                    payroll_batch_id:
                        null,

                    client_id:
                        clientId,

                    professional_tax:
                        Number(
                            professionalTax.toFixed(2)
                        ),

                    total_deductions:
                        Number(
                            totalDeductions.toFixed(2)
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
                        )
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

        // --------------------------------------------------------
        // NOTHING GENERATED
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // INSERT
        // --------------------------------------------------------

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

// ============================================================
// EMAIL PAYSLIP
//
// POST /api/payroll/:id/email
//
// ATTENDANCE SOURCE:
// third_party_emp_attendance ONLY
// ============================================================

router.post(
    "/:id/email",
    async (req, res) => {

        try {

            // ----------------------------------------------------
            // ID
            // ----------------------------------------------------

            const payrollId =
                getId(
                    req.params.id
                );

            if (!payrollId) {

                return sendError(
                    res,
                    400,
                    "Invalid payroll ID"
                );
            }

            // ----------------------------------------------------
            // EMAIL CONFIG
            // ----------------------------------------------------

            if (
                !EMAIL_USER ||
                !EMAIL_PASS
            ) {

                console.error(
                    "EMAIL_USER or EMAIL_PASS is missing"
                );

                return sendError(
                    res,
                    500,
                    "Email service is not configured. Please check EMAIL_USER and EMAIL_PASS."
                );
            }

            // ----------------------------------------------------
            // PAYROLL
            // ----------------------------------------------------

            const {
                data: payroll,
                error: payrollError
            } = await supabase
                .from(
                    "third_party_payroll"
                )
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
                    status,
                    employee_ref_id,
                    attendance_id,
                    deployment_id,
                    client_id,
                    professional_tax,
                    total_deductions,
                    employer_pf,
                    employer_esic,
                    total_employer_contribution,
                    total_employer_cost
                `)
                .eq(
                    "id",
                    payrollId
                )
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

            // ----------------------------------------------------
            // STATUS
            // ----------------------------------------------------

            const payrollStatus =
                String(
                    payroll.status || ""
                )
                .trim()
                .toLowerCase();

            if (
                payrollStatus !==
                    "approved" &&
                payrollStatus !==
                    "locked"
            ) {

                return sendError(
                    res,
                    400,
                    "Payslip can be emailed only after payroll is Approved or Locked."
                );
            }

            // ----------------------------------------------------
            // CANDIDATE
            // ----------------------------------------------------

            const candidateId =
                payroll.employee_ref_id;

            if (!candidateId) {

                return sendError(
                    res,
                    400,
                    "Candidate ID is missing"
                );
            }

            const {
                data: candidate,
                error: candidateError
            } = await supabase
                .from("candidates")
                .select(`
                    id,
                    full_name,
                    email,
                    designation
                `)
                .eq(
                    "id",
                    candidateId
                )
                .maybeSingle();

            if (candidateError) {
                throw candidateError;
            }

            if (!candidate) {

                return sendError(
                    res,
                    404,
                    "Candidate not found"
                );
            }

            // ----------------------------------------------------
            // EMAIL
            // ----------------------------------------------------

            const employeeEmail =
                String(
                    candidate.email || ""
                ).trim();

            if (!employeeEmail) {

                return sendError(
                    res,
                    400,
                    "Employee email address is not available"
                );
            }

            const emailRegex =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                !emailRegex.test(
                    employeeEmail
                )
            ) {

                return sendError(
                    res,
                    400,
                    `Invalid employee email address: ${employeeEmail}`
                );
            }

            const employeeName =
                candidate.full_name ||
                payroll.employee_name ||
                "Employee";

            // ----------------------------------------------------
            // ATTENDANCE
            //
            // SAME TABLE USED FOR PAYROLL + PAYSLIP
            // ----------------------------------------------------

            const {
                attendance
            } =
                await getAttendanceForPayroll(
                    payroll
                );

            const totalDays =
                attendance?.billing_month
                    ? getDaysInMonth(
                        attendance.billing_month
                    )
                    : getDaysInMonth(
                        payroll.salary_month
                    );

            const presentDays =
                Number(
                    attendance?.present_days ||
                    0
                );

            const absentDays =
                Number(
                    attendance?.absent_days ||
                    0
                );

            const leaveDays =
                Number(
                    attendance?.leave_days ||
                    0
                );

            const halfDays =
                Number(
                    attendance?.half_days ||
                    0
                );

            const lopDays =
                Number(
                    attendance?.lop_days ||
                    0
                );

            const payableDays =
                Number(
                    attendance?.payable_days ??
                    Math.max(
                        0,
                        presentDays +
                        leaveDays +
                        halfDays * 0.5
                    )
                );

            const overtimeHours =
                Number(
                    attendance?.overtime_hours ||
                    0
                );

            // ----------------------------------------------------
            // MONEY
            // ----------------------------------------------------

            const money = (value) =>
                Number(
                    value || 0
                ).toLocaleString(
                    "en-IN",
                    {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }
                );

            // ----------------------------------------------------
            // DEDUCTIONS
            // ----------------------------------------------------

            const totalDeductions =
                Number(
                    payroll.total_deductions ??
                    (
                        Number(payroll.pf || 0) +
                        Number(payroll.esic || 0) +
                        Number(payroll.tax || 0) +
                        Number(payroll.professional_tax || 0) +
                        Number(payroll.lop || 0)
                    )
                );

            const employerContribution =
                Number(
                    payroll.total_employer_contribution ??
                    (
                        Number(payroll.employer_pf || 0) +
                        Number(payroll.employer_esic || 0)
                    )
                );

            const employerCost =
                Number(
                    payroll.total_employer_cost ??
                    (
                        Number(payroll.gross_salary || 0) +
                        employerContribution
                    )
                );

            // ----------------------------------------------------
            // HTML
            // ----------------------------------------------------

            const html = `
<!DOCTYPE html>
<html>
<head>

<meta charset="UTF-8">

<style>

body {
    font-family: Arial, sans-serif;
    background: #f8fafc;
    margin: 0;
    padding: 30px;
    color: #0f172a;
}

.container {
    max-width: 700px;
    margin: auto;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 30px;
}

.header {
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 20px;
    margin-bottom: 20px;
}

h1 {
    margin: 0;
    font-size: 22px;
}

.subtitle {
    color: #64748b;
    font-size: 13px;
    margin-top: 5px;
}

.status {
    display: inline-block;
    margin-top: 10px;
    padding: 6px 12px;
    border-radius: 20px;
    background: #dcfce7;
    color: #166534;
    font-weight: bold;
    font-size: 12px;
}

.section {
    margin-top: 25px;
}

.section h3 {
    background: #f1f5f9;
    padding: 10px;
    font-size: 13px;
    text-transform: uppercase;
}

table {
    width: 100%;
    border-collapse: collapse;
}

td {
    padding: 9px 5px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
}

td:last-child {
    text-align: right;
    font-weight: bold;
}

.net {
    background: #ecfdf5;
    padding: 18px;
    margin-top: 20px;
    border-radius: 10px;
}

.net strong {
    font-size: 22px;
    color: #047857;
}

.footer {
    margin-top: 25px;
    color: #94a3b8;
    font-size: 11px;
    text-align: center;
}

</style>

</head>

<body>

<div class="container">

<div class="header">

<h1>
Talent Corner HR Services
</h1>

<div class="subtitle">
Payslip — ${payroll.salary_month}
</div>

<div class="status">
${payroll.status}
</div>

</div>

<div class="section">

<h3>
Employee Details
</h3>

<table>

<tr>
<td>Employee Name</td>
<td>${employeeName}</td>
</tr>

<tr>
<td>Employee ID</td>
<td>${candidateId}</td>
</tr>

<tr>
<td>Email</td>
<td>${employeeEmail}</td>
</tr>

<tr>
<td>Designation</td>
<td>${candidate.designation || "-"}</td>
</tr>

<tr>
<td>Client ID</td>
<td>${payroll.client_id || "-"}</td>
</tr>

<tr>
<td>Deployment ID</td>
<td>${payroll.deployment_id || "-"}</td>
</tr>

</table>

</div>

<div class="section">

<h3>
Attendance
</h3>

<table>

<tr>
<td>Total Days</td>
<td>${totalDays}</td>
</tr>

<tr>
<td>Present Days</td>
<td>${presentDays}</td>
</tr>

<tr>
<td>Absent Days</td>
<td>${absentDays}</td>
</tr>

<tr>
<td>Leave Days</td>
<td>${leaveDays}</td>
</tr>

<tr>
<td>Half Days</td>
<td>${halfDays}</td>
</tr>

<tr>
<td>LOP Days</td>
<td>${lopDays}</td>
</tr>

<tr>
<td>Payable Days</td>
<td>${payableDays}</td>
</tr>

<tr>
<td>Overtime Hours</td>
<td>${overtimeHours}</td>
</tr>

</table>

</div>

<div class="section">

<h3>
Earnings
</h3>

<table>

<tr>
<td>Basic Salary</td>
<td>₹${money(payroll.basic_salary)}</td>
</tr>

<tr>
<td>Allowances</td>
<td>₹${money(payroll.allowances)}</td>
</tr>

<tr>
<td>Overtime</td>
<td>₹${money(payroll.overtime)}</td>
</tr>

<tr>
<td>Bonus</td>
<td>₹${money(payroll.bonus)}</td>
</tr>

<tr>
<td><strong>Gross Earnings</strong></td>
<td>₹${money(payroll.gross_salary)}</td>
</tr>

</table>

</div>

<div class="section">

<h3>
Employee Deductions
</h3>

<table>

<tr>
<td>PF</td>
<td>₹${money(payroll.pf)}</td>
</tr>

<tr>
<td>ESIC</td>
<td>₹${money(payroll.esic)}</td>
</tr>

<tr>
<td>TDS</td>
<td>₹${money(payroll.tax)}</td>
</tr>

<tr>
<td>Professional Tax</td>
<td>₹${money(payroll.professional_tax)}</td>
</tr>

<tr>
<td>LOP</td>
<td>₹${money(payroll.lop)}</td>
</tr>

<tr>
<td><strong>Total Deductions</strong></td>
<td>₹${money(totalDeductions)}</td>
</tr>

</table>

</div>

<div class="net">

Net Salary Payable

<br>

<strong>
₹${money(payroll.net_salary)}
</strong>

</div>

<div class="section">

<h3>
Employer Contributions
</h3>

<table>

<tr>
<td>Employer PF</td>
<td>₹${money(payroll.employer_pf)}</td>
</tr>

<tr>
<td>Employer ESIC</td>
<td>₹${money(payroll.employer_esic)}</td>
</tr>

<tr>
<td>Total Employer Contribution</td>
<td>₹${money(employerContribution)}</td>
</tr>

<tr>
<td>Total Employer Cost</td>
<td>₹${money(employerCost)}</td>
</tr>

</table>

</div>

<div class="footer">

This is a system-generated payslip
from Talent Corner HR Services.

</div>

</div>

</body>
</html>
`;

            // ----------------------------------------------------
            // TRANSPORTER
            // ----------------------------------------------------

            const transporter =
                nodemailer.createTransport({
                    service: "gmail",

                    auth: {
                        user:
                            EMAIL_USER,

                        pass:
                            EMAIL_PASS
                    }
                });

            // ----------------------------------------------------
            // VERIFY
            // ----------------------------------------------------

            await transporter.verify();

            // ----------------------------------------------------
            // SEND
            // ----------------------------------------------------

            const mailResult =
                await transporter.sendMail({

                    from:
                        `"Talent Corner HR Services" <${EMAIL_USER}>`,

                    to:
                        employeeEmail,

                    subject:
                        `Payslip - ${payroll.salary_month} - ${employeeName}`,

                    html
                });

            console.log(
                `Payslip ${payrollId} sent to ${employeeEmail}`
            );

            return res.json({

                success: true,

                message:
                    `Payslip emailed successfully to ${employeeEmail}`,

                payroll_id:
                    payrollId,

                candidate_id:
                    candidateId,

                employee_email:
                    employeeEmail,

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
                "Failed to send payslip email",
                error.message
            );
        }
    }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;