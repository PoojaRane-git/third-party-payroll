// =====================================================
// ATTENDANCE ROUTER - CLIENT
// =====================================================
//
// ATTENDANCE-ONLY MODULE
//
// TABLE USED:
//   1. third_party_emp_daily_attendance
//
// EMPLOYEE DETAILS:
//   2. candidates
//   3. deployments
//
// DO NOT USE:
//   - third_party_attendance_approval
//   - third_party_emp_attendance
//   - summary_id
//   - monthly_attendance_id
//
// MONTHLY ATTENDANCE IS CALCULATED DIRECTLY FROM:
//   third_party_emp_daily_attendance
//
// =====================================================

const express = require("express");
const router = express.Router();

const supabase = require("../../supabaseClient");

// =====================================================
// CONSTANTS
// =====================================================

const DAILY_ATTENDANCE_TABLE =
    "third_party_emp_daily_attendance";

// =====================================================
// HELPERS
// =====================================================

function isValidPositiveInteger(value) {
    const number = Number(value);

    return (
        Number.isInteger(number) &&
        number > 0
    );
}

// -----------------------------------------------------
// Normalize attendance status
// -----------------------------------------------------

function normalizeStatus(status) {
    return String(status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
}

// -----------------------------------------------------
// Validate YYYY-MM-DD
// -----------------------------------------------------

function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(
        String(value || "")
    );
}

// -----------------------------------------------------
// Validate YYYY-MM
// -----------------------------------------------------

function isValidBillingMonth(value) {
    return /^\d{4}-\d{2}$/.test(
        String(value || "")
    );
}

// -----------------------------------------------------
// Get month date range
// -----------------------------------------------------

function getMonthRange(billingMonth) {
    const [year, month] =
        billingMonth
            .split("-")
            .map(Number);

    const lastDay = new Date(
        year,
        month,
        0
    ).getDate();

    return {
        firstDate: `${billingMonth}-01`,

        lastDate: `${billingMonth}-${String(
            lastDay
        ).padStart(2, "0")}`,
    };
}

// =====================================================
// CALCULATE ATTENDANCE SUMMARY
// =====================================================

function calculateAttendanceSummary(records) {
    const attendance = Array.isArray(records)
        ? records
        : [];

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;

    attendance.forEach((row) => {
        const status = normalizeStatus(
            row?.status
        );

        // ---------------------------------------------
        // PRESENT
        // ---------------------------------------------

        if (status === "present") {
            presentDays += 1;
        }

        // ---------------------------------------------
        // ABSENT
        // ---------------------------------------------

        if (status === "absent") {
            absentDays += 1;
        }

        // ---------------------------------------------
        // LEAVE
        // ---------------------------------------------

        if (
            status === "leave" ||
            status === "on_leave"
        ) {
            leaveDays += 1;
        }

        // ---------------------------------------------
        // HALF DAY
        // ---------------------------------------------

        if (
            status === "half_day" ||
            status === "halfday"
        ) {
            halfDays += 1;
        }

        // ---------------------------------------------
        // OVERTIME
        // ---------------------------------------------

        overtimeHours += Number(
            row?.overtime_hours || 0
        );
    });

    return {
        total_records:
            attendance.length,

        present_days:
            presentDays,

        absent_days:
            absentDays,

        leave_days:
            leaveDays,

        half_days:
            halfDays,

        working_days:
            presentDays +
            halfDays * 0.5,

        lop_days:
            absentDays,

        overtime_hours:
            Number(
                overtimeHours.toFixed(2)
            ),
    };
}

// =====================================================
// GET EMPLOYEES FOR CLIENT
//
// GET /api/employees?client_id=1
//
// =====================================================

