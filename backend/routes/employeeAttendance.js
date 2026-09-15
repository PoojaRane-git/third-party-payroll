// ============================================================
// EMPLOYEE ATTENDANCE ROUTER
//
// SOURCE OF TRUTH:
//   1. third_party_emp_daily_attendance
//   2. third_party_attendance_summary
//
// NOT USED:
//   ❌ third_party_attendance_approval
//   ❌ third_party_emp_attendance
//
// Employee can:
//   - Check in
//   - Check out
//   - View today's attendance
//   - View daily attendance
//   - View monthly attendance
// ============================================================

const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// ============================================================
// HELPERS
// ============================================================

const sendError = (res, status, message, error = null) => {
    console.error(message, error || "");

    return res.status(status).json({
        success: false,
        message,
        error: error?.message || error?.details || null,
    });
};

// ------------------------------------------------------------
// IST DATE
// ------------------------------------------------------------

const getTodayIST = () => {
    const now = new Date();

    const ist = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);

    return ist;
};

// ------------------------------------------------------------
// CURRENT MONTH
// ------------------------------------------------------------

const getCurrentMonthIST = () => {
    const today = getTodayIST();

    return today.substring(0, 7);
};

// ------------------------------------------------------------
// DAYS IN MONTH
// ------------------------------------------------------------

const getDaysInMonth = (billingMonth) => {
    const [year, month] = billingMonth
        .split("-")
        .map(Number);

    return new Date(year, month, 0).getDate();
};

// ============================================================
// GET EMPLOYEE ID
// ============================================================

const getEmployeeId = async (req) => {

    // If authentication middleware already attached employee_id
    if (req.user?.employee_id) {
        return Number(req.user.employee_id);
    }

    if (req.user?.employeeId) {
        return Number(req.user.employeeId);
    }

    // Supabase Auth UUID
    const authUserId = req.user?.id;

    if (!authUserId) {
        throw new Error(
            "Authenticated user ID is missing."
        );
    }

    console.log(
        "Finding employee for auth user:",
        authUserId
    );

    const { data, error } = await supabase
        .from("third_party_users")
        .select("employee_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data?.employee_id) {
        throw new Error(
            "Employee profile not found for authenticated user."
        );
    }

    return Number(data.employee_id);
};

// ============================================================
// RECALCULATE MONTHLY SUMMARY
//
// IMPORTANT:
// This reads ONLY from:
// third_party_emp_daily_attendance
//
// It does NOT read:
// third_party_emp_attendance
// third_party_attendance_approval
// ============================================================

