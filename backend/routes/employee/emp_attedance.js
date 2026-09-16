const express = require("express");
const router = express.Router();

const supabase = require("../../config/supabase");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

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
req.profile.employee_id

ATTENDANCE SOURCE OF TRUTH:
    third_party_emp_daily_attendance
    third_party_attendance_summary

NOT USED:
    ❌ third_party_attendance_approval
    ❌ summary_id
    ❌ approval_status
    ❌ approval_by
    ❌ approved_at
    ❌ third_party_emp_attendance
=====================================================
*/

const employeeAuth = [
    authenticate,
    authorize("employee"),
];

/* =====================================================
   HELPERS
===================================================== */

const getTodayIST = () => {
    return new Date().toLocaleDateString(
        "en-CA",
        {
            timeZone: "Asia/Kolkata",
        }
    );
};

const getCurrentMonthIST = () => {
    return getTodayIST().slice(0, 7);
};

const getDaysInMonth = (billingMonth) => {
    const [year, month] =
        billingMonth.split("-").map(Number);

    return new Date(
        year,
        month,
        0
    ).getDate();
};

const getMonthRange = (billingMonth) => {
    const [year, month] =
        billingMonth.split("-").map(Number);

    const startDate =
        `${billingMonth}-01`;

    const endDate =
        month === 12
            ? `${year + 1}-01-01`
            : `${year}-${String(
                  month + 1
              ).padStart(2, "0")}-01`;

    return {
        startDate,
        endDate,
    };
};

const number = (value) => {
    const result = Number(value);

    return Number.isFinite(result)
        ? result
        : 0;
};

/* =====================================================
   DAILY ATTENDANCE SELECT
=====================================================

IMPORTANT:
There is NO summary_id here.
There is NO approval_status here.
===================================================== */

const DAILY_ATTENDANCE_SELECT = `
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
`;

/* =====================================================
   SUMMARY SELECT
=====================================================

IMPORTANT:
There is NO status here.
===================================================== */

const SUMMARY_SELECT = `
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
`;

/* =====================================================
   RECALCULATE MONTHLY SUMMARY
=====================================================

Reads ONLY:

third_party_emp_daily_attendance

Writes:

third_party_attendance_summary

Does NOT use:

third_party_emp_attendance
third_party_attendance_approval
===================================================== */

const recalculateMonthlySummary = async (
    employeeId,
    billingMonth
) => {
    const {
        startDate,
        endDate,
    } = getMonthRange(billingMonth);

    console.log(
        `Recalculating attendance summary:
         employee=${employeeId}
         month=${billingMonth}`
    );

    /* =================================================
       GET DAILY ATTENDANCE
    ================================================= */

    const {
        data: dailyRows,
        error: dailyError,
    } = await supabase
        .from(
            "third_party_emp_daily_attendance"
        )
        .select(DAILY_ATTENDANCE_SELECT)
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
        throw dailyError;
    }

    const rows = dailyRows || [];

    /* =================================================
       CALCULATE SUMMARY
    ================================================= */

    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;

    rows.forEach((row) => {
        const status = String(
            row.status || ""
        )
            .trim()
            .toLowerCase();

        if (status === "present") {
            presentDays += 1;
        }

        else if (status === "absent") {
            absentDays += 1;
        }

        else if (status === "leave") {
            leaveDays += 1;
        }

        else if (
            status === "half day" ||
            status === "halfday"
        ) {
            halfDays += 1;
        }

        overtimeHours += number(
            row.overtime_hours
        );
    });

    /* =================================================
       LOP
    ================================================= */

    const lopDays = absentDays;

    /* =================================================
       PAYABLE DAYS

       Present = 1
       Leave   = 1
       Half    = 0.5
       Absent  = 0
    ================================================= */

    const payableDays =
        presentDays +
        leaveDays +
        halfDays * 0.5;

    /* =================================================
       TOTAL DAYS
    ================================================= */

    const totalDays =
        getDaysInMonth(
            billingMonth
        );

    /* =================================================
       CLIENT + DEPLOYMENT

       Take from daily attendance first.
    ================================================= */

    let clientId = null;
    let deploymentId = null;

    if (rows.length > 0) {
        const latest =
            rows[rows.length - 1];

        clientId =
            latest.client_id;

        deploymentId =
            latest.deployment_id;
    }

    /* =================================================
       IF DAILY ROW DOES NOT HAVE CLIENT/DEPLOYMENT,
       READ EXISTING SUMMARY
    ================================================= */

    if (
        !clientId ||
        !deploymentId
    ) {
        const {
            data: existingSummary,
            error: existingSummaryError,
        } = await supabase
            .from(
                "third_party_attendance_summary"
            )
            .select(
                SUMMARY_SELECT
            )
            .eq(
                "employee_id",
                employeeId
            )
            .eq(
                "billing_month",
                billingMonth
            )
            .maybeSingle();

        if (existingSummaryError) {
            throw existingSummaryError;
        }

        if (existingSummary) {
            clientId =
                existingSummary.client_id;

            deploymentId =
                existingSummary.deployment_id;
        }
    }

    /* =================================================
       FINAL FALLBACK:
       ACTIVE DEPLOYMENT
    ================================================= */

    if (
        !clientId ||
        !deploymentId
    ) {
        const {
            data: deploymentRows,
            error: deploymentError,
        } = await supabase
            .from("deployments")
            .select(`
                id,
                client_id
            `)
            .eq(
                "employee_id",
                employeeId
            )
            .eq(
                "status",
                "Active"
            )
            .order(
                "id",
                {
                    ascending: false,
                }
            )
            .limit(1);

        if (deploymentError) {
            throw deploymentError;
        }

        const deployment =
            deploymentRows?.[0];

        if (deployment) {
            deploymentId =
                deployment.id;

            clientId =
                deployment.client_id;
        }
    }

    /* =================================================
       CANNOT CREATE SUMMARY WITHOUT DEPLOYMENT
    ================================================= */

    if (
        !clientId ||
        !deploymentId
    ) {
        throw new Error(
            "No client/deployment found for this employee."
        );
    }

    /* =================================================
       UPSERT SUMMARY
    ================================================= */

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
        .select(
            SUMMARY_SELECT
        )
        .single();

    if (summaryError) {
        throw summaryError;
    }

    return {
        ...summary,

        working_days:
            presentDays +
            halfDays * 0.5,
    };
};