router.get(
    "/employees",
    async (req, res) => {
        try {
            const {
                client_id,
            } = req.query;

            // -------------------------------------------------
            // VALIDATE CLIENT
            // -------------------------------------------------

            if (
                !isValidPositiveInteger(
                    client_id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid client_id is required",
                });
            }

            const clientId =
                Number(client_id);

            // -------------------------------------------------
            // FETCH DEPLOYMENTS
            // -------------------------------------------------

            const {
                data: deployments,
                error: deploymentError,
            } = await supabase
                .from("deployments")
                .select(`
                    id,
                    candidate_id,
                    client_id,
                    project_name,
                    pay_rate,
                    bill_rate,
                    billing_model,
                    start_date,
                    end_date,
                    status
                `)
                .eq(
                    "client_id",
                    clientId
                );

            if (deploymentError) {
                console.error(
                    "Deployment query error:",
                    deploymentError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Unable to fetch deployments",
                    details:
                        deploymentError.message,
                });
            }

            // -------------------------------------------------
            // NO DEPLOYMENTS
            // -------------------------------------------------

            if (
                !deployments ||
                deployments.length === 0
            ) {
                return res.json({
                    success: true,
                    employees: [],
                });
            }

            // -------------------------------------------------
            // CANDIDATE IDS
            // -------------------------------------------------

            const candidateIds = [
                ...new Set(
                    deployments
                        .map(
                            (deployment) =>
                                deployment.candidate_id
                        )
                        .filter(
                            (id) =>
                                id !== null &&
                                id !== undefined
                        )
                ),
            ];

            let candidates = [];

            // -------------------------------------------------
            // FETCH CANDIDATES
            // -------------------------------------------------

            if (
                candidateIds.length > 0
            ) {
                const {
                    data,
                    error:
                        candidateError,
                } = await supabase
                    .from("candidates")
                    .select(`
                        id,
                        full_name,
                        email,
                        phone,
                        date_of_joining,
                        employment_status,
                        designation
                    `)
                    .in(
                        "id",
                        candidateIds
                    );

                if (candidateError) {
                    console.error(
                        "Candidate query error:",
                        candidateError
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Unable to fetch candidate details",
                        details:
                            candidateError.message,
                    });
                }

                candidates =
                    data || [];
            }

            // -------------------------------------------------
            // FORMAT EMPLOYEES
            // -------------------------------------------------

            const employees =
                deployments
                    .map(
                        (deployment) => {
                            const candidate =
                                candidates.find(
                                    (item) =>
                                        String(
                                            item.id
                                        ) ===
                                        String(
                                            deployment.candidate_id
                                        )
                                );

                            if (!candidate) {
                                return null;
                            }

                            return {
                                id:
                                    candidate.id,

                                employee_id:
                                    candidate.id,

                                employee_name:
                                    candidate.full_name,

                                full_name:
                                    candidate.full_name,

                                email:
                                    candidate.email ??
                                    null,

                                phone:
                                    candidate.phone ??
                                    null,

                                date_of_joining:
                                    candidate.date_of_joining ??
                                    null,

                                employment_status:
                                    candidate.employment_status ??
                                    deployment.status ??
                                    null,

                                designation:
                                    candidate.designation ??
                                    null,

                                client_id:
                                    deployment.client_id,

                                deployment_id:
                                    deployment.id,

                                candidate_id:
                                    deployment.candidate_id,

                                project_name:
                                    deployment.project_name ??
                                    null,

                                status:
                                    deployment.status ??
                                    "Active",

                                pay_rate:
                                    deployment.pay_rate ??
                                    null,

                                bill_rate:
                                    deployment.bill_rate ??
                                    null,

                                billing_model:
                                    deployment.billing_model ??
                                    null,

                                start_date:
                                    deployment.start_date ??
                                    null,

                                end_date:
                                    deployment.end_date ??
                                    null,
                            };
                        }
                    )
                    .filter(Boolean);

            // -------------------------------------------------
            // RESPONSE
            // -------------------------------------------------

            return res.json({
                success: true,
                count: employees.length,
                employees,
            });
        } catch (error) {
            console.error(
                "GET /employees error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Unable to fetch employees",
                details:
                    error.message,
            });
        }
    }
);

// =====================================================
// GET DAILY ATTENDANCE
//
// GET /api/attendance/daily
//
// QUERY:
// ?client_id=1
// &attendance_date=2026-09-09
//
// =====================================================