const recalculateMonthlySummary = async (
    employeeId,
    billingMonth
) => {

    console.log(
        `Recalculating summary: employee=${employeeId}, month=${billingMonth}`
    );

    // --------------------------------------------------------
    // Get daily attendance
    // --------------------------------------------------------

    const monthStart =
        `${billingMonth}-01`;

    const [year, month] =
        billingMonth
            .split("-")
            .map(Number);

    const nextMonthDate =
        new Date(
            Date.UTC(year, month, 1)
        );

    const nextMonth =
        nextMonthDate
            .toISOString()
            .substring(0, 10);

    const {
        data: dailyRows,
        error: dailyError,
    } = await supabase
        .from(
            "third_party_emp_daily_attendance"
        )
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
        .eq(
            "candidates_id",
            employeeId
        )
        .gte(
            "attendance_date",
            monthStart
        )
        .lt(
            "attendance_date",
            nextMonth
        )
        .order(
            "attendance_date",
            {
                ascending: true,
            }
        );

    if (dailyError) {
        throw dailyError;
    }

    const rows =
        dailyRows || [];

    // --------------------------------------------------------
    // Calculate
    // --------------------------------------------------------

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;

    rows.forEach((row) => {

        const status =
            String(
                row.status || ""
            )
                .toLowerCase()
                .trim();

        if (status === "present") {

            presentDays += 1;

        } else if (
            status === "absent"
        ) {

            absentDays += 1;

        } else if (
            status === "leave"
        ) {

            leaveDays += 1;

        } else if (
            status === "half day" ||
            status === "halfday"
        ) {

            halfDays += 1;
        }

        overtimeHours += Number(
            row.overtime_hours || 0
        );
    });

    // --------------------------------------------------------
    // LOP
    //
    // Absent days are LOP.
    // --------------------------------------------------------

    const lopDays =
        absentDays;

    // --------------------------------------------------------
    // PAYABLE DAYS
    //
    // Present = 1
    // Leave   = 1
    // Half    = 0.5
    // Absent  = 0
    // --------------------------------------------------------

    const payableDays =
        presentDays +
        leaveDays +
        halfDays * 0.5;

    // --------------------------------------------------------
    // TOTAL CALENDAR DAYS
    // --------------------------------------------------------

    const totalDays =
        getDaysInMonth(
            billingMonth
        );

    // --------------------------------------------------------
    // Get client/deployment
    // --------------------------------------------------------

    let clientId = null;
    let deploymentId = null;

    if (rows.length > 0) {

        const latestRow =
            rows[rows.length - 1];

        clientId =
            latestRow.client_id;

        deploymentId =
            latestRow.deployment_id;
    }

    // --------------------------------------------------------
    // If there are no daily rows, try existing summary
    // to preserve client/deployment IDs.
    //
    // IMPORTANT:
    // NO "status" HERE.
    // --------------------------------------------------------

    if (
        !clientId ||
        !deploymentId
    ) {

        const {
            data: existingSummary,
            error: existingError,
        } = await supabase
            .from(
                "third_party_attendance_summary"
            )
            .select(`
                id,
                employee_id,
                client_id,
                deployment_id,
                billing_month,
                total_days,
                present_days,
                absent_days,
                leave_days,
                half_days,
                lop_days,
                payable_days,
                overtime_hours,
                created_at,
                updated_at
            `)
            .eq(
                "employee_id",
                employeeId
            )
            .eq(
                "billing_month",
                billingMonth
            )
            .maybeSingle();

        if (existingError) {
            throw existingError;
        }

        if (existingSummary) {

            clientId =
                existingSummary.client_id;

            deploymentId =
                existingSummary.deployment_id;
        }
    }

    // --------------------------------------------------------
    // Last fallback: active deployment
    //
    // IMPORTANT:
    // deployments uses candidate_id
    // NOT employee_id
    // --------------------------------------------------------

    if (
        !clientId ||
        !deploymentId
    ) {

        const {
            data: deployment,
            error: deploymentError,
        } = await supabase
            .from("deployments")
            .select(`
                id,
                client_id,
                candidate_id
            `)
            .eq(
                "candidate_id",
                employeeId
            )
            .eq(
                "status",
                "Active"
            )
            .limit(1)
            .maybeSingle();

        if (deploymentError) {
            throw deploymentError;
        }

        if (deployment) {

            deploymentId =
                deployment.id;

            clientId =
                deployment.client_id;
        }
    }

    // --------------------------------------------------------
    // Summary requires client + deployment
    // --------------------------------------------------------

    if (
        !clientId ||
        !deploymentId
    ) {

        throw new Error(
            "Client/deployment information not found for employee."
        );
    }

    // --------------------------------------------------------
    // UPSERT MONTHLY SUMMARY
    //
    // IMPORTANT:
    // There is NO status column.
    // --------------------------------------------------------

    const summaryPayload = {

        employee_id:
            employeeId,

        client_id:
            clientId,

        deployment_id:
            deploymentId,

        billing_month:
            billingMonth,

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
            Number(
                overtimeHours.toFixed(2)
            ),

        updated_at:
            new Date().toISOString(),
    };

    const {
        data: summary,
        error: summaryError,
    } = await supabase
        .from(
            "third_party_attendance_summary"
        )
        .upsert(
            summaryPayload,
            {
                onConflict:
                    "employee_id,billing_month",
            }
        )
        .select(`
            id,
            employee_id,
            client_id,
            deployment_id,
            billing_month,
            total_days,
            present_days,
            absent_days,
            leave_days,
            half_days,
            lop_days,
            payable_days,
            overtime_hours,
            created_at,
            updated_at
        `)
        .single();

    if (summaryError) {
        throw summaryError;
    }

    return {
        ...summary,

        // Response-only calculated field.
        // NOT stored in database.
        working_days:
            Number(presentDays) +
            Number(halfDays) * 0.5,
    };
};

