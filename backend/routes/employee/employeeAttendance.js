// ============================================================
// EMPLOYEE ATTENDANCE ROUTER
//
// SOURCE OF TRUTH:
//   1. third_party_emp_daily_attendance
//   2. third_party_attendance_summary
//   3. candidates (for /me profile + payslip employee info)
//
// AUTH:
//   authenticate -> sets req.user (Supabase auth user)
//   authorize("employee") -> looks up employee_users by
//   req.user.id and attaches the row as req.profile
//   (req.profile.employee_id is the candidates.id to use)
//
// MOUNTED (see server.js) at BOTH:
//   /api/emp-attendance
//   /api/employee
// So every route below is reachable under either prefix,
// e.g. GET /api/employee/me and GET /api/emp-attendance/me
// both hit the handler defined here.
// ============================================================

const express = require("express");
const router = express.Router();

const supabase = require("../../config/supabase");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

const employeeAuth = [authenticate, authorize("employee")];

// Apply to every route in this router.
router.use(...employeeAuth);

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

const getTodayIST = () => {
    const now = new Date();

    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
};

const getCurrentMonthIST = () => {
    return getTodayIST().substring(0, 7);
};

const getDaysInMonth = (billingMonth) => {
    const [year, month] = billingMonth.split("-").map(Number);
    return new Date(year, month, 0).getDate();
};

// ============================================================
// GET EMPLOYEE ID
//
// authorize("employee") already ran and attached req.profile
// (from employee_users), which has employee_id.
// ============================================================

const getEmployeeId = (req) => {
    const employeeId = Number(req.profile?.employee_id);

    if (!employeeId) {
        throw new Error(
            "Employee ID is not linked to this account."
        );
    }

    return employeeId;
};

// ============================================================
// GET LOGGED-IN EMPLOYEE PROFILE
// GET /me
//
// Reads the employee's own record from `candidates`,
// keyed by req.profile.employee_id.
// ============================================================

router.get("/me", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);

        const { data: employee, error } = await supabase
            .from("candidates")
            .select("*")
            .eq("id", employeeId)
            .maybeSingle();

        if (error) {
            return sendError(res, 500, "Failed to fetch employee profile.", error);
        }

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee profile not found.",
            });
        }

        return res.json({ success: true, employee });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch employee profile.", error);
    }
});

// ============================================================
// RECALCULATE MONTHLY SUMMARY
//
// Reads ONLY from third_party_emp_daily_attendance.
// ============================================================

const recalculateMonthlySummary = async (employeeId, billingMonth) => {

    const monthStart = `${billingMonth}-01`;
    const [year, month] = billingMonth.split("-").map(Number);
    const nextMonth = new Date(Date.UTC(year, month, 1))
        .toISOString()
        .substring(0, 10);

    const { data: dailyRows, error: dailyError } = await supabase
        .from("third_party_emp_daily_attendance")
        .select(`
            id, candidates_id, deployment_id, client_id, attendance_date,
            check_in, check_out, working_hours, overtime_hours, status,
            work_mode, remarks, created_at, updated_at
        `)
        .eq("candidates_id", employeeId)
        .gte("attendance_date", monthStart)
        .lt("attendance_date", nextMonth)
        .order("attendance_date", { ascending: true });

    if (dailyError) throw dailyError;

    const rows = dailyRows || [];

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;

    rows.forEach((row) => {
        const status = String(row.status || "").toLowerCase().trim();

        if (status === "present") presentDays += 1;
        else if (status === "absent") absentDays += 1;
        else if (status === "leave") leaveDays += 1;
        else if (status === "half day" || status === "halfday") halfDays += 1;

        overtimeHours += Number(row.overtime_hours || 0);
    });

    const lopDays = absentDays;
    const payableDays = presentDays + leaveDays + halfDays * 0.5;
    const totalDays = getDaysInMonth(billingMonth);

    let clientId = null;
    let deploymentId = null;

    if (rows.length > 0) {
        const latestRow = rows[rows.length - 1];
        clientId = latestRow.client_id;
        deploymentId = latestRow.deployment_id;
    }

    if (!clientId || !deploymentId) {
        const { data: existingSummary, error: existingError } = await supabase
            .from("third_party_attendance_summary")
            .select(`
                id, employee_id, client_id, deployment_id, billing_month,
                total_days, present_days, absent_days, leave_days, half_days,
                lop_days, payable_days, overtime_hours, created_at, updated_at
            `)
            .eq("employee_id", employeeId)
            .eq("billing_month", billingMonth)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existingSummary) {
            clientId = existingSummary.client_id;
            deploymentId = existingSummary.deployment_id;
        }
    }

    if (!clientId || !deploymentId) {
        const { data: deployment, error: deploymentError } = await supabase
            .from("deployments")
            .select(`id, client_id, candidate_id`)
            .eq("candidate_id", employeeId)
            .eq("status", "Active")
            .limit(1)
            .maybeSingle();

        if (deploymentError) throw deploymentError;

        if (deployment) {
            deploymentId = deployment.id;
            clientId = deployment.client_id;
        }
    }

    if (!clientId || !deploymentId) {
        throw new Error(
            "Client/deployment information not found for employee."
        );
    }

    const summaryPayload = {
        employee_id: employeeId,
        client_id: clientId,
        deployment_id: deploymentId,
        billing_month: billingMonth,
        total_days: totalDays,
        present_days: presentDays,
        absent_days: absentDays,
        leave_days: leaveDays,
        half_days: halfDays,
        lop_days: lopDays,
        payable_days: payableDays,
        overtime_hours: Number(overtimeHours.toFixed(2)),
        updated_at: new Date().toISOString(),
    };

    const { data: summary, error: summaryError } = await supabase
        .from("third_party_attendance_summary")
        .upsert(summaryPayload, { onConflict: "employee_id,billing_month" })
        .select(`
            id, employee_id, client_id, deployment_id, billing_month,
            total_days, present_days, absent_days, leave_days, half_days,
            lop_days, payable_days, overtime_hours, created_at, updated_at
        `)
        .single();

    if (summaryError) throw summaryError;

    return {
        ...summary,
        working_days: Number(presentDays) + Number(halfDays) * 0.5,
    };
};

