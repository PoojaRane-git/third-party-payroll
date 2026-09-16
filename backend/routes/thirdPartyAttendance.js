
const express = require("express");
const router = express.Router();

const supabaseAdmin =
    require("../config/supabaseAdmin");

// ============================================================
// TABLES
// ============================================================

const DAILY_TABLE =
    "third_party_emp_daily_attendance";

const DEPLOYMENTS_TABLE =
    "deployments";

const CANDIDATES_TABLE =
    "candidates";

const ROSTER_TABLE =
    "employee_roster";

const HOLIDAY_TABLE =
    "holiday_calendar";

const LEAVE_TABLE =
    "leave_applications";

const POLICY_TABLE =
    "client_attendance_policy";


// ============================================================
// DEFAULT POLICY
//
// IMPORTANT:
// These defaults are used when client_attendance_policy
// has no row yet.
// ============================================================

const DEFAULT_POLICY = {
    full_day_hours: 8,
    half_day_min_hours: 4,
    sandwich_rule_enabled: false,
    holiday_ot_enabled: true,
    weekly_off_ot_enabled: true,
    comp_off_enabled: true,
    ot_multiplier: 1.5,
};


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


const sendError = (
    res,
    status,
    message,
    details = null
) => {
    return res.status(status).json({
        success: false,
        message,
        ...(details
            ? { details }
            : {}),
    });
};


// ============================================================
// NORMALIZE STATUS
// ============================================================

const normalizeStatus = (status) => {
    return String(status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
};


// ============================================================
// VALIDATE MONTH
// ============================================================

const isValidBillingMonth = (value) => {
    const month = String(value || "");

    if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(
            month
        )
    ) {
        return false;
    }

    return true;
};


// ============================================================
// MONTH INFORMATION
// ============================================================

const getMonthInfo = (billingMonth) => {
    const [
        year,
        month,
    ] = billingMonth
        .split("-")
        .map(Number);

    const totalDays =
        new Date(
            year,
            month,
            0
        ).getDate();

    return {
        year,
        month,
        totalDays,
        firstDate:
            `${billingMonth}-01`,
        lastDate:
            `${billingMonth}-${String(
                totalDays
            ).padStart(2, "0")}`,
    };
};


// ============================================================
// DATE FORMAT
// ============================================================

const formatDate = (
    year,
    month,
    day
) => {
    return `${year}-${String(
        month
    ).padStart(2, "0")}-${String(
        day
    ).padStart(2, "0")}`;
};


// ============================================================
// DATE COMPARISON
// ============================================================

const dateOnly = (value) => {
    if (!value) {
        return null;
    }

    return String(value).slice(0, 10);
};


// ============================================================
// GET TODAY - INDIA
// ============================================================

const getTodayIndia = () => {
    return new Date()
        .toLocaleDateString(
            "en-CA",
            {
                timeZone:
                    "Asia/Kolkata",
            }
        );
};


// ============================================================
// CHECK DEPLOYMENT ACTIVE FOR DATE
// ============================================================

const isDeploymentActiveOnDate = (
    deployment,
    date
) => {
    const startDate =
        dateOnly(
            deployment.start_date
        );

    const endDate =
        dateOnly(
            deployment.end_date
        );

    if (
        startDate &&
        date < startDate
    ) {
        return false;
    }

    if (
        endDate &&
        date > endDate
    ) {
        return false;
    }

    // If deployment has an explicit inactive status,
    // don't include it.
    const status =
        normalizeStatus(
            deployment.status
        );

    if (
        [
            "inactive",
            "terminated",
            "cancelled",
            "completed",
            "closed",
        ].includes(status)
    ) {
        return false;
    }

    return true;
};


// ============================================================
// WEEKDAY HELPERS
//
// JS:
// 0 = Sunday
// 1 = Monday
// ...
// 6 = Saturday
// ============================================================

const getRosterWorkingField = (
    weekday
) => {
    const fields = {
        0: "sunday_working",
        1: "monday_working",
        2: "tuesday_working",
        3: "wednesday_working",
        4: "thursday_working",
        5: "friday_working",
        6: "saturday_working",
    };

    return fields[weekday];
};


// ============================================================
// DEFAULT ROSTER
//
// If employee_roster has no row yet:
//
// Monday-Friday = Working
// Saturday-Sunday = Weekly Off
//
// This prevents empty newly-added roster table from
// making attendance calculations useless.
// ============================================================