/* =====================================================
   BASIC ROUTE
===================================================== */

router.get(
    "/",
    (req, res) => {
        res.json({
            success: true,
            message:
                "Employee Portal API is running!",
        });
    }
);

/* =====================================================
   TEST ROUTE
===================================================== */

router.get(
    "/test",
    (req, res) => {
        res.json({
            success: true,
            message:
                "Employee Portal connected to Node.js",
        });
    }
);

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
                Number(
                    req.profile?.employee_id
                );

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
                .eq(
                    "id",
                    employeeId
                )
                .maybeSingle();

            if (error) {
                console.error(
                    "Employee profile database error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    error:
                        error.message,
                });
            }

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee not found.",
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
                error:
                    error.message,
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
                Number(
                    req.profile?.employee_id
                );

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const today =
                getTodayIST();

            const {
                data,
                error,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(
                    DAILY_ATTENDANCE_SELECT
                )
                .eq(
                    "employee_id",
                    employeeId
                )
                .eq(
                    "attendance_date",
                    today
                )
                .order(
                    "id",
                    {
                        ascending: false,
                    }
                )
                .limit(1);

            if (error) {
                console.error(
                    "Today's attendance database error:",
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

                attendance:
                    data?.[0] ||
                    null,
            });

        } catch (error) {
            console.error(
                "Today's attendance error:",
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
   GET EMPLOYEE DAILY ATTENDANCE BY MONTH
=====================================================

GET /api/employee/attendance?month=2026-09
===================================================== */

router.get(
    "/attendance",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(
                    req.profile?.employee_id
                );

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const month =
                req.query.month ||
                getCurrentMonthIST();

            if (
                !/^\d{4}-\d{2}$/.test(
                    month
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid month format. Use YYYY-MM.",
                });
            }

            const [
                year,
                monthNumber,
            ] =
                month
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

            const {
                startDate,
                endDate,
            } =
                getMonthRange(month);

            const {
                data,
                error,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(
                    DAILY_ATTENDANCE_SELECT
                )
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
                    error:
                        error.message,
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
                error:
                    error.message,
            });
        }
    }
);

/* =====================================================
   GET EMPLOYEE MONTHLY SUMMARY
=====================================================

GET /api/employee/monthly?billing_month=2026-09
===================================================== */

