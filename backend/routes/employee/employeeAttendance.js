// ============================================================
// EMPLOYEE ATTENDANCE ROUTER
//
// MOUNTED (see server.js) at BOTH:
//   /api/emp-attendance
//   /api/employee
// ============================================================

const express = require("express");
const router = express.Router();

const supabase = require("../../config/supabase");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");
const { generatePayslipPDF } = require("../../utils/Payslippdf");

const {
    recalculateMonthlySummary,
    getTodayIST,
    getMonthRange,
    DAILY_COLUMNS,
    SUMMARY_COLUMNS,
} = require("../services/attendanceSummary");

router.use(authenticate, authorize("employee"));

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

const getCurrentMonthIST = () => getTodayIST().substring(0, 7);

const getEmployeeId = (req) => {
    const employeeId = Number(req.profile?.employee_id);

    if (!employeeId) {
        throw new Error("Employee ID is not linked to this account.");
    }

    return employeeId;
};

// ============================================================
// GET /me
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
// GET DAILY ATTENDANCE
// GET /  (?billing_month=YYYY-MM or ?month=YYYY-MM)
// ============================================================

router.get("/", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);
        const billingMonth =
            req.query.billing_month || req.query.month || getCurrentMonthIST();
        const { monthStart, nextMonth } = getMonthRange(billingMonth);

        const { data, error } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
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
// GET /today
// ============================================================

router.get("/today", async (req, res) => {
    try {
        const employeeId = getEmployeeId(req);

        const { data, error } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("candidates_id", employeeId)
            .eq("attendance_date", getTodayIST())
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
// POST /check-in
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
            .select("id, client_id, candidate_id")
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

        let result;

        if (existing) {
            result = await supabase
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
                .select(DAILY_COLUMNS)
                .single();
        } else {
            result = await supabase
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
                .select(DAILY_COLUMNS)
                .single();
        }

        if (result.error) {
            return sendError(res, 500, "Failed to check in.", result.error);
        }

        let summary = null;

        try {
            summary = await recalculateMonthlySummary(employeeId, today.substring(0, 7));
        } catch (summaryError) {
            console.error("Monthly summary database error:", summaryError);
        }

        return res.status(201).json({
            success: true,
            message: "Attendance checked in successfully.",
            attendance: result.data,
            summary,
        });
    } catch (error) {
        return sendError(res, 500, "Check-in failed.", error);
    }
});

// ============================================================
// PATCH /:id/check-out
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
            .select(DAILY_COLUMNS)
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

        const checkOut = new Date();
        const hours =
            (checkOut.getTime() - new Date(attendance.check_in).getTime()) /
            (1000 * 60 * 60);
        const workingHours = Math.max(0, Number(hours.toFixed(2)));

        let status;
        if (workingHours >= 8) status = "Present";
        else if (workingHours >= 4) status = "Half Day";
        else status = "Absent";

        const overtimeHours =
            workingHours > 8 ? Number((workingHours - 8).toFixed(2)) : 0;

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
            .select(DAILY_COLUMNS)
            .single();

        if (updateError) {
            return sendError(res, 500, "Failed to check out.", updateError);
        }

        let summary = null;

        try {
            summary = await recalculateMonthlySummary(
                employeeId,
                String(attendance.attendance_date).substring(0, 7)
            );
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
// GET /monthly
// ============================================================

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
                .select(SUMMARY_COLUMNS)
                .eq("employee_id", employeeId)
                .eq("billing_month", billingMonth)
                .maybeSingle();

            if (error) {
                return sendError(res, 500, "Failed to fetch monthly summary.", error);
            }
            summary = data;
        }

        const { monthStart, nextMonth } = getMonthRange(billingMonth);

        const { data: dailyAttendance, error: dailyError } = await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("candidates_id", employeeId)
            .gte("attendance_date", monthStart)
            .lt("attendance_date", nextMonth)
            .order("attendance_date", { ascending: true });

        if (dailyError) {
            return sendError(res, 500, "Failed to fetch monthly attendance.", dailyError);
        }

        return res.json({
            success: true,
            billing_month: billingMonth,
            summary: summary || null,
            attendance: dailyAttendance || [],
            daily_attendance: dailyAttendance || [],
        });
    } catch (error) {
        return sendError(res, 500, "Failed to fetch monthly attendance.", error);
    }
});

// ============================================================
// GET /payroll/me   (employee's own payslips)
// ============================================================

router.get("/payroll/me", async (req, res) => {
    try {
        const employeeId = Number(req.profile?.employee_id);

        if (!employeeId) {
            return res.status(403).json({
                success: false,
                message: "Employee profile is not linked to an employee.",
            });
        }

        const { data: payslips, error } = await supabase
            .from("third_party_payroll")
            .select("*")
            .eq("employee_ref_id", employeeId)
            .order("salary_month", { ascending: false });

        if (error) {
            return sendError(res, 500, "Unable to load payslips.", error);
        }

        return res.json({ success: true, payslips: payslips || [] });
    } catch (error) {
        return sendError(res, 500, "Unable to load payslips.", error);
    }
});

// ============================================================
// GET /payroll/:id/pdf   (own payslip only)
// ============================================================

router.get("/payroll/:id/pdf", async (req, res) => {
    try {
        const employeeId = Number(req.profile?.employee_id);
        const payrollId = Number(req.params.id);

        if (!employeeId) {
            return res.status(403).json({
                success: false,
                message: "Employee profile is not linked to an employee.",
            });
        }

        if (!payrollId) {
            return res.status(400).json({ success: false, message: "Invalid payroll ID." });
        }

        const { data: payroll, error } = await supabase
            .from("third_party_payroll")
            .select("*")
            .eq("id", payrollId)
            .eq("employee_ref_id", employeeId)
            .maybeSingle();

        if (error) {
            return sendError(res, 500, "Unable to load payroll.", error);
        }

        if (!payroll) {
            return res.status(404).json({ success: false, message: "Payroll record not found." });
        }

        // NOTE: needs third_party_payroll.status to exist
        const status = String(payroll.status || "").toLowerCase().trim();

        if (!["approved", "locked", "paid"].includes(status)) {
            return res.status(403).json({
                success: false,
                message: "Payslip is available only after payroll is approved.",
            });
        }

        const pdfBuffer = await generatePayslipPDF(payroll);

        const employeeName = String(payroll.employee_name || "Employee")
            .replace(/[^a-zA-Z0-9]/g, "_")
            .replace(/_+/g, "_");

        const salaryMonth = String(payroll.salary_month || "payslip")
            .replace(/[^a-zA-Z0-9-_]/g, "-");

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${employeeName}_Payslip_${salaryMonth}.pdf"`
        );
        res.setHeader("Content-Length", pdfBuffer.length);

        return res.send(pdfBuffer);
    } catch (error) {
        return sendError(res, 500, "Unable to generate payslip PDF.", error);
    }
});

module.exports = router;