const getDefaultRoster = () => {
    return {
        monday_working: true,
        tuesday_working: true,
        wednesday_working: true,
        thursday_working: true,
        friday_working: true,
        saturday_working: false,
        sunday_working: false,
    };
};


// ============================================================
// IS WORKING DAY
// ============================================================

const isWorkingDay = (
    date,
    roster
) => {
    const jsDate =
        new Date(
            `${date}T00:00:00`
        );

    const weekday =
        jsDate.getDay();

    const field =
        getRosterWorkingField(
            weekday
        );

    return Boolean(
        roster[field]
    );
};


// ============================================================
// FIND APPLICABLE ROSTER
//
// Priority:
//
// 1. Employee + deployment roster
// 2. Employee roster without deployment
// 3. Default Mon-Fri roster
// ============================================================

const findRosterForDate = (
    rosters,
    employeeId,
    deploymentId,
    date
) => {
    const matching =
        rosters.filter(
            (roster) => {
                if (
                    Number(
                        roster.employee_id
                    ) !==
                    Number(employeeId)
                ) {
                    return false;
                }

                if (
                    roster.deployment_id &&
                    Number(
                        roster.deployment_id
                    ) !==
                    Number(deploymentId)
                ) {
                    return false;
                }

                const effectiveFrom =
                    dateOnly(
                        roster.effective_from
                    );

                const effectiveTo =
                    dateOnly(
                        roster.effective_to
                    );

                if (
                    effectiveFrom &&
                    date <
                        effectiveFrom
                ) {
                    return false;
                }

                if (
                    effectiveTo &&
                    date >
                        effectiveTo
                ) {
                    return false;
                }

                return true;
            }
        );

    if (
        matching.length > 0
    ) {
        // Prefer deployment-specific roster.
        const deploymentSpecific =
            matching.find(
                (item) =>
                    item.deployment_id &&
                    Number(
                        item.deployment_id
                    ) ===
                    Number(deploymentId)
            );

        return (
            deploymentSpecific ||
            matching[0]
        );
    }

    return getDefaultRoster();
};


// ============================================================
// CALCULATE WORKING HOURS
// ============================================================

const calculateWorkingHours = (
    checkIn,
    checkOut
) => {
    if (
        !checkIn ||
        !checkOut
    ) {
        return 0;
    }

    const start =
        new Date(checkIn);

    const end =
        new Date(checkOut);

    if (
        Number.isNaN(
            start.getTime()
        ) ||
        Number.isNaN(
            end.getTime()
        )
    ) {
        return 0;
    }

    const milliseconds =
        end.getTime() -
        start.getTime();

    if (
        milliseconds <= 0
    ) {
        return 0;
    }

    return Number(
        (
            milliseconds /
            (1000 * 60 * 60)
        ).toFixed(2)
    );
};


// ============================================================
// DETERMINE ATTENDANCE STATUS
// ============================================================

const determinePunchStatus = (
    record,
    policy
) => {
    const normalized =
        normalizeStatus(
            record?.status
        );

    // -----------------------------------------------
    // Explicit Leave
    // -----------------------------------------------

    if (
        normalized === "leave" ||
        normalized === "on_leave"
    ) {
        return "Leave";
    }

    // -----------------------------------------------
    // Holiday / Weekly Off worked
    // -----------------------------------------------

    if (
        normalized ===
            "holiday_worked" ||
        normalized ===
            "weekly_off_worked"
    ) {
        return normalized ===
            "holiday_worked"
            ? "Holiday Worked"
            : "Weekly Off Worked";
    }

    // -----------------------------------------------
    // Existing explicit status
    // -----------------------------------------------

    if (
        normalized === "present"
    ) {
        return "Present";
    }

    if (
        normalized ===
            "half_day" ||
        normalized ===
            "halfday"
    ) {
        return "Half Day";
    }

    if (
        normalized === "absent"
    ) {
        return "Absent";
    }

    // -----------------------------------------------
    // Calculate from punch times
    // -----------------------------------------------

    const workingHours =
        Number(
            record?.working_hours ||
                calculateWorkingHours(
                    record?.check_in,
                    record?.check_out
                )
        );

    if (
        workingHours >=
        Number(
            policy.full_day_hours
        )
    ) {
        return "Present";
    }

    if (
        workingHours >=
        Number(
            policy.half_day_min_hours
        )
    ) {
        return "Half Day";
    }

    return "Absent";
};