// ============================================================
// GET DAILY ATTENDANCE
//
// GET /employee/attendance
//
// Supports:
// ?billing_month=2026-09
// ?month=2026-09
// ============================================================

router.get("/", async (req, res) => {

    try {

        const employeeId =
            await getEmployeeId(req);

        // Support both frontend parameter names
        const billingMonth =
            req.query.billing_month ||
            req.query.month ||
            getCurrentMonthIST();

        const monthStart =
            `${billingMonth}-01`;

        const [year, month] =
            billingMonth
                .split("-")
                .map(Number);

        const nextMonth =
            new Date(
                Date.UTC(year, month, 1)
            )
                .toISOString()
                .substring(0, 10);

        const {
            data,
            error,
        } = await supabase
            .from(
                "third_party_emp_daily_attendance"
            )
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
            .eq(
                "candidates_id",
                employeeId
            )
            .gte(
                "attendance_date",
                monthStart
            )
            .lt(
                "attendance_date",
                nextMonth
            )
            .order(
                "attendance_date",
                {
                    ascending: false,
                }
            );

        if (error) {

            return sendError(
                res,
                500,
                "Failed to fetch attendance.",
                error
            );
        }

        return res.json({

            success: true,

            attendance:
                data || [],
        });

    } catch (error) {

        return sendError(
            res,
            500,
            "Failed to fetch employee attendance.",
            error
        );
    }
});

// ============================================================
// GET TODAY
//
// GET /employee/attendance/today
// ============================================================

router.get(
    "/today",
    async (req, res) => {

        try {

            const employeeId =
                await getEmployeeId(req);

            const today =
                getTodayIST();

            const {
                data,
                error,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
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
                .eq(
                    "candidates_id",
                    employeeId
                )
                .eq(
                    "attendance_date",
                    today
                )
                .maybeSingle();

            if (error) {

                return sendError(
                    res,
                    500,
                    "Failed to fetch today's attendance.",
                    error
                );
            }

            return res.json({

                success: true,

                attendance:
                    data || null,
            });

        } catch (error) {

            return sendError(
                res,
                500,
                "Failed to fetch today's attendance.",
                error
            );
        }
    }
);

// ============================================================
// CHECK IN
//
// POST /employee/attendance/check-in
// ============================================================

router.post(
    "/check-in",
    async (req, res) => {

        try {

            const employeeId =
                await getEmployeeId(req);

            const today =
                getTodayIST();

            // ------------------------------------------------
            // Check existing row
            // ------------------------------------------------

            const {
                data: existing,
                error: existingError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(`
                    id,
                    candidates_id,
                    attendance_date,
                    check_in,
                    check_out,
                    status,
                    work_mode,
                    remarks
                `)
                .eq(
                    "candidates_id",
                    employeeId
                )
                .eq(
                    "attendance_date",
                    today
                )
                .maybeSingle();

            if (existingError) {

                return sendError(
                    res,
                    500,
                    "Failed to check existing attendance.",
                    existingError
                );
            }

            if (existing?.check_in) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You have already checked in today.",

                    attendance:
                        existing,
                });
            }

            // ------------------------------------------------
            // Find active deployment
            //
            // IMPORTANT:
            // deployments.candidate_id
            // ------------------------------------------------

            const {
                data: deployment,
                error: deploymentError,
            } = await supabase
                .from("deployments")
                .select(`
                    id,
                    client_id,
                    candidate_id
                `)
                .eq(
                    "candidate_id",
                    employeeId
                )
                .eq(
                    "status",
                    "Active"
                )
                .limit(1)
                .maybeSingle();

            if (deploymentError) {

                return sendError(
                    res,
                    500,
                    "Failed to find employee deployment.",
                    deploymentError
                );
            }

            if (!deployment) {

                return res.status(400).json({

                    success: false,

                    message:
                        "No active deployment found for this employee.",
                });
            }

            // ------------------------------------------------
            // Request values
            // ------------------------------------------------

            const workMode =
                req.body?.work_mode ||
                "Office";

            const remarks =
                req.body?.remarks ||
                "";

            const now =
                new Date().toISOString();

            // ------------------------------------------------
            // If row exists without check-in, update it.
            // Otherwise create it.
            // ------------------------------------------------

            let attendance;
            let attendanceError;

            if (existing) {

                const result =
                    await supabase
                        .from(
                            "third_party_emp_daily_attendance"
                        )
                        .update({

                            candidates_id:
                                employeeId,

                            deployment_id:
                                deployment.id,

                            client_id:
                                deployment.client_id,

                            check_in:
                                now,

                            check_out:
                                null,

                            working_hours:
                                0,

                            overtime_hours:
                                0,

                            status:
                                "Present",

                            work_mode:
                                workMode,

                            remarks,

                            updated_at:
                                now,
                        })
                        .eq(
                            "id",
                            existing.id
                        )
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
                        .single();

                attendance =
                    result.data;

                attendanceError =
                    result.error;

            } else {

                const result =
                    await supabase
                        .from(
                            "third_party_emp_daily_attendance"
                        )
                        .insert({

                            candidates_id:
                                employeeId,

                            deployment_id:
                                deployment.id,

                            client_id:
                                deployment.client_id,

                            attendance_date:
                                today,

                            check_in:
                                now,

                            check_out:
                                null,

                            working_hours:
                                0,

                            overtime_hours:
                                0,

                            status:
                                "Present",

                            work_mode:
                                workMode,

                            remarks,
                        })
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
                        .single();

                attendance =
                    result.data;

                attendanceError =
                    result.error;
            }

            if (attendanceError) {

                return sendError(
                    res,
                    500,
                    "Failed to check in.",
                    attendanceError
                );
            }

            // ------------------------------------------------
            // Immediately update monthly summary
            // ------------------------------------------------

            const billingMonth =
                today.substring(0, 7);

            let summary = null;

            try {

                summary =
                    await recalculateMonthlySummary(
                        employeeId,
                        billingMonth
                    );

            } catch (summaryError) {

                console.error(
                    "Monthly summary database error:",
                    summaryError
                );

                // Attendance is already successfully saved.
                // Do not fail check-in because summary failed.
            }

            return res.status(201).json({

                success: true,

                message:
                    "Attendance checked in successfully.",

                attendance,

                summary,
            });

        } catch (error) {

            return sendError(
                res,
                500,
                "Check-in failed.",
                error
            );
        }
    }
);