// ============================================================
// GET DAILY ATTENDANCE
// GET /emp-attendance  (?billing_month=YYYY-MM or ?month=YYYY-MM)
// ============================================================

router.get("/", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);

        const billingMonth =
            req.query.billing_month || req.query.month || getCurrentMonthIST();

        const monthStart = `${billingMonth}-01`;
        const [year, month] = billingMonth.split("-").map(Number);
        const nextMonth = new Date(Date.UTC(year, month, 1))
            .toISOString()
            .substring(0, 10);

        const { data, error } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(`
                id, candidates_id, deployment_id, client_id, attendance_date,
                check_in, check_out, working_hours, overtime_hours, status,
                work_mode, remarks, created_at, updated_at
            `)
            .eq("candidates_id", employeeId)
            .gte("attendance_date", monthStart)
            .lt("attendance_date", nextMonth)
            .order("attendance_date", { ascending: false });

        if (error) {
            return sendError(res, 500, "Failed to fetch attendance.", error);
        }

        return res.json({ success: true, attendance: data || [] });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch employee attendance.", error);
    }
});

// ============================================================
// GET TODAY
// GET /emp-attendance/today
// ============================================================

router.get("/today", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        const today = getTodayIST();

        const { data, error } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(`
                id, candidates_id, deployment_id, client_id, attendance_date,
                check_in, check_out, working_hours, overtime_hours, status,
                work_mode, remarks, created_at, updated_at
            `)
            .eq("candidates_id", employeeId)
            .eq("attendance_date", today)
            .maybeSingle();

        if (error) {
            return sendError(res, 500, "Failed to fetch today's attendance.", error);
        }

        return res.json({ success: true, attendance: data || null });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch today's attendance.", error);
    }
});

// ============================================================
// CHECK IN
// POST /emp-attendance/check-in
// ============================================================