// ============================================================
// GET POLICY
// ============================================================

const getPolicies = async (
    clientIds
) => {
    if (
        !clientIds.length
    ) {
        return new Map();
    }

    const {
        data,
        error,
    } = await supabaseAdmin
        .from(
            POLICY_TABLE
        )
        .select(`
            id,
            client_id,
            full_day_hours,
            half_day_min_hours,
            sandwich_rule_enabled,
            holiday_ot_enabled,
            weekly_off_ot_enabled,
            comp_off_enabled,
            ot_multiplier
        `)
        .in(
            "client_id",
            clientIds
        );

    if (error) {
        throw error;
    }

    const map =
        new Map();

    (
        data || []
    ).forEach(
        (policy) => {
            map.set(
                Number(
                    policy.client_id
                ),
                {
                    ...DEFAULT_POLICY,
                    ...policy,
                }
            );
        }
    );

    return map;
};


// ============================================================
// GET ROSTERS
// ============================================================

const getRosters = async (
    employeeIds
) => {
    if (
        !employeeIds.length
    ) {
        return [];
    }

    const {
        data,
        error,
    } = await supabaseAdmin
        .from(
            ROSTER_TABLE
        )
        .select(`
            id,
            employee_id,
            deployment_id,
            client_id,
            roster_name,
            monday_working,
            tuesday_working,
            wednesday_working,
            thursday_working,
            friday_working,
            saturday_working,
            sunday_working,
            effective_from,
            effective_to
        `)
        .in(
            "employee_id",
            employeeIds
        );

    if (error) {
        throw error;
    }

    return data || [];
};


// ============================================================
// GET HOLIDAYS
// ============================================================

const getHolidays = async (
    clientIds,
    firstDate,
    lastDate
) => {
    if (
        !clientIds.length
    ) {
        return [];
    }

    const {
        data,
        error,
    } = await supabaseAdmin
        .from(
            HOLIDAY_TABLE
        )
        .select(`
            id,
            client_id,
            holiday_date,
            name,
            holiday_type,
            is_paid
        `)
        .in(
            "client_id",
            clientIds
        )
        .gte(
            "holiday_date",
            firstDate
        )
        .lte(
            "holiday_date",
            lastDate
        );

    if (error) {
        throw error;
    }

    return data || [];
};


// ============================================================
// GET APPROVED LEAVES
// ============================================================

const getApprovedLeaves = async (
    employeeIds,
    clientIds,
    firstDate,
    lastDate
) => {
    if (
        !employeeIds.length ||
        !clientIds.length
    ) {
        return [];
    }

    const {
        data,
        error,
    } = await supabaseAdmin
        .from(
            LEAVE_TABLE
        )
        .select(`
            id,
            employee_id,
            client_id,
            deployment_id,
            leave_type,
            start_date,
            end_date,
            reason,
            status
        `)
        .in(
            "employee_id",
            employeeIds
        )
        .in(
            "client_id",
            clientIds
        )
        .eq(
            "status",
            "Approved"
        )
        .lte(
            "start_date",
            lastDate
        )
        .gte(
            "end_date",
            firstDate
        );

    if (error) {
        throw error;
    }

    return data || [];
};


// ============================================================
// CHECK APPROVED LEAVE FOR DATE
// ============================================================

const getApprovedLeaveForDate = (
    leaves,
    employeeId,
    clientId,
    deploymentId,
    date
) => {
    return leaves.find(
        (leave) => {
            if (
                Number(
                    leave.employee_id
                ) !==
                Number(employeeId)
            ) {
                return false;
            }

            if (
                Number(
                    leave.client_id
                ) !==
                Number(clientId)
            ) {
                return false;
            }

            if (
                leave.deployment_id &&
                Number(
                    leave.deployment_id
                ) !==
                Number(deploymentId)
            ) {
                return false;
            }

            const startDate =
                dateOnly(
                    leave.start_date
                );

            const endDate =
                dateOnly(
                    leave.end_date
                );

            return (
                date >= startDate &&
                date <= endDate
            );
        }
    );
};


// ============================================================
// BUILD HOLIDAY MAP
// ============================================================

const buildHolidayMap = (
    holidays
) => {
    const map =
        new Map();

    holidays.forEach(
        (holiday) => {
            const key =
                `${holiday.client_id}|${dateOnly(
                    holiday.holiday_date
                )}`;

            map.set(
                key,
                holiday
            );
        }
    );

    return map;
};