// ============================================================
// CHECK OUT
//
// PATCH /employee/attendance/:id/check-out
// ============================================================

router.patch(
    "/:id/check-out",
    async (req, res) => {

        try {

            const employeeId =
                await getEmployeeId(req);

            const attendanceId =
                Number(req.params.id);

            if (!attendanceId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid attendance ID.",
                });
            }

            // ------------------------------------------------
            // Get today's attendance
            // ------------------------------------------------

            const {
                data: attendance,
                error: fetchError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
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
                .eq(
                    "id",
                    attendanceId
                )
                .eq(
                    "candidates_id",
                    employeeId
                )
                .maybeSingle();

            if (fetchError) {

                return sendError(
                    res,
                    500,
                    "Failed to fetch attendance.",
                    fetchError
                );
            }

            if (!attendance) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Attendance record not found.",
                });
            }

            if (!attendance.check_in) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You must check in before checking out.",
                });
            }

            if (attendance.check_out) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You have already checked out.",

                    attendance,
                });
            }

            // ------------------------------------------------
            // Calculate working hours
            // ------------------------------------------------

            const checkIn =
                new Date(
                    attendance.check_in
                );

            const checkOut =
                new Date();

            const milliseconds =
                checkOut.getTime() -
                checkIn.getTime();

            const hours =
                milliseconds /
                (1000 * 60 * 60);

            const workingHours =
                Math.max(
                    0,
                    Number(
                        hours.toFixed(2)
                    )
                );

            // ------------------------------------------------
            // Attendance status
            //
            // >= 8 hours = Present
            // < 8 hours  = Half Day
            // ------------------------------------------------

            const status =
                workingHours >= 8
                    ? "Present"
                    : "Half Day";

            // ------------------------------------------------
            // Overtime
            // ------------------------------------------------

            const overtimeHours =
                workingHours > 8
                    ? Number(
                        (
                            workingHours - 8
                        ).toFixed(2)
                    )
                    : 0;

            // ------------------------------------------------
            // Update daily attendance
            // ------------------------------------------------

            const {
                data: updatedAttendance,
                error: updateError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .update({

                    check_out:
                        checkOut.toISOString(),

                    working_hours:
                        workingHours,

                    overtime_hours:
                        overtimeHours,

                    status,

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    attendanceId
                )
                .eq(
                    "candidates_id",
                    employeeId
                )
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
                .single();

            if (updateError) {

                return sendError(
                    res,
                    500,
                    "Failed to check out.",
                    updateError
                );
            }

            // ------------------------------------------------
            // Recalculate monthly summary immediately
            // ------------------------------------------------

            const billingMonth =
                String(
                    attendance.attendance_date
                ).substring(0, 7);

            let summary = null;

            try {

                summary =
                    await recalculateMonthlySummary(
                        employeeId,
                        billingMonth
                    );

            } catch (summaryError) {

                console.error(
                    "Monthly summary database error:",
                    summaryError
                );
            }

            return res.json({

                success: true,

                message:
                    "Attendance checked out successfully.",

                attendance:
                    updatedAttendance,

                summary,
            });

        } catch (error) {

            return sendError(
                res,
                500,
                "Check-out failed.",
                error
            );
        }
    }
);

