import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    CalendarDays,
    Calendar,
    RefreshCw,
    Search,
    Users,
    UserCheck,
    UserX,
    Coffee,
    Timer,
    ChevronDown,
    AlertTriangle,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";
import api from "../../../services/api";
import { useAuth } from "../../../../auth/AuthProvider";

// ============================================================
// HELPERS
// ============================================================

const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";

    const value = String(dateString).slice(0, 10);

    const [year, month, day] =
        value.split("-");

    if (!year || !month || !day) {
        return dateString;
    }

    return `${day}/${month}/${year}`;
};

const formatDateLong = (dateString) => {
    if (!dateString) return "";

    const value =
        String(dateString).slice(0, 10);

    const date =
        new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
        }
    );
};

const getToday = () => {
    const date = new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getCurrentBillingMonth = () => {
    return getToday().slice(0, 7);
};

const normalizeStatus = (status) => {
    return String(status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
};

// ============================================================
// EMPLOYEE NAME
// ============================================================

const getEmployeeName = (employee) => {
    return (
        employee?.employee_name ||
        employee?.candidate_name ||
        employee?.full_name ||
        employee?.name ||
        employee?.employee?.full_name ||
        employee?.employee?.name ||
        employee?.candidate?.full_name ||
        employee?.candidate?.name ||
        employee?.candidates?.full_name ||
        employee?.candidates?.name ||
        "Unknown Employee"
    );
};

// ============================================================
// EMPLOYEE ID
//
// IMPORTANT:
// Attendance table uses candidates_id.
// ============================================================

const getEmployeeId = (employee) => {
    return (
        employee?.candidates_id ??
        employee?.candidate_id ??
        employee?.employee_id ??
        employee?.employee?.id ??
        employee?.candidate?.id ??
        employee?.id ??
        ""
    );
};

// ============================================================
// OVERTIME
// ============================================================

const getOvertime = (record) => {
    const value =
        Number(
            record?.overtime_hours ??
            record?.overtime ??
            record?.ot_hours ??
            0
        );

    return Number.isFinite(value)
        ? value
        : 0;
};

// ============================================================
// WORKING HOURS
// ============================================================

const getWorkingHours = (record) => {
    const value =
        Number(
            record?.working_hours ??
            record?.hours_worked ??
            0
        );

    return Number.isFinite(value)
        ? value
        : 0;
};

// ============================================================
// STATUS
// ============================================================

const getStatus = (record) => {
    return normalizeStatus(
        record?.status
    );
};

// ============================================================
// MISSING PUNCH
// ============================================================

const isMissingPunch = (record) => {

    if (
        record?.is_missing_punch === true
    ) {
        return true;
    }

    const status =
        normalizeStatus(
            record?.status
        );

    if (
        status === "missing_punch" ||
        status === "incomplete_logs" ||
        status === "incomplete"
    ) {
        return true;
    }

    /*
     * If employee checked in but has no
     * checkout, it is an incomplete punch.
     */
    if (
        record?.check_in &&
        !record?.check_out
    ) {
        return true;
    }

    return false;
};

// ============================================================
// MONTH DISPLAY
// ============================================================

const formatBillingMonth = (
    billingMonth
) => {
    if (!billingMonth) return "";

    const [
        year,
        month,
    ] =
        String(
            billingMonth
        ).split("-");

    if (!year || !month) {
        return billingMonth;
    }

    const date =
        new Date(
            Number(year),
            Number(month) - 1,
            1
        );

    return date.toLocaleDateString(
        "en-IN",
        {
            month: "long",
            year: "numeric",
        }
    );
};

// ============================================================
// TIME DISPLAY
// ============================================================

const formatTime = (value) => {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        !Number.isNaN(
            date.getTime()
        )
    ) {
        return date.toLocaleTimeString(
            "en-IN",
            {
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    }

    return String(value);
};

// ============================================================
// COMPONENT
// ============================================================

const ClientAttendance = () => {

    // ========================================================
    // AUTH
    // ========================================================

    const {
        session,
        user,
        loading: authLoading,
        logout,
    } = useAuth();

    // ========================================================
    // STATE
    // ========================================================

    const [
        billingMonth,
        setBillingMonth,
    ] = useState(
        getCurrentBillingMonth()
    );

    const [
        attendanceDate,
        setAttendanceDate,
    ] = useState(
        getToday()
    );

    const [
        searchEmployee,
        setSearchEmployee,
    ] = useState("");

    const [
        statusFilter,
        setStatusFilter,
    ] = useState("all");

    const [
        activeTab,
        setActiveTab,
    ] = useState("daily");

    // ========================================================
    // ALL ATTENDANCE DATA
    // ========================================================

    const [
        allAttendance,
        setAllAttendance,
    ] = useState([]);

    // ========================================================
    // ALL CLIENT EMPLOYEES
    //
    // This is required to display employees who have
    // no attendance row for the selected date.
    // ========================================================

    const [
        clientEmployees,
        setClientEmployees,
    ] = useState([]);

    const [
        allMonths,
        setAllMonths,
    ] = useState([]);

    // ========================================================
    // LOADING / ERROR
    // ========================================================

    const [
        loading,
        setLoading,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState("");

    const [
        refreshing,
        setRefreshing,
    ] = useState(false);

    // ========================================================
    // CLIENT ID
    // ========================================================

    const clientId = useMemo(() => {

        const numericId =
            Number(
                user?.client_id
            );

        if (
            Number.isFinite(
                numericId
            ) &&
            numericId > 0
        ) {
            return numericId;
        }

        return null;

    }, [user]);

    // ========================================================
    // CLIENT NAME
    // ========================================================

    const clientName = useMemo(() => {

        return (
            user?.company_name ||
            user?.companyName ||
            user?.company ||
            user?.name ||
            ""
        );

    }, [user]);

    // ========================================================
    // AUTH DEBUG
    // ========================================================

    useEffect(() => {

        console.log(
            "CLIENT ATTENDANCE AUTH:",
            {
                authLoading,
                hasSession:
                    !!session,
                user,
                clientId,
                role:
                    user?.role,
                status:
                    user?.status,
            }
        );

    }, [
        authLoading,
        session,
        user,
        clientId,
    ]);

    // ========================================================
    // LOGOUT
    // ========================================================

    const handleLogout =
        async () => {

            try {

                await logout();

                window.location.href =
                    "/login";

            } catch (
                logoutError
            ) {

                console.error(
                    "Client attendance logout error:",
                    logoutError
                );

                window.location.href =
                    "/login";
            }
        };

    // ========================================================
    // FETCH CLIENT EMPLOYEES
    //
    // GET /api/attendance/employees?client_id=1
    //
    // This allows the UI to show:
    //
    // Employee has attendance row
    //       -> use actual attendance
    //
    // Employee has NO attendance row
    //       -> show Absent
    // ========================================================

    const fetchClientEmployees =
        useCallback(
            async () => {

                if (
                    authLoading ||
                    !session ||
                    !user ||
                    !clientId
                ) {
                    return;
                }

                try {

                    console.log(
                        "FETCH CLIENT EMPLOYEES:",
                        {
                            client_id:
                                clientId,
                        }
                    );

                    const response =
                        await api.get(
                            "/attendance/employees",
                            {
                                params: {
                                    client_id:
                                        clientId,
                                },
                            }
                        );

                    const result =
                        response?.data ||
                        {};

                    console.log(
                        "CLIENT EMPLOYEES RESPONSE:",
                        result
                    );

                    if (
                        result.success ===
                        false
                    ) {
                        throw new Error(
                            result.error ||
                            result.message ||
                            "Failed to load employees."
                        );
                    }

                    const employees =
                        Array.isArray(
                            result.data
                        )
                            ? result.data
                            : Array.isArray(
                                result.employees
                            )
                                ? result.employees
                                : [];

                    setClientEmployees(
                        employees
                    );

                } catch (
                    employeeError
                ) {

                    console.error(
                        "Fetch client employees error:",
                        employeeError
                    );

                    /*
                     * Do not destroy attendance data
                     * if employee lookup fails.
                     */
                }

            },
            [
                authLoading,
                session,
                user,
                clientId,
            ]
        );

    // ========================================================
    // FETCH ALL ATTENDANCE
    //
    // GET /api/attendance/all?client_id=1
    // ========================================================

    const fetchAllAttendance =
        useCallback(
            async (
                showLoader = true
            ) => {

                if (
                    authLoading ||
                    !session ||
                    !user
                ) {
                    return;
                }

                if (!clientId) {

                    setError(
                        "Client ID not found for the logged-in user."
                    );

                    setAllAttendance([]);
                    setAllMonths([]);

                    return;
                }

                try {

                    if (
                        showLoader
                    ) {
                        setLoading(
                            true
                        );
                    }

                    setError("");

                    console.log(
                        "FETCH ALL ATTENDANCE:",
                        {
                            client_id:
                                clientId,
                        }
                    );

                    const response =
                        await api.get(
                            "/attendance/all",
                            {
                                params: {
                                    client_id:
                                        clientId,
                                },
                            }
                        );

                    const result =
                        response?.data ||
                        {};

                    console.log(
                        "ALL ATTENDANCE RESPONSE:",
                        result
                    );

                    if (
                        result.success !==
                        true
                    ) {

                        throw new Error(
                            result.error ||
                            result.message ||
                            "Failed to load attendance."
                        );
                    }

                    const records =
                        Array.isArray(
                            result.data
                        )
                            ? result.data
                            : [];

                    const months =
                        Array.isArray(
                            result.months
                        )
                            ? result.months
                            : [];

                    setAllAttendance(
                        records
                    );

                    setAllMonths(
                        months
                    );

                    // ==================================================
                    // AVAILABLE MONTHS
                    // ==================================================

                    if (
                        months.length >
                        0
                    ) {

                        const available =
                            months
                                .map(
                                    (
                                        month
                                    ) =>
                                        month?.billing_month
                                )
                                .filter(
                                    Boolean
                                )
                                .sort();

                        if (
                            available.length >
                            0
                        ) {

                            const latestMonth =
                                available[
                                    available.length -
                                    1
                                ];

                            if (
                                !available.includes(
                                    billingMonth
                                )
                            ) {

                                setBillingMonth(
                                    latestMonth
                                );
                            }
                        }
                    }

                } catch (
                    attendanceError
                ) {

                    console.error(
                        "Fetch all attendance error:",
                        attendanceError
                    );

                    if (
                        attendanceError
                            ?.response
                            ?.status ===
                        401
                    ) {

                        setError(
                            "Your session has expired. Please login again."
                        );

                    } else if (
                        attendanceError
                            ?.response
                            ?.status ===
                        403
                    ) {

                        setError(
                            "You do not have permission to view this attendance."
                        );

                    } else {

                        setError(
                            attendanceError
                                ?.response
                                ?.data
                                ?.error ||
                            attendanceError
                                ?.response
                                ?.data
                                ?.message ||
                            attendanceError?.message ||
                            "Failed to load attendance history."
                        );
                    }

                    setAllAttendance([]);
                    setAllMonths([]);

                } finally {

                    if (
                        showLoader
                    ) {
                        setLoading(
                            false
                        );
                    }
                }

            },
            [
                authLoading,
                session,
                user,
                clientId,
                billingMonth,
            ]
        );

    // ========================================================
    // LOAD DATA AFTER AUTH
    // ========================================================

    useEffect(() => {

        if (
            authLoading ||
            !session ||
            !user ||
            !clientId ||
            user?.role !== "client"
        ) {
            return;
        }

        fetchAllAttendance(
            true
        );

        fetchClientEmployees();

    }, [
        authLoading,
        session,
        user,
        clientId,
        fetchAllAttendance,
        fetchClientEmployees,
    ]);

    // ========================================================
    // REFRESH
    // ========================================================

    const handleRefresh =
        async () => {

            try {

                setRefreshing(
                    true
                );

                await Promise.all([
                    fetchAllAttendance(
                        false
                    ),
                    fetchClientEmployees(),
                ]);

            } finally {

                setRefreshing(
                    false
                );
            }
        };

    // ========================================================
    // AVAILABLE MONTHS
    // ========================================================

    const availableMonths =
        useMemo(() => {

            return allMonths
                .map(
                    (month) =>
                        month?.billing_month
                )
                .filter(Boolean)
                .sort();

        }, [allMonths]);

    // ========================================================
    // DAILY ATTENDANCE
    //
    // IMPORTANT:
    //
    // We start with ALL CLIENT EMPLOYEES.
    //
    // If an employee has a matching attendance row,
    // use that attendance row.
    //
    // If no row exists:
    // create an Absent record.
    // ========================================================

    const dailyAttendance =
        useMemo(() => {

            const selectedDate =
                String(
                    attendanceDate
                );

            // -------------------------------------------------
            // Actual attendance records for selected date
            // -------------------------------------------------

            const dateAttendance =
                allAttendance.filter(
                    (record) => {

                        const recordDate =
                            String(
                                record?.attendance_date ||
                                ""
                            ).slice(0, 10);

                        return (
                            recordDate ===
                            selectedDate
                        );
                    }
                );

            // -------------------------------------------------
            // Map actual attendance by candidate ID
            // -------------------------------------------------

            const attendanceMap =
                new Map();

            dateAttendance.forEach(
                (record) => {

                    const employeeId =
                        String(
                            getEmployeeId(
                                record
                            )
                        );

                    if (
                        employeeId &&
                        employeeId !==
                            "undefined"
                    ) {

                        attendanceMap.set(
                            employeeId,
                            record
                        );
                    }
                }
            );

            // -------------------------------------------------
            // Start with employees
            // -------------------------------------------------

            const result = [];

            clientEmployees.forEach(
                (employee) => {

                    const employeeId =
                        String(
                            getEmployeeId(
                                employee
                            )
                        );

                    if (
                        !employeeId ||
                        employeeId ===
                            "undefined"
                    ) {
                        return;
                    }

                    const actualRecord =
                        attendanceMap.get(
                            employeeId
                        );

                    // -----------------------------------------
                    // Actual attendance exists
                    // -----------------------------------------

                    if (
                        actualRecord
                    ) {

                        result.push(
                            actualRecord
                        );

                        return;
                    }

                    // -----------------------------------------
                    // NO ATTENDANCE RECORD
                    //
                    // Create virtual ABSENT record.
                    // -----------------------------------------

                    result.push({
                        id:
                            `absent-${employeeId}-${selectedDate}`,

                        candidates_id:
                            getEmployeeId(
                                employee
                            ),

                        candidate_id:
                            getEmployeeId(
                                employee
                            ),

                        employee_id:
                            getEmployeeId(
                                employee
                            ),

                        employee_name:
                            getEmployeeName(
                                employee
                            ),

                        full_name:
                            getEmployeeName(
                                employee
                            ),

                        employee_email:
                            employee?.employee_email ||
                            employee?.email ||
                            null,

                        employee_phone:
                            employee?.employee_phone ||
                            employee?.phone ||
                            employee?.mobile ||
                            null,

                        designation:
                            employee?.designation ||
                            null,

                        attendance_date:
                            selectedDate,

                        check_in:
                            null,

                        check_out:
                            null,

                        working_hours:
                            0,

                        overtime_hours:
                            0,

                        status:
                            "Absent",

                        work_mode:
                            employee?.work_mode ||
                            "WFO",

                        is_virtual_absent:
                            true,
                    });
                }
            );

            // -------------------------------------------------
            // Safety:
            //
            // If backend returned attendance for an employee
            // that is not currently returned by /employees,
            // don't hide that attendance.
            // -------------------------------------------------

            dateAttendance.forEach(
                (record) => {

                    const employeeId =
                        String(
                            getEmployeeId(
                                record
                            )
                        );

                    const alreadyExists =
                        result.some(
                            (item) =>
                                String(
                                    getEmployeeId(
                                        item
                                    )
                                ) ===
                                employeeId
                        );

                    if (
                        !alreadyExists
                    ) {

                        result.push(
                            record
                        );
                    }
                }
            );

            return result;

        }, [
            allAttendance,
            clientEmployees,
            attendanceDate,
        ]);

    // ========================================================
    // FILTERED DAILY ATTENDANCE
    // ========================================================

    const filteredDailyAttendance =
        useMemo(() => {

            const search =
                searchEmployee
                    .trim()
                    .toLowerCase();

            return dailyAttendance.filter(
                (record) => {

                    const employeeName =
                        getEmployeeName(
                            record
                        ).toLowerCase();

                    const employeeId =
                        String(
                            getEmployeeId(
                                record
                            )
                        ).toLowerCase();

                    const matchesSearch =
                        !search ||
                        employeeName.includes(
                            search
                        ) ||
                        employeeId.includes(
                            search
                        );

                    const status =
                        getStatus(
                            record
                        );

                    const missingPunch =
                        isMissingPunch(
                            record
                        );

                    let matchesStatus =
                        true;

                    if (
                        statusFilter ===
                        "missing_punch"
                    ) {

                        matchesStatus =
                            missingPunch;

                    } else {

                        matchesStatus =
                            statusFilter ===
                                "all" ||
                            status ===
                                statusFilter;
                    }

                    return (
                        matchesSearch &&
                        matchesStatus
                    );
                }
            );

        }, [
            dailyAttendance,
            searchEmployee,
            statusFilter,
        ]);

    // ========================================================
    // MONTHLY RAW ATTENDANCE
    // ========================================================

    const selectedMonthAttendance =
        useMemo(() => {

            return allAttendance.filter(
                (record) => {

                    const date =
                        String(
                            record?.attendance_date ||
                            ""
                        ).slice(0, 10);

                    return (
                        date.slice(0, 7) ===
                        billingMonth
                    );
                }
            );

        }, [
            allAttendance,
            billingMonth,
        ]);

    // ========================================================
    // MONTHLY EMPLOYEE SUMMARY
    // ========================================================

    const monthlyAttendance =
        useMemo(() => {

            const employeeMap =
                new Map();

            for (
                const record of
                    selectedMonthAttendance
            ) {

                const employeeId =
                    String(
                        getEmployeeId(
                            record
                        )
                    );

                if (
                    !employeeId ||
                    employeeId ===
                        "undefined"
                ) {
                    continue;
                }

                if (
                    !employeeMap.has(
                        employeeId
                    )
                ) {

                    employeeMap.set(
                        employeeId,
                        {
                            employee_id:
                                getEmployeeId(
                                    record
                                ),

                            candidates_id:
                                getEmployeeId(
                                    record
                                ),

                            employee_name:
                                getEmployeeName(
                                    record
                                ),

                            full_name:
                                getEmployeeName(
                                    record
                                ),

                            employee_email:
                                record?.employee_email ??
                                null,

                            employee_phone:
                                record?.employee_phone ??
                                null,

                            designation:
                                record?.designation ??
                                null,

                            present_days: 0,

                            absent_days: 0,

                            leave_days: 0,

                            half_days: 0,

                            working_days: 0,

                            lop_days: 0,

                            overtime_hours: 0,

                            total_records: 0,

                            total_working_hours: 0,
                        }
                    );
                }

                const employee =
                    employeeMap.get(
                        employeeId
                    );

                const status =
                    getStatus(
                        record
                    );

                // ---------------------------------------------
                // EVERY DAILY RECORD COUNTS
                // ---------------------------------------------

                employee.total_records++;

                // ---------------------------------------------
                // PRESENT
                // ---------------------------------------------

                if (
                    status ===
                    "present"
                ) {

                    employee.present_days++;
                }

                // ---------------------------------------------
                // ABSENT
                // ---------------------------------------------

                if (
                    status ===
                    "absent"
                ) {

                    employee.absent_days++;

                    /*
                     * Absent is also treated as LOP
                     * for payroll calculation.
                     */
                    employee.lop_days++;
                }

                // ---------------------------------------------
                // LOP
                // ---------------------------------------------

                if (
                    status ===
                    "lop"
                ) {

                    employee.lop_days++;
                }

                // ---------------------------------------------
                // LEAVE
                // ---------------------------------------------

                if (
                    status ===
                        "leave" ||
                    status ===
                        "on_leave" ||
                    status ===
                        "approved_leave"
                ) {

                    employee.leave_days++;
                }

                // ---------------------------------------------
                // HALF DAY
                // ---------------------------------------------

                if (
                    status ===
                        "half_day" ||
                    status ===
                        "halfday"
                ) {

                    employee.half_days++;
                }

                // ---------------------------------------------
                // WORKING DAYS
                // ---------------------------------------------

                if (
                    status ===
                    "present"
                ) {

                    employee.working_days++;
                }

                if (
                    status ===
                        "half_day" ||
                    status ===
                        "halfday"
                ) {

                    employee.working_days +=
                        0.5;
                }

                // ---------------------------------------------
                // OVERTIME
                // ---------------------------------------------

                employee.overtime_hours +=
                    getOvertime(
                        record
                    );

                // ---------------------------------------------
                // WORKING HOURS
                // ---------------------------------------------

                employee.total_working_hours +=
                    getWorkingHours(
                        record
                    );
            }

            return Array.from(
                employeeMap.values()
            ).map(
                (employee) => ({
                    ...employee,

                    overtime_hours:
                        Math.round(
                            employee.overtime_hours *
                                100
                        ) / 100,

                    total_working_hours:
                        Math.round(
                            employee.total_working_hours *
                                100
                        ) / 100,
                })
            );

        }, [
            selectedMonthAttendance,
        ]);

    // ========================================================
    // FILTERED MONTHLY ATTENDANCE
    // ========================================================

    const filteredMonthlyAttendance =
        useMemo(() => {

            const search =
                searchEmployee
                    .trim()
                    .toLowerCase();

            return monthlyAttendance.filter(
                (record) => {

                    const employeeName =
                        getEmployeeName(
                            record
                        ).toLowerCase();

                    const employeeId =
                        String(
                            getEmployeeId(
                                record
                            )
                        ).toLowerCase();

                    return (
                        !search ||
                        employeeName.includes(
                            search
                        ) ||
                        employeeId.includes(
                            search
                        )
                    );
                }
            );

        }, [
            monthlyAttendance,
            searchEmployee,
        ]);

    // ========================================================
    // DAILY SUMMARY
    // ========================================================

    const dailyStats =
        useMemo(() => {

            let present = 0;
            let absent = 0;
            let leave = 0;
            let overtime = 0;

            dailyAttendance.forEach(
                (record) => {

                    const status =
                        getStatus(
                            record
                        );

                    if (
                        status ===
                        "present"
                    ) {
                        present++;
                    }

                    if (
                        status ===
                        "absent"
                    ) {
                        absent++;
                    }

                    if (
                        status ===
                            "leave" ||
                        status ===
                            "on_leave" ||
                        status ===
                            "approved_leave"
                    ) {
                        leave++;
                    }

                    overtime +=
                        getOvertime(
                            record
                        );
                }
            );

            return {

                employees:
                    dailyAttendance.length,

                present,

                absent,

                leave,

                overtime:
                    Math.round(
                        overtime * 100
                    ) / 100,
            };

        }, [
            dailyAttendance,
        ]);

    // ========================================================
    // MONTHLY SUMMARY
    // ========================================================

    const monthlyStats =
        useMemo(() => {

            let present = 0;
            let absent = 0;
            let leave = 0;
            let overtime = 0;

            monthlyAttendance.forEach(
                (record) => {

                    present +=
                        Number(
                            record?.present_days ||
                            0
                        );

                    absent +=
                        Number(
                            record?.absent_days ||
                            0
                        );

                    leave +=
                        Number(
                            record?.leave_days ||
                            0
                        );

                    overtime +=
                        Number(
                            record?.overtime_hours ||
                            0
                        );
                }
            );

            return {

                employees:
                    monthlyAttendance.length,

                present,

                absent,

                leave,

                overtime:
                    Math.round(
                        overtime * 100
                    ) / 100,
            };

        }, [
            monthlyAttendance,
        ]);

    // ========================================================
    // DISPLAY STATS
    // ========================================================

    const stats =
        activeTab === "daily"
            ? dailyStats
            : monthlyStats;

    // ========================================================
    // STATUS BADGE
    // ========================================================

    const getStatusBadge = (
        record
    ) => {

        const normalized =
            normalizeStatus(
                record?.status
            );

        // ----------------------------------------------------
        // MISSING PUNCH HAS PRIORITY
        // ----------------------------------------------------

        if (
            isMissingPunch(
                record
            )
        ) {

            return (
                <div className="flex flex-col gap-1">

                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">

                        <AlertTriangle
                            size={13}
                        />

                        Missing Punch

                    </span>

                </div>
            );
        }

        let className =
            "bg-slate-100 text-slate-600";

        let label =
            record?.status ||
            "Unknown";

        if (
            normalized ===
            "present"
        ) {

            className =
                "bg-emerald-50 text-emerald-700";

            label =
                "Present";

        } else if (
            normalized ===
                "absent"
        ) {

            className =
                "bg-red-50 text-red-600";

            label =
                "Absent";

        } else if (
            normalized ===
                "leave" ||
            normalized ===
                "on_leave" ||
            normalized ===
                "approved_leave"
        ) {

            className =
                "bg-blue-50 text-blue-600";

            label =
                "Leave";

        } else if (
            normalized ===
                "half_day" ||
            normalized ===
                "halfday"
        ) {

            className =
                "bg-amber-50 text-amber-700";

            label =
                "Half Day";

        } else if (
            normalized ===
            "lop"
        ) {

            className =
                "bg-red-50 text-red-600";

            label =
                "LOP";

        } else if (
            normalized ===
            "weekly_off"
        ) {

            className =
                "bg-slate-100 text-slate-600";

            label =
                "Weekly Off";

        } else if (
            normalized ===
            "holiday"
        ) {

            className =
                "bg-purple-50 text-purple-700";

            label =
                "Holiday";

        } else if (
            normalized ===
            "holiday_worked"
        ) {

            className =
                "bg-indigo-50 text-indigo-700";

            label =
                "Holiday Worked";

        } else if (
            normalized ===
            "weekly_off_worked"
        ) {

            className =
                "bg-indigo-50 text-indigo-700";

            label =
                "Weekly Off Worked";

        } else if (
            normalized ===
            "in_progress"
        ) {

            className =
                "bg-yellow-50 text-yellow-700";

            label =
                "In Progress";
        }

        return (
            <span
                className={
                    `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`
                }
            >
                {label}
            </span>
        );
    };

    // ========================================================
    // AUTH LOADING
    // ========================================================

    if (authLoading) {

        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">

                <div className="flex flex-col items-center gap-3">

                    <RefreshCw
                        size={26}
                        className="animate-spin text-indigo-600"
                    />

                    <p className="text-sm text-slate-500">
                        Loading attendance...
                    </p>

                </div>

            </div>
        );
    }

    // ========================================================
    // INVALID SESSION
    // ========================================================

    if (
        !session ||
        !user
    ) {

        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">

                <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">

                    <h2 className="text-lg font-bold text-slate-900">
                        Session not found
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Please login again to view attendance.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            (window.location.href =
                                "/login")
                        }
                        className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                        Login Again
                    </button>

                </div>

            </div>
        );
    }

    // ========================================================
    // MAIN UI
    // ========================================================

    return (
        <div className="min-h-screen bg-slate-50">

            {/* ==================================================
                SIDEBAR
            ================================================== */}

            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                clientName={clientName}
                onLogout={handleLogout}
            />

            {/* ==================================================
                MAIN CONTENT
            ================================================== */}

            <main className="min-h-screen pl-64">

                <div className="mx-auto max-w-[1280px] px-6 py-6">

                    {/* ==================================================
                        HEADER
                    ================================================== */}

                    <div className="mb-6 flex items-start justify-between">

                        <div>

                            <div className="flex items-center gap-3">

                                <CalendarDays
                                    size={25}
                                    strokeWidth={2}
                                    className="text-indigo-600"
                                />

                                <h1 className="text-[30px] font-bold leading-none text-slate-900">
                                    Attendance
                                </h1>

                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                View employee daily and monthly attendance.
                            </p>

                        </div>

                        <button
                            type="button"
                            onClick={
                                handleRefresh
                            }
                            disabled={
                                refreshing ||
                                loading
                            }
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >

                            <RefreshCw
                                size={16}
                                className={
                                    refreshing
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            Refresh

                        </button>

                    </div>

                    {/* ==================================================
                        FILTERS
                    ================================================== */}

                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                            {/* Billing Month */}

                            <div>

                                <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Billing Month
                                </label>

                                <div className="relative">

                                    <Calendar
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />

                                    <select
                                        value={
                                            billingMonth
                                        }
                                        onChange={(e) =>
                                            setBillingMonth(
                                                e.target.value
                                            )
                                        }
                                        className="h-[43px] w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    >

                                        {availableMonths.length >
                                        0 ? (

                                            availableMonths.map(
                                                (
                                                    month
                                                ) => (
                                                    <option
                                                        key={
                                                            month
                                                        }
                                                        value={
                                                            month
                                                        }
                                                    >
                                                        {formatBillingMonth(
                                                            month
                                                        )}
                                                    </option>
                                                )
                                            )

                                        ) : (

                                            <option
                                                value={
                                                    billingMonth
                                                }
                                            >
                                                {formatBillingMonth(
                                                    billingMonth
                                                )}
                                            </option>
                                        )}

                                    </select>

                                    <ChevronDown
                                        size={16}
                                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                                    />

                                </div>

                            </div>

                            {/* Attendance Date */}

                            <div>

                                <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Attendance Date
                                </label>

                                <div className="relative">

                                    <Calendar
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />

                                    <input
                                        type="date"
                                        value={
                                            attendanceDate
                                        }
                                        onChange={(e) =>
                                            setAttendanceDate(
                                                e.target.value
                                            )
                                        }
                                        className="h-[43px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    />

                                </div>

                            </div>

                            {/* Search */}

                            <div>

                                <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Search Employee
                                </label>

                                <div className="relative">

                                    <Search
                                        size={17}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />

                                    <input
                                        type="text"
                                        value={
                                            searchEmployee
                                        }
                                        onChange={(e) =>
                                            setSearchEmployee(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Name or employee ID..."
                                        className="h-[43px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    />

                                </div>

                            </div>

                        </div>

                    </div>

                    {/* ==================================================
                        SUMMARY CARDS
                    ================================================== */}

                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">

                        {/* Employees */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Employees
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {stats.employees}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {activeTab ===
                                        "daily"
                                            ? "Employees today"
                                            : "Employees this month"}
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">

                                    <Users
                                        size={21}
                                        className="text-indigo-600"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* Present */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Present
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {stats.present}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {activeTab ===
                                        "daily"
                                            ? "Present today"
                                            : "Present days"}
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">

                                    <UserCheck
                                        size={21}
                                        className="text-emerald-600"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* Absent */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Absent
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {stats.absent}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {activeTab ===
                                        "daily"
                                            ? "Absent today"
                                            : "Absent days"}
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">

                                    <UserX
                                        size={21}
                                        className="text-red-600"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* Leave */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Leave
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {stats.leave}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        {activeTab ===
                                        "daily"
                                            ? "On leave"
                                            : "Leave days"}
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">

                                    <Coffee
                                        size={21}
                                        className="text-blue-600"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* Overtime */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Overtime
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {Number(
                                            stats.overtime
                                        ).toFixed(
                                            2
                                        )}{" "}
                                        hrs
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Total OT
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">

                                    <Timer
                                        size={21}
                                        className="text-indigo-600"
                                    />

                                </div>

                            </div>

                        </div>

                    </div>

                    {/* ==================================================
                        MAIN CARD
                    ================================================== */}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                        {/* Tabs */}

                        <div className="flex border-b border-slate-200">

                            <button
                                type="button"
                                onClick={() =>
                                    setActiveTab(
                                        "daily"
                                    )
                                }
                                className={`relative px-6 py-4 text-sm font-semibold transition ${
                                    activeTab ===
                                    "daily"
                                        ? "text-indigo-600"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >

                                Daily Attendance

                                {activeTab ===
                                    "daily" && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                                )}

                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setActiveTab(
                                        "monthly"
                                    )
                                }
                                className={`relative px-6 py-4 text-sm font-semibold transition ${
                                    activeTab ===
                                    "monthly"
                                        ? "text-indigo-600"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >

                                Monthly Attendance

                                {activeTab ===
                                    "monthly" && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                                )}

                            </button>

                        </div>

                        {/* ==================================================
                            ERROR
                        ================================================== */}

                        {error && (
                            <div className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {/* ==================================================
                            DAILY STATUS FILTER
                        ================================================== */}

                        {activeTab ===
                            "daily" && (
                            <div className="flex justify-end border-b border-slate-200 px-6 py-6">

                                <div className="relative">

                                    <select
                                        value={
                                            statusFilter
                                        }
                                        onChange={(e) =>
                                            setStatusFilter(
                                                e.target.value
                                            )
                                        }
                                        className="h-[42px] appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    >

                                        <option value="all">
                                            All Status
                                        </option>

                                        <option value="present">
                                            Present
                                        </option>

                                        <option value="absent">
                                            Absent
                                        </option>

                                        <option value="leave">
                                            Leave
                                        </option>

                                        <option value="half_day">
                                            Half Day
                                        </option>

                                        <option value="lop">
                                            LOP
                                        </option>

                                        <option value="missing_punch">
                                            Missing Punch
                                        </option>

                                        <option value="weekly_off">
                                            Weekly Off
                                        </option>

                                        <option value="holiday">
                                            Holiday
                                        </option>

                                        <option value="holiday_worked">
                                            Holiday Worked
                                        </option>

                                        <option value="weekly_off_worked">
                                            Weekly Off Worked
                                        </option>

                                    </select>

                                    <ChevronDown
                                        size={16}
                                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                                    />

                                </div>

                            </div>
                        )}

                        {/* ==================================================
                            CONTENT
                        ================================================== */}

                        {loading ? (

                            <div className="flex min-h-[360px] items-center justify-center">

                                <div className="flex flex-col items-center gap-3">

                                    <RefreshCw
                                        size={26}
                                        className="animate-spin text-indigo-600"
                                    />

                                    <p className="text-sm text-slate-500">
                                        Loading attendance...
                                    </p>

                                </div>

                            </div>

                        ) : activeTab ===
                            "daily" ? (

                            /* ==================================================
                               DAILY TABLE
                            ================================================== */

                            filteredDailyAttendance.length ===
                            0 ? (

                                <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">

                                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">

                                        <CalendarDays
                                            size={27}
                                            className="text-slate-400"
                                        />

                                    </div>

                                    <h3 className="text-base font-bold text-slate-900">
                                        No daily attendance
                                    </h3>

                                    <p className="mt-2 text-sm text-slate-500">

                                        {searchEmployee ||
                                        statusFilter !==
                                            "all"
                                            ? "No attendance records match your current filters."
                                            : `No attendance records were found for ${formatDateLong(
                                                attendanceDate
                                            )}.`}

                                    </p>

                                </div>

                            ) : (

                                <div className="overflow-x-auto">

                                    <table className="w-full min-w-[900px]">

                                        <thead>

                                            <tr className="border-b border-slate-200 bg-slate-50">

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Employee
                                                </th>

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Date
                                                </th>

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Check In
                                                </th>

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Check Out
                                                </th>

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Working Hours
                                                </th>

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Overtime
                                                </th>

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Status
                                                </th>

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Work Mode
                                                </th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {filteredDailyAttendance.map(
                                                (
                                                    record,
                                                    index
                                                ) => (

                                                    <tr
                                                        key={
                                                            record?.id ??
                                                            `${getEmployeeId(
                                                                record
                                                            )}-${record?.attendance_date}-${index}`
                                                        }
                                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                                                    >

                                                        <td className="px-6 py-4">

                                                            <div>

                                                                <p className="text-sm font-semibold text-slate-900">
                                                                    {getEmployeeName(
                                                                        record
                                                                    )}
                                                                </p>

                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    ID:{" "}
                                                                    {getEmployeeId(
                                                                        record
                                                                    ) ||
                                                                        "—"}
                                                                </p>

                                                            </div>

                                                        </td>

                                                        <td className="px-6 py-4 text-sm text-slate-600">

                                                            {formatDateForDisplay(
                                                                record?.attendance_date
                                                            )}

                                                        </td>

                                                        <td className="px-6 py-4 text-sm text-slate-600">

                                                            {formatTime(
                                                                record?.check_in
                                                            )}

                                                        </td>

                                                        <td className="px-6 py-4 text-sm text-slate-600">

                                                            {formatTime(
                                                                record?.check_out
                                                            )}

                                                        </td>

                                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">

                                                            {record?.working_hours ??
                                                                "—"}

                                                        </td>

                                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">

                                                            {getOvertime(
                                                                record
                                                            ).toFixed(
                                                                2
                                                            )}{" "}
                                                            hrs

                                                        </td>

                                                        <td className="px-6 py-4">

                                                            {getStatusBadge(
                                                                record
                                                            )}

                                                        </td>

                                                        <td className="px-6 py-4 text-sm capitalize text-slate-600">

                                                            {String(
                                                                record?.work_mode ||
                                                                "—"
                                                            ).replace(
                                                                /_/g,
                                                                " "
                                                            )}

                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            )

                        ) : (

                            /* ==================================================
                               MONTHLY TABLE
                            ================================================== */

                            filteredMonthlyAttendance.length ===
                            0 ? (

                                <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">

                                    <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">

                                        <CalendarDays
                                            size={27}
                                            className="text-slate-400"
                                        />

                                    </div>

                                    <h3 className="text-base font-bold text-slate-900">
                                        No monthly attendance
                                    </h3>

                                    <p className="mt-2 text-sm text-slate-500">

                                        {searchEmployee
                                            ? "No employees match your search."
                                            : `No attendance records were found for ${formatBillingMonth(
                                                billingMonth
                                            )}.`}

                                    </p>

                                </div>

                            ) : (

                                <div className="overflow-x-auto">

                                    <table className="w-full min-w-[1050px]">

                                        <thead>

                                            <tr className="border-b border-slate-200 bg-slate-50">

                                                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Employee
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Present
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Absent
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Leave
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Half Day
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Working Days
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    LOP
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Overtime
                                                </th>

                                                <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                    Records
                                                </th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {filteredMonthlyAttendance.map(
                                                (
                                                    record,
                                                    index
                                                ) => (

                                                    <tr
                                                        key={
                                                            `${getEmployeeId(
                                                                record
                                                            )}-${index}`
                                                        }
                                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                                                    >

                                                        <td className="px-6 py-4">

                                                            <div>

                                                                <p className="text-sm font-semibold text-slate-900">
                                                                    {getEmployeeName(
                                                                        record
                                                                    )}
                                                                </p>

                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    ID:{" "}
                                                                    {getEmployeeId(
                                                                        record
                                                                    ) ||
                                                                        "—"}
                                                                </p>

                                                            </div>

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm font-semibold text-emerald-700">

                                                            {record?.present_days ??
                                                                0}

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">

                                                            {record?.absent_days ??
                                                                0}

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm font-semibold text-blue-600">

                                                            {record?.leave_days ??
                                                                0}

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm font-semibold text-amber-600">

                                                            {record?.half_days ??
                                                                0}

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm font-semibold text-slate-700">

                                                            {record?.working_days ??
                                                                0}

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">

                                                            {record?.lop_days ??
                                                                0}

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm font-semibold text-indigo-600">

                                                            {Number(
                                                                record?.overtime_hours ??
                                                                0
                                                            ).toFixed(
                                                                2
                                                            )}{" "}
                                                            hrs

                                                        </td>

                                                        <td className="px-6 py-4 text-center text-sm text-slate-600">

                                                            {record?.total_records ??
                                                                0}

                                                        </td>

                                                    </tr>

                                                )
                                            )}

                                        </tbody>

                                    </table>

                                </div>

                            )

                        )}

                    </div>

                </div>

            </main>

        </div>
    );
};

export default ClientAttendance;