router.post("/check-in", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        const today = getTodayIST();

        const { data: existing, error: existingError } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(`
                id, candidates_id, attendance_date, check_in, check_out,
                status, work_mode, remarks
            `)
            .eq("candidates_id", employeeId)
            .eq("attendance_date", today)
            .maybeSingle();

        if (existingError) {
            return sendError(res, 500, "Failed to check existing attendance.", existingError);
        }

        if (existing?.check_in) {
            return res.status(400).json({
                success: false,
                message: "You have already checked in today.",
                attendance: existing,
            });
        }

        const { data: deployment, error: deploymentError } = await supabase
            .from("deployments")
            .select(`id, client_id, candidate_id`)
            .eq("candidate_id", employeeId)
            .eq("status", "Active")
            .limit(1)
            .maybeSingle();

        if (deploymentError) {
            return sendError(res, 500, "Failed to find employee deployment.", deploymentError);
        }

        if (!deployment) {
            return res.status(400).json({
                success: false,
                message: "No active deployment found for this employee.",
            });
        }

        const workMode = req.body?.work_mode || "Office";
        const remarks = req.body?.remarks || "";
        const now = new Date().toISOString();

        let attendance;
        let attendanceError;

        if (existing) {
            const result = await supabase
                .from("third_party_emp_daily_attendance")
                .update({
                    candidates_id: employeeId,
                    deployment_id: deployment.id,
                    client_id: deployment.client_id,
                    check_in: now,
                    check_out: null,
                    working_hours: 0,
                    overtime_hours: 0,
                    status: "In Progress",
                    work_mode: workMode,
                    remarks,
                    updated_at: now,
                })
                .eq("id", existing.id)
                .select(`
                    id, candidates_id, deployment_id, client_id, attendance_date,
                    check_in, check_out, working_hours, overtime_hours, status,
                    work_mode, remarks, created_at, updated_at
                `)
                .single();

            attendance = result.data;
            attendanceError = result.error;
        } else {
            const result = await supabase
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
                    status: "Present",
                    work_mode: workMode,
                    remarks,
                })
                .select(`
                    id, candidates_id, deployment_id, client_id, attendance_date,
                    check_in, check_out, working_hours, overtime_hours, status,
                    work_mode, remarks, created_at, updated_at
                `)
                .single();

            attendance = result.data;
            attendanceError = result.error;
        }

        if (attendanceError) {
            return sendError(res, 500, "Failed to check in.", attendanceError);
        }

        const billingMonth = today.substring(0, 7);
        let summary = null;

        try {
            summary = await recalculateMonthlySummary(employeeId, billingMonth);
        } catch (summaryError) {
            console.error("Monthly summary database error:", summaryError);
        }

        return res.status(201).json({
            success: true,
            message: "Attendance checked in successfully.",
            attendance,
            summary,
        });
    } catch (error) {
        return sendError(res, 500, "Check-in failed.", error);
    }
});

// ============================================================
// CHECK OUT
// PATCH /emp-attendance/:id/check-out
// ============================================================

router.patch("/:id/check-out", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        const attendanceId = Number(req.params.id);

        if (!attendanceId) {
            return res.status(400).json({ success: false, message: "Invalid attendance ID." });
        }

        const { data: attendance, error: fetchError } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(`
                id, candidates_id, deployment_id, client_id, attendance_date,
                check_in, check_out, working_hours, overtime_hours, status,
                work_mode, remarks, created_at, updated_at
            `)
            .eq("id", attendanceId)
            .eq("candidates_id", employeeId)
            .maybeSingle();

        if (fetchError) {
            return sendError(res, 500, "Failed to fetch attendance.", fetchError);
        }

        if (!attendance) {
            return res.status(404).json({ success: false, message: "Attendance record not found." });
        }

        if (!attendance.check_in) {
            return res.status(400).json({ success: false, message: "You must check in before checking out." });
        }

        if (attendance.check_out) {
            return res.status(400).json({
                success: false,
                message: "You have already checked out.",
                attendance,
            });
        }

        const checkIn = new Date(attendance.check_in);
        const checkOut = new Date();
        const milliseconds = checkOut.getTime() - checkIn.getTime();
        const hours = milliseconds / (1000 * 60 * 60);
        const workingHours = Math.max(0, Number(hours.toFixed(2)));

        let status;

        if (workingHours >= 8) {
            status = "Present";
        } else if (workingHours >= 4) {
            status = "Half Day";
        } else {
            status = "Absent";
        }
        const overtimeHours = workingHours > 8 ? Number((workingHours - 8).toFixed(2)) : 0;

        const { data: updatedAttendance, error: updateError } = await supabase
            .from("third_party_emp_daily_attendance")
            .update({
                check_out: checkOut.toISOString(),
                working_hours: workingHours,
                overtime_hours: overtimeHours,
                status,
                updated_at: new Date().toISOString(),
            })
            .eq("id", attendanceId)
            .eq("candidates_id", employeeId)
            .select(`
                id, candidates_id, deployment_id, client_id, attendance_date,
                check_in, check_out, working_hours, overtime_hours, status,
                work_mode, remarks, created_at, updated_at
            `)
            .single();

        if (updateError) {
            return sendError(res, 500, "Failed to check out.", updateError);
        }

        const billingMonth = String(attendance.attendance_date).substring(0, 7);
        let summary = null;

        try {
            summary = await recalculateMonthlySummary(employeeId, billingMonth);
        } catch (summaryError) {
            console.error("Monthly summary database error:", summaryError);
        }

        return res.json({
            success: true,
            message: "Attendance checked out successfully.",
            attendance: updatedAttendance,
            summary,
        });
    } catch (error) {
        return sendError(res, 500, "Check-out failed.", error);
    }
});