// ============================================================
// BUILD ATTENDANCE MAP
//
// Key:
//
// employee_id | deployment_id | attendance_date
//
// ============================================================

const buildAttendanceMap = (
    records
) => {
    const map =
        new Map();

    records.forEach(
        (record) => {
            const employeeId =
                Number(
                    record.candidates_id ??
                    record.employee_id
                );

            const deploymentId =
                Number(
                    record.deployment_id
                );

            const attendanceDate =
                dateOnly(
                    record.attendance_date
                );

            if (
                !employeeId ||
                !deploymentId ||
                !attendanceDate
            ) {
                return;
            }

            const key =
                `${employeeId}|${deploymentId}|${attendanceDate}`;

            map.set(
                key,
                record
            );
        }
    );

    return map;
};


// ============================================================
// SUMMARY COUNTER
// ============================================================

const emptySummary = () => ({
    total_days: 0,
    present_days: 0,
    absent_days: 0,
    leave_days: 0,
    half_days: 0,
    holiday_days: 0,
    weekly_off_days: 0,
    holiday_worked_days: 0,
    weekly_off_worked_days: 0,
    lop_days: 0,
    payable_days: 0,
    overtime_hours: 0,
    total_recorded_days: 0,
});


// ============================================================
// ADD STATUS TO SUMMARY
// ============================================================

const addStatusToSummary = (
    summary,
    status
) => {
    switch (
        normalizeStatus(status)
    ) {
        case "present":
            summary.present_days += 1;
            summary.payable_days += 1;
            break;

        case "half_day":
        case "halfday":
            summary.half_days += 1;
            summary.payable_days += 0.5;
            break;

        case "absent":
            summary.absent_days += 1;
            summary.lop_days += 1;
            break;

        case "leave":
        case "on_leave":
            summary.leave_days += 1;
            summary.payable_days += 1;
            break;

        case "holiday":
            summary.holiday_days += 1;

            // Paid holiday counts as payable.
            summary.payable_days += 1;
            break;

        case "weekly_off":
            summary.weekly_off_days += 1;

            // Weekly off is paid/factored into fixed salary.
            summary.payable_days += 1;
            break;

        case "holiday_worked":
            summary.holiday_worked_days += 1;
            summary.payable_days += 1;
            break;

        case "weekly_off_worked":
            summary.weekly_off_worked_days += 1;
            summary.payable_days += 1;
            break;

        default:
            break;
    }
};


// ============================================================
// GET ADMIN ATTENDANCE
//
// GET /api/third-party-attendance
//
// Optional:
//
// ?client_id=1
// ?billing_month=2026-09
//
// IMPORTANT:
//
// Employee list comes from DEPLOYMENTS,
// NOT attendance table.
//
// Missing attendance on working day
// becomes Absent/LOP.
//
// No fake database rows are inserted.
// ============================================================