router.get(
    "/monthly",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(
                    req.profile?.employee_id
                );

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const billingMonth =
                req.query.billing_month ||
                getCurrentMonthIST();

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

            /*
            Recalculate from daily attendance
            every time.

            This guarantees that the monthly
            summary is immediately updated.
            */

            let summary = null;

            try {
                summary =
                    await recalculateMonthlySummary(
                        employeeId,
                        billingMonth
                    );
            } catch (summaryError) {
                console.error(
                    "Monthly summary recalculation error:",
                    summaryError
                );

                /*
                Fallback to existing summary.
                */

                const {
                    data,
                    error,
                } = await supabase
                    .from(
                        "third_party_attendance_summary"
                    )
                    .select(
                        SUMMARY_SELECT
                    )
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
                    return res.status(500).json({
                        success: false,
                        error:
                            error.message,
                    });
                }

                summary = data;
            }

            /* =================================================
               DAILY ATTENDANCE
            ================================================= */

            const {
                startDate,
                endDate,
            } =
                getMonthRange(
                    billingMonth
                );

            const {
                data: dailyData,
                error: dailyError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(
                    DAILY_ATTENDANCE_SELECT
                )
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

            /* =================================================
               EMPTY SUMMARY
            ================================================= */

            if (!summary) {
                return res.json({
                    success: true,

                    employee_id:
                        employeeId,

                    billing_month:
                        billingMonth,

                    summary: {
                        total_days:
                            getDaysInMonth(
                                billingMonth
                            ),

                        working_days: 0,

                        present_days: 0,

                        absent_days: 0,

                        leave_days: 0,

                        half_days: 0,

                        lop_days: 0,

                        payable_days: 0,

                        overtime_hours: 0,
                    },

                    data:
                        dailyData || [],
                });
            }

            /* =================================================
               SUMMARY RESPONSE
            ================================================= */

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

            return res.json({
                success: true,

                employee_id:
                    employeeId,

                billing_month:
                    billingMonth,

                summary: {
                    id:
                        summary.id,

                    total_days:
                        number(
                            summary.total_days
                        ),

                    working_days:
                        presentDays +
                        halfDays * 0.5,

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
                            overtimeHours.toFixed(
                                2
                            )
                        ),
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
                error:
                    error.message,
            });
        }
    }
);

/* =====================================================
   CHECK-IN
=====================================================

POST /api/employee/attendance/check-in

ONLY creates/updates:

third_party_emp_daily_attendance

NO summary_id
NO approval_status
===================================================== */