// ============================================================
// GET MONTHLY SUMMARY
// GET /emp-attendance/monthly
// ============================================================
// ============================================================
// GET MONTHLY SUMMARY
// GET /emp-attendance/monthly
// ============================================================

// Counts weekdays (Mon-Fri) before today that have no attendance row
// and are not a holiday / approved leave day.
const countMissingWorkingDays = ({
    billingMonth,
    dailyAttendance,
    excludedDates,
}) => {
    const [year, month] = billingMonth.split("-").map(Number);
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const todayIST = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
    });

    const recordedDates = new Set(
        (dailyAttendance || []).map((r) => r.attendance_date)
    );

    let missing = 0;

    for (let d = 1; d <= lastDayOfMonth; d++) {
        const dateStr = `${billingMonth}-${String(d).padStart(2, "0")}`;

        if (dateStr >= todayIST) break; // only past days, not today

        const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0 = Sun, 6 = Sat
        if (dow === 0 || dow === 6) continue; // adjust to your week-off rule

        if (recordedDates.has(dateStr)) continue;
        if (excludedDates.has(dateStr)) continue;

        missing++;
    }

    return missing;
};

router.get("/monthly", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);

        const billingMonth =
            req.query.billing_month || req.query.month || getCurrentMonthIST();

        let summary;

        try {
            summary = await recalculateMonthlySummary(employeeId, billingMonth);
        } catch (summaryError) {
            console.error("Monthly summary recalculation failed:", summaryError);

            const { data, error } = await supabase
                .from("third_party_attendance_summary")
                .select(`
                    id, employee_id, client_id, deployment_id, billing_month,
                    total_days, present_days, absent_days, leave_days, half_days,
                    lop_days, payable_days, overtime_hours, created_at, updated_at
                `)
                .eq("employee_id", employeeId)
                .eq("billing_month", billingMonth)
                .maybeSingle();

            if (error) {
                return sendError(res, 500, "Failed to fetch monthly summary.", error);
            }

            summary = data;
        }

        const monthStart = `${billingMonth}-01`;
        const [year, month] = billingMonth.split("-").map(Number);
        const nextMonth = new Date(Date.UTC(year, month, 1))
            .toISOString()
            .substring(0, 10);

        const { data: dailyAttendance, error: dailyError } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(`
                id, candidates_id, deployment_id, client_id, attendance_date,
                check_in, check_out, working_hours, overtime_hours, status,
                work_mode, remarks, created_at, updated_at
            `)
            .eq("candidates_id", employeeId)
            .gte("attendance_date", monthStart)
            .lt("attendance_date", nextMonth)
            .order("attendance_date", { ascending: true });

        if (dailyError) {
            return sendError(res, 500, "Failed to fetch monthly attendance.", dailyError);
        }

        // ------------------------------------------------------------
        // Dates that must NOT be counted as absent (holidays, leave)
        // ------------------------------------------------------------
        const excludedDates = new Set();

        // ---- Holidays (per client, full-day only) ----
        const clientId =
            summary?.client_id ||
            (dailyAttendance || []).find((r) => r.client_id)?.client_id ||
            null;

        if (clientId) {
            const { data: holidays, error: holidayError } = await supabase
                .from("holiday_calendar")
                .select("holiday_date, holiday_type")
                .eq("client_id", clientId)
                .eq("holiday_type", "Full Day") // half-day holidays are still working days
                .gte("holiday_date", monthStart)
                .lt("holiday_date", nextMonth);

            if (holidayError) {
                console.error("Holiday lookup failed:", holidayError);
            }

            (holidays || []).forEach((h) => excludedDates.add(h.holiday_date));
        }

        // ---- Approved leaves ----
        // TODO: table and column names below are guesses. Change them to
        // match your leave table (or delete this block if you have none).
        const { data: leaves, error: leaveError } = await supabase
            .from("leave_requests")
            .select("from_date, to_date")
            .eq("employee_id", employeeId)
            .eq("status", "Approved")
            .lt("from_date", nextMonth)
            .gte("to_date", monthStart);

        if (leaveError) {
            console.error("Leave lookup failed:", leaveError);
        }

        (leaves || []).forEach((l) => {
            let cur = new Date(`${l.from_date}T00:00:00Z`);
            const end = new Date(`${l.to_date}T00:00:00Z`);
            while (cur <= end) {
                excludedDates.add(cur.toISOString().substring(0, 10));
                cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
            }
        });

        // ------------------------------------------------------------
        // Absent = absent_days already in summary
        //        + past weekdays with no record, holiday or leave
        // ------------------------------------------------------------
        const missingDays = countMissingWorkingDays({
            billingMonth,
            dailyAttendance,
            excludedDates,
        });

        summary = {
            ...(summary || {}),
            absent_days: Number(summary?.absent_days || 0) + missingDays,
        };

        return res.json({
            success: true,
            billing_month: billingMonth,
            summary,
            attendance: dailyAttendance || [],
            daily_attendance: dailyAttendance || [],
        });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch monthly attendance.", error);
    }
});