// ============================================================
// GET MONTHLY SUMMARY
//
// GET /employee/attendance/monthly
//
// Supports:
// ?billing_month=2026-09
// ?month=2026-09
//
// IMPORTANT:
// NO status field.
// ============================================================

router.get(
    "/monthly",
    async (req, res) => {

        try {

            const employeeId =
                await getEmployeeId(req);

            // Support both frontend parameters
            const billingMonth =
                req.query.billing_month ||
                req.query.month ||
                getCurrentMonthIST();

            // ------------------------------------------------
            // Recalculate first so summary is always current
            // ------------------------------------------------

            let summary;

            try {

                summary =
                    await recalculateMonthlySummary(
                        employeeId,
                        billingMonth
                    );

            } catch (summaryError) {

                console.error(
                    "Monthly summary recalculation failed:",
                    summaryError
                );

                // ------------------------------------------------
                // Fallback: read existing summary
                // ------------------------------------------------

                const {
                    data,
                    error,
                } = await supabase
                    .from(
                        "third_party_attendance_summary"
                    )
                    .select(`
                        id,
                        employee_id,
                        client_id,
                        deployment_id,
                        billing_month,
                        total_days,
                        present_days,
                        absent_days,
                        leave_days,
                        half_days,
                        lop_days,
                        payable_days,
                        overtime_hours,
                        created_at,
                        updated_at
                    `)
                    .eq(
                        "employee_id",
                        employeeId
                    )
                    .eq(
                        "billing_month",
                        billingMonth
                    )
                    .maybeSingle();

                if (error) {

                    return sendError(
                        res,
                        500,
                        "Failed to fetch monthly summary.",
                        error
                    );
                }

                summary =
                    data;
            }

            // ------------------------------------------------
            // Get daily records for this month
            // ------------------------------------------------

            const monthStart =
                `${billingMonth}-01`;

            const [year, month] =
                billingMonth
                    .split("-")
                    .map(Number);

            const nextMonth =
                new Date(
                    Date.UTC(year, month, 1)
                )
                    .toISOString()
                    .substring(0, 10);

            const {
                data: dailyAttendance,
                error: dailyError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
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
                .eq(
                    "candidates_id",
                    employeeId
                )
                .gte(
                    "attendance_date",
                    monthStart
                )
                .lt(
                    "attendance_date",
                    nextMonth
                )
                .order(
                    "attendance_date",
                    {
                        ascending: true,
                    }
                );

            if (dailyError) {

                return sendError(
                    res,
                    500,
                    "Failed to fetch monthly attendance.",
                    dailyError
                );
            }

            return res.json({

                success: true,

                billing_month:
                    billingMonth,

                summary:
                    summary || null,

                attendance:
                    dailyAttendance || [],

                // Convenient frontend aliases
                daily_attendance:
                    dailyAttendance || [],
            });

        } catch (error) {

            return sendError(
                res,
                500,
                "Failed to fetch monthly attendance.",
                error
            );
        }
    }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;