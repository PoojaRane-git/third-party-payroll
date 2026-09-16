const express = require("express");
const router = express.Router();

const supabaseAdmin =
    require("../config/supabaseAdmin");
// ============================================================
// TABLES
// ============================================================

const DAILY_TABLE =
    "third_party_emp_daily_attendance";

const SUMMARY_TABLE =
    "third_party_attendance_summary";

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

const sendError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message,
    });
};

const normalizeStatus = (status) => {
    return String(status || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");
};

const isValidBillingMonth = (value) => {
    return /^\d{4}-\d{2}$/.test(value);
};

const getMonthRange = (billingMonth) => {
    const [year, month] =
        billingMonth.split("-").map(Number);

    const startDate =
        `${year}-${String(month).padStart(2, "0")}-01`;

    const nextMonth =
        new Date(year, month, 1);

    const endDate =
        `${nextMonth.getFullYear()}-${String(
            nextMonth.getMonth() + 1
        ).padStart(2, "0")}-01`;

    return {
        startDate,
        endDate,
    };
};

// ============================================================
// CALCULATE MONTHLY SUMMARY
// ============================================================

const calculateSummary = (records, billingMonth) => {
    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;

    records.forEach((record) => {
        const status =
            normalizeStatus(record.status);

        if (status === "present") {
            presentDays += 1;
        }

        if (status === "absent") {
            absentDays += 1;
        }

        if (
            status === "leave" ||
            status === "on_leave"
        ) {
            leaveDays += 1;
        }

        if (
            status === "half_day" ||
            status === "halfday"
        ) {
            halfDays += 1;
        }

        overtimeHours += Number(
            record.overtime_hours || 0
        );
    });

    const totalDays =
        new Date(
            Number(billingMonth.substring(0, 4)),
            Number(billingMonth.substring(5, 7)),
            0
        ).getDate();

    const lopDays =
        absentDays;

    const payableDays =
        presentDays +
        leaveDays +
        halfDays * 0.5 -
        lopDays;

    return {
        total_days: totalDays,

        present_days: presentDays,

        absent_days: absentDays,

        leave_days: leaveDays,

        half_days: halfDays,

        lop_days: lopDays,

        payable_days:
            Math.max(
                0,
                Number(
                    payableDays.toFixed(2)
                )
            ),

        overtime_hours:
            Number(
                overtimeHours.toFixed(2)
            ),
    };
};

// ============================================================
// GET ADMIN ATTENDANCE
//
// GET /api/third-party-attendance
//
// Optional:
// ?client_id=1
// ?billing_month=2026-09
//
// SOURCE:
// third_party_emp_daily_attendance
//
// NO APPROVAL
// NO third_party_emp_attendance
// ============================================================

router.get("/", async (req, res) => {
    try {
        const {
            client_id,
            billing_month,
        } = req.query;

        // ====================================================
        // VALIDATE CLIENT
        // ====================================================

        let clientId = null;

        if (client_id) {
            clientId = getId(client_id);

            if (!clientId) {
                return sendError(
                    res,
                    400,
                    "Invalid client_id"
                );
            }
        }

        // ====================================================
        // DEFAULT MONTH
        // ====================================================

        const currentDate =
            new Date();

        const defaultMonth =
            `${currentDate.getFullYear()}-${String(
                currentDate.getMonth() + 1
            ).padStart(2, "0")}`;

        const selectedMonth =
            billing_month || defaultMonth;

        if (
            !isValidBillingMonth(
                selectedMonth
            )
        ) {
            return sendError(
                res,
                400,
                "Invalid billing_month. Use YYYY-MM."
            );
        }

        const {
            startDate,
            endDate,
        } = getMonthRange(
            selectedMonth
        );

        // ====================================================
        // GET DAILY ATTENDANCE
        // ====================================================

        let dailyQuery =
            supabaseAdmin
                .from(DAILY_TABLE)
                .select(`
                    id,
                    candidates_id,
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
                .gte(
                    "attendance_date",
                    startDate
                )
                .lt(
                    "attendance_date",
                    endDate
                )
                .order(
                    "attendance_date",
                    {
                        ascending: true,
                    }
                );

        if (clientId) {
            dailyQuery =
                dailyQuery.eq(
                    "client_id",
                    clientId
                );
        }

        const {
            data: dailyRecords,
            error: dailyError,
        } = await dailyQuery;

        if (dailyError) {
            throw dailyError;
        }

        const records =
            dailyRecords || [];

        // ====================================================
        // GET EMPLOYEES
        // ====================================================

        const employeeIds = [
            ...new Set(
                records
                    .map(
                        (record) =>
                            Number(
                                record.candidates_id
                            )
                    )
                    .filter(
                        (id) =>
                            Number.isInteger(id) &&
                            id > 0
                    )
            ),
        ];

        let employees = [];

        if (employeeIds.length > 0) {
            const {
                data,
                error,
            } = await supabaseAdmin
                .from("candidates")
                .select(`
                    id,
                    full_name,
                    designation,
                    email
                `)
                .in(
                    "id",
                    employeeIds
                );

            if (error) {
                throw error;
            }

            employees = data || [];
        }

        // ====================================================
        // GET CLIENTS
        // ====================================================

        const clientIds = [
            ...new Set(
                records
                    .map(
                        (record) =>
                            Number(
                                record.client_id
                            )
                    )
                    .filter(
                        (id) =>
                            Number.isInteger(id) &&
                            id > 0
                    )
            ),
        ];

        let clients = [];

        if (clientIds.length > 0) {
            const {
                data,
                error,
            } = await supabaseAdmin
                .from("clients")
                .select(`
                    id,
                    company_name
                `)
                .in(
                    "id",
                    clientIds
                );

            if (error) {
                throw error;
            }

            clients = data || [];
        }

        // ====================================================
        // MAPS
        // ====================================================

        const employeeMap =
            new Map(
                employees.map(
                    (employee) => [
                        Number(employee.id),
                        employee,
                    ]
                )
            );

        const clientMap =
            new Map(
                clients.map(
                    (client) => [
                        Number(client.id),
                        client,
                    ]
                )
            );

        // ====================================================
        // GROUP DAILY RECORDS BY EMPLOYEE
        // ====================================================

        const employeeRecords =
            new Map();

        records.forEach((record) => {
            const employeeId =
                Number(
                    record.candidates_id
                );

            if (
                !employeeRecords.has(
                    employeeId
                )
            ) {
                employeeRecords.set(
                    employeeId,
                    []
                );
            }

            employeeRecords
                .get(employeeId)
                .push(record);
        });

        // ====================================================
        // BUILD MONTHLY ADMIN DATA
        // ====================================================

        const formattedData =
            Array.from(
                employeeRecords.entries()
            ).map(
                ([
                    employeeId,
                    employeeAttendance,
                ]) => {
                    const firstRecord =
                        employeeAttendance[0];

                    const employee =
                        employeeMap.get(
                            employeeId
                        );

                    const client =
                        clientMap.get(
                            Number(
                                firstRecord.client_id
                            )
                        );

                    const summary =
                        calculateSummary(
                            employeeAttendance,
                            selectedMonth
                        );

                    return {
                        // -------------------------------
                        // IDS
                        // -------------------------------

                        id: employeeId,

                        employee_id:
                            employeeId,

                        deployment_id:
                            firstRecord.deployment_id,

                        client_id:
                            Number(
                                firstRecord.client_id
                            ),

                        // -------------------------------
                        // EMPLOYEE
                        // -------------------------------

                        employee_name:
                            employee?.full_name ||
                            "Unknown Employee",

                        role:
                            employee?.designation ||
                            "N/A",

                        email:
                            employee?.email ||
                            null,

                        // -------------------------------
                        // CLIENT
                        // -------------------------------

                        client:
                            client?.company_name ||
                            "Unknown Client",

                        client_name:
                            client?.company_name ||
                            "Unknown Client",

                        // -------------------------------
                        // MONTH
                        // -------------------------------

                        billing_month:
                            selectedMonth,

                        // -------------------------------
                        // MONTHLY ATTENDANCE
                        // -------------------------------

                        total_days:
                            summary.total_days,

                        present_days:
                            summary.present_days,

                        absent_days:
                            summary.absent_days,

                        leave_days:
                            summary.leave_days,

                        half_days:
                            summary.half_days,

                        lop_days:
                            summary.lop_days,

                        payable_days:
                            summary.payable_days,

                        overtime_hours:
                            summary.overtime_hours,

                        // -------------------------------
                        // DAILY RECORDS
                        // -------------------------------

                        attendance:
                            employeeAttendance,
                    };
                }
            );

        // ====================================================
        // KPI
        // ====================================================

        const totalPresent =
            formattedData.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.present_days || 0
                    ),
                0
            );

        const totalAbsent =
            formattedData.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.absent_days || 0
                    ),
                0
            );

        const totalLeave =
            formattedData.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.leave_days || 0
                    ),
                0
            );

        const totalOvertime =
            formattedData.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.overtime_hours || 0
                    ),
                0
            );

        // ====================================================
        // RESPONSE
        // ====================================================

        return res.json({
            success: true,

            billing_month:
                selectedMonth,

            data:
                formattedData,

            summary: {
                total_records:
                    formattedData.length,

                total_staff:
                    formattedData.length,

                total_clients:
                    new Set(
                        formattedData.map(
                            (item) =>
                                item.client_id
                        )
                    ).size,

                total_present_days:
                    totalPresent,

                total_absent_days:
                    totalAbsent,

                total_leave_days:
                    totalLeave,

                total_overtime_hours:
                    Number(
                        totalOvertime.toFixed(2)
                    ),
            },
        });
    } catch (err) {
        console.error(
            "GET /api/third-party-attendance:",
            err
        );

        return sendError(
            res,
            500,
            err.message ||
                "Failed to fetch attendance."
        );
    }
});

// ============================================================
// ADMIN ATTENDANCE IS READ ONLY
//
// NO POST
// NO PATCH
// NO DELETE
// NO APPROVAL
// ============================================================

module.exports = router;