router.get(
    "/attendance/daily",
    async (req, res) => {
        try {
            const {
                client_id,
                attendance_date,
            } = req.query;

            // -------------------------------------------------
            // VALIDATE CLIENT
            // -------------------------------------------------

            if (
                !isValidPositiveInteger(
                    client_id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid client_id is required",
                });
            }

            // -------------------------------------------------
            // VALIDATE DATE
            // -------------------------------------------------

            if (
                !isValidDate(
                    attendance_date
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid attendance_date is required in YYYY-MM-DD format",
                });
            }

            const clientId =
                Number(client_id);

            // -------------------------------------------------
            // FETCH DAILY ATTENDANCE
            // -------------------------------------------------

            const {
                data,
                error,
            } = await supabase
                .from(
                    DAILY_ATTENDANCE_TABLE
                )
                .select(`
                    id,
                    employee_id,
                    deployment_id,
                    client_id,
                    attendance_date,
                    check_in,
                    check_out,
                    working_hours,
                    overtime_hours,
                    status,
                    work_mode,
                    remarks,
                    created_at,
                    updated_at
                `)
                .eq(
                    "client_id",
                    clientId
                )
                .eq(
                    "attendance_date",
                    attendance_date
                )
                .order(
                    "employee_id",
                    {
                        ascending: true,
                    }
                );

            if (error) {
                console.error(
                    "Daily attendance query error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to load daily attendance",
                    details:
                        error.message,
                });
            }

            const records =
                data || [];

            // -------------------------------------------------
            // FETCH EMPLOYEE DETAILS
            // -------------------------------------------------

            const employeeIds = [
                ...new Set(
                    records
                        .map(
                            (record) =>
                                record.employee_id
                        )
                        .filter(
                            (id) =>
                                id !== null &&
                                id !== undefined
                        )
                ),
            ];

            let employeesMap = {};

            if (
                employeeIds.length > 0
            ) {
                const {
                    data: employees,
                    error:
                        employeeError,
                } = await supabase
                    .from("candidates")
                    .select(`
                        id,
                        full_name,
                        email,
                        phone,
                        designation
                    `)
                    .in(
                        "id",
                        employeeIds
                    );

                if (employeeError) {
                    console.error(
                        "Employee lookup error:",
                        employeeError
                    );
                } else {
                    employeesMap =
                        Object.fromEntries(
                            (
                                employees ||
                                []
                            ).map(
                                (employee) => [
                                    String(
                                        employee.id
                                    ),
                                    employee,
                                ]
                            )
                        );
                }
            }

            // -------------------------------------------------
            // ADD EMPLOYEE INFORMATION
            // -------------------------------------------------

            const attendance =
                records.map(
                    (record) => {
                        const employee =
                            employeesMap[
                                String(
                                    record.employee_id
                                )
                            ];

                        return {
                            ...record,

                            employee_name:
                                employee
                                    ?.full_name ??
                                `Employee ${
                                    record.employee_id ??
                                    ""
                                }`,

                            full_name:
                                employee
                                    ?.full_name ??
                                `Employee ${
                                    record.employee_id ??
                                    ""
                                }`,

                            employee_email:
                                employee
                                    ?.email ??
                                null,

                            employee_phone:
                                employee
                                    ?.phone ??
                                null,

                            designation:
                                employee
                                    ?.designation ??
                                null,
                        };
                    }
                );

            // -------------------------------------------------
            // RESPONSE
            // -------------------------------------------------

            return res.json({
                success: true,

                client_id:
                    clientId,

                attendance_date,

                count:
                    attendance.length,

                data:
                    attendance,

                attendance:
                    attendance,
            });
        } catch (error) {
            console.error(
                "GET /attendance/daily error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Failed to load daily attendance",
                details:
                    error.message,
            });
        }
    }
);

// =====================================================
// GET EMPLOYEE MONTHLY ATTENDANCE
//
// GET /api/attendance/monthly/employee
//
// QUERY:
// ?client_id=1
// &employee_id=1
// &billing_month=2026-09
//
// =====================================================

