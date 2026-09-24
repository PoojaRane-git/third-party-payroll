// ============================================================
// services/attendanceSummary.js
//
// Shared by the employee router and payroll.
// Builds third_party_attendance_summary from
// third_party_emp_daily_attendance.
// ============================================================

const supabase = require("../config/supabase");

// ------------------------------------------------------------
// LEAVE TABLE CONFIG  (TODO: change to match your real table)
// ------------------------------------------------------------
const LEAVE = {
    table: "leave_requests",
    employeeColumn: "employee_id",
    fromColumn: "from_date",
    toColumn: "to_date",
    statusColumn: "status",
    approvedValue: "Approved",
};

const DAILY_COLUMNS = `
    id, candidates_id, deployment_id, client_id, attendance_date,
    check_in, check_out, working_hours, overtime_hours, status,
    work_mode, remarks, created_at, updated_at
`;

const SUMMARY_COLUMNS = `
    id, employee_id, client_id, deployment_id, billing_month,
    total_days, present_days, absent_days, leave_days, half_days,
    lop_days, payable_days, overtime_hours, created_at, updated_at
`;

// ------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------
const getTodayIST = () =>
    new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());

const getDaysInMonth = (billingMonth) => {
    const [year, month] = billingMonth.split("-").map(Number);
    return new Date(year, month, 0).getDate();
};

const getMonthRange = (billingMonth) => {
    const [year, month] = billingMonth.split("-").map(Number);
    const monthStart = `${billingMonth}-01`;
    const nextMonth = new Date(Date.UTC(year, month, 1))
        .toISOString()
        .substring(0, 10);
    return { monthStart, nextMonth };
};

const addDaysISO = (dateStr, n) =>
    new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000)
        .toISOString()
        .substring(0, 10);

// ------------------------------------------------------------
// Weekdays (Mon-Fri) with NO attendance row:
//  - outside deployment period -> ignored
//  - holiday                   -> ignored
//  - approved leave            -> counted as leave
//  - past day                  -> counted as absent
//  - today / future            -> never counted
// ------------------------------------------------------------
const countMissingDays = ({
    billingMonth,
    rows,
    holidayDates,
    leaveDates,
    startDate,
    endDate,
}) => {
    const lastDay = getDaysInMonth(billingMonth);
    const todayIST = getTodayIST();
    const recorded = new Set(rows.map((r) => r.attendance_date));

    let absent = 0;
    let leave = 0;

    for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${billingMonth}-${String(d).padStart(2, "0")}`;

        if (startDate && dateStr < startDate) continue;
        if (endDate && dateStr > endDate) continue;

        const dow = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun, 6=Sat
        if (dow === 0 || dow === 6) continue; // week-off (adjust to roster)
        if (recorded.has(dateStr)) continue;
        if (holidayDates.has(dateStr)) continue;

        if (leaveDates.has(dateStr)) leave++;
        else if (dateStr < todayIST) absent++;
    }

    return { absent, leave };
};

// ------------------------------------------------------------
// Recalculate + store monthly summary
// ------------------------------------------------------------
const recalculateMonthlySummary = async (employeeId, billingMonth) => {
    const { monthStart, nextMonth } = getMonthRange(billingMonth);

    const { data: dailyRows, error: dailyError } = await supabase
        .from("third_party_emp_daily_attendance")
        .select(DAILY_COLUMNS)
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
        // "in progress" is not counted until check-out

        overtimeHours += Number(row.overtime_hours || 0);
    });

    // ---- Resolve client / deployment ----
    let clientId = null;
    let deploymentId = null;

    if (rows.length > 0) {
        const latest = rows[rows.length - 1];
        clientId = latest.client_id;
        deploymentId = latest.deployment_id;
    }

    if (!clientId || !deploymentId) {
        const { data: existing, error } = await supabase
            .from("third_party_attendance_summary")
            .select("id, client_id, deployment_id")
            .eq("employee_id", employeeId)
            .eq("billing_month", billingMonth)
            .maybeSingle();

        if (error) throw error;

        if (existing) {
            clientId = existing.client_id;
            deploymentId = existing.deployment_id;
        }
    }

    if (!clientId || !deploymentId) {
        // Latest deployment (any status, so ex-employees still resolve)
        const { data: deployment, error } = await supabase
            .from("deployments")
            .select("id, client_id")
            .eq("candidate_id", employeeId)
            .order("start_date", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (deployment) {
            deploymentId = deployment.id;
            clientId = deployment.client_id;
        }
    }

    if (!clientId || !deploymentId) {
        throw new Error("Client/deployment information not found for employee.");
    }

    // ---- Deployment period ----
    const { data: deploymentInfo, error: deploymentInfoError } = await supabase
        .from("deployments")
        .select("start_date, end_date")
        .eq("id", deploymentId)
        .maybeSingle();

    if (deploymentInfoError) {
        console.error("Deployment dates lookup failed:", deploymentInfoError);
    }

    const startDate = deploymentInfo?.start_date || null;
    const endDate = deploymentInfo?.end_date || null;

    // ---- Holidays (per client, full-day only) ----
    const holidayDates = new Set();
    const { data: holidays, error: holidayError } = await supabase
        .from("holiday_calendar")
        .select("holiday_date")
        .eq("client_id", clientId)
        .eq("holiday_type", "Full Day")
        .gte("holiday_date", monthStart)
        .lt("holiday_date", nextMonth);

    if (holidayError) console.error("Holiday lookup failed:", holidayError);
    (holidays || []).forEach((h) => holidayDates.add(h.holiday_date));

    // ---- Approved leaves ----
    const leaveDates = new Set();
    const { data: leaves, error: leaveError } = await supabase
        .from(LEAVE.table)
        .select(`${LEAVE.fromColumn}, ${LEAVE.toColumn}`)
        .eq(LEAVE.employeeColumn, employeeId)
        .eq(LEAVE.statusColumn, LEAVE.approvedValue)
        .lt(LEAVE.fromColumn, nextMonth)
        .gte(LEAVE.toColumn, monthStart);

    if (leaveError) console.error("Leave lookup failed:", leaveError);
    (leaves || []).forEach((l) => {
        const from = l[LEAVE.fromColumn];
        const to = l[LEAVE.toColumn];
        for (let d = from; d <= to; d = addDaysISO(d, 1)) leaveDates.add(d);
    });

    // ---- Days with no attendance row ----
    const missing = countMissingDays({
        billingMonth,
        rows,
        holidayDates,
        leaveDates,
        startDate,
        endDate,
    });

    absentDays += missing.absent;
    leaveDays += missing.leave;

    const totalDays = getDaysInMonth(billingMonth);
    const lopDays = absentDays;

    // ---- Days inside the deployment period ----
    const lastDate = `${billingMonth}-${String(totalDays).padStart(2, "0")}`;
    const periodStart = startDate && startDate > monthStart ? startDate : monthStart;
    const periodEnd = endDate && endDate < lastDate ? endDate : lastDate;
    const daysInPeriod =
        periodEnd < periodStart
            ? 0
            : Math.round(
                  (Date.parse(periodEnd) - Date.parse(periodStart)) / 86400000
              ) + 1;

    const payableDays = Math.max(0, daysInPeriod - lopDays - halfDays * 0.5);

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
        .select(SUMMARY_COLUMNS)
        .single();

    if (summaryError) throw summaryError;

    return {
        ...summary,
        working_days: presentDays + halfDays * 0.5,
    };
};

module.exports = {
    recalculateMonthlySummary,
    getTodayIST,
    getDaysInMonth,
    getMonthRange,
    DAILY_COLUMNS,
    SUMMARY_COLUMNS,
};