/* =====================================================
   EMPLOYEE PAYSLIPS
=====================================================

GET /api/employee/payroll/me
===================================================== */
router.get(
    "/payroll/me",
    async (req, res) => {
        try {
            const employeeId =
                Number(req.profile?.employee_id);

            console.log(
                "Logged-in employee ID:",
                employeeId
            );

            if (!employeeId) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Employee profile is not linked to an employee.",
                });
            }

            const {
                data: payslips,
                error,
            } = await supabase
                .from(
                    "third_party_payroll"
                )
                .select("*")
                .eq(
                    "employee_ref_id",
                    employeeId
                )
                .order(
                    "salary_month",
                    {
                        ascending: false,
                    }
                );

            if (error) {
                console.error(
                    "Employee payslip database error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load payslips.",
                    error:
                        error.message,
                });
            }

            return res.json({
                success: true,
                payslips:
                    payslips || [],
            });

        } catch (error) {
            console.error(
                "Employee payslip API error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load payslips.",
                error:
                    error.message,
            });
        }
    }
);

// =====================================================
// EMPLOYEE PAYSLIP PDF
// GET /api/employee/payroll/:id/pdf
// =====================================================

router.get(
    "/employee/payroll/:id/pdf",
    async (req, res) => {
        try {
            const payrollId =
                Number(req.params.id);

            if (!payrollId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid payroll ID.",
                });
            }

            // ---------------------------------------------
            // GET PAYROLL
            // ---------------------------------------------

            const {
                data: payroll,
                error,
            } = await supabase
                .from(
                    "third_party_payroll"
                )
                .select("*")
                .eq(
                    "id",
                    payrollId
                )
                .single();

            if (error) {
                console.error(
                    "PDF payroll fetch error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load payroll.",
                    error:
                        error.message,
                });
            }

            if (!payroll) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Payroll record not found.",
                });
            }

            // ---------------------------------------------
            // ONLY APPROVED / LOCKED / PAID
            // ---------------------------------------------

            const status =
                String(
                    payroll.status || ""
                )
                    .toLowerCase()
                    .trim();

            if (
                ![
                    "approved",
                    "locked",
                    "paid",
                ].includes(status)
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Payslip is available only after payroll is approved.",
                });
            }

            // ---------------------------------------------
            // GENERATE PDF
            // ---------------------------------------------

            const pdfBuffer =
                await generatePayslipPDF(
                    payroll
                );

            const employeeName =
                String(
                    payroll.employee_name ||
                    "Employee"
                )
                    .replace(
                        /[^a-zA-Z0-9]/g,
                        "_"
                    )
                    .replace(
                        /_+/g,
                        "_"
                    );

            const salaryMonth =
                String(
                    payroll.salary_month ||
                    "payslip"
                ).replace(
                    /[^a-zA-Z0-9-_]/g,
                    "-"
                );

            // ---------------------------------------------
            // RESPONSE
            // ---------------------------------------------

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${employeeName}_Payslip_${salaryMonth}.pdf"`
            );

            res.setHeader(
                "Content-Length",
                pdfBuffer.length
            );

            return res.send(
                pdfBuffer
            );

        } catch (error) {

            console.error(
                "Employee payslip PDF error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to generate payslip PDF.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;