router.get(
    "/attendance/monthly/employee",
    async (req, res) => {
        try {
            const {
                client_id,
                employee_id,
                billing_month,
            } = req.query;

            // -------------------------------------------------
            // VALIDATE CLIENT
            // -------------------------------------------------

            if (
                !isValidPositiveInteger(
                    client_id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid client_id is required",
                });
            }

            // -------------------------------------------------
            // VALIDATE EMPLOYEE
            // -------------------------------------------------

            if (
                !isValidPositiveInteger(
                    employee_id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid employee_id is required",
                });
            }

            // -------------------------------------------------
            // VALIDATE MONTH
            // -------------------------------------------------

            if (
                !isValidBillingMonth(
                    billing_month
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid billing_month is required in YYYY-MM format",
                });
            }

            const clientId =
                Number(client_id);

            const employeeId =
                Number(employee_id);

            const {
                firstDate,
                lastDate,
            } = getMonthRange(
                billing_month
            );

            // -------------------------------------------------
            // FETCH DAILY RECORDS
            // -------------------------------------------------

            const {
                data,
                error,
            } = await supabase
                .from(
                    DAILY_ATTENDANCE_TABLE
                )
                .select(`
                    id,
                    employee_id,
                    deployment_id,
                    client_id,
                    attendance_date,
                    check_in,
                    check_out,
                    working_hours,
                    overtime_hours,
                    status,
                    work_mode,
                    remarks,
                    created_at,
                    updated_at
                `)
                .eq(
                    "client_id",
                    clientId
                )
                .eq(
                    "employee_id",
                    employeeId
                )
                .gte(
                    "attendance_date",
                    firstDate
                )
                .lte(
                    "attendance_date",
                    lastDate
                )
                .order(
                    "attendance_date",
                    {
                        ascending: true,
                    }
                );

            if (error) {
                console.error(
                    "Employee monthly attendance error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to fetch employee monthly attendance",
                    details:
                        error.message,
                });
            }

            const records =
                data || [];

            // -------------------------------------------------
            // CALCULATE SUMMARY
            // -------------------------------------------------

            const summary =
                calculateAttendanceSummary(
                    records
                );

            // -------------------------------------------------
            // EMPLOYEE DETAILS
            // -------------------------------------------------

            let employee = null;

            const {
                data: candidate,
                error:
                    candidateError,
            } = await supabase
                .from("candidates")
                .select(`
                    id,
                    full_name,
                    email,
                    phone,
                    designation,
                    employment_status
                `)
                .eq(
                    "id",
                    employeeId
                )
                .maybeSingle();

            if (candidateError) {
                console.error(
                    "Employee details error:",
                    candidateError
                );
            } else {
                employee =
                    candidate;
            }

            // -------------------------------------------------
            // RESPONSE
            // -------------------------------------------------

            return res.json({
                success: true,

                client_id:
                    clientId,

                employee_id:
                    employeeId,

                employee_name:
                    employee?.full_name ??
                    `Employee ${employeeId}`,

                full_name:
                    employee?.full_name ??
                    `Employee ${employeeId}`,

                email:
                    employee?.email ??
                    null,

                phone:
                    employee?.phone ??
                    null,

                designation:
                    employee?.designation ??
                    null,

                employment_status:
                    employee
                        ?.employment_status ??
                    null,

                billing_month,

                date_range: {
                    first_date:
                        firstDate,

                    last_date:
                        lastDate,
                },

                summary,

                attendance:
                    records,
            });
        } catch (error) {
            console.error(
                "GET employee monthly attendance error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Failed to fetch employee monthly attendance",
                details:
                    error.message,
            });
        }
    }
);

// =====================================================
// GET CLIENT MONTHLY ATTENDANCE
//
// GET /api/attendance/monthly
//
// QUERY:
// ?client_id=1
// &billing_month=2026-09
//
// =====================================================

