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
        // ATTENDANCE
        //
        // Uses:
        // third_party_emp_attendance
        //
        // NO ATTENDANCE APPROVAL TABLE
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

        // --------------------------------------------------------
        // CALENDAR DAYS
        // --------------------------------------------------------

        const calendarDays =
            getDaysInMonth(
                validMonth
            );

        // --------------------------------------------------------
        // PAYROLL DIVISOR
        //
        // 26 is retained for overtime calculation,
        // matching your existing payroll logic.
        // --------------------------------------------------------

        const salaryDivisor = 26;

        const generated = [];
        const skipped = [];

        // --------------------------------------------------------
        // PROCESS ATTENDANCE
        // --------------------------------------------------------

        for (const attendance of attendanceRows) {

            try {

                // ------------------------------------------------
                // EMPLOYEE
                // ------------------------------------------------

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

                // ------------------------------------------------
                // DEPLOYMENT
                // ------------------------------------------------

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

                // ------------------------------------------------
                // PAY RATE
                //
                // Pay rate represents fixed monthly gross salary.
                // ------------------------------------------------

                const fixedGrossSalary =
                    Number(
                        deployment.pay_rate ||
                        candidate.pay_rate ||
                        0
                    );

                if (
                    !Number.isFinite(
                        fixedGrossSalary
                    ) ||
                    fixedGrossSalary <= 0
                ) {

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

                // ------------------------------------------------
                // PAYABLE DAYS
                //
                // Use attendance payable_days when available.
                // This is the authoritative attendance result.
                // ------------------------------------------------

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
                            halfDays * 0.5
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

                // ------------------------------------------------
                // SALARY STRUCTURE
                //
                // Fixed Gross
                //     ↓
                // Basic = 50%
                // HRA = 50% of Basic
                // Conveyance = 1200
                // Medical = 1000
                // Other = remaining amount
                // ------------------------------------------------

                const monthlyBasic =
                    Math.round(
                        fixedGrossSalary * 0.5
                    );

                const monthlyHRA =
                    Math.round(
                        monthlyBasic * 0.5
                    );

                const monthlyConveyance =
                    1200;

                const monthlyMedicalAllowance =
                    1000;

                const monthlyOtherAllowance =
                    Math.max(
                        0,
                        Math.round(
                            fixedGrossSalary -
                            monthlyBasic -
                            monthlyHRA -
                            monthlyConveyance -
                            monthlyMedicalAllowance
                        )
                    );

                // ------------------------------------------------
                // EARNED SALARY COMPONENTS
                //
                // Prorated using attendance payable days.
                // ------------------------------------------------

                const earnBasicSalary =
                    Math.round(
                        (
                            monthlyBasic /
                            totalDays
                        ) *
                        payableDays
                    );

                const earnHRA =
                    Math.round(
                        (
                            monthlyHRA /
                            totalDays
                        ) *
                        payableDays
                    );

                const earnConveyance =
                    Math.round(
                        (
                            monthlyConveyance /
                            totalDays
                        ) *
                        payableDays
                    );

                const earnMedicalAllowance =
                    Math.round(
                        (
                            monthlyMedicalAllowance /
                            totalDays
                        ) *
                        payableDays
                    );

                const earnOtherAllowance =
                    Math.round(
                        (
                            monthlyOtherAllowance /
                            totalDays
                        ) *
                        payableDays
                    );

                // ------------------------------------------------
                // OVERTIME
                //
                // Existing project rule:
                // monthly basic / 26 / 8 * 1.5
                // ------------------------------------------------

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

                // ------------------------------------------------
                // BONUS
                //
                // Existing PaySlip rule:
                // Admin / Accounts = 8.33%
                // ------------------------------------------------

                const department =
                    String(
                        candidate.department || ""
                    )
                        .trim()
                        .toLowerCase();

                const earnedFixedGross =
                    earnBasicSalary +
                    earnHRA +
                    earnConveyance +
                    earnMedicalAllowance +
                    earnOtherAllowance;

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

                // ------------------------------------------------
                // GROSS
                // ------------------------------------------------

                const grossSalary =
                    earnedFixedGross +
                    overtimeAmount +
                    bonus;

                // ------------------------------------------------
                // PF WAGES
                //
                // Same concept as old PaySlip:
                // earned gross excluding HRA.
                //
                // Overtime and bonus are included because they
                // are part of the third-party payroll gross.
                // ------------------------------------------------

                const pfWages =
                    Math.max(
                        0,
                        grossSalary -
                        earnHRA
                    );

                // ------------------------------------------------
                // EMPLOYEE PF
                //
                // Existing project rule:
                // 12% of PF wages capped at 15,000.
                // ------------------------------------------------

                const pfBase =
                    Math.min(
                        pfWages,
                        15000
                    );

                const employeePF =
                    Math.round(
                        pfBase *
                        0.12
                    );

                // ------------------------------------------------
                // ESIC
                //
                // Existing project rule:
                // 0.75% when gross <= 21,000.
                // ------------------------------------------------

                const esicApplicable =
                    !!candidate.esic_number;

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

                // ------------------------------------------------
                // PROFESSIONAL TAX
                //
                // Existing PaySlip rule:
                // ₹200 when gross > ₹25,000.
                // ------------------------------------------------

                const professionalTax =
                    (
                        grossSalary > 25000 &&
                        (
                            String(
                                candidate.gender || ""
                            )
                                .toLowerCase() ===
                            "female" ||

                            String(
                                candidate.gender || ""
                            )
                                .toLowerCase() ===
                            "male"
                        )
                    )
                        ? 200
                        : 0;

                // ------------------------------------------------
                // TDS
                // ------------------------------------------------

                const taxTds = 0;

                // ------------------------------------------------
                // LOP
                //
                // payable_days already reflects attendance.
                // Therefore the salary components are already
                // prorated for unpaid days.
                //
                // We do not deduct LOP a second time.
                // ------------------------------------------------

                const lopDeduction = 0;

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
                // GRATUITY
                //
                // Existing PaySlip rule:
                // 4.81% of earned basic.
                // ------------------------------------------------

                const gratuity =
                    Math.round(
                        earnBasicSalary *
                        0.0481
                    );

                // ------------------------------------------------
                // EMPLOYER PF
                // ------------------------------------------------

                const employerPF =
                    Math.round(
                        pfBase *
                        0.12
                    );

                // ------------------------------------------------
                // EMPLOYER ESIC
                // ------------------------------------------------

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

                // ------------------------------------------------
                // EMPLOYER CONTRIBUTION
                // ------------------------------------------------

                const totalEmployerContribution =
                    employerPF +
                    employerESIC;

                // ------------------------------------------------
                // EMPLOYER COST
                // ------------------------------------------------

                const totalEmployerCost =
                    grossSalary +
                    totalEmployerContribution +
                    gratuity;

                // ------------------------------------------------
                // PAYROLL OBJECT
                // ------------------------------------------------

                generated.push({

                    employee_name:
                        candidate.full_name ||
                        attendance.employee_name,

                    salary_month:
                        validMonth,

                    // ------------------------------------------------
                    // FIXED / EARNED SALARY
                    // ------------------------------------------------

                    basic_salary:
                        Number(
                            earnBasicSalary.toFixed(2)
                        ),

                    allowances:
                        0,

                    hra:
                        Number(
                            earnHRA.toFixed(2)
                        ),

                    conveyance:
                        Number(
                            earnConveyance.toFixed(2)
                        ),

                    medical_allowance:
                        Number(
                            earnMedicalAllowance.toFixed(2)
                        ),

                    other_allowance:
                        Number(
                            earnOtherAllowance.toFixed(2)
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

                    // ------------------------------------------------
                    // EMPLOYEE DEDUCTIONS
                    // ------------------------------------------------

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

                    professional_tax:
                        Number(
                            professionalTax.toFixed(2)
                        ),

                    lop:
                        Number(
                            lopDeduction.toFixed(2)
                        ),

                    total_deductions:
                        Number(
                            totalDeductions.toFixed(2)
                        ),

                    net_salary:
                        Number(
                            netSalary.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // EMPLOYER
                    // ------------------------------------------------

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

                    gratuity:
                        Number(
                            gratuity.toFixed(2)
                        ),

                    // ------------------------------------------------
                    // EMPLOYEE INFORMATION
                    // ------------------------------------------------

                    joining_date:
                        candidate.date_of_joining ||
                        null,

                    pran:
                        candidate.uan_number ||
                        null,

                    pf_wages:
                        Number(
                            pfWages.toFixed(2)
                        ),

                    bank_name:
                        candidate.bank_name ||
                        null,

                    account_number:
                        candidate.bank_account_number ||
                        null,

                    ifsc_code:
                        candidate.ifsc_code ||
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

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

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
// Generates PDF payslip and sends it to employee.
//
// ATTENDANCE SOURCE:
// third_party_emp_attendance ONLY
// ============================================================

// router.post("/:id/email", async (req, res) => {
//     let browser = null;

//     try {
//         // ========================================================
//         // ID
//         // ========================================================

//         const payrollId = getId(req.params.id);

//         if (!payrollId) {
//             return sendError(
//                 res,
//                 400,
//                 "Invalid payroll ID"
//             );
//         }

//         // ========================================================
//         // EMAIL CONFIG
//         // ========================================================

//         if (!EMAIL_USER || !EMAIL_PASS) {
//             console.error(
//                 "EMAIL_USER or EMAIL_PASS is missing"
//             );

//             return sendError(
//                 res,
//                 500,
//                 "Email service is not configured. Please check EMAIL_USER and EMAIL_PASS."
//             );
//         }

//         // ========================================================
//         // GET PAYROLL
//         // ========================================================

//         const {
//             data: payroll,
//             error: payrollError
//         } = await supabase
//             .from("third_party_payroll")
//             .select(`
//                 id,
//                 employee_name,
//                 salary_month,

//                 basic_salary,
//                 allowances,
//                 overtime,
//                 bonus,
//                 gross_salary,

//                 pf,
//                 esic,
//                 tax,
//                 professional_tax,
//                 lop,

//                 net_salary,

//                 status,

//                 employee_ref_id,
//                 attendance_id,
//                 deployment_id,
//                 client_id,

//                 bank_name,
//                 account_number,
//                 ifsc_code,

//                 total_deductions,

//                 employer_pf,
//                 employer_esic,
//                 total_employer_contribution,
//                 total_employer_cost,

//                 created_at
//             `)
//             .eq("id", payrollId)
//             .maybeSingle();

//         if (payrollError) {
//             console.error(
//                 "Payroll fetch error:",
//                 payrollError
//             );

//             throw payrollError;
//         }

//         if (!payroll) {
//             return sendError(
//                 res,
//                 404,
//                 "Payroll record not found"
//             );
//         }

//         // ========================================================
//         // STATUS
//         // ========================================================

//         const payrollStatus = String(
//             payroll.status || ""
//         )
//             .trim()
//             .toLowerCase();

//         if (
//             payrollStatus !== "approved" &&
//             payrollStatus !== "locked"
//         ) {
//             return sendError(
//                 res,
//                 400,
//                 "Payslip can be emailed only after payroll is Approved or Locked."
//             );
//         }

//         // ========================================================
//         // CANDIDATE
//         // ========================================================

//         const candidateId =
//             payroll.employee_ref_id;

//         if (!candidateId) {
//             return sendError(
//                 res,
//                 400,
//                 "Candidate ID is missing"
//             );
//         }

//         const {
//             data: candidate,
//             error: candidateError
//         } = await supabase
//             .from("candidates")
//             .select(`
//                 id,
//                 full_name,
//                 email,
//                 designation,
//                 employee_id,
//                 date_of_joining,
//                 location
//             `)
//             .eq("id", candidateId)
//             .maybeSingle();

//         if (candidateError) {
//             console.error(
//                 "Candidate fetch error:",
//                 candidateError
//             );

//             throw candidateError;
//         }

//         if (!candidate) {
//             return sendError(
//                 res,
//                 404,
//                 "Candidate not found"
//             );
//         }

//         // ========================================================
//         // EMPLOYEE EMAIL
//         // ========================================================

//         const employeeEmail = String(
//             candidate.email || ""
//         ).trim();

//         if (!employeeEmail) {
//             return sendError(
//                 res,
//                 400,
//                 "Employee email address is not available"
//             );
//         }

//         const emailRegex =
//             /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//         if (!emailRegex.test(employeeEmail)) {
//             return sendError(
//                 res,
//                 400,
//                 `Invalid employee email address: ${employeeEmail}`
//             );
//         }

//         // ========================================================
//         // EMPLOYEE NAME
//         // ========================================================

//         const employeeName =
//             candidate.full_name ||
//             payroll.employee_name ||
//             "Employee";

//         // ========================================================
//         // DEPLOYMENT
//         // ========================================================

//         let deployment = null;

//         if (payroll.deployment_id) {
//             const {
//                 data: deploymentData,
//                 error: deploymentError
//             } = await supabase
//                 .from("deployments")
//                 .select(`
//                     id,
//                     employee_id,
//                     client_id,
//                     project_name,
//                     pay_rate,
//                     bill_rate,
//                     start_date,
//                     end_date,
//                     status,
//                     work_location
//                 `)
//                 .eq(
//                     "id",
//                     payroll.deployment_id
//                 )
//                 .maybeSingle();

//             if (deploymentError) {
//                 console.error(
//                     "Deployment fetch error:",
//                     deploymentError
//                 );
//             }

//             deployment = deploymentData;
//         }

//         // ========================================================
//         // CLIENT
//         // ========================================================

//         let client = null;

//         if (payroll.client_id) {
//             const {
//                 data: clientData,
//                 error: clientError
//             } = await supabase
//                 .from("clients")
//                 .select(`
//                     id,
//                     company_name
//                 `)
//                 .eq(
//                     "id",
//                     payroll.client_id
//                 )
//                 .maybeSingle();

//             if (clientError) {
//                 console.error(
//                     "Client fetch error:",
//                     clientError
//                 );
//             }

//             client = clientData;
//         }

//         // ========================================================
//         // ATTENDANCE
//         // ========================================================

//         const {
//             attendance
//         } = await getAttendanceForPayroll(
//             payroll
//         );

//         const totalDays =
//             attendance?.billing_month
//                 ? getDaysInMonth(
//                       attendance.billing_month
//                   )
//                 : getDaysInMonth(
//                       payroll.salary_month
//                   );

//         const presentDays = Number(
//             attendance?.present_days || 0
//         );

//         const absentDays = Number(
//             attendance?.absent_days || 0
//         );

//         const leaveDays = Number(
//             attendance?.leave_days || 0
//         );

//         const halfDays = Number(
//             attendance?.half_days || 0
//         );

//         const lopDays = Number(
//             attendance?.lop_days || 0
//         );

//         const payableDays = Number(
//             attendance?.payable_days ??
//                 Math.max(
//                     0,
//                     presentDays +
//                         leaveDays +
//                         halfDays * 0.5
//                 )
//         );

//         const overtimeHours = Number(
//             attendance?.overtime_hours || 0
//         );

//         // ========================================================
//         // MONEY
//         // ========================================================

//         const money = (value) => {
//             return Number(value || 0).toLocaleString(
//                 "en-IN",
//                 {
//                     minimumFractionDigits: 2,
//                     maximumFractionDigits: 2
//                 }
//             );
//         };

//         // ========================================================
//         // SAFE HTML
//         // ========================================================

//         const escapeHtml = (value) => {
//             return String(value ?? "")
//                 .replace(/&/g, "&amp;")
//                 .replace(/</g, "&lt;")
//                 .replace(/>/g, "&gt;")
//                 .replace(/"/g, "&quot;")
//                 .replace(/'/g, "&#039;");
//         };

//         const safe = (
//             value,
//             fallback = "N/A"
//         ) => {
//             if (
//                 value === null ||
//                 value === undefined ||
//                 String(value).trim() === ""
//             ) {
//                 return fallback;
//             }

//             return String(value);
//         };

//         // ========================================================
//         // MONTH / DATE
//         // ========================================================

//         const salaryMonth =
//             payroll.salary_month || "";

//         let monthStart = "N/A";
//         let monthEnd = "N/A";
//         let monthName = "N/A";

//         if (/^\d{4}-\d{2}$/.test(salaryMonth)) {
//             const [year, month] =
//                 salaryMonth
//                     .split("-")
//                     .map(Number);

//             const firstDay =
//                 new Date(
//                     year,
//                     month - 1,
//                     1
//                 );

//             const lastDay =
//                 new Date(
//                     year,
//                     month,
//                     0
//                 );

//             const formatDate = (date) => {
//                 return date.toLocaleDateString(
//                     "en-IN",
//                     {
//                         day: "numeric",
//                         month: "short",
//                         year: "numeric"
//                     }
//                 );
//             };

//             monthStart =
//                 formatDate(firstDay);

//             monthEnd =
//                 formatDate(lastDay);

//             monthName =
//                 firstDay.toLocaleDateString(
//                     "en-IN",
//                     {
//                         month: "long",
//                         year: "numeric"
//                     }
//                 );
//         }

//         // ========================================================
//         // DATE OF JOINING
//         // ========================================================

//         const dateOfJoining =
//             candidate.date_of_joining
//                 ? new Date(
//                       candidate.date_of_joining
//                   ).toLocaleDateString(
//                       "en-IN",
//                       {
//                           day: "2-digit",
//                           month: "2-digit",
//                           year: "numeric"
//                       }
//                   )
//                 : "N/A";

//         // ========================================================
//         // EMPLOYEE NUMBER
//         // ========================================================

//         const employeeNumber = safe(
//             candidate.employee_id ||
//                 deployment?.employee_id ||
//                 candidate.id,
//             "N/A"
//         );

//         // ========================================================
//         // LOCATION
//         // ========================================================

//         const location = safe(
//             deployment?.work_location ||
//                 candidate.location,
//             "Head Office"
//         );

//         // ========================================================
//         // SALARY VALUES
//         // ========================================================

//         const basicSalary = Number(
//             payroll.basic_salary || 0
//         );

//         const allowances = Number(
//             payroll.allowances || 0
//         );

//         const overtime = Number(
//             payroll.overtime || 0
//         );

//         const bonus = Number(
//             payroll.bonus || 0
//         );

//         const grossSalary = Number(
//             payroll.gross_salary ??
//                 (
//                     basicSalary +
//                     allowances +
//                     overtime +
//                     bonus
//                 )
//         );

//         const pf = Number(
//             payroll.pf || 0
//         );

//         const esic = Number(
//             payroll.esic || 0
//         );

//         const tax = Number(
//             payroll.tax || 0
//         );

//         const professionalTax =
//             Number(
//                 payroll.professional_tax || 0
//             );

//         const lop = Number(
//             payroll.lop || 0
//         );

//         const totalDeductions =
//             Number(
//                 payroll.total_deductions ??
//                     (
//                         pf +
//                         esic +
//                         tax +
//                         professionalTax +
//                         lop
//                     )
//             );

//         const netSalary = Number(
//             payroll.net_salary ??
//                 Math.max(
//                     0,
//                     grossSalary -
//                         totalDeductions
//                 )
//         );

//         const employerPf = Number(
//             payroll.employer_pf || 0
//         );

//         const employerEsic = Number(
//             payroll.employer_esic || 0
//         );

//         const employerContribution =
//             Number(
//                 payroll.total_employer_contribution ??
//                     (
//                         employerPf +
//                         employerEsic
//                     )
//             );

//         const employerCost =
//             Number(
//                 payroll.total_employer_cost ??
//                     (
//                         grossSalary +
//                         employerContribution
//                     )
//             );

//         // ========================================================
//         // AMOUNT IN WORDS
//         // ========================================================

//         const numberToWords = (number) => {
//             const ones = [
//                 "",
//                 "One",
//                 "Two",
//                 "Three",
//                 "Four",
//                 "Five",
//                 "Six",
//                 "Seven",
//                 "Eight",
//                 "Nine",
//                 "Ten",
//                 "Eleven",
//                 "Twelve",
//                 "Thirteen",
//                 "Fourteen",
//                 "Fifteen",
//                 "Sixteen",
//                 "Seventeen",
//                 "Eighteen",
//                 "Nineteen"
//             ];

//             const tens = [
//                 "",
//                 "",
//                 "Twenty",
//                 "Thirty",
//                 "Forty",
//                 "Fifty",
//                 "Sixty",
//                 "Seventy",
//                 "Eighty",
//                 "Ninety"
//             ];

//             const belowThousand = (
//                 num
//             ) => {
//                 let result = "";

//                 if (num >= 100) {
//                     result +=
//                         ones[
//                             Math.floor(
//                                 num / 100
//                             )
//                         ] +
//                         " Hundred ";

//                     num %= 100;
//                 }

//                 if (num >= 20) {
//                     result +=
//                         tens[
//                             Math.floor(
//                                 num / 10
//                             )
//                         ] +
//                         " ";

//                     num %= 10;
//                 }

//                 if (num > 0) {
//                     result +=
//                         ones[num] +
//                         " ";
//                 }

//                 return result.trim();
//             };

//             number = Math.floor(
//                 Number(number || 0)
//             );

//             if (number === 0) {
//                 return "Zero";
//             }

//             let result = "";

//             const crore =
//                 Math.floor(
//                     number / 10000000
//                 );

//             number %= 10000000;

//             const lakh =
//                 Math.floor(
//                     number / 100000
//                 );

//             number %= 100000;

//             const thousand =
//                 Math.floor(
//                     number / 1000
//                 );

//             number %= 1000;

//             if (crore) {
//                 result +=
//                     belowThousand(crore) +
//                     " Crore ";
//             }

//             if (lakh) {
//                 result +=
//                     belowThousand(lakh) +
//                     " Lakh ";
//             }

//             if (thousand) {
//                 result +=
//                     belowThousand(thousand) +
//                     " Thousand ";
//             }

//             if (number) {
//                 result +=
//                     belowThousand(number);
//             }

//             return result.trim();
//         };

//         const amountInWords =
//             `INR ${numberToWords(
//                 netSalary
//             )} Rupees only`;

//         // ========================================================
//         // HTML PAYSLIP
//         //
//         // This follows the uploaded payslip structure.
//         // ========================================================

//         const html = `
// <!DOCTYPE html>

// <html>

// <head>

// <meta charset="UTF-8">

// <title>
// Payslip - ${escapeHtml(employeeName)}
// </title>

// <style>

// @page {
//     size: A4;
//     margin: 0;
// }

// * {
//     box-sizing: border-box;
// }

// html,
// body {
//     margin: 0;
//     padding: 0;
//     width: 210mm;
//     min-height: 297mm;
//     background: #ffffff;
//     font-family: Arial, Helvetica, sans-serif;
//     color: #111111;
// }

// .page {
//     width: 210mm;
//     min-height: 297mm;
//     padding: 11mm 17mm;
//     background: #ffffff;
// }

// .company-header {
//     margin-bottom: 17px;
// }

// .company-name {
//     font-size: 17px;
//     font-weight: 700;
//     margin-bottom: 7px;
// }

// .company-address {
//     font-size: 9px;
//     line-height: 1.35;
// }

// .pay-slip-box {
//     width: 100%;
//     min-height: 245mm;
//     border: 2px solid #111111;
//     padding: 10px 12px;
// }

// .pay-slip-heading {
//     border-bottom: 1px solid #111111;
//     padding-bottom: 7px;
// }

// .pay-slip-title {
//     font-size: 16px;
//     font-weight: 700;
// }

// .pay-slip-period {
//     font-size: 10px;
//     margin-top: 2px;
// }

// .center-heading {
//     text-align: center;
//     font-size: 13px;
//     font-weight: 700;
//     line-height: 1.3;
//     padding: 10px 0;
//     border-bottom: 1px solid #111111;
// }

// .employee-info {
//     width: 100%;
//     display: table;
//     margin-top: 9px;
//     margin-bottom: 15px;
// }

// .employee-column {
//     display: table-cell;
//     vertical-align: top;
//     width: 50%;
// }

// .info-row {
//     display: table;
//     width: 100%;
//     min-height: 17px;
//     font-size: 9px;
// }

// .info-label {
//     display: table-cell;
//     width: 112px;
//     vertical-align: top;
// }

// .info-value {
//     display: table-cell;
//     font-weight: 700;
//     vertical-align: top;
// }

// .salary-section {
//     border-top: 1px solid #111111;
//     padding-top: 8px;
// }

// .salary-table {
//     width: 100%;
//     border-collapse: collapse;
//     table-layout: fixed;
//     font-size: 9px;
// }

// .salary-table th {
//     background: #f2f2f2;
//     border: 1px solid #b8b8b8;
//     padding: 5px 4px;
//     font-weight: 700;
//     text-align: left;
// }

// .salary-table td {
//     border: 1px solid #cccccc;
//     padding: 4px;
//     height: 18px;
//     vertical-align: middle;
// }

// .salary-table .amount {
//     text-align: right;
//     white-space: nowrap;
// }

// .salary-table .total {
//     font-weight: 700;
//     background: #f3f3f3;
// }

// .net-row td {
//     font-weight: 700;
// }

// .amount-words {
//     border-top: 1px solid #999999;
//     margin-top: 7px;
//     padding-top: 7px;
//     font-size: 9px;
//     line-height: 1.5;
// }

// .amount-words-title {
//     font-weight: 700;
//     margin-bottom: 4px;
// }

// .signature-area {
//     position: relative;
//     border-top: 1px solid #999999;
//     margin-top: 15px;
//     height: 105px;
// }

// /*
// ============================================================
// LOGO IMAGE
// ============================================================

// Replace YOUR_LOGO_IMAGE_HERE with your actual logo.

// Example:

// src="file:///home/pooja/Desktop/Talent-Corner/logo.png"

// or:

// src="cid:talent-corner-logo"

// ============================================================
// */

// .logo-image {
//     position: absolute;
//     right: 15px;
//     top: 12px;
//     width: 95px;
//     height: auto;
//     object-fit: contain;
// }

// /*
// ============================================================
// SIGNATURE IMAGE
// ============================================================
// */

// .signature-image {
//     position: absolute;
//     right: 128px;
//     top: 25px;
//     width: 70px;
//     height: 40px;
//     object-fit: contain;
// }

// /*
// ============================================================
// STAMP IMAGE
// ============================================================

// Replace YOUR_STAMP_IMAGE_HERE with actual stamp.

// ============================================================
// */

// .stamp-image {
//     position: absolute;
//     right: 17px;
//     top: 22px;
//     width: 68px;
//     height: 68px;
//     object-fit: contain;
// }

// .authorised {
//     position: absolute;
//     right: 5px;
//     top: 91px;
//     width: 92px;
//     text-align: center;
//     font-size: 8px;
// }

// .footer-note {
//     text-align: center;
//     font-size: 7px;
//     color: #555555;
//     margin-top: 6px;
// }

// </style>

// </head>

// <body>

// <div class="page">

//     <!-- ====================================================
//          COMPANY HEADER
//          ==================================================== -->

//     <div class="company-header">

//         <div class="company-name">
//             Talent Corner HR Services Pvt Ltd.
//         </div>

//         <div class="company-address">

//             708/709, Bhaveshwar Arcade NX<br>

//             Opp Shreyas Cinema, LBS Marg, Ghatkopar(W),<br>

//             Mumbai-400086<br>

//             UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)<br>

//             E-Mail : accounts@talentcorner.in

//         </div>

//     </div>


//     <!-- ====================================================
//          PAYSLIP
//          ==================================================== -->

//     <div class="pay-slip-box">

//         <!-- PAYSLIP TITLE -->

//         <div class="pay-slip-heading">

//             <div class="pay-slip-title">
//                 Pay Slip
//             </div>

//             <div class="pay-slip-period">
//                 for ${escapeHtml(monthStart)}
//                 to ${escapeHtml(monthEnd)}
//             </div>

//         </div>


//         <!-- CENTER TITLE -->

//         <div class="center-heading">

//             Pay Slip for
//             ${escapeHtml(monthStart)}
//             to
//             ${escapeHtml(monthEnd)}

//             <br>

//             ${escapeHtml(
//                 employeeName
//             ).toUpperCase()}

//         </div>


//         <!-- =================================================
//              EMPLOYEE DETAILS
//              ================================================= -->

//         <div class="employee-info">

//             <!-- LEFT -->

//             <div class="employee-column">

//                 <div class="info-row">
//                     <div class="info-label">
//                         Employee Number:
//                     </div>

//                     <div class="info-value">
//                         ${escapeHtml(
//                             employeeNumber
//                         )}
//                     </div>
//                 </div>


//                 <div class="info-row">
//                     <div class="info-label">
//                         Function:
//                     </div>

//                     <div class="info-value">
//                         CS
//                     </div>
//                 </div>


//                 <div class="info-row">
//                     <div class="info-label">
//                         Designation:
//                     </div>

//                     <div class="info-value">
//                         ${escapeHtml(
//                             safe(
//                                 candidate.designation
//                             )
//                         )}
//                     </div>
//                 </div>


//                 <div class="info-row">
//                     <div class="info-label">
//                         Location:
//                     </div>

//                     <div class="info-value">
//                         ${escapeHtml(
//                             location
//                         )}
//                     </div>
//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         Bank Details:
//                     </div>

//                     <div class="info-value">

//                         Name -
//                         ${escapeHtml(
//                             payroll.bank_name ||
//                                 "N/A"
//                         )}

//                         <br>

//                         BRANCH -
//                         N/A

//                         <br>

//                         IFSC code -
//                         ${escapeHtml(
//                             payroll.ifsc_code ||
//                                 "N/A"
//                         )}

//                         <br>

//                         ACC NO. -
//                         ${escapeHtml(
//                             payroll.account_number ||
//                                 "N/A"
//                         )}

//                     </div>

//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         Date of joining:
//                     </div>

//                     <div class="info-value">
//                         ${escapeHtml(
//                             dateOfJoining
//                         )}
//                     </div>

//                 </div>

//             </div>


//             <!-- RIGHT -->

//             <div class="employee-column">

//                 <div class="info-row">

//                     <div class="info-label">
//                         Tax Regime:
//                     </div>

//                     <div class="info-value">
//                         Regular Tax Regime
//                     </div>

//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         Income Tax Number
//                         (PAN):
//                     </div>

//                     <div class="info-value">
//                         N/A
//                     </div>

//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         Universal Account
//                     </div>

//                     <div class="info-value">
//                         N/A
//                     </div>

//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         Number (UAN):
//                     </div>

//                     <div class="info-value">
//                         N/A
//                     </div>

//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         PF account number:
//                     </div>

//                     <div class="info-value">
//                         N/A
//                     </div>

//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         ESI Number:
//                     </div>

//                     <div class="info-value">
//                         N/A
//                     </div>

//                 </div>


//                 <div class="info-row">

//                     <div class="info-label">
//                         PR Account Number
//                         (PRAN):
//                     </div>

//                     <div class="info-value">
//                         N/A
//                     </div>

//                 </div>

//             </div>

//         </div>


//         <!-- =================================================
//              SALARY TABLE
//              ================================================= -->

//         <div class="salary-section">

//             <table class="salary-table">

//                 <thead>

//                     <tr>

//                         <th style="width:23%;">
//                             Earnings
//                         </th>

//                         <th style="width:13%;">
//                             Amount
//                         </th>

//                         <th style="width:13%;">
//                             Gross Salary
//                         </th>

//                         <th style="width:23%;">
//                             Deductions
//                         </th>

//                         <th style="width:13%;">
//                             Amount
//                         </th>

//                         <th style="width:13%;">
//                             Gross Salary
//                         </th>

//                     </tr>

//                 </thead>


//                 <tbody>

//                     <!-- BASIC -->

//                     <tr>

//                         <td>
//                             Basic Salary
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 basicSalary
//                             )}
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 basicSalary
//                             )}
//                         </td>

//                         <td>
//                             Provident Fund
//                         </td>

//                         <td class="amount">
//                             ${money(pf)}
//                         </td>

//                         <td class="amount">
//                             -
//                         </td>

//                     </tr>


//                     <!-- ALLOWANCES -->

//                     <tr>

//                         <td>
//                             HRA / Allowances
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 allowances
//                             )}
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 allowances
//                             )}
//                         </td>

//                         <td>
//                             ${
//                                 esic > 0
//                                     ? "ESIC"
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 esic > 0
//                                     ? money(esic)
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 esic > 0
//                                     ? "-"
//                                     : ""
//                             }
//                         </td>

//                     </tr>


//                     <!-- OVERTIME -->

//                     <tr>

//                         <td>
//                             Overtime
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 overtime
//                             )}
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 overtime
//                             )}
//                         </td>

//                         <td>
//                             ${
//                                 tax > 0
//                                     ? "Income Tax"
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 tax > 0
//                                     ? money(tax)
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 tax > 0
//                                     ? "-"
//                                     : ""
//                             }
//                         </td>

//                     </tr>


//                     <!-- BONUS -->

//                     <tr>

//                         <td>
//                             Bonus
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 bonus
//                             )}
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 bonus
//                             )}
//                         </td>

//                         <td>
//                             ${
//                                 professionalTax > 0
//                                     ? "Professional Tax"
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 professionalTax > 0
//                                     ? money(
//                                           professionalTax
//                                       )
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 professionalTax > 0
//                                     ? "-"
//                                     : ""
//                             }
//                         </td>

//                     </tr>


//                     <!-- LOP -->

//                     <tr>

//                         <td>
//                             LOP
//                         </td>

//                         <td class="amount">
//                             ${money(lop)}
//                         </td>

//                         <td class="amount">
//                             ${money(lop)}
//                         </td>

//                         <td>
//                             ${
//                                 lop > 0
//                                     ? "Loss of Pay"
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 lop > 0
//                                     ? money(lop)
//                                     : ""
//                             }
//                         </td>

//                         <td class="amount">
//                             ${
//                                 lop > 0
//                                     ? "-"
//                                     : ""
//                             }
//                         </td>

//                     </tr>


//                     <!-- EMPTY ROW -->

//                     <tr>

//                         <td></td>
//                         <td></td>
//                         <td></td>

//                         <td></td>
//                         <td></td>
//                         <td></td>

//                     </tr>


//                     <!-- TOTAL -->

//                     <tr class="total">

//                         <td>
//                             Total Earnings
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 grossSalary
//                             )}
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 grossSalary
//                             )}
//                         </td>

//                         <td>
//                             Total Deductions
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 totalDeductions
//                             )}
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 totalDeductions
//                             )}
//                         </td>

//                     </tr>


//                     <!-- NET -->

//                     <tr class="net-row">

//                         <td></td>

//                         <td></td>

//                         <td></td>

//                         <td>
//                             Net Amount
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 netSalary
//                             )}
//                         </td>

//                         <td class="amount">
//                             ${money(
//                                 netSalary
//                             )}
//                         </td>

//                     </tr>

//                 </tbody>

//             </table>


//             <!-- =================================================
//                  AMOUNT IN WORDS
//                  ================================================= -->

//             <div class="amount-words">

//                 <div class="amount-words-title">
//                     Amount (in words):
//                 </div>

//                 ${escapeHtml(
//                     amountInWords
//                 )}

//             </div>


//             <!-- =================================================
//                  SIGNATURE / STAMP / LOGO
//                  ================================================= -->

//             <div class="signature-area">

//                 <!-- =================================================
//                      LOGO IMAGE TAG

//                      PUT YOUR LOGO PATH HERE
//                      ================================================= -->

//                 <img
//                     class="logo-image"
//                     src="YOUR_LOGO_IMAGE_HERE"
//                     alt="Talent Corner Logo"
//                 />


//                 <!-- =================================================
//                      SIGNATURE IMAGE TAG
//                      ================================================= -->

//                 <img
//                     class="signature-image"
//                     src="YOUR_SIGNATURE_IMAGE_HERE"
//                     alt="Authorised Signature"
//                 />


//                 <!-- =================================================
//                      STAMP IMAGE TAG

//                      PUT YOUR STAMP PATH HERE
//                      ================================================= -->

//                 <img
//                     class="stamp-image"
//                     src="YOUR_STAMP_IMAGE_HERE"
//                     alt="Talent Corner Stamp"
//                 />


//                 <div class="authorised">
//                     Authorised Signatory
//                 </div>

//             </div>

//         </div>

//     </div>

// </div>

// </body>

// </html>
// `;

//         // ========================================================
//         // PUPPETEER
//         // ========================================================

//         const puppeteer =
//             require("puppeteer");

//         browser = await puppeteer.launch({
//             headless: true,

//             args: [
//                 "--no-sandbox",
//                 "--disable-setuid-sandbox",
//                 "--disable-dev-shm-usage"
//             ]
//         });

//         const page =
//             await browser.newPage();

//         await page.setContent(
//             html,
//             {
//                 waitUntil: "networkidle0"
//             }
//         );

//         // ========================================================
//         // GENERATE PDF
//         // ========================================================

//         const pdfBuffer =
//             await page.pdf({
//                 format: "A4",
//                 printBackground: true,
//                 preferCSSPageSize: true,

//                 margin: {
//                     top: "0mm",
//                     right: "0mm",
//                     bottom: "0mm",
//                     left: "0mm"
//                 }
//             });

//         await browser.close();

//         browser = null;

//         // ========================================================
//         // MAIL TRANSPORTER
//         // ========================================================

//         const transporter =
//             nodemailer.createTransport({
//                 service: "gmail",

//                 auth: {
//                     user: EMAIL_USER,
//                     pass: EMAIL_PASS
//                 }
//             });

//         // ========================================================
//         // VERIFY EMAIL
//         // ========================================================

//         await transporter.verify();

//         // ========================================================
//         // FILE NAME
//         // ========================================================

//         const cleanName =
//             String(employeeName)
//                 .replace(
//                     /[^a-zA-Z0-9]+/g,
//                     "_"
//                 )
//                 .replace(
//                     /^_+|_+$/g,
//                     ""
//                 );

//         const fileName =
//             `Payslip_${cleanName}_${salaryMonth}.pdf`;

//         // ========================================================
//         // SEND EMAIL
//         // ========================================================

//         const mailResult =
//             await transporter.sendMail({

//                 from:
//                     `"Talent Corner HR Services Pvt Ltd." <${EMAIL_USER}>`,

//                 to:
//                     employeeEmail,

//                 subject:
//                     `Payslip - ${salaryMonth} - ${employeeName}`,

//                 html: `
//                     <div style="
//                         font-family: Arial, Helvetica, sans-serif;
//                         font-size: 14px;
//                         color: #222222;
//                         line-height: 1.6;
//                     ">

//                         <p>
//                             Dear
//                             <strong>
//                                 ${escapeHtml(
//                                     employeeName
//                                 )}
//                             </strong>,
//                         </p>

//                         <p>
//                             Please find attached your
//                             payslip for
//                             <strong>
//                                 ${escapeHtml(
//                                     monthName
//                                 )}
//                             </strong>.
//                         </p>

//                         <p>
//                             Regards,<br>
//                             <strong>
//                                 Talent Corner HR Services Pvt Ltd.
//                             </strong>
//                         </p>

//                     </div>
//                 `,

//                 attachments: [
//                     {
//                         filename: fileName,
//                         content: pdfBuffer,
//                         contentType:
//                             "application/pdf"
//                     }
//                 ]
//             });

//         // ========================================================
//         // SUCCESS
//         // ========================================================

//         console.log(
//             `Payslip ${payrollId} sent to ${employeeEmail}`
//         );

//         return res.json({

//             success: true,

//             message:
//                 `Payslip emailed successfully to ${employeeEmail}`,

//             payroll_id:
//                 payrollId,

//             candidate_id:
//                 candidateId,

//             employee_name:
//                 employeeName,

//             employee_email:
//                 employeeEmail,

//             salary_month:
//                 salaryMonth,

//             file_name:
//                 fileName,

//             message_id:
//                 mailResult.messageId

//         });

//     } catch (error) {

//         // ========================================================
//         // CLOSE BROWSER ON ERROR
//         // ========================================================

//         if (browser) {
//             try {
//                 await browser.close();
//             } catch (_) {}
//         }

//         console.error(
//             "EMAIL PAYSLIP ERROR:",
//             error
//         );

//         return sendError(
//             res,
//             500,
//             "Failed to generate and send payslip",
//             error.message
//         );
//     }
// });
router.post("/:id/email", async (req, res) => {
    try {
        // ========================================================
        // ID
        // ========================================================

        const payrollId = getId(req.params.id);

        if (!payrollId) {
            return sendError(res, 400, "Invalid payroll ID");
        }

        // ========================================================
        // EMAIL CONFIG
        // ========================================================

        if (!EMAIL_USER || !EMAIL_PASS) {
            console.error("EMAIL_USER or EMAIL_PASS is missing");

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
            console.error("Payroll fetch error:", payrollError);
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
        // STATUS
        // ========================================================

        const payrollStatus = String(
            payroll.status || ""
        )
            .trim()
            .toLowerCase();

        if (
            payrollStatus !== "approved" &&
            payrollStatus !== "locked"
        ) {
            return sendError(
                res,
                400,
                "Payslip can be emailed only after payroll is Approved or Locked."
            );
        }

        // ========================================================
        // CANDIDATE
        // ========================================================

        const candidateId = payroll.employee_ref_id;

        if (!candidateId) {
            return sendError(
                res,
                400,
                "Candidate ID is missing from payroll record."
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
                designation,
                employee_code,
                date_of_joining,
                location,
                pan_number,
                uan_number,
                esic_number,
                gender,
                department
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
                "Candidate not found."
            );
        }

        // ========================================================
        // EMAIL
        // ========================================================

        const employeeEmail = String(
            candidate.email || ""
        ).trim();

        if (!employeeEmail) {
            return sendError(
                res,
                400,
                `Employee email address is not available for ${candidate.full_name || "this employee"}.`
            );
        }

        // IMPORTANT:
        // Correct email regex
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

            deployment = deploymentData;
        }

        // ========================================================
        // ATTENDANCE
        // ========================================================

        const {
            attendance
        } = await getAttendanceForPayroll(payroll);

        const totalDays =
            attendance?.billing_month
                ? getDaysInMonth(
                    attendance.billing_month
                )
                : getDaysInMonth(
                    payroll.salary_month
                );

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
            attendance?.overtime_hours || 0
        );

        // ========================================================
        // MONTH
        // ========================================================

        const salaryMonth =
            payroll.salary_month || "";

        let year;
        let month;

        if (/^\d{4}-\d{2}$/.test(salaryMonth)) {
            [year, month] = salaryMonth
                .split("-")
                .map(Number);
        } else {
            const date = new Date(salaryMonth);

            year = date.getFullYear();
            month = date.getMonth() + 1;
        }

        const firstDay = new Date(
            year,
            month - 1,
            1
        );

        const lastDay = new Date(
            year,
            month,
            0
        );

        const formatPdfDate = (date) => {
            return date.toLocaleDateString(
                "en-IN",
                {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                }
            );
        };

        const monthStart =
            formatPdfDate(firstDay);

        const monthEnd =
            formatPdfDate(lastDay);

        const monthName =
            firstDay.toLocaleDateString(
                "en-IN",
                {
                    month: "long",
                    year: "numeric"
                }
            );

        // ========================================================
        // MONEY
        // ========================================================

        const formatNumberWithCommas = (value) => {
            return Number(value || 0).toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );
        };

        // ========================================================
        // NUMBER TO WORDS
        // ========================================================

        const numberToWordsIndian = (number) => {
            const ones = [
                "",
                "One",
                "Two",
                "Three",
                "Four",
                "Five",
                "Six",
                "Seven",
                "Eight",
                "Nine",
                "Ten",
                "Eleven",
                "Twelve",
                "Thirteen",
                "Fourteen",
                "Fifteen",
                "Sixteen",
                "Seventeen",
                "Eighteen",
                "Nineteen"
            ];

            const tens = [
                "",
                "",
                "Twenty",
                "Thirty",
                "Forty",
                "Fifty",
                "Sixty",
                "Seventy",
                "Eighty",
                "Ninety"
            ];

            const belowThousand = (num) => {
                let result = "";

                if (num >= 100) {
                    result +=
                        ones[Math.floor(num / 100)] +
                        " Hundred ";

                    num %= 100;
                }

                if (num >= 20) {
                    result +=
                        tens[Math.floor(num / 10)] +
                        " ";

                    num %= 10;
                }

                if (num > 0) {
                    result += ones[num] + " ";
                }

                return result.trim();
            };

            number = Math.floor(
                Number(number || 0)
            );

            if (number === 0) {
                return "Zero";
            }

            let result = "";

            const crore = Math.floor(
                number / 10000000
            );

            number %= 10000000;

            const lakh = Math.floor(
                number / 100000
            );

            number %= 100000;

            const thousand = Math.floor(
                number / 1000
            );

            number %= 1000;

            if (crore) {
                result +=
                    belowThousand(crore) +
                    " Crore ";
            }

            if (lakh) {
                result +=
                    belowThousand(lakh) +
                    " Lakh ";
            }

            if (thousand) {
                result +=
                    belowThousand(thousand) +
                    " Thousand ";
            }

            if (number) {
                result +=
                    belowThousand(number);
            }

            return result.trim();
        };

        // ========================================================
        // EMPLOYEE DETAILS
        // ========================================================

        const dateOfJoining =
            candidate.date_of_joining
                ? new Date(
                    candidate.date_of_joining
                ).toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit"
                    }
                )
                : "N/A";

        // IMPORTANT:
        // candidates table uses employee_code,
        // NOT employee_id.
        const employeeNumber =
            candidate.employee_code ||
            candidate.id ||
            "N/A";

        const location =
            deployment?.work_location ||
            candidate.location ||
            "Head Office";

        // ========================================================
        // SALARY
        // Same values as payroll / PaySlip
        // ========================================================

        const basicSalary = Number(
            payroll.basic_salary || 0
        );

        const allowances = Number(
            payroll.allowances || 0
        );

        const overtime = Number(
            payroll.overtime || 0
        );

        const bonus = Number(
            payroll.bonus || 0
        );

        const grossSalary = Number(
            payroll.gross_salary ??
            (
                basicSalary +
                allowances +
                overtime +
                bonus
            )
        );

        const pf = Number(
            payroll.pf || 0
        );

        const esic = Number(
            payroll.esic || 0
        );

        const tax = Number(
            payroll.tax || 0
        );

        const professionalTax = Number(
            payroll.professional_tax || 0
        );

        const lop = Number(
            payroll.lop || 0
        );

        const totalDeductions = Number(
            payroll.total_deductions ??
            (
                pf +
                esic +
                tax +
                professionalTax +
                lop
            )
        );

        const netSalary = Number(
            payroll.net_salary ??
            Math.max(
                0,
                grossSalary -
                totalDeductions
            )
        );

        // ========================================================
        // PDF
        // Same payslip-style format
        // ========================================================

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const pageWidth = 210;

        // ========================================================
        // COMPANY HEADER
        // ========================================================

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(17);

        doc.text(
            "Talent Corner HR Services Pvt. Ltd.",
            17,
            18
        );

        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(9);

        doc.text(
            "708/709, Bhaveshwar Arcade NX",
            17,
            25
        );

        doc.text(
            "Opp Shreyas Cinema, LBS Marg",
            17,
            29
        );

        doc.text(
            "Ghatkopar(W), Mumbai-400086",
            17,
            33
        );

        doc.text(
            "GSTIN : 27AACCT6635P1ZP",
            17,
            37
        );

        doc.text(
            "UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)",
            17,
            41
        );

        doc.text(
            "E-Mail : accounts@talentcorner.in",
            17,
            45
        );

        // ========================================================
        // PAYSLIP BOX
        // ========================================================

        doc.setLineWidth(0.5);

        doc.rect(
            17,
            51,
            pageWidth - 34,
            232
        );

        // ========================================================
        // PAYSLIP TITLE
        // ========================================================

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(16);

        doc.text(
            "Pay Slip",
            29,
            62
        );

        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(10);

        doc.text(
            `for ${monthStart} to ${monthEnd}`,
            29,
            68
        );

        doc.line(
            29,
            72,
            181,
            72
        );

        // ========================================================
        // CENTER HEADING
        // ========================================================

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(13);

        doc.text(
            `Pay Slip for ${monthStart} to ${monthEnd}`,
            pageWidth / 2,
            80,
            {
                align: "center"
            }
        );

        doc.text(
            String(employeeName).toUpperCase(),
            pageWidth / 2,
            86,
            {
                align: "center"
            }
        );

        doc.line(
            29,
            91,
            181,
            91
        );

        // ========================================================
        // EMPLOYEE DETAILS
        // ========================================================

        const leftX = 29;
        const rightX = 108;

        let leftY = 99;
        let rightY = 99;

        const labelWidth = 31;

        const addInfo = (
            x,
            y,
            label,
            value
        ) => {
            doc.setFont(
                "helvetica",
                "normal"
            );

            doc.setFontSize(8);

            doc.text(
                label,
                x,
                y
            );

            doc.setFont(
                "helvetica",
                "bold"
            );

            doc.text(
                String(value || "N/A"),
                x + labelWidth,
                y
            );
        };

        addInfo(
            leftX,
            leftY,
            "Employee Number:",
            employeeNumber
        );

        leftY += 7;

        addInfo(
            leftX,
            leftY,
            "Function:",
            "CS"
        );

        leftY += 7;

        addInfo(
            leftX,
            leftY,
            "Designation:",
            candidate.designation || "N/A"
        );

        leftY += 7;

        addInfo(
            leftX,
            leftY,
            "Location:",
            location
        );

        leftY += 7;

        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(8);

        doc.text(
            "Bank Details:",
            leftX,
            leftY
        );

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.text(
            `Name - ${payroll.bank_name || "N/A"}`,
            leftX + labelWidth,
            leftY
        );

        leftY += 4;

        doc.text(
            "BRANCH - N/A",
            leftX + labelWidth,
            leftY
        );

        leftY += 4;

        doc.text(
            `IFSC code - ${payroll.ifsc_code || "N/A"}`,
            leftX + labelWidth,
            leftY
        );

        leftY += 4;

        doc.text(
            `ACC NO. - ${payroll.account_number || "N/A"}`,
            leftX + labelWidth,
            leftY
        );

        leftY += 7;

        addInfo(
            leftX,
            leftY,
            "Date of joining:",
            dateOfJoining
        );

        // ========================================================
        // RIGHT SIDE
        // ========================================================

        addInfo(
            rightX,
            rightY,
            "Tax Regime:",
            "Regular Tax Regime"
        );

        rightY += 7;

        addInfo(
            rightX,
            rightY,
            "Income Tax Number (PAN):",
            candidate.pan_number || "N/A"
        );

        rightY += 7;

        addInfo(
            rightX,
            rightY,
            "Universal Account Number (UAN):",
            candidate.uan_number || "N/A"
        );

        rightY += 7;

        addInfo(
            rightX,
            rightY,
            "PF account number:",
            payroll.pran || "N/A"
        );

        rightY += 7;

        addInfo(
            rightX,
            rightY,
            "ESI Number:",
            candidate.esic_number || "N/A"
        );

        rightY += 7;

        addInfo(
            rightX,
            rightY,
            "PR Account Number (PRAN):",
            payroll.pran || "N/A"
        );

        // ========================================================
        // SALARY TABLE
        // ========================================================

        const tableX = 29;
        const tableY = 145;

        const widths = [
            35,
            22,
            22,
            35,
            22,
            22
        ];

        const rowHeight = 9;

        const headers = [
            "Earnings",
            "Amount",
            "Gross Salary",
            "Deductions",
            "Amount",
            "Gross Salary"
        ];

        let x = tableX;

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(7.5);

        headers.forEach(
            (header, index) => {
                doc.setFillColor(
                    242,
                    242,
                    242
                );

                doc.rect(
                    x,
                    tableY,
                    widths[index],
                    rowHeight,
                    "FD"
                );

                doc.text(
                    header,
                    x + 2,
                    tableY + 6
                );

                x += widths[index];
            }
        );

        // ========================================================
        // TABLE ROW
        // ========================================================

        const drawRow = (
            y,
            earningsLabel,
            earningsAmount,
            deductionLabel,
            deductionAmount
        ) => {
            let currentX = tableX;

            const values = [
                earningsLabel,
                formatNumberWithCommas(
                    earningsAmount
                ),
                formatNumberWithCommas(
                    earningsAmount
                ),
                deductionLabel,
                deductionAmount === ""
                    ? ""
                    : formatNumberWithCommas(
                        deductionAmount
                    ),
                deductionLabel
                    ? "-"
                    : ""
            ];

            values.forEach(
                (value, index) => {
                    doc.rect(
                        currentX,
                        y,
                        widths[index],
                        rowHeight
                    );

                    if (
                        index === 1 ||
                        index === 2 ||
                        index === 4 ||
                        index === 5
                    ) {
                        doc.text(
                            String(value),
                            currentX +
                            widths[index] -
                            2,
                            y + 6,
                            {
                                align: "right"
                            }
                        );
                    } else {
                        doc.text(
                            String(value),
                            currentX + 2,
                            y + 6
                        );
                    }

                    currentX += widths[index];
                }
            );
        };

        // ========================================================
        // SALARY ROWS
        // ========================================================

        drawRow(
            tableY + rowHeight,
            "Basic Salary",
            basicSalary,
            "Provident Fund",
            pf
        );

        drawRow(
            tableY + rowHeight * 2,
            "HRA / Allowances",
            allowances,
            esic > 0 ? "ESIC" : "",
            esic > 0 ? esic : ""
        );

        drawRow(
            tableY + rowHeight * 3,
            "Overtime",
            overtime,
            tax > 0 ? "Income Tax" : "",
            tax > 0 ? tax : ""
        );

        drawRow(
            tableY + rowHeight * 4,
            "Bonus",
            bonus,
            professionalTax > 0
                ? "Professional Tax"
                : "",
            professionalTax > 0
                ? professionalTax
                : ""
        );

        drawRow(
            tableY + rowHeight * 5,
            "LOP",
            lop,
            lop > 0
                ? "Loss of Pay"
                : "",
            lop > 0
                ? lop
                : ""
        );

        // ========================================================
        // EMPTY ROW
        // ========================================================

        let emptyX = tableX;

        const emptyY =
            tableY + rowHeight * 6;

        widths.forEach((width) => {
            doc.rect(
                emptyX,
                emptyY,
                width,
                rowHeight
            );

            emptyX += width;
        });

        // ========================================================
        // TOTAL ROW
        // ========================================================

        const totalY =
            tableY + rowHeight * 7;

        let totalX = tableX;

        const totalValues = [
            "Total Earnings",
            formatNumberWithCommas(
                grossSalary
            ),
            formatNumberWithCommas(
                grossSalary
            ),
            "Total Deductions",
            formatNumberWithCommas(
                totalDeductions
            ),
            formatNumberWithCommas(
                totalDeductions
            )
        ];

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(7.5);

        totalValues.forEach(
            (value, index) => {
                doc.setFillColor(
                    243,
                    243,
                    243
                );

                doc.rect(
                    totalX,
                    totalY,
                    widths[index],
                    rowHeight,
                    "FD"
                );

                if (
                    index === 1 ||
                    index === 2 ||
                    index === 4 ||
                    index === 5
                ) {
                    doc.text(
                        String(value),
                        totalX +
                        widths[index] -
                        2,
                        totalY + 6,
                        {
                            align: "right"
                        }
                    );
                } else {
                    doc.text(
                        String(value),
                        totalX + 2,
                        totalY + 6
                    );
                }

                totalX += widths[index];
            }
        );

        // ========================================================
        // NET ROW
        // ========================================================

        const netY =
            totalY + rowHeight;

        let netX = tableX;

        const netValues = [
            "",
            "",
            "",
            "Net Amount",
            formatNumberWithCommas(
                netSalary
            ),
            formatNumberWithCommas(
                netSalary
            )
        ];

        netValues.forEach(
            (value, index) => {
                doc.rect(
                    netX,
                    netY,
                    widths[index],
                    rowHeight
                );

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                if (
                    index === 4 ||
                    index === 5
                ) {
                    doc.text(
                        String(value),
                        netX +
                        widths[index] -
                        2,
                        netY + 6,
                        {
                            align: "right"
                        }
                    );
                } else {
                    doc.text(
                        String(value),
                        netX + 2,
                        netY + 6
                    );
                }

                netX += widths[index];
            }
        );

        // ========================================================
        // AMOUNT IN WORDS
        // ========================================================

        const wordsY =
            netY + 18;

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(8);

        doc.text(
            "Amount (in words):",
            tableX,
            wordsY
        );

        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.text(
            `INR ${numberToWordsIndian(
                Math.round(netSalary)
            )} Only`,
            tableX,
            wordsY + 6
        );

        doc.line(
            tableX,
            wordsY + 10,
            181,
            wordsY + 10
        );

        // ========================================================
        // SIGNATURE
        // ========================================================

        const signatureY =
            wordsY + 25;

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(8);

        doc.text(
            "for Talent Corner HR Services Pvt. Ltd.",
            181,
            signatureY,
            {
                align: "right"
            }
        );

        doc.text(
            "Authorised Signatory",
            181,
            signatureY + 18,
            {
                align: "right"
            }
        );

        // ========================================================
        // PDF BUFFER
        // ========================================================

        const pdfBuffer = Buffer.from(
            doc.output("arraybuffer")
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

        // Check Gmail connection before sending
        await transporter.verify();

        console.log(
            "SMTP connection verified successfully."
        );

        // ========================================================
        // EMAIL BODY
        // NO CSS
        // ========================================================

        const emailHtml = `
            <p>Dear <strong>${String(employeeName)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}</strong>,</p>

            <p>Please find attached your payslip for <strong>${monthName}</strong>.</p>

            <p>Regards,<br>
            <strong>Talent Corner HR Services Pvt Ltd.</strong></p>
        `;

        // ========================================================
        // SEND EMAIL
        // ========================================================

        console.log(
            "Sending payslip email:",
            {
                payrollId,
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

                to: employeeEmail,

                subject:
                    `Payslip - ${salaryMonth} - ${employeeName}`,

                html: emailHtml,

                attachments: [
                    {
                        filename: fileName,
                        content: pdfBuffer,
                        contentType: "application/pdf"
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

            payroll_id: payrollId,

            candidate_id: candidateId,

            employee_name: employeeName,

            employee_email: employeeEmail,

            salary_month: salaryMonth,

            file_name: fileName,

            message_id: mailResult.messageId
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
// (pay rate, attendance, existing-payroll check)
//
// GET /api/payroll/lookup/prefill?deployment_id=5&salary_month=2026-08
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
            .select(`
                id, candidate_id, client_id, pay_rate, bill_rate,
                project_name, status
            `)
            .eq("id", deploymentId)
            .maybeSingle();

        if (deploymentError) throw deploymentError;

        if (!deployment) {
            return sendError(res, 404, "Deployment not found");
        }

        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select("id, full_name, email, phone, designation")
            .eq("id", deployment.candidate_id)
            .maybeSingle();

        if (candidateError) throw candidateError;

        const { data: attendanceRows, error: attendanceError } = await supabase
            .from("third_party_emp_attendance")
            .select(`
                id, employee_name, billing_month, status,
                present_days, absent_days, leave_days,
                overtime_hours, deployment_id, employee_id,
                half_days, lop_days, payable_days
            `)
            .eq("employee_id", deployment.candidate_id)
            .eq("deployment_id", deploymentId)
            .eq("billing_month", salaryMonth)
            .order("id", { ascending: false })
            .limit(1);

        if (attendanceError) throw attendanceError;

        const attendance = attendanceRows?.[0] || null;

        const { data: existingPayroll, error: existingError } = await supabase
            .from("third_party_payroll")
            .select("id, status")
            .eq("employee_ref_id", deployment.candidate_id)
            .eq("deployment_id", deploymentId)
            .eq("salary_month", salaryMonth)
            .limit(1);

        if (existingError) throw existingError;

        const calendarDays = getDaysInMonth(salaryMonth);

        return res.json({
            success: true,
            data: {
                deployment_id: deploymentId,
                employee_id: deployment.candidate_id,
                client_id: deployment.client_id,
                employee_name: candidate?.full_name || "N/A",
                email: candidate?.email || "",
                designation: candidate?.designation || "",
                pay_rate: Number(deployment.pay_rate || 0),
                deployment_status: deployment.status || null,

                attendance_id: attendance?.id || null,
                present_days: Number(attendance?.present_days || 0),
                absent_days: Number(attendance?.absent_days || 0),
                leave_days: Number(attendance?.leave_days || 0),
                half_days: Number(attendance?.half_days || 0),
                lop_days: Number(attendance?.lop_days || 0),
                overtime_hours: Number(attendance?.overtime_hours || 0),
                total_days: calendarDays,

                already_exists: !!(existingPayroll && existingPayroll.length > 0),
                existing_payroll_id: existingPayroll?.[0]?.id || null,
                existing_payroll_status: existingPayroll?.[0]?.status || null
            }
        });

    } catch (error) {
        console.error("GET /api/payroll/lookup/prefill:", error);
        return sendError(res, 500, "Failed to fetch prefill data", error.message);
    }
});

// ============================================================
// CREATE PAYROLL MANUALLY
//
// POST /api/payroll
//
// Admin picks an employee (client_id/deployment_id/employee_id are
// auto-resolved from the deployment); admin types in the money fields.
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
        } catch (err) {
            return sendError(res, 400, err.message);
        }

        // --------------------------------------------------------
        // VALIDATE DEPLOYMENT BELONGS TO CLIENT + EMPLOYEE
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // DUPLICATE CHECK
        // --------------------------------------------------------

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
                "A payroll record already exists for this employee, deployment, and month",
                { existing_payroll_id: existingRows[0].id }
            );
        }

        // --------------------------------------------------------
        // CANDIDATE (for stored employee_name)
        // --------------------------------------------------------

        const { data: candidate, error: candidateError } = await supabase
            .from("candidates")
            .select("id, full_name")
            .eq("id", employeeId)
            .maybeSingle();

        if (candidateError) throw candidateError;
        if (!candidate) return sendError(res, 404, "Candidate not found");

        // --------------------------------------------------------
        // NUMERIC FIELDS
        // --------------------------------------------------------

        const numField = (name, required = false) => {
            const raw = req.body[name];

            if (raw === undefined || raw === null || raw === "") {
                if (required) throw new Error(`${name} is required`);
                return 0;
            }

            const num = Number(raw);

            if (!Number.isFinite(num) || num < 0) {
                throw new Error(`Invalid value for ${name}`);
            }

            return num;
        };

        let basicSalary,
            hra,
            conveyance,
            medicalAllowance,
            otherAllowance,
            allowances,
            overtime,
            bonus,
            pf,
            esic,
            tax,
            professionalTax,
            lop,
            gratuity,
            pfWages,
            employerPf,
            employerEsic;

        try {
            basicSalary = numField("basic_salary", true);

            // Separate salary components
            hra = numField("hra");
            conveyance = numField("conveyance");
            medicalAllowance = numField("medical_allowance");
            otherAllowance = numField("other_allowance");

            // Keep old allowances field for backward compatibility
            allowances = numField("allowances");

            overtime = numField("overtime");
            bonus = numField("bonus");

            // Employee deductions
            pf = numField("pf");
            esic = numField("esic");
            tax = numField("tax");
            professionalTax = numField("professional_tax");
            lop = numField("lop");

            // Employer / other components
            gratuity = numField("gratuity");
            employerPf = numField("employer_pf");
            employerEsic = numField("employer_esic");
        } catch (err) {
            return sendError(res, 400, err.message);
        }

        // --------------------------------------------------------
        // OTHER EMPLOYEE DETAILS
        // --------------------------------------------------------

        const bankName = req.body.bank_name
            ? String(req.body.bank_name).trim()
            : null;

        const accountNumber = req.body.account_number
            ? String(req.body.account_number).trim()
            : null;

        const ifscCode = req.body.ifsc_code
            ? String(req.body.ifsc_code).trim()
            : null;

        const joiningDate = req.body.joining_date
            ? String(req.body.joining_date).trim()
            : null;

        const pran = req.body.pran
            ? String(req.body.pran).trim()
            : null;

        const attendanceId = req.body.attendance_id
            ? getId(req.body.attendance_id)
            : null;

        // --------------------------------------------------------
        // CALCULATED TOTALS
        // --------------------------------------------------------

        /*
         * Gross Salary
         *
         * Basic Salary
         * + HRA
         * + Conveyance
         * + Medical Allowance
         * + Other Allowance
         * + Overtime
         * + Bonus
         *
         * `allowances` is kept for backward compatibility.
         */

        const totalSeparateAllowances =
            hra +
            conveyance +
            medicalAllowance +
            otherAllowance;

        const grossSalary =
            basicSalary +
            totalSeparateAllowances +
            allowances +
            overtime +
            bonus;

        /*
         * PF Wages
         *
         * As requested:
         * Gross Salary - HRA
         */

        pfWages = Math.max(0, grossSalary - hra);

        // --------------------------------------------------------
        // DEDUCTIONS
        // --------------------------------------------------------

        const totalDeductions =
            pf +
            esic +
            tax +
            professionalTax +
            lop;

        const netSalary = Math.max(
            0,
            grossSalary - totalDeductions
        );

        // --------------------------------------------------------
        // EMPLOYER CONTRIBUTION
        // --------------------------------------------------------

        const totalEmployerContribution =
            employerPf +
            employerEsic;

        const totalEmployerCost =
            grossSalary +
            totalEmployerContribution +
            gratuity;

        // --------------------------------------------------------
        // INSERT
        // --------------------------------------------------------

        const { data: inserted, error: insertError } = await supabase
            .from("third_party_payroll")
            .insert({
                employee_name: candidate.full_name,
                salary_month: salaryMonth,

                // ------------------------------------------------
                // EARNINGS
                // ------------------------------------------------

                basic_salary: Number(basicSalary.toFixed(2)),

                hra: Number(hra.toFixed(2)),

                conveyance: Number(conveyance.toFixed(2)),

                medical_allowance: Number(
                    medicalAllowance.toFixed(2)
                ),

                other_allowance: Number(
                    otherAllowance.toFixed(2)
                ),

                // Existing field kept
                allowances: Number(
                    allowances.toFixed(2)
                ),

                overtime: Number(
                    overtime.toFixed(2)
                ),

                bonus: Number(
                    bonus.toFixed(2)
                ),

                gross_salary: Number(
                    grossSalary.toFixed(2)
                ),

                // ------------------------------------------------
                // PF WAGES
                // ------------------------------------------------

                pf_wages: Number(
                    pfWages.toFixed(2)
                ),

                // ------------------------------------------------
                // DEDUCTIONS
                // ------------------------------------------------

                pf: Number(
                    pf.toFixed(2)
                ),

                esic: Number(
                    esic.toFixed(2)
                ),

                tax: Number(
                    tax.toFixed(2)
                ),

                professional_tax: Number(
                    professionalTax.toFixed(2)
                ),

                lop: Number(
                    lop.toFixed(2)
                ),

                total_deductions: Number(
                    totalDeductions.toFixed(2)
                ),

                // ------------------------------------------------
                // NET SALARY
                // ------------------------------------------------

                net_salary: Number(
                    netSalary.toFixed(2)
                ),

                // ------------------------------------------------
                // GRATUITY
                // ------------------------------------------------

                gratuity: Number(
                    gratuity.toFixed(2)
                ),

                // ------------------------------------------------
                // EMPLOYER CONTRIBUTION
                // ------------------------------------------------

                employer_pf: Number(
                    employerPf.toFixed(2)
                ),

                employer_esic: Number(
                    employerEsic.toFixed(2)
                ),

                total_employer_contribution: Number(
                    totalEmployerContribution.toFixed(2)
                ),

                total_employer_cost: Number(
                    totalEmployerCost.toFixed(2)
                ),

                // ------------------------------------------------
                // BANK DETAILS
                // ------------------------------------------------

                bank_name: bankName,
                account_number: accountNumber,
                ifsc_code: ifscCode,

                // ------------------------------------------------
                // EMPLOYEE DETAILS
                // ------------------------------------------------

                joining_date: joiningDate,
                pran: pran,

                // ------------------------------------------------
                // STATUS
                // ------------------------------------------------

                status: "Pending",

                // ------------------------------------------------
                // REFERENCES
                // ------------------------------------------------

                employee_ref_id: employeeId,
                attendance_id: attendanceId,
                deployment_id: deploymentId,
                payroll_batch_id: null,
                client_id: clientId
            })
            .select()
            .single();

        if (insertError) throw insertError;

        return res.status(201).json({
            success: true,
            message: "Payroll record created successfully",
            data: inserted
        });

    } catch (error) {
        console.error("POST /api/payroll:", error);

        return sendError(
            res,
            500,
            "Failed to create payroll record",
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
// CREATE PAYROLL MANUALLY
//
// POST /api/payroll
//
// Admin selects:
// - Client
// - Employee / Deployment
// - Salary Month
//
// Automatically gets:
// - Employee name
// - Employee email
// - Pay rate
// - Attendance
//
// Admin manually enters:
// - Basic Salary
// - Allowances
// - Overtime
// - Bonus
// - PF
// - ESIC
// - Tax
// - Professional Tax
// - LOP
// - Employer PF
// - Employer ESIC
// - Bank Name
// - Account Number
// - IFSC
//
// New payroll always starts as Pending.
// ============================================================

router.post("/", async (req, res) => {

    try {

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

        // --------------------------------------------------------
        // MONTH
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // DEPLOYMENT
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // VALIDATE CLIENT
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // VALIDATE EMPLOYEE
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // CANDIDATE
        // --------------------------------------------------------

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
            return sendError(
                res,
                404,
                "Employee not found"
            );
        }

        // --------------------------------------------------------
        // DUPLICATE CHECK
        // --------------------------------------------------------

        const {
            data: existingRows,
            error: existingError
        } = await supabase
            .from("third_party_payroll")
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
                        existingRows[0].id,

                    existing_status:
                        existingRows[0].status
                }
            );
        }

        // --------------------------------------------------------
        // ATTENDANCE
        //
        // Uses the SAME table as your current payroll system:
        // third_party_emp_attendance
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // NUMERIC INPUT
        // --------------------------------------------------------

        const getNumber =
            (
                field,
                fallback = 0
            ) => {

                const raw =
                    req.body[field];

                if (
                    raw === undefined ||
                    raw === null ||
                    raw === ""
                ) {
                    return Number(
                        fallback
                    );
                }

                const value =
                    Number(raw);

                if (
                    !Number.isFinite(value) ||
                    value < 0
                ) {
                    throw new Error(
                        `Invalid value for ${field}`
                    );
                }

                return value;
            };

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

            // ----------------------------------------------------
            // If admin leaves Basic Salary blank,
            // automatically use deployment pay rate.
            // ----------------------------------------------------

            basicSalary =
                getNumber(
                    "basic_salary",
                    deployment.pay_rate || 0
                );

            allowances =
                getNumber(
                    "allowances"
                );

            overtime =
                getNumber(
                    "overtime"
                );

            bonus =
                getNumber(
                    "bonus"
                );

            pf =
                getNumber(
                    "pf"
                );

            esic =
                getNumber(
                    "esic"
                );

            tax =
                getNumber(
                    "tax"
                );

            professionalTax =
                getNumber(
                    "professional_tax"
                );

            lop =
                getNumber(
                    "lop"
                );

            employerPF =
                getNumber(
                    "employer_pf"
                );

            employerESIC =
                getNumber(
                    "employer_esic"
                );

        } catch (error) {

            return sendError(
                res,
                400,
                error.message
            );
        }

        // --------------------------------------------------------
        // BANK
        // --------------------------------------------------------

        const bankName =
            req.body.bank_name
                ? String(
                    req.body.bank_name
                ).trim()
                : null;

        const accountNumber =
            req.body.account_number
                ? String(
                    req.body.account_number
                ).trim()
                : null;

        const ifscCode =
            req.body.ifsc_code
                ? String(
                    req.body.ifsc_code
                )
                    .trim()
                    .toUpperCase()
                : null;

        // --------------------------------------------------------
        // ATTENDANCE VALUES
        //
        // These are not manually entered here.
        // They are automatically pulled from attendance.
        // --------------------------------------------------------

        const attendanceId =
            attendance?.id ||
            null;

        // --------------------------------------------------------
        // SALARY CALCULATIONS
        // --------------------------------------------------------

        const grossSalary =
            basicSalary +
            allowances +
            overtime +
            bonus;

        const totalDeductions =
            pf +
            esic +
            tax +
            professionalTax +
            lop;

        const netSalary =
            Math.max(
                0,
                grossSalary -
                totalDeductions
            );

        const totalEmployerContribution =
            employerPF +
            employerESIC;

        const totalEmployerCost =
            grossSalary +
            totalEmployerContribution;

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
            .insert({

                employee_name:
                    candidate.full_name,

                salary_month:
                    salaryMonth,

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
                    ifscCode,

                status:
                    "Pending",

                employee_ref_id:
                    employeeId,

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

        if (insertError) {
            throw insertError;
        }

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.status(201).json({

            success: true,

            message:
                "Payroll created successfully",

            data: {

                ...insertedPayroll,

                employee_email:
                    candidate.email || "",

                phone:
                    candidate.phone || "",

                designation:
                    candidate.designation || "",

                pay_rate:
                    Number(
                        deployment.pay_rate || 0
                    ),

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
// EDIT PAYROLL DETAILS
// PATCH /api/payroll/:id/details
// Allowed for Pending and Approved payrolls
// ============================================================

router.patch("/:id/details", async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return sendError(res, 400, "Invalid payroll ID");
    }

    const {
      basic_salary,
      allowances,
      overtime,
      bonus,

      pf,
      esic,
      tax,
      professional_tax,
      lop,

      employer_pf,
      employer_esic,

      bank_name,
      account_number,
      ifsc_code,
    } = req.body;

    // ----------------------------------------------------------
    // GET EXISTING PAYROLL
    // ----------------------------------------------------------

    const { data: payroll, error: payrollError } = await supabase
      .from("third_party_payroll")
      .select(`
        id,
        employee_name,
        salary_month,
        basic_salary,
        allowances,
        overtime,
        bonus,
        pf,
        esic,
        tax,
        professional_tax,
        lop,
        employer_pf,
        employer_esic,
        bank_name,
        account_number,
        ifsc_code,
        status,
        employee_ref_id,
        attendance_id,
        deployment_id,
        client_id
      `)
      .eq("id", id)
      .maybeSingle();

    if (payrollError) {
      console.error("GET payroll for edit error:", payrollError);

      return sendError(
        res,
        500,
        payrollError.message || "Failed to fetch payroll"
      );
    }

    if (!payroll) {
      return sendError(res, 404, "Payroll record not found");
    }

    // ----------------------------------------------------------
    // LOCKED PAYROLL CANNOT BE EDITED
    // ----------------------------------------------------------

    if (payroll.status === "Locked") {
      return sendError(
        res,
        400,
        "Locked payroll cannot be edited"
      );
    }

    if (
      payroll.status !== "Pending" &&
      payroll.status !== "Approved"
    ) {
      return sendError(
        res,
        400,
        `Payroll with status "${payroll.status}" cannot be edited`
      );
    }

    // ----------------------------------------------------------
    // NUMBER HELPER
    // ----------------------------------------------------------

    const getNumber = (value, fallback = 0) => {
      if (value === undefined || value === null || value === "") {
        return Number(fallback) || 0;
      }

      const number = Number(value);

      if (!Number.isFinite(number) || number < 0) {
        throw new Error("Salary and deduction values must be valid numbers");
      }

      return number;
    };

    // ----------------------------------------------------------
    // UPDATED VALUES
    // ----------------------------------------------------------

    const basicSalary = getNumber(
      basic_salary,
      payroll.basic_salary
    );

    const allowancesValue = getNumber(
      allowances,
      payroll.allowances
    );

    const overtimeValue = getNumber(
      overtime,
      payroll.overtime
    );

    const bonusValue = getNumber(
      bonus,
      payroll.bonus
    );

    const pfValue = getNumber(
      pf,
      payroll.pf
    );

    const esicValue = getNumber(
      esic,
      payroll.esic
    );

    const taxValue = getNumber(
      tax,
      payroll.tax
    );

    const professionalTaxValue = getNumber(
      professional_tax,
      payroll.professional_tax
    );

    const lopValue = getNumber(
      lop,
      payroll.lop
    );

    const employerPfValue = getNumber(
      employer_pf,
      payroll.employer_pf
    );

    const employerEsicValue = getNumber(
      employer_esic,
      payroll.employer_esic
    );

    // ----------------------------------------------------------
    // RECALCULATE PAYROLL
    // ----------------------------------------------------------

    const grossSalary =
      basicSalary +
      allowancesValue +
      overtimeValue +
      bonusValue;

    const totalDeductions =
      pfValue +
      esicValue +
      taxValue +
      professionalTaxValue +
      lopValue;

    const netSalary = Math.max(
      0,
      grossSalary - totalDeductions
    );

    const totalEmployerContribution =
      employerPfValue +
      employerEsicValue;

    const totalEmployerCost =
      grossSalary +
      totalEmployerContribution;

    // ----------------------------------------------------------
    // BANK DETAILS
    // ----------------------------------------------------------

    const bankName =
      bank_name !== undefined
        ? String(bank_name).trim() || null
        : payroll.bank_name;

    const accountNumber =
      account_number !== undefined
        ? String(account_number).trim() || null
        : payroll.account_number;

    const ifscCode =
      ifsc_code !== undefined
        ? String(ifsc_code).trim().toUpperCase() || null
        : payroll.ifsc_code;

    // ----------------------------------------------------------
    // UPDATE PAYROLL
    // ----------------------------------------------------------

    const updateData = {
      basic_salary: basicSalary,
      allowances: allowancesValue,
      overtime: overtimeValue,
      bonus: bonusValue,

      gross_salary: grossSalary,

      pf: pfValue,
      esic: esicValue,
      tax: taxValue,
      professional_tax: professionalTaxValue,
      lop: lopValue,

      total_deductions: totalDeductions,
      net_salary: netSalary,

      employer_pf: employerPfValue,
      employer_esic: employerEsicValue,

      total_employer_contribution:
        totalEmployerContribution,

      total_employer_cost:
        totalEmployerCost,

      bank_name: bankName,
      account_number: accountNumber,
      ifsc_code: ifscCode,
    };

    const { data: updatedPayroll, error: updateError } =
      await supabase
        .from("third_party_payroll")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

    if (updateError) {
      console.error(
        "UPDATE payroll details error:",
        updateError
      );

      return sendError(
        res,
        500,
        updateError.message || "Failed to update payroll"
      );
    }

    // ----------------------------------------------------------
    // UPDATE DEDUCTION RECORD IF IT EXISTS
    // ----------------------------------------------------------

    try {
      const { data: deduction } = await supabase
        .from("deductions")
        .select("id, lop_days")
        .eq("payroll_id", id)
        .maybeSingle();

      if (deduction) {
        await supabase
          .from("deductions")
          .update({
            employee_pf: pfValue,
            employee_esic: esicValue,
            tax_tds: taxValue,
            professional_tax: professionalTaxValue,
            lop_deduction: lopValue,
          })
          .eq("id", deduction.id);
      }
    } catch (deductionError) {
      console.error(
        "Deduction sync error:",
        deductionError
      );

      // Payroll was already updated, so don't fail the
      // main request because the optional deduction sync failed.
    }

    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    return res.json({
      success: true,
      message: "Payroll details updated successfully",
      data: updatedPayroll,
    });
  } catch (error) {
    console.error(
      "PATCH /payroll/:id/details error:",
      error
    );

    return sendError(
      res,
      500,
      error.message || "Failed to update payroll details"
    );
  }
});
// ============================================================
// EXPORT
// ============================================================

module.exports = router;