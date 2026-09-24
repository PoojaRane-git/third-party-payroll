const express = require("express");

const router = express.Router();

const supabase = require("../config/supabase");

const {
    authenticate,
    authorize,
} = require("../middleware/auth");

const {
    recalculateMonthlySummary,
    getTodayIST,
    getMonthRange,
    DAILY_COLUMNS,
    SUMMARY_COLUMNS,
} = require("../services/attendanceSummary");

/*
|--------------------------------------------------------------------------
| Employee Attendance Authorization
|--------------------------------------------------------------------------
*/

router.use(authenticate);
router.use(authorize("employee"));

/*
|--------------------------------------------------------------------------
| GET /me
|--------------------------------------------------------------------------
|
| Get logged-in employee profile information.
|
*/

router.get("/me", async (req, res) => {
    try {
        const employeeId = req.profile?.employee_id;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID not found",
            });
        }

        const { data: employee, error } = await supabase
            .from("candidates")
            .select("*")
            .eq("id", employeeId)
            .maybeSingle();

        if (error) {
            console.error("Employee profile error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load employee profile",
            });
        }

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        return res.json({
            success: true,
            employee,
        });
    } catch (error) {
        console.error("GET /me error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| GET /
|--------------------------------------------------------------------------
|
| Get daily attendance for employee.
|
| Example:
| /api/emp-attendance?billing_month=2026-09
|
*/

router.get("/", async (req, res) => {
    try {
        const employeeId = req.profile?.employee_id;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID not found",
            });
        }

        const billingMonth =
            req.query.billing_month ||
            getTodayIST().substring(0, 7);

        const { monthStart, nextMonth } =
            getMonthRange(billingMonth);

        const {
            data,
            error,
        } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("candidates_id", employeeId)
            .gte("attendance_date", monthStart)
            .lt("attendance_date", nextMonth)
            .order("attendance_date", {
                ascending: true,
            });

        if (error) {
            console.error(
                "Daily attendance error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load attendance",
            });
        }

        return res.json({
            success: true,
            billing_month: billingMonth,
            attendance: data || [],
            daily_attendance: data || [],
        });
    } catch (error) {
        console.error("GET attendance error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| GET /today
|--------------------------------------------------------------------------
|
| Get today's attendance.
|
*/

router.get("/today", async (req, res) => {
    try {
        const employeeId = req.profile?.employee_id;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID not found",
            });
        }

        const today = getTodayIST();

        const {
            data,
            error,
        } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("candidates_id", employeeId)
            .eq("attendance_date", today)
            .order("id", {
                ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error(
                "Today's attendance error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load today's attendance",
            });
        }

        return res.json({
            success: true,
            date: today,
            attendance: data || null,
        });
    } catch (error) {
        console.error("GET /today error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| POST /check-in
|--------------------------------------------------------------------------
|
| Check in employee.
|
| IMPORTANT:
| The database does NOT allow "In Progress".
|
| Therefore check-in is stored as "Present".
|
| The monthly summary uses check_out to determine whether
| the attendance is actually complete.
|
*/

router.post("/check-in", async (req, res) => {
    try {
        const employeeId = req.profile?.employee_id;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID not found",
            });
        }

        const today = getTodayIST();

        /*
        |--------------------------------------------------------------------------
        | Check if today's attendance already exists
        |--------------------------------------------------------------------------
        */

        const {
            data: existingAttendance,
            error: existingError,
        } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("candidates_id", employeeId)
            .eq("attendance_date", today)
            .order("id", {
                ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (existingError) {
            console.error(
                "Existing attendance error:",
                existingError
            );

            return res.status(500).json({
                success: false,
                message: "Failed to check today's attendance",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Prevent duplicate check-in
        |--------------------------------------------------------------------------
        */

        if (
            existingAttendance &&
            existingAttendance.check_in &&
            !existingAttendance.check_out
        ) {
            return res.status(400).json({
                success: false,
                message: "You are already checked in",
                attendance: existingAttendance,
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Get active deployment
        |--------------------------------------------------------------------------
        */

        const {
            data: deployment,
            error: deploymentError,
        } = await supabase
            .from("deployments")
            .select(`
                id,
                client_id,
                candidate_id,
                start_date,
                end_date,
                status
            `)
            .eq("candidate_id", employeeId)
            .eq("status", "Active")
            .order("start_date", {
                ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (deploymentError) {
            console.error(
                "Deployment error:",
                deploymentError
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load deployment information",
            });
        }

        if (!deployment) {
            return res.status(404).json({
                success: false,
                message: "Deployment information not found",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Request values
        |--------------------------------------------------------------------------
        */

        const workMode =
            req.body?.work_mode ||
            req.body?.workMode ||
            "Office";

        const remarks =
            req.body?.remarks || "";

        const now = new Date().toISOString();

        /*
        |--------------------------------------------------------------------------
        | Existing row with checkout
        |--------------------------------------------------------------------------
        |
        | This normally means there is already a completed record today.
        | We don't overwrite it.
        |--------------------------------------------------------------------------
        */

        if (
            existingAttendance &&
            existingAttendance.check_in &&
            existingAttendance.check_out
        ) {
            return res.status(400).json({
                success: false,
                message: "Today's attendance is already completed",
                attendance: existingAttendance,
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Update existing incomplete row
        |--------------------------------------------------------------------------
        */

        if (existingAttendance) {
            const {
                data: updatedAttendance,
                error: updateError,
            } = await supabase
                .from("third_party_emp_daily_attendance")
                .update({
                    deployment_id: deployment.id,
                    client_id: deployment.client_id,

                    check_in: now,
                    check_out: null,

                    working_hours: 0,
                    overtime_hours: 0,

                    /*
                     * "Present" is allowed by the DB constraint.
                     * We DO NOT use "In Progress".
                     */
                    status: "Present",

                    work_mode: workMode,
                    remarks,

                    updated_at: now,
                })
                .eq("id", existingAttendance.id)
                .eq("candidates_id", employeeId)
                .select(DAILY_COLUMNS)
                .single();

            if (updateError) {
                console.error(
                    "Check-in update error:",
                    updateError
                );

                return res.status(500).json({
                    success: false,
                    message: "Failed to check in",
                    error: updateError.message,
                });
            }

            /*
            |--------------------------------------------------------------------------
            | Recalculate monthly summary
            |--------------------------------------------------------------------------
            */

            try {
                await recalculateMonthlySummary(
                    employeeId,
                    today.substring(0, 7)
                );
            } catch (summaryError) {
                console.error(
                    "Summary recalculation error:",
                    summaryError
                );
            }

            return res.json({
                success: true,
                message: "Check-in successful",
                attendance: updatedAttendance,
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Create new attendance
        |--------------------------------------------------------------------------
        */

        const {
            data: attendance,
            error: insertError,
        } = await supabase
            .from("third_party_emp_daily_attendance")
            .insert({
                candidates_id: employeeId,
                deployment_id: deployment.id,
                client_id: deployment.client_id,

                attendance_date: today,

                check_in: now,
                check_out: null,

                working_hours: 0,
                overtime_hours: 0,

                /*
                 * Allowed by check_daily_attendance_status.
                 */
                status: "Present",

                work_mode: workMode,
                remarks,
            })
            .select(DAILY_COLUMNS)
            .single();

        if (insertError) {
            console.error(
                "Check-in insert error:",
                insertError
            );

            return res.status(500).json({
                success: false,
                message: "Failed to check in",
                error: insertError.message,
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Recalculate monthly summary
        |--------------------------------------------------------------------------
        */

        try {
            await recalculateMonthlySummary(
                employeeId,
                today.substring(0, 7)
            );
        } catch (summaryError) {
            console.error(
                "Summary recalculation error:",
                summaryError
            );
        }

        return res.json({
            success: true,
            message: "Check-in successful",
            attendance,
        });
    } catch (error) {
        console.error("POST /check-in error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| PATCH /:id/check-out
|--------------------------------------------------------------------------
|
| Check out employee.
|
*/

router.patch("/:id/check-out", async (req, res) => {
    try {
        const employeeId = req.profile?.employee_id;

        const attendanceId = Number(req.params.id);

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID not found",
            });
        }

        if (!Number.isInteger(attendanceId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid attendance ID",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Get attendance
        |--------------------------------------------------------------------------
        */

        const {
            data: attendance,
            error: attendanceError,
        } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("id", attendanceId)
            .eq("candidates_id", employeeId)
            .maybeSingle();

        if (attendanceError) {
            console.error(
                "Checkout attendance lookup error:",
                attendanceError
            );

            return res.status(500).json({
                success: false,
                message: "Failed to find attendance",
            });
        }

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Must have check-in
        |--------------------------------------------------------------------------
        */

        if (!attendance.check_in) {
            return res.status(400).json({
                success: false,
                message: "Check-in is required before checkout",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Prevent duplicate checkout
        |--------------------------------------------------------------------------
        */

        if (attendance.check_out) {
            return res.status(400).json({
                success: false,
                message: "You have already checked out",
                attendance,
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Calculate working hours
        |--------------------------------------------------------------------------
        */

        const checkInTime =
            new Date(attendance.check_in);

        const checkOutTime =
            new Date();

        const millisecondsWorked =
            checkOutTime.getTime() -
            checkInTime.getTime();

        const workingHours =
            millisecondsWorked /
            (1000 * 60 * 60);

        /*
        |--------------------------------------------------------------------------
        | Prevent invalid negative time
        |--------------------------------------------------------------------------
        */

        const safeWorkingHours =
            Math.max(0, workingHours);

        /*
        |--------------------------------------------------------------------------
        | Determine status
        |--------------------------------------------------------------------------
        */

        let status;

        if (safeWorkingHours >= 8) {
            status = "Present";
        } else if (safeWorkingHours >= 4) {
            status = "Half Day";
        } else {
            status = "Absent";
        }

        /*
        |--------------------------------------------------------------------------
        | Overtime
        |--------------------------------------------------------------------------
        */

        const overtimeHours =
            safeWorkingHours > 8
                ? safeWorkingHours - 8
                : 0;

        /*
        |--------------------------------------------------------------------------
        | Round values
        |--------------------------------------------------------------------------
        */

        const roundedWorkingHours =
            Math.round(
                safeWorkingHours * 100
            ) / 100;

        const roundedOvertimeHours =
            Math.round(
                overtimeHours * 100
            ) / 100;

        /*
        |--------------------------------------------------------------------------
        | Update attendance
        |--------------------------------------------------------------------------
        */

        const {
            data: updatedAttendance,
            error: updateError,
        } = await supabase
            .from("third_party_emp_daily_attendance")
            .update({
                check_out: checkOutTime.toISOString(),

                working_hours:
                    roundedWorkingHours,

                overtime_hours:
                    roundedOvertimeHours,

                status,

                updated_at:
                    checkOutTime.toISOString(),
            })
            .eq("id", attendanceId)
            .eq("candidates_id", employeeId)
            .select(DAILY_COLUMNS)
            .single();

        if (updateError) {
            console.error(
                "Checkout update error:",
                updateError
            );

            return res.status(500).json({
                success: false,
                message: "Failed to check out",
                error: updateError.message,
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Recalculate monthly summary
        |--------------------------------------------------------------------------
        */

        try {
            const billingMonth =
                String(
                    attendance.attendance_date
                ).substring(0, 7);

            await recalculateMonthlySummary(
                employeeId,
                billingMonth
            );
        } catch (summaryError) {
            console.error(
                "Summary recalculation error:",
                summaryError
            );
        }

        return res.json({
            success: true,
            message: "Check-out successful",
            attendance: updatedAttendance,
        });
    } catch (error) {
        console.error(
            "PATCH /:id/check-out error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

/*
|--------------------------------------------------------------------------
| GET /monthly
|--------------------------------------------------------------------------
|
| Get monthly summary + daily attendance.
|
*/

router.get("/monthly", async (req, res) => {
    try {
        const employeeId = req.profile?.employee_id;

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID not found",
            });
        }

        const billingMonth =
            req.query.billing_month ||
            getTodayIST().substring(0, 7);

        /*
        |--------------------------------------------------------------------------
        | Recalculate summary
        |--------------------------------------------------------------------------
        */

        let summary;

        try {
            summary =
                await recalculateMonthlySummary(
                    employeeId,
                    billingMonth
                );
        } catch (recalculateError) {
            console.error(
                "Monthly summary recalculation failed:",
                recalculateError
            );

            /*
            |--------------------------------------------------------------------------
            | Fallback to existing summary
            |--------------------------------------------------------------------------
            */

            const {
                data: existingSummary,
                error: existingError,
            } = await supabase
                .from("third_party_attendance_summary")
                .select(SUMMARY_COLUMNS)
                .eq("employee_id", employeeId)
                .eq("billing_month", billingMonth)
                .maybeSingle();

            if (existingError) {
                console.error(
                    "Fallback summary error:",
                    existingError
                );
            }

            summary = existingSummary || null;
        }

        /*
        |--------------------------------------------------------------------------
        | Daily attendance
        |--------------------------------------------------------------------------
        */

        const {
            monthStart,
            nextMonth,
        } = getMonthRange(billingMonth);

        const {
            data: dailyAttendance,
            error: dailyError,
        } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("candidates_id", employeeId)
            .gte("attendance_date", monthStart)
            .lt("attendance_date", nextMonth)
            .order("attendance_date", {
                ascending: true,
            });

        if (dailyError) {
            console.error(
                "Monthly daily attendance error:",
                dailyError
            );

            return res.status(500).json({
                success: false,
                message: "Failed to load daily attendance",
            });
        }

        /*
        |--------------------------------------------------------------------------
        | Response
        |--------------------------------------------------------------------------
        */

        return res.json({
            success: true,

            billing_month:
                billingMonth,

            summary,

            attendance:
                dailyAttendance || [],

            daily_attendance:
                dailyAttendance || [],
        });
    } catch (error) {
        console.error(
            "GET /monthly error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});

module.exports = router;