router.get(
    "/",
    async (req, res) => {
        try {
            const {
                client_id,
                billing_month,
            } = req.query;

            // =================================================
            // CLIENT FILTER
            // =================================================

            let clientId = null;

            if (client_id) {
                clientId =
                    getId(
                        client_id
                    );

                if (!clientId) {
                    return sendError(
                        res,
                        400,
                        "Invalid client_id."
                    );
                }
            }

            // =================================================
            // DEFAULT MONTH
            // =================================================

            const todayIndia =
                getTodayIndia();

            const defaultMonth =
                todayIndia.slice(
                    0,
                    7
                );

            const selectedMonth =
                billing_month ||
                defaultMonth;

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
                year,
                month,
                totalDays,
                firstDate,
                lastDate,
            } =
                getMonthInfo(
                    selectedMonth
                );

            // =================================================
            // IMPORTANT:
            // Don't count future dates as absent.
            //
            // For current month:
            // process only through today.
            //
            // For previous months:
            // process entire month.
            // =================================================

            const calculationLastDate =
                selectedMonth ===
                todayIndia.slice(
                    0,
                    7
                )
                    ? todayIndia
                    : selectedMonth <
                      todayIndia.slice(
                          0,
                          7
                      )
                    ? lastDate
                    : null;

            // Future month
            if (
                !calculationLastDate
            ) {
                return res.json({
                    success: true,

                    billing_month:
                        selectedMonth,

                    data: [],

                    summary: {
                        total_staff: 0,
                        total_clients: 0,
                        total_present_days: 0,
                        total_absent_days: 0,
                        total_leave_days: 0,
                        total_overtime_hours: 0,
                    },
                });
            }

            // =================================================
            // 1. GET DEPLOYMENTS
            //
            // THIS IS NOW THE STARTING POINT.
            //
            // This fixes the original problem where employees
            // with no attendance disappeared.
            // =================================================

            let deploymentQuery =
                supabaseAdmin
                    .from(
                        DEPLOYMENTS_TABLE
                    )
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
                    `);

            if (clientId) {
                deploymentQuery =
                    deploymentQuery.eq(
                        "client_id",
                        clientId
                    );
            }

            const {
                data: deployments,
                error:
                    deploymentError,
            } =
                await deploymentQuery;

            if (deploymentError) {
                throw deploymentError;
            }

            const activeDeployments =
                (
                    deployments ||
                    []
                ).filter(
                    (deployment) => {
                        const employeeId =
                            Number(
                                deployment.candidate_id
                            );

                        if (
                            !employeeId
                        ) {
                            return false;
                        }

                        // Deployment must overlap
                        // the selected calculation period.
                        if (
                            !isDeploymentActiveOnDate(
                                deployment,
                                firstDate
                            ) &&
                            !isDeploymentActiveOnDate(
                                deployment,
                                calculationLastDate
                            )
                        ) {
                            // Could still overlap month in the middle.
                            const start =
                                dateOnly(
                                    deployment.start_date
                                );

                            const end =
                                dateOnly(
                                    deployment.end_date
                                );

                            if (
                                start &&
                                start >
                                    calculationLastDate
                            ) {
                                return false;
                            }

                            if (
                                end &&
                                end <
                                    firstDate
                            ) {
                                return false;
                            }
                        }

                        return true;
                    }
                );

            // =================================================
            // NO DEPLOYMENTS
            // =================================================

            if (
                activeDeployments.length === 0
            ) {
                return res.json({
                    success: true,

                    billing_month:
                        selectedMonth,

                    data: [],

                    summary: {
                        total_staff: 0,
                        total_clients: 0,
                        total_present_days: 0,
                        total_absent_days: 0,
                        total_leave_days: 0,
                        total_overtime_hours: 0,
                    },
                });
            }

            // =================================================
            // 2. EMPLOYEE IDS
            // =================================================

            const employeeIds = [
                ...new Set(
                    activeDeployments
                        .map(
                            (
                                deployment
                            ) =>
                                Number(
                                    deployment.candidate_id
                                )
                        )
                        .filter(
                            (
                                id
                            ) =>
                                Number.isInteger(
                                    id
                                ) &&
                                id > 0
                        )
                ),
            ];

            // =================================================
            // 3. CLIENT IDS
            // =================================================

            const clientIds = [
                ...new Set(
                    activeDeployments
                        .map(
                            (
                                deployment
                            ) =>
                                Number(
                                    deployment.client_id
                                )
                        )
                        .filter(
                            (
                                id
                            ) =>
                                Number.isInteger(
                                    id
                                ) &&
                                id > 0
                        )
                ),
            ];

            // =================================================
            // 4. GET CANDIDATES
            // =================================================

            const {
                data: candidates,
                error:
                    candidateError,
            } =
                await supabaseAdmin
                    .from(
                        CANDIDATES_TABLE
                    )
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

            if (candidateError) {
                throw candidateError;
            }

            // =================================================
            // 5. GET CLIENTS
            // =================================================

            const {
                data: clients,
                error:
                    clientError,
            } =
                await supabaseAdmin
                    .from("clients")
                    .select(`
                        id,
                        company_name
                    `)
                    .in(
                        "id",
                        clientIds
                    );

            if (clientError) {
                throw clientError;
            }

            // =================================================
            // 6. GET DAILY ATTENDANCE
            //
            // Actual punches only.
            //
            // Missing dates are NOT expected in this table.
            // =================================================

            let attendanceQuery =
                supabaseAdmin
                    .from(
                        DAILY_TABLE
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
                    .gte(
                        "attendance_date",
                        firstDate
                    )
                    .lte(
                        "attendance_date",
                        calculationLastDate
                    );

            if (clientId) {
                attendanceQuery =
                    attendanceQuery.eq(
                        "client_id",
                        clientId
                    );
            }

            const {
                data:
                    dailyRecords,
                error:
                    attendanceError,
            } =
                await attendanceQuery;

            if (attendanceError) {
                throw attendanceError;
            }

            // =================================================
            // 7. GET ROSTERS
            //
            // Empty table is allowed.
            //
            // Default Mon-Fri is used.
            // =================================================

            const rosters =
                await getRosters(
                    employeeIds
                );

            // =================================================
            // 8. GET HOLIDAYS
            //
            // Empty table is allowed.
            // =================================================

            const holidays =
                await getHolidays(
                    clientIds,
                    firstDate,
                    calculationLastDate
                );

            // =================================================
            // 9. GET APPROVED LEAVES
            //
            // Empty table is allowed.
            // =================================================

            const approvedLeaves =
                await getApprovedLeaves(
                    employeeIds,
                    clientIds,
                    firstDate,
                    calculationLastDate
                );

            // =================================================
            // 10. GET ATTENDANCE POLICIES
            //
            // Empty table is allowed.
            // Defaults are used.
            // =================================================

            const policies =
                await getPolicies(
                    clientIds
                );

            // =================================================
            // MAPS
            // =================================================

            const candidateMap =
                new Map(
                    (
                        candidates ||
                        []
                    ).map(
                        (
                            candidate
                        ) => [
                            Number(
                                candidate.id
                            ),
                            candidate,
                        ]
                    )
                );

            const clientMap =
                new Map(
                    (
                        clients ||
                        []
                    ).map(
                        (
                            client
                        ) => [
                            Number(
                                client.id
                            ),
                            client,
                        ]
                    )
                );

            const attendanceMap =
                buildAttendanceMap(
                    dailyRecords ||
                        []
                );

            const holidayMap =
                buildHolidayMap(
                    holidays
                );

            // =================================================
            // GROUP DEPLOYMENTS
            //
            // Employee + deployment should be separate rows.
            // =================================================

            const employeeDeploymentMap =
                new Map();

            activeDeployments.forEach(
                (
                    deployment
                ) => {
                    const employeeId =
                        Number(
                            deployment.candidate_id
                        );

                    const deploymentId =
                        Number(
                            deployment.id
                        );

                    const key =
                        `${employeeId}|${deploymentId}`;

                    if (
                        !employeeDeploymentMap.has(
                            key
                        )
                    ) {
                        employeeDeploymentMap.set(
                            key,
                            deployment
                        );
                    }
                }
            );

            // =================================================
            // BUILD MONTHLY DATA
            // =================================================

            const formattedData =
                [];

            for (
                const deployment
                of employeeDeploymentMap.values()
            ) {
                const employeeId =
                    Number(
                        deployment.candidate_id
                    );

                const deploymentId =
                    Number(
                        deployment.id
                    );

                const currentClientId =
                    Number(
                        deployment.client_id
                    );

                const candidate =
                    candidateMap.get(
                        employeeId
                    );

                const client =
                    clientMap.get(
                        currentClientId
                    );

                const policy =
                    policies.get(
                        currentClientId
                    ) ||
                    DEFAULT_POLICY;

                const summary =
                    emptySummary();

                summary.total_days =
                    totalDays;

                const monthlyAttendance =
                    [];

                // =================================================
                // PROCESS EACH DAY
                // =================================================

                for (
                    let day = 1;
                    day <= totalDays;
                    day++
                ) {
                    const date =
                        formatDate(
                            year,
                            month,
                            day
                        );

                    // ---------------------------------------------
                    // Don't process future days.
                    // ---------------------------------------------

                    if (
                        date >
                        calculationLastDate
                    ) {
                        continue;
                    }

                    // ---------------------------------------------
                    // Deployment active?
                    // ---------------------------------------------

                    if (
                        !isDeploymentActiveOnDate(
                            deployment,
                            date
                        )
                    ) {
                        continue;
                    }

                    // ---------------------------------------------
                    // ROSTER
                    // ---------------------------------------------

                    const roster =
                        findRosterForDate(
                            rosters,
                            employeeId,
                            deploymentId,
                            date
                        );

                    const workingDay =
                        isWorkingDay(
                            date,
                            roster
                        );

                    // ---------------------------------------------
                    // HOLIDAY
                    // ---------------------------------------------

                    const holidayKey =
                        `${currentClientId}|${date}`;

                    const holiday =
                        holidayMap.get(
                            holidayKey
                        );

                    // ---------------------------------------------
                    // LEAVE
                    // ---------------------------------------------

                    const leave =
                        getApprovedLeaveForDate(
                            approvedLeaves,
                            employeeId,
                            currentClientId,
                            deploymentId,
                            date
                        );

                    // ---------------------------------------------
                    // ACTUAL ATTENDANCE
                    // ---------------------------------------------

                    const attendanceKey =
                        `${employeeId}|${deploymentId}|${date}`;

                    const attendance =
                        attendanceMap.get(
                            attendanceKey
                        );

                    let status = null;

                    // =================================================
                    // PRIORITY
                    //
                    // 1. Actual attendance
                    // 2. Approved leave
                    // 3. Holiday
                    // 4. Weekly off
                    // 5. Missing working day = Absent
                    // =================================================

                    if (
                        attendance
                    ) {
                        const normalized =
                            normalizeStatus(
                                attendance.status
                            );

                        // Holiday worked
                        if (
                            holiday &&
                            (
                                attendance.check_in ||
                                attendance.check_out ||
                                Number(
                                    attendance.working_hours ||
                                        0
                                ) > 0
                            )
                        ) {
                            status =
                                "Holiday Worked";
                        }

                        // Weekly off worked
                        else if (
                            !workingDay &&
                            (
                                attendance.check_in ||
                                attendance.check_out ||
                                Number(
                                    attendance.working_hours ||
                                        0
                                ) > 0
                            )
                        ) {
                            status =
                                "Weekly Off Worked";
                        }

                        // Explicit leave
                        else if (
                            normalized ===
                                "leave" ||
                            normalized ===
                                "on_leave"
                        ) {
                            status =
                                "Leave";
                        }

                        // Otherwise calculate normal status
                        else {
                            status =
                                determinePunchStatus(
                                    attendance,
                                    policy
                                );
                        }
                    }

                    // =================================================
                    // NO ATTENDANCE RECORD
                    // =================================================

                    else if (
                        leave
                    ) {
                        status =
                            "Leave";
                    }

                    else if (
                        holiday
                    ) {
                        status =
                            "Holiday";
                    }

                    else if (
                        !workingDay
                    ) {
                        status =
                            "Weekly Off";
                    }

                    else {
                        // ---------------------------------------------
                        // THIS IS THE IMPORTANT FIX.
                        //
                        // Employee is deployed.
                        // It is a working day.
                        // No attendance record exists.
                        //
                        // Therefore:
                        // ABSENT / LOP
                        // ---------------------------------------------

                        status =
                            "Absent";
                    }

                    // =================================================
                    // SUMMARY
                    // =================================================

                    addStatusToSummary(
                        summary,
                        status
                    );

                    if (
                        attendance
                    ) {
                        summary.total_recorded_days +=
                            1;

                        summary.overtime_hours +=
                            Number(
                                attendance.overtime_hours ||
                                    0
                            );
                    }

                    // =================================================
                    // DAILY RESPONSE
                    // =================================================

                    monthlyAttendance.push({
                        id:
                            attendance?.id ||
                            null,

                        employee_id:
                            employeeId,

                        deployment_id:
                            deploymentId,

                        client_id:
                            currentClientId,

                        attendance_date:
                            date,

                        check_in:
                            attendance?.check_in ||
                            null,

                        check_out:
                            attendance?.check_out ||
                            null,

                        working_hours:
                            Number(
                                attendance?.working_hours ||
                                    (
                                        attendance?.check_in &&
                                        attendance?.check_out
                                            ? calculateWorkingHours(
                                                  attendance.check_in,
                                                  attendance.check_out
                                              )
                                            : 0
                                    )
                            ),

                        overtime_hours:
                            Number(
                                attendance?.overtime_hours ||
                                    0
                            ),

                        status,

                        work_mode:
                            attendance?.work_mode ||
                            null,

                        remarks:
                            attendance?.remarks ||
                            (
                                status ===
                                "Absent"
                                    ? "No attendance marked"
                                    : null
                            ),

                        is_missing_punch:
                            Boolean(
                                attendance &&
                                attendance.check_in &&
                                !attendance.check_out
                            ),

                        source:
                            attendance
                                ? "attendance"
                                : status ===
                                  "Absent"
                                ? "system_missing_attendance"
                                : status ===
                                  "Leave"
                                ? "approved_leave"
                                : status ===
                                  "Holiday"
                                ? "holiday_calendar"
                                : "employee_roster",
                    });
                }

                // =================================================
                // ROUND SUMMARY
                // =================================================

                summary.overtime_hours =
                    Number(
                        summary.overtime_hours.toFixed(
                            2
                        )
                    );

                summary.payable_days =
                    Number(
                        summary.payable_days.toFixed(
                            2
                        )
                    );

                // =================================================
                // FORMAT EMPLOYEE ROW
                // =================================================

                formattedData.push({
                    // ---------------------------------------------
                    // IDS
                    // ---------------------------------------------

                    id:
                        employeeId,

                    employee_id:
                        employeeId,

                    deployment_id:
                        deploymentId,

                    client_id:
                        currentClientId,

                    // ---------------------------------------------
                    // EMPLOYEE
                    // ---------------------------------------------

                    employee_name:
                        candidate?.full_name ||
                        `Employee ${employeeId}`,

                    full_name:
                        candidate?.full_name ||
                        `Employee ${employeeId}`,

                    role:
                        candidate?.designation ||
                        "N/A",

                    email:
                        candidate?.email ||
                        null,

                    // ---------------------------------------------
                    // CLIENT
                    // ---------------------------------------------

                    client:
                        client?.company_name ||
                        "Unknown Client",

                    client_name:
                        client?.company_name ||
                        "Unknown Client",

                    // ---------------------------------------------
                    // DEPLOYMENT
                    // ---------------------------------------------

                    project_name:
                        deployment.project_name ||
                        null,

                    billing_model:
                        deployment.billing_model ||
                        null,

                    pay_rate:
                        deployment.pay_rate ||
                        null,

                    bill_rate:
                        deployment.bill_rate ||
                        null,

                    // ---------------------------------------------
                    // MONTH
                    // ---------------------------------------------

                    billing_month:
                        selectedMonth,

                    // ---------------------------------------------
                    // SUMMARY
                    // ---------------------------------------------

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

                    holiday_days:
                        summary.holiday_days,

                    weekly_off_days:
                        summary.weekly_off_days,

                    holiday_worked_days:
                        summary.holiday_worked_days,

                    weekly_off_worked_days:
                        summary.weekly_off_worked_days,

                    lop_days:
                        summary.lop_days,

                    payable_days:
                        summary.payable_days,

                    overtime_hours:
                        summary.overtime_hours,

                    total_recorded_days:
                        summary.total_recorded_days,

                    // ---------------------------------------------
                    // DAILY
                    // ---------------------------------------------

                    attendance:
                        monthlyAttendance,
                });
            }

            // =====================================================
            // ADMIN KPI
            // =====================================================

            const totalPresent =
                formattedData.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.present_days ||
                                0
                        ),
                    0
                );

            const totalAbsent =
                formattedData.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.absent_days ||
                                0
                        ),
                    0
                );

            const totalLeave =
                formattedData.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.leave_days ||
                                0
                        ),
                    0
                );

            const totalOvertime =
                formattedData.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.overtime_hours ||
                                0
                        ),
                    0
                );

            const totalHoliday =
                formattedData.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.holiday_days ||
                                0
                        ),
                    0
                );

            const totalWeeklyOff =
                formattedData.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        Number(
                            item.weekly_off_days ||
                                0
                        ),
                    0
                );

            // =====================================================
            // RESPONSE
            // =====================================================

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
                                (
                                    item
                                ) =>
                                    item.client_id
                            )
                        ).size,

                    total_present_days:
                        totalPresent,

                    total_absent_days:
                        totalAbsent,

                    total_leave_days:
                        totalLeave,

                    total_holiday_days:
                        totalHoliday,

                    total_weekly_off_days:
                        totalWeeklyOff,

                    total_overtime_hours:
                        Number(
                            totalOvertime.toFixed(
                                2
                            )
                        ),
                },
            });
        } catch (error) {
            console.error(
                "GET /api/third-party-attendance ERROR:",
                error
            );

            return sendError(
                res,
                500,
                "Failed to fetch attendance.",
                error.message
            );
        }
    }
);


// ============================================================
// ADMIN ATTENDANCE IS READ ONLY
//
// NO POST
// NO PATCH
// NO DELETE
// NO NORMAL ATTENDANCE APPROVAL
// ============================================================

module.exports = router;