router.post(
    "/attendance/check-in",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(
                    req.profile?.employee_id
                );

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            const today =
                getTodayIST();

            const {
                work_mode = "Office",
                remarks = "",
            } = req.body || {};

            /* =================================================
               FIND ACTIVE DEPLOYMENT
            ================================================= */

            const {
                data: deploymentRows,
                error: deploymentError,
            } = await supabase
                .from("deployments")
                .select(`
                    id,
                    client_id,
                    employee_id,
                    status
                `)
                .eq(
                    "employee_id",
                    employeeId
                )
                .eq(
                    "status",
                    "Active"
                )
                .order(
                    "id",
                    {
                        ascending: false,
                    }
                )
                .limit(1);

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

            const deployment =
                deploymentRows?.[0];

            if (!deployment) {
                return res.status(404).json({
                    success: false,
                    error:
                        "No active deployment found for this employee.",
                });
            }

            /* =================================================
               CHECK EXISTING ATTENDANCE
            ================================================= */

            const {
                data: existingRows,
                error: existingError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(
                    DAILY_ATTENDANCE_SELECT
                )
                .eq(
                    "employee_id",
                    employeeId
                )
                .eq(
                    "attendance_date",
                    today
                )
                .order(
                    "id",
                    {
                        ascending: false,
                    }
                )
                .limit(1);

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

            const existing =
                existingRows?.[0] ||
                null;

            if (existing?.check_in) {
                return res.status(400).json({
                    success: false,
                    error:
                        "You have already checked in today.",
                    attendance:
                        existing,
                });
            }

            /* =================================================
               CHECK-IN TIME
            ================================================= */

            const checkInTime =
                new Date();

            /* =================================================
               CREATE DAILY ATTENDANCE
            ================================================= */

            let attendance;
            let attendanceError;

            if (existing) {
                /*
                Existing row may have been created
                by a scheduler as Absent.

                Convert it into Present when the
                employee actually checks in.
                */

                const result =
                    await supabase
                        .from(
                            "third_party_emp_daily_attendance"
                        )
                        .update({
                            deployment_id:
                                deployment.id,

                            client_id:
                                deployment.client_id,

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

                            updated_at:
                                checkInTime.toISOString(),
                        })
                        .eq(
                            "id",
                            existing.id
                        )
                        .eq(
                            "employee_id",
                            employeeId
                        )
                        .select(
                            DAILY_ATTENDANCE_SELECT
                        )
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
                            employee_id:
                                employeeId,

                            deployment_id:
                                deployment.id,

                            client_id:
                                deployment.client_id,

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
                        })
                        .select(
                            DAILY_ATTENDANCE_SELECT
                        )
                        .single();

                attendance =
                    result.data;

                attendanceError =
                    result.error;
            }

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

            /* =================================================
               IMMEDIATELY RECALCULATE MONTH
            ================================================= */

            let summary = null;

            try {
                summary =
                    await recalculateMonthlySummary(
                        employeeId,
                        today.slice(0, 7)
                    );
            } catch (summaryError) {
                console.error(
                    "Summary recalculation after check-in failed:",
                    summaryError
                );
            }

            return res.status(201).json({
                success: true,

                message:
                    "Check-in successful.",

                attendance,

                summary,
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
   CHECK-OUT
=====================================================

PATCH /api/employee/attendance/:id/check-out

Working hours:
    >= 8 hours → Present
    < 8 hours  → Half Day

Overtime:
    hours above 8
===================================================== */

router.patch(
    "/attendance/:id/check-out",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(
                    req.profile?.employee_id
                );

            const attendanceId =
                Number(req.params.id);

            if (!employeeId) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Employee ID is not linked to this account.",
                });
            }

            if (
                !Number.isInteger(
                    attendanceId
                ) ||
                attendanceId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid attendance ID.",
                });
            }

            /* =================================================
               GET ATTENDANCE
            ================================================= */

            const {
                data: existing,
                error: findError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select(
                    DAILY_ATTENDANCE_SELECT
                )
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

            if (!existing.check_in) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Check-in is required before check-out.",
                });
            }

            if (existing.check_out) {
                return res.status(400).json({
                    success: false,
                    error:
                        "You have already checked out.",
                    attendance:
                        existing,
                });
            }

            /* =================================================
               CALCULATE HOURS
            ================================================= */

            const checkIn =
                new Date(
                    existing.check_in
                );

            const checkOut =
                new Date();

            const milliseconds =
                checkOut.getTime() -
                checkIn.getTime();

            const workingHours =
                milliseconds /
                (1000 * 60 * 60);

            const roundedHours =
                Math.max(
                    0,
                    Number(
                        workingHours.toFixed(
                            2
                        )
                    )
                );

            /* =================================================
               STATUS
            ================================================= */

            const status =
                roundedHours >= 8
                    ? "Present"
                    : "Half Day";

            /* =================================================
               OVERTIME
            ================================================= */

            const overtimeHours =
                roundedHours > 8
                    ? Number(
                        (
                            roundedHours -
                            8
                        ).toFixed(2)
                    )
                    : 0;

            /* =================================================
               UPDATE DAILY ATTENDANCE
            ================================================= */

            const {
                data: attendance,
                error: updateError,
            } = await supabase
                .from(
                    "third_party_emp_daily_attendance"
                )
                .update({
                    check_out:
                        checkOut.toISOString(),

                    working_hours:
                        roundedHours,

                    overtime_hours:
                        overtimeHours,

                    status,

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
                .select(
                    DAILY_ATTENDANCE_SELECT
                )
                .single();

            if (updateError) {
                console.error(
                    "Check-out database error:",
                    updateError
                );

                return res.status(500).json({
                    success: false,
                    error:
                        updateError.message,
                });
            }

            /* =================================================
               RECALCULATE MONTHLY SUMMARY
            ================================================= */

            let summary = null;

            try {
                summary =
                    await recalculateMonthlySummary(
                        employeeId,
                        String(
                            existing.attendance_date
                        ).slice(0, 7)
                    );
            } catch (summaryError) {
                console.error(
                    "Summary recalculation after check-out failed:",
                    summaryError
                );
            }

            return res.json({
                success: true,

                message:
                    "Check-out successful.",

                attendance,

                summary,
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
   EMPLOYEE PAYSLIPS
===================================================== */

router.get(
    "/payroll/me",
    ...employeeAuth,
    async (req, res) => {
        try {
            const employeeId =
                Number(
                    req.profile?.employee_id
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
   EXPORT
===================================================== */

module.exports = router;