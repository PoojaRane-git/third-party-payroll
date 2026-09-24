const supabase = require("../config/supabase");

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const DAILY_COLUMNS = `
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
`;

const SUMMARY_COLUMNS = `
    id,
    employee_id,
    client_id,
    deployment_id,
    billing_month,
    total_days,
    working_days,
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

/*
|--------------------------------------------------------------------------
| Date Helpers
|--------------------------------------------------------------------------
*/

/**
 * Returns today's date in Asia/Kolkata as YYYY-MM-DD.
 */
function getTodayIST() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

/**
 * Returns number of days in a month.
 *
 * billingMonth format:
 * YYYY-MM
 */
function getDaysInMonth(billingMonth) {
    const [year, month] = billingMonth.split("-").map(Number);

    return new Date(year, month, 0).getDate();
}

/**
 * Returns:
 * {
 *   monthStart: YYYY-MM-DD,
 *   nextMonth: YYYY-MM-DD
 * }
 */
function getMonthRange(billingMonth) {
    const [year, month] = billingMonth.split("-").map(Number);

    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthNumber = month === 12 ? 1 : month + 1;

    const nextMonth = `${nextYear}-${String(nextMonthNumber).padStart(
        2,
        "0"
    )}-01`;

    return {
        monthStart,
        nextMonth,
    };
}

function addDaysISO(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);

    date.setDate(date.getDate() + days);

    return date.toISOString().slice(0, 10);
}

function getDayOfWeek(dateString) {
    const date = new Date(`${dateString}T00:00:00`);

    return date.getDay();
}

function isWeekend(dateString) {
    const day = getDayOfWeek(dateString);

    return day === 0 || day === 6;
}

function getMonthDates(billingMonth) {
    const totalDays = getDaysInMonth(billingMonth);

    const dates = [];

    for (let day = 1; day <= totalDays; day++) {
        dates.push(
            `${billingMonth}-${String(day).padStart(2, "0")}`
        );
    }

    return dates;
}

/*
|--------------------------------------------------------------------------
| Leave Dates
|--------------------------------------------------------------------------
*/

async function getApprovedLeaveDates(employeeId, billingMonth) {
    const { monthStart, nextMonth } = getMonthRange(billingMonth);

    const leaveDates = new Set();

    try {
        const { data, error } = await supabase
            .from("leave_requests")
            .select(`
                id,
                employee_id,
                start_date,
                end_date,
                status
            `)
            .eq("employee_id", employeeId)
            .eq("status", "Approved")
            .lte("start_date", nextMonth)
            .gte("end_date", monthStart);

        if (error) {
            console.error("Failed to fetch approved leaves:", error);
            return leaveDates;
        }

        for (const leave of data || []) {
            if (!leave.start_date || !leave.end_date) {
                continue;
            }

            let currentDate = leave.start_date;

            while (currentDate <= leave.end_date) {
                if (
                    currentDate >= monthStart &&
                    currentDate < nextMonth
                ) {
                    leaveDates.add(currentDate);
                }

                currentDate = addDaysISO(currentDate, 1);
            }
        }
    } catch (error) {
        console.error("Error getting approved leave dates:", error);
    }

    return leaveDates;
}

/*
|--------------------------------------------------------------------------
| Holiday Dates
|--------------------------------------------------------------------------
*/

async function getHolidayDates(clientId, billingMonth) {
    const { monthStart, nextMonth } = getMonthRange(billingMonth);

    const holidayDates = new Set();

    if (!clientId) {
        return holidayDates;
    }

    try {
        const { data, error } = await supabase
            .from("holiday_calendar")
            .select(`
                id,
                client_id,
                holiday_date
            `)
            .eq("client_id", clientId)
            .gte("holiday_date", monthStart)
            .lt("holiday_date", nextMonth);

        if (error) {
            console.error("Failed to fetch holidays:", error);
            return holidayDates;
        }

        for (const holiday of data || []) {
            if (holiday.holiday_date) {
                holidayDates.add(
                    String(holiday.holiday_date).slice(0, 10)
                );
            }
        }
    } catch (error) {
        console.error("Error getting holiday dates:", error);
    }

    return holidayDates;
}

/*
|--------------------------------------------------------------------------
| Employee Deployment
|--------------------------------------------------------------------------
*/

async function getEmployeeDeployment(employeeId) {
    try {
        const { data, error } = await supabase
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

        if (error) {
            console.error("Failed to fetch employee deployment:", error);
            return null;
        }

        return data || null;
    } catch (error) {
        console.error("Error getting employee deployment:", error);
        return null;
    }
}

/*
|--------------------------------------------------------------------------
| Existing Summary
|--------------------------------------------------------------------------
*/

async function getExistingSummary(employeeId, billingMonth) {
    const { data, error } = await supabase
        .from("third_party_attendance_summary")
        .select(SUMMARY_COLUMNS)
        .eq("employee_id", employeeId)
        .eq("billing_month", billingMonth)
        .maybeSingle();

    if (error) {
        console.error("Failed to fetch existing summary:", error);
        return null;
    }

    return data || null;
}

/*
|--------------------------------------------------------------------------
| Recalculate Monthly Summary
|--------------------------------------------------------------------------
*/

async function recalculateMonthlySummary(employeeId, billingMonth) {
    if (!employeeId) {
        throw new Error("Employee ID is required");
    }

    if (!billingMonth) {
        throw new Error("Billing month is required");
    }

    /*
    |--------------------------------------------------------------------------
    | Month information
    |--------------------------------------------------------------------------
    */

    const { monthStart, nextMonth } = getMonthRange(billingMonth);

    const totalDays = getDaysInMonth(billingMonth);

    const todayIST = getTodayIST();

    /*
    |--------------------------------------------------------------------------
    | Employee deployment
    |--------------------------------------------------------------------------
    */

    const deployment = await getEmployeeDeployment(employeeId);

    const existingSummary = await getExistingSummary(
        employeeId,
        billingMonth
    );

    const clientId =
        deployment?.client_id ||
        existingSummary?.client_id ||
        null;

    const deploymentId =
        deployment?.id ||
        existingSummary?.deployment_id ||
        null;

    /*
    |--------------------------------------------------------------------------
    | Daily Attendance
    |--------------------------------------------------------------------------
    */

    const { data: dailyAttendance, error: attendanceError } =
        await supabase
            .from("third_party_emp_daily_attendance")
            .select(DAILY_COLUMNS)
            .eq("candidates_id", employeeId)
            .gte("attendance_date", monthStart)
            .lt("attendance_date", nextMonth)
            .order("attendance_date", {
                ascending: true,
            });

    if (attendanceError) {
        throw attendanceError;
    }

    /*
    |--------------------------------------------------------------------------
    | Map attendance by date
    |--------------------------------------------------------------------------
    */

    const attendanceByDate = new Map();

    for (const row of dailyAttendance || []) {
        const date = String(row.attendance_date).slice(0, 10);

        attendanceByDate.set(date, row);
    }

    /*
    |--------------------------------------------------------------------------
    | Leaves and Holidays
    |--------------------------------------------------------------------------
    */

    const approvedLeaveDates =
        await getApprovedLeaveDates(
            employeeId,
            billingMonth
        );

    const holidayDates =
        await getHolidayDates(
            clientId,
            billingMonth
        );

    /*
    |--------------------------------------------------------------------------
    | Counters
    |--------------------------------------------------------------------------
    */

    let workingDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let leaveDays = 0;
    let halfDays = 0;
    let overtimeHours = 0;

    /*
    |--------------------------------------------------------------------------
    | Process each calendar day
    |--------------------------------------------------------------------------
    */

    const monthDates = getMonthDates(billingMonth);

    for (const date of monthDates) {
        /*
        |--------------------------------------------------------------------------
        | Do not calculate future dates
        |--------------------------------------------------------------------------
        */

        if (date > todayIST) {
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | Deployment date restriction
        |--------------------------------------------------------------------------
        */

        if (
            deployment?.start_date &&
            date < String(deployment.start_date).slice(0, 10)
        ) {
            continue;
        }

        if (
            deployment?.end_date &&
            date > String(deployment.end_date).slice(0, 10)
        ) {
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | Weekend
        |--------------------------------------------------------------------------
        */

        if (isWeekend(date)) {
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | Holiday
        |--------------------------------------------------------------------------
        */

        if (holidayDates.has(date)) {
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | This is a working day
        |--------------------------------------------------------------------------
        */

        workingDays++;

        /*
        |--------------------------------------------------------------------------
        | Approved Leave
        |--------------------------------------------------------------------------
        */

        if (approvedLeaveDates.has(date)) {
            leaveDays++;
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | Attendance for this date
        |--------------------------------------------------------------------------
        */

        const row = attendanceByDate.get(date);

        /*
        |--------------------------------------------------------------------------
        | No attendance
        |--------------------------------------------------------------------------
        |
        | Today is not marked absent until the day is completed.
        |
        | Past working days with no attendance are absent.
        |--------------------------------------------------------------------------
        */

        if (!row) {
            if (date < todayIST) {
                absentDays++;
            }

            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | IMPORTANT:
        |
        | A check-in without checkout is NOT Present.
        |
        | Your database allows:
        | Present / Absent / Leave / Half Day /
        | Holiday / Weekly Off
        |
        | It does NOT allow "In Progress".
        |
        | Therefore we determine whether attendance is complete
        | using check_out instead of the status field.
        |--------------------------------------------------------------------------
        */

        const hasCheckIn = !!row.check_in;
        const hasCheckOut = !!row.check_out;

        if (hasCheckIn && !hasCheckOut) {
            /*
             * Do not count unfinished attendance as Present.
             *
             * We also don't mark it Absent here because the
             * employee may still complete the attendance.
             */
            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | No check-in / no check-out
        |--------------------------------------------------------------------------
        */

        if (!hasCheckIn && !hasCheckOut) {
            if (date < todayIST) {
                absentDays++;
            }

            continue;
        }

        /*
        |--------------------------------------------------------------------------
        | Completed attendance
        |--------------------------------------------------------------------------
        */

        const status = String(row.status || "").trim();

        const workingHours = Number(row.working_hours) || 0;

        /*
        |--------------------------------------------------------------------------
        | Present
        |--------------------------------------------------------------------------
        */

        if (status === "Present") {
            presentDays++;
        }

        /*
        |--------------------------------------------------------------------------
        | Half Day
        |--------------------------------------------------------------------------
        */

        else if (status === "Half Day") {
            halfDays++;
        }

        /*
        |--------------------------------------------------------------------------
        | Leave
        |--------------------------------------------------------------------------
        */

        else if (status === "Leave") {
            leaveDays++;
        }

        /*
        |--------------------------------------------------------------------------
        | Absent
        |--------------------------------------------------------------------------
        */

        else if (status === "Absent") {
            absentDays++;
        }

        /*
        |--------------------------------------------------------------------------
        | Unknown status
        |--------------------------------------------------------------------------
        |
        | If checkout exists but status is unexpected, determine
        | attendance from working hours.
        |--------------------------------------------------------------------------
        */

        else {
            if (workingHours >= 8) {
                presentDays++;
            } else if (workingHours >= 4) {
                halfDays++;
            } else {
                absentDays++;
            }
        }

        /*
        |--------------------------------------------------------------------------
        | Overtime
        |--------------------------------------------------------------------------
        |
        | Only completed attendance contributes overtime.
        |--------------------------------------------------------------------------
        */

        if (hasCheckOut) {
            const rowOvertime =
                Number(row.overtime_hours) || 0;

            if (rowOvertime > 0) {
                overtimeHours += rowOvertime;
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Final Calculations
    |--------------------------------------------------------------------------
    */

    overtimeHours =
        Math.round(overtimeHours * 100) / 100;

    /*
     * LOP = absent days
     */
    const lopDays = absentDays;

    /*
     * Half Day = 0.5 payable day
     */
    const payableDays =
        presentDays +
        halfDays * 0.5;

    /*
    |--------------------------------------------------------------------------
    | Summary object
    |--------------------------------------------------------------------------
    */

    const summaryData = {
        employee_id: employeeId,
        client_id: clientId,
        deployment_id: deploymentId,
        billing_month: billingMonth,

        total_days: totalDays,

        working_days: workingDays,

        present_days: presentDays,

        absent_days: absentDays,

        leave_days: leaveDays,

        half_days: halfDays,

        lop_days: lopDays,

        payable_days: payableDays,

        overtime_hours: overtimeHours,

        updated_at: new Date().toISOString(),
    };

    /*
    |--------------------------------------------------------------------------
    | Save Summary
    |--------------------------------------------------------------------------
    */

    const { data: savedSummary, error: summaryError } =
        await supabase
            .from("third_party_attendance_summary")
            .upsert(
                summaryData,
                {
                    onConflict: "employee_id,billing_month",
                }
            )
            .select(SUMMARY_COLUMNS)
            .single();

    if (summaryError) {
        throw summaryError;
    }

    return savedSummary;
}

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
    recalculateMonthlySummary,
    getTodayIST,
    getMonthRange,
    DAILY_COLUMNS,
    SUMMARY_COLUMNS,
};