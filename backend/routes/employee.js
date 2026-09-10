const express = require("express");
const router = express.Router();

const supabase = require("../supabase");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

/*
=====================================================
EMPLOYEE AUTHENTICATION
=====================================================

Supabase Auth
    ↓
authenticate.js
    ↓
authorize("employee")
    ↓
employee_users
    ↓
req.profile.employee_id

NO x-employee-id
NO custom JWT
NO employee password checking
*/

const employeeAuth = [
    authenticate,
    authorize("employee"),
];

/* =====================================================
   BASIC ROUTE
===================================================== */

router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Employee Portal API is running!",
    });
});

/* =====================================================
   TEST ROUTE
===================================================== */

router.get("/test", (req, res) => {
    res.json({
        success: true,
        message: "Employee Portal connected to Node.js",
    });
});

/* =====================================================
   GET LOGGED-IN EMPLOYEE
=====================================================

GET /api/employee/me
===================================================== */

router.get(
    "/me",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(req.profile?.employee_id);

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const {
                data: employee,
                error,
            } = await supabase
                .from("candidates")
                .select(`
                    id,
                    full_name,
                    email,
                    phone,
                    pan_number,
                    bank_account_number,
                    ifsc_code,
                    bank_name,
                    uan_number,
                    esic_number,
                    date_of_joining,
                    employment_status
                `)
                .eq("id", employeeId)
                .maybeSingle();

            if (error) {
                console.error(
                    "Employee profile database error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error: error.message,
                });
            }

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    error: "Employee not found.",
                });
            }

            return res.json({
                success: true,
                employee,
            });

        } catch (error) {
            console.error(
                "Employee profile error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/* =====================================================
   GET TODAY'S ATTENDANCE
=====================================================

GET /api/employee/attendance/today
===================================================== */

router.get(
    "/attendance/today",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(req.profile?.employee_id);

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const today =
                new Date().toLocaleDateString(
                    "en-CA",
                    {
                        timeZone: "Asia/Kolkata",
                    }
                );

            const {
                data,
                error,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(`
                    id,
                    employee_id,
                    deployment_id,
                    client_id,
                    summary_id,
                    attendance_date,
                    check_in,
                    check_out,
                    working_hours,
                    overtime_hours,
                    status,
                    work_mode,
                    remarks,
                    approval_status
                `)
                .eq(
                    "employee_id",
                    employeeId
                )
                .eq(
                    "attendance_date",
                    today
                )
                .order("id", {
                    ascending: false,
                })
                .limit(1);

            if (error) {
                console.error(
                    "Today's attendance database error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error: error.message,
                });
            }

            return res.json({
                success: true,
                attendance:
                    data?.[0] || null,
            });

        } catch (error) {
            console.error(
                "Today's attendance error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/* =====================================================
   GET EMPLOYEE ATTENDANCE BY MONTH
=====================================================

GET /api/employee/attendance?month=2026-09
===================================================== */

router.get(
    "/attendance",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(req.profile?.employee_id);

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const month =
                req.query.month ||
                new Date()
                    .toLocaleDateString(
                        "en-CA",
                        {
                            timeZone:
                                "Asia/Kolkata",
                        }
                    )
                    .slice(0, 7);

            if (!/^\d{4}-\d{2}$/.test(month)) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid month format. Use YYYY-MM.",
                });
            }

            const [
                year,
                monthNumber,
            ] = month
                .split("-")
                .map(Number);

            if (
                monthNumber < 1 ||
                monthNumber > 12
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid month.",
                });
            }

            const startDate =
                `${month}-01`;

            const endDate =
                monthNumber === 12
                    ? `${year + 1}-01-01`
                    : `${year}-${String(
                          monthNumber + 1
                      ).padStart(2, "0")}-01`;

            const {
                data,
                error,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(`
                    id,
                    employee_id,
                    deployment_id,
                    client_id,
                    summary_id,
                    attendance_date,
                    check_in,
                    check_out,
                    working_hours,
                    overtime_hours,
                    status,
                    work_mode,
                    remarks,
                    approval_status
                `)
                .eq(
                    "employee_id",
                    employeeId
                )
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

            if (error) {
                console.error(
                    "Monthly attendance database error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error: error.message,
                });
            }

            return res.json({
                success: true,
                month,
                attendance:
                    data || [],
            });

        } catch (error) {
            console.error(
                "Monthly attendance error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/* =====================================================
   GET EMPLOYEE MONTHLY SUMMARY
=====================================================

GET /api/employee/monthly?billing_month=2026-09

PRIMARY MONTHLY SOURCE:
third_party_attendance_summary

DAILY SOURCE:
third_party_emp_daily_attendance
===================================================== */

router.get(
    "/monthly",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(req.profile?.employee_id);

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const billingMonth =
                req.query.billing_month ||
                new Date()
                    .toLocaleDateString(
                        "en-CA",
                        {
                            timeZone:
                                "Asia/Kolkata",
                        }
                    )
                    .slice(0, 7);

            if (
                !/^\d{4}-\d{2}$/.test(
                    billingMonth
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid billing_month. Use YYYY-MM.",
                });
            }

            const [
                year,
                monthNumber,
            ] =
                billingMonth
                    .split("-")
                    .map(Number);

            if (
                monthNumber < 1 ||
                monthNumber > 12
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid billing month.",
                });
            }

            /* =========================================
               MONTHLY SUMMARY
            ========================================= */

            const {
                data: summaryRows,
                error: summaryError,
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
                    status
                `)
                .eq(
                    "employee_id",
                    employeeId
                )
                .eq(
                    "billing_month",
                    billingMonth
                )
                .order("id", {
                    ascending: false,
                })
                .limit(1);

            if (summaryError) {
                console.error(
                    "Monthly summary database error:",
                    summaryError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        summaryError.message,
                });
            }

            const summary =
                summaryRows?.[0] || null;

            /* =========================================
               DAILY ATTENDANCE
            ========================================= */

            const startDate =
                `${billingMonth}-01`;

            const endDate =
                monthNumber === 12
                    ? `${year + 1}-01-01`
                    : `${year}-${String(
                          monthNumber + 1
                      ).padStart(2, "0")}-01`;

            const {
                data: dailyData,
                error: dailyError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(`
                    id,
                    employee_id,
                    deployment_id,
                    client_id,
                    summary_id,
                    attendance_date,
                    check_in,
                    check_out,
                    working_hours,
                    overtime_hours,
                    status,
                    work_mode,
                    remarks,
                    approval_status
                `)
                .eq(
                    "employee_id",
                    employeeId
                )
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

            if (dailyError) {
                console.error(
                    "Daily attendance database error:",
                    dailyError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        dailyError.message,
                });
            }

            /* =========================================
               NO SUMMARY
            ========================================= */

            if (!summary) {
                return res.json({
                    success: true,

                    employee_id:
                        employeeId,

                    billing_month:
                        billingMonth,

                    summary: {
                        total_days: 0,
                        working_days: 0,
                        present_days: 0,
                        absent_days: 0,
                        leave_days: 0,
                        half_days: 0,
                        lop_days: 0,
                        payable_days: 0,
                        overtime_hours: 0,
                        status: "Pending",
                    },

                    data:
                        dailyData || [],
                });
            }

            /* =========================================
               NUMBER HELPER
            ========================================= */

            const number = (value) => {
                const result =
                    Number(value);

                return Number.isNaN(result)
                    ? 0
                    : result;
            };

            const presentDays =
                number(
                    summary.present_days
                );

            const absentDays =
                number(
                    summary.absent_days
                );

            const leaveDays =
                number(
                    summary.leave_days
                );

            const halfDays =
                number(
                    summary.half_days
                );

            const lopDays =
                number(
                    summary.lop_days
                );

            const payableDays =
                number(
                    summary.payable_days
                );

            const overtimeHours =
                number(
                    summary.overtime_hours
                );

            const workingDays =
                presentDays +
                absentDays +
                leaveDays +
                halfDays;

            /* =========================================
               RESPONSE
            ========================================= */

            return res.json({
                success: true,

                employee_id:
                    employeeId,

                billing_month:
                    billingMonth,

                summary: {
                    total_days:
                        number(
                            summary.total_days
                        ),

                    working_days:
                        workingDays,

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

                    status:
                        summary.status ||
                        "Pending",
                },

                data:
                    dailyData || [],
            });

        } catch (error) {
            console.error(
                "Monthly attendance error:",
                error
            );

            return res.status(500).json({
                success: false,
                error: error.message,
            });
        }
    }
);

/* =====================================================
   EMPLOYEE CHECK-IN
=====================================================

POST /api/employee/attendance/check-in

IMPORTANT:
Daily attendance uses:

third_party_emp_daily_attendance.summary_id

The monthly parent is:

third_party_attendance_summary
===================================================== */

router.post(
    "/attendance/check-in",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(req.profile?.employee_id);

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const {
                work_mode = "Office",
                remarks = "",
            } = req.body;

            /* =========================================
               FIND ACTIVE DEPLOYMENT
            ========================================= */

            const {
                data: deployment,
                error: deploymentError,
            } = await supabase
                .from("deployments")
                .select(`
                    id,
                    client_id,
                    candidate_id,
                    status
                `)
                .eq(
                    "candidate_id",
                    employeeId
                )
                .eq(
                    "status",
                    "Active"
                )
                .order("id", {
                    ascending: false,
                })
                .limit(1)
                .maybeSingle();

            if (deploymentError) {
                console.error(
                    "Deployment lookup error:",
                    deploymentError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        deploymentError.message,
                });
            }

            if (!deployment) {
                return res.status(404).json({
                    success: false,
                    error:
                        "No active deployment found for this employee.",
                });
            }

            /* =========================================
               TODAY / MONTH
            ========================================= */

            const today =
                new Date().toLocaleDateString(
                    "en-CA",
                    {
                        timeZone:
                            "Asia/Kolkata",
                    }
                );

            const billingMonth =
                today.slice(0, 7);

            /* =========================================
               FIND MONTHLY SUMMARY
            ========================================= */

            const {
                data: summaryRows,
                error: summaryLookupError,
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
                    status
                `)
                .eq(
                    "employee_id",
                    employeeId
                )
                .eq(
                    "deployment_id",
                    deployment.id
                )
                .eq(
                    "billing_month",
                    billingMonth
                )
                .order("id", {
                    ascending: false,
                })
                .limit(1);

            if (summaryLookupError) {
                console.error(
                    "Summary lookup error:",
                    summaryLookupError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        summaryLookupError.message,
                });
            }

            let summary =
                summaryRows?.[0] || null;

            /* =========================================
               CREATE MONTHLY SUMMARY IF MISSING
            ========================================= */

            if (!summary) {
                const {
                    data: newSummary,
                    error: createSummaryError,
                } = await supabase
                    .from(
                        "third_party_attendance_summary"
                    )
                    .insert({
                        employee_id:
                            employeeId,

                        client_id:
                            deployment.client_id,

                        deployment_id:
                            deployment.id,

                        billing_month:
                            billingMonth,

                        total_days:
                            new Date(
                                Number(
                                    billingMonth.slice(
                                        0,
                                        4
                                    )
                                ),
                                Number(
                                    billingMonth.slice(
                                        5,
                                        7
                                    )
                                ),
                                0
                            ).getDate(),

                        present_days: 0,

                        absent_days: 0,

                        leave_days: 0,

                        half_days: 0,

                        lop_days: 0,

                        payable_days: 0,

                        overtime_hours: 0,

                        status: "Pending",

                        created_at:
                            new Date().toISOString(),

                        updated_at:
                            new Date().toISOString(),
                    })
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
                        status
                    `)
                    .single();

                if (createSummaryError) {
                    console.error(
                        "Summary creation error:",
                        createSummaryError
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            createSummaryError.message,
                    });
                }

                summary =
                    newSummary;
            }

            /* =========================================
               CHECK IF ALREADY CHECKED IN
            ========================================= */

            const {
                data: existingAttendance,
                error: existingError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select("*")
                .eq(
                    "employee_id",
                    employeeId
                )
                .eq(
                    "deployment_id",
                    deployment.id
                )
                .eq(
                    "attendance_date",
                    today
                )
                .limit(1)
                .maybeSingle();

            if (existingError) {
                console.error(
                    "Existing attendance lookup error:",
                    existingError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        existingError.message,
                });
            }

            if (
                existingAttendance?.check_in
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Employee has already checked in today.",
                    attendance:
                        existingAttendance,
                });
            }

            /* =========================================
               CHECK-IN TIME
            ========================================= */

            const checkInTime =
                new Date();

            /* =========================================
               INSERT DAILY ATTENDANCE
            ========================================= */

            const {
                data: attendance,
                error: attendanceError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .upsert(
                    {
                        employee_id:
                            employeeId,

                        deployment_id:
                            deployment.id,

                        client_id:
                            deployment.client_id,

                        summary_id:
                            summary.id,

                        attendance_date:
                            today,

                        check_in:
                            checkInTime.toISOString(),

                        check_out:
                            null,

                        working_hours:
                            0,

                        overtime_hours:
                            0,

                        status:
                            "Present",

                        work_mode,

                        remarks,

                        approval_status:
                            "Pending",

                        updated_at:
                            checkInTime.toISOString(),
                    },
                    {
                        onConflict:
                            "employee_id,deployment_id,attendance_date",
                    }
                )
                .select()
                .single();

            if (attendanceError) {
                console.error(
                    "Check-in database error:",
                    attendanceError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        attendanceError.message,
                });
            }

            return res.json({
                success: true,

                message:
                    "Check-in successful",

                attendance,
            });

        } catch (error) {
            console.error(
                "Check-in error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    error.message,
            });
        }
    }
);

/* =====================================================
   EMPLOYEE PAYSLIPS
=====================================================

GET /api/employee/payroll/me
===================================================== */

router.get(
    "/payroll/me",
    ...employeeAuth,
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
                .from("third_party_payroll")
                .select("*")
                .eq(
                    "employee_ref_id",
                    employeeId
                )
                .in("status", [
                    "approved",
                    "Approved",
                    "locked",
                    "Locked",
                    "paid",
                    "Paid",
                ])
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

/* =====================================================
   EMPLOYEE CHECK-OUT
=====================================================

PATCH /api/employee/attendance/:id/check-out
===================================================== */

router.patch(
    "/attendance/:id/check-out",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(req.profile?.employee_id);

            const attendanceId =
                req.params.id;

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            /* =========================================
               FIND ATTENDANCE
            ========================================= */

            const {
                data: existing,
                error: findError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select("*")
                .eq(
                    "id",
                    attendanceId
                )
                .eq(
                    "employee_id",
                    employeeId
                )
                .maybeSingle();

            if (findError) {
                console.error(
                    "Attendance lookup error:",
                    findError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        findError.message,
                });
            }

            if (!existing) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Attendance record not found.",
                });
            }

            /* =========================================
               CHECK-IN REQUIRED
            ========================================= */

            if (!existing.check_in) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Check-in is required before check-out.",
                });
            }

            /* =========================================
               PREVENT DUPLICATE CHECK-OUT
            ========================================= */

            if (existing.check_out) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Employee has already checked out.",
                });
            }

            /* =========================================
               CALCULATE WORKING HOURS
            ========================================= */

            const checkOut =
                new Date();

            const checkIn =
                new Date(
                    existing.check_in
                );

            const workingHours =
                (
                    checkOut.getTime() -
                    checkIn.getTime()
                ) /
                (1000 * 60 * 60);

            const roundedWorkingHours =
                Math.max(
                    0,
                    Number(
                        workingHours.toFixed(
                            2
                        )
                    )
                );

            const overtimeHours =
                Math.max(
                    0,
                    Number(
                        (
                            roundedWorkingHours -
                            8
                        ).toFixed(2)
                    )
                );

            /* =========================================
               UPDATE ATTENDANCE
            ========================================= */

            const {
                data: attendance,
                error,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .update({
                    check_out:
                        checkOut.toISOString(),

                    working_hours:
                        roundedWorkingHours,

                    overtime_hours:
                        overtimeHours,

                    updated_at:
                        checkOut.toISOString(),
                })
                .eq(
                    "id",
                    attendanceId
                )
                .eq(
                    "employee_id",
                    employeeId
                )
                .select()
                .single();

            if (error) {
                console.error(
                    "Check-out database error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error:
                        error.message,
                });
            }

            return res.json({
                success: true,

                message:
                    "Check-out successful",

                attendance,
            });

        } catch (error) {
            console.error(
                "Check-out error:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    error.message,
            });
        }
    }
);

/* =====================================================
   EXPORT ROUTER
===================================================== */

module.exports = router;