router.get(
    "/attendance/monthly",
    async (req, res) => {
        try {
            const {
                client_id,
                billing_month,
            } = req.query;

            // -------------------------------------------------
            // VALIDATE CLIENT
            // -------------------------------------------------

            if (
                !isValidPositiveInteger(
                    client_id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid client_id is required",
                });
            }

            // -------------------------------------------------
            // VALIDATE MONTH
            // -------------------------------------------------

            if (
                !isValidBillingMonth(
                    billing_month
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Valid billing_month is required in YYYY-MM format",
                });
            }

            const clientId =
                Number(client_id);

            const {
                firstDate,
                lastDate,
            } = getMonthRange(
                billing_month
            );

            // -------------------------------------------------
            // FETCH ATTENDANCE
            // -------------------------------------------------

            const {
                data,
                error,
            } = await supabase
                .from(
                    DAILY_ATTENDANCE_TABLE
                )
                .select(`
                    id,
                    employee_id,
                    deployment_id,
                    client_id,
                    attendance_date,
                    check_in,
                    check_out,
                    working_hours,
                    overtime_hours,
                    status,
                    work_mode,
                    remarks,
                    created_at,
                    updated_at
                `)
                .eq(
                    "client_id",
                    clientId
                )
                .gte(
                    "attendance_date",
                    firstDate
                )
                .lte(
                    "attendance_date",
                    lastDate
                )
                .order(
                    "employee_id",
                    {
                        ascending: true,
                    }
                )
                .order(
                    "attendance_date",
                    {
                        ascending: true,
                    }
                );

            if (error) {
                console.error(
                    "Monthly attendance error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to fetch monthly attendance",
                    details:
                        error.message,
                });
            }

            const records =
                data || [];

            // -------------------------------------------------
            // GET EMPLOYEE IDS
            // -------------------------------------------------

            const employeeIds = [
                ...new Set(
                    records
                        .map(
                            (record) =>
                                record.employee_id
                        )
                        .filter(
                            (id) =>
                                id !== null &&
                                id !== undefined
                        )
                ),
            ];

            // -------------------------------------------------
            // FETCH EMPLOYEE DETAILS
            // -------------------------------------------------

            let employeesMap = {};

            if (
                employeeIds.length > 0
            ) {
                const {
                    data: candidates,
                    error:
                        candidateError,
                } = await supabase
                    .from("candidates")
                    .select(`
                        id,
                        full_name,
                        email,
                        phone,
                        designation,
                        employment_status
                    `)
                    .in(
                        "id",
                        employeeIds
                    );

                if (candidateError) {
                    console.error(
                        "Employee lookup error:",
                        candidateError
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Unable to fetch employee names",
                        details:
                            candidateError.message,
                    });
                }

                employeesMap =
                    Object.fromEntries(
                        (
                            candidates ||
                            []
                        ).map(
                            (candidate) => [
                                String(
                                    candidate.id
                                ),
                                candidate,
                            ]
                        )
                    );
            }

            // -------------------------------------------------
            // GROUP RECORDS BY EMPLOYEE
            // -------------------------------------------------

            const employeeGroups =
                {};

            records.forEach(
                (record) => {
                    const employeeId =
                        String(
                            record.employee_id
                        );

                    if (
                        !employeeGroups[
                            employeeId
                        ]
                    ) {
                        employeeGroups[
                            employeeId
                        ] = [];
                    }

                    employeeGroups[
                        employeeId
                    ].push(record);
                }
            );

            // -------------------------------------------------
            // BUILD MONTHLY DATA
            // -------------------------------------------------

            const monthlyData =
                Object.entries(
                    employeeGroups
                ).map(
                    ([
                        employeeId,
                        employeeRecords,
                    ]) => {
                        const summary =
                            calculateAttendanceSummary(
                                employeeRecords
                            );

                        const employee =
                            employeesMap[
                                String(
                                    employeeId
                                )
                            ];

                        return {
                            employee_id:
                                Number(
                                    employeeId
                                ),

                            employee_name:
                                employee
                                    ?.full_name ??
                                `Employee ${employeeId}`,

                            full_name:
                                employee
                                    ?.full_name ??
                                `Employee ${employeeId}`,

                            email:
                                employee
                                    ?.email ??
                                null,

                            phone:
                                employee
                                    ?.phone ??
                                null,

                            designation:
                                employee
                                    ?.designation ??
                                null,

                            employment_status:
                                employee
                                    ?.employment_status ??
                                null,

                            deployment_id:
                                employeeRecords[0]
                                    ?.deployment_id ??
                                null,

                            client_id:
                                clientId,

                            billing_month,

                            present_days:
                                summary.present_days,

                            absent_days:
                                summary.absent_days,

                            leave_days:
                                summary.leave_days,

                            half_days:
                                summary.half_days,

                            working_days:
                                summary.working_days,

                            lop_days:
                                summary.lop_days,

                            overtime_hours:
                                summary.overtime_hours,

                            total_records:
                                summary.total_records,

                            attendance:
                                employeeRecords,
                        };
                    }
                );

            // -------------------------------------------------
            // RESPONSE
            // -------------------------------------------------

            return res.json({
                success: true,

                client_id:
                    clientId,

                billing_month,

                date_range: {
                    first_date:
                        firstDate,

                    last_date:
                        lastDate,
                },

                total_employees:
                    monthlyData.length,

                data:
                    monthlyData,
            });
        } catch (error) {
            console.error(
                "GET /attendance/monthly error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Failed to fetch monthly attendance",
                details:
                    error.message,
            });
        }
    }
);

// =====================================================
// EXPORT
// =====================================================

module.exports = router;