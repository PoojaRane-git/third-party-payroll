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
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";
import api from "../../../services/api";
import { useAuth } from "../../../auth/AuthProvider";

// ============================================================
// HELPERS
// ============================================================

const formatDateForDisplay = (dateString) => {
    if (!dateString) return "";

    const [year, month, day] = dateString.split("-");

    if (!year || !month || !day) {
        return dateString;
    }

    return `${day}/${month}/${year}`;
};

const formatDateLong = (dateString) => {
    if (!dateString) return "";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const getToday = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

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

const getEmployeeName = (employee) => {
    return (
        employee?.employee_name ||
        employee?.full_name ||
        employee?.name ||
        employee?.employee?.full_name ||
        "Unknown Employee"
    );
};

const getEmployeeId = (employee) => {
    return (
        employee?.employee_id ??
        employee?.id ??
        employee?.candidate_id ??
        ""
    );
};

const getOvertime = (record) => {
    const value = Number(
        record?.overtime_hours ??
        record?.overtime ??
        0
    );

    return Number.isFinite(value) ? value : 0;
};

const getStatus = (record) => {
    return normalizeStatus(record?.status);
};

// ============================================================
// COMPONENT
// ============================================================

const ClientAttendance = () => {

    // ========================================================
    // AUTH SESSION
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

    const [billingMonth, setBillingMonth] =
        useState(getCurrentBillingMonth());

    const [attendanceDate, setAttendanceDate] =
        useState(getToday());

    const [searchEmployee, setSearchEmployee] =
        useState("");

    const [statusFilter, setStatusFilter] =
        useState("all");

    const [activeTab, setActiveTab] =
        useState("daily");

    const [dailyAttendance, setDailyAttendance] =
        useState([]);

    const [monthlyAttendance, setMonthlyAttendance] =
        useState([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [refreshing, setRefreshing] =
        useState(false);

    // ========================================================
    // CLIENT SESSION
    // ========================================================
    // IMPORTANT:
    // Authentication comes from AuthProvider / Supabase session.
    //
    // Your /auth/me response contains:
    //
    // user = {
    //     supabase_user_id,
    //     email,
    //     profile_id,
    //     role,
    //     status,
    //     ...
    // }
    //
    // Therefore profile_id is used as the client ID.
    // ========================================================

    const clientId = useMemo(() => {

        const numericId = Number(
            user?.profile_id
        );

        if (
            Number.isFinite(numericId) &&
            numericId > 0
        ) {
            return numericId;
        }

        return null;

    }, [user]);

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
                hasSession: !!session,
                user,
                clientId,
                role: user?.role,
                status: user?.status,
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

    const handleLogout = async () => {

        try {

            await logout();

            window.location.href = "/login";

        } catch (error) {

            console.error(
                "Client attendance logout error:",
                error
            );

            window.location.href = "/login";

        }
    };

    // ========================================================
    // FETCH DAILY ATTENDANCE
    // ========================================================

    const fetchDailyAttendance = useCallback(
        async (showLoader = true) => {

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

                setDailyAttendance([]);

                return;
            }

            if (!attendanceDate) {
                return;
            }

            try {

                if (showLoader) {
                    setLoading(true);
                }

                setError("");

                console.log(
                    "FETCH DAILY ATTENDANCE:",
                    {
                        client_id: clientId,
                        attendance_date:
                            attendanceDate,
                    }
                );

                const response =
                    await api.get(
                        "/attendance/daily",
                        {
                            params: {
                                client_id:
                                    clientId,

                                attendance_date:
                                    attendanceDate,
                            },
                        }
                    );

                const result =
                    response?.data || {};

                console.log(
                    "DAILY ATTENDANCE RESPONSE:",
                    result
                );

                const records =
                    Array.isArray(
                        result.data
                    )
                        ? result.data
                        : Array.isArray(
                            result.attendance
                        )
                            ? result.attendance
                            : [];

                setDailyAttendance(records);

            } catch (err) {

                console.error(
                    "Fetch daily attendance error:",
                    err
                );

                if (
                    err?.response?.status ===
                    401
                ) {

                    setError(
                        "Your session has expired. Please login again."
                    );

                } else if (
                    err?.response?.status ===
                    403
                ) {

                    setError(
                        "You do not have permission to view this attendance."
                    );

                } else {

                    setError(
                        err?.response?.data?.error ||
                        err?.response?.data?.message ||
                        err?.message ||
                        "Failed to load attendance."
                    );

                }

                setDailyAttendance([]);

            } finally {

                if (showLoader) {
                    setLoading(false);
                }

            }

        },
        [
            authLoading,
            session,
            user,
            clientId,
            attendanceDate,
        ]
    );

    // ========================================================
    // FETCH MONTHLY ATTENDANCE
    // ========================================================

    const fetchMonthlyAttendance = useCallback(
        async (showLoader = true) => {

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

                setMonthlyAttendance([]);

                return;
            }

            if (!billingMonth) {
                return;
            }

            try {

                if (showLoader) {
                    setLoading(true);
                }

                setError("");

                console.log(
                    "FETCH MONTHLY ATTENDANCE:",
                    {
                        client_id: clientId,
                        billing_month:
                            billingMonth,
                    }
                );

                const response =
                    await api.get(
                        "/attendance/monthly",
                        {
                            params: {
                                client_id:
                                    clientId,

                                billing_month:
                                    billingMonth,
                            },
                        }
                    );

                const result =
                    response?.data || {};

                console.log(
                    "MONTHLY ATTENDANCE RESPONSE:",
                    result
                );

                const records =
                    Array.isArray(
                        result.data
                    )
                        ? result.data
                        : [];

                setMonthlyAttendance(records);

            } catch (err) {

                console.error(
                    "Fetch monthly attendance error:",
                    err
                );

                if (
                    err?.response?.status ===
                    401
                ) {

                    setError(
                        "Your session has expired. Please login again."
                    );

                } else if (
                    err?.response?.status ===
                    403
                ) {

                    setError(
                        "You do not have permission to view this attendance."
                    );

                } else {

                    setError(
                        err?.response?.data?.error ||
                        err?.response?.data?.message ||
                        err?.message ||
                        "Failed to load monthly attendance."
                    );

                }

                setMonthlyAttendance([]);

            } finally {

                if (showLoader) {
                    setLoading(false);
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
    // DAILY LOAD
    // ========================================================

    useEffect(() => {

        if (
            authLoading ||
            !session ||
            !user ||
            !clientId ||
            user?.role !== "client" ||
            activeTab !== "daily"
        ) {
            return;
        }

        fetchDailyAttendance(true);

    }, [
        authLoading,
        session,
        user,
        clientId,
        activeTab,
        attendanceDate,
        fetchDailyAttendance,
    ]);

    // ========================================================
    // MONTHLY LOAD
    // ========================================================

    useEffect(() => {

        if (
            authLoading ||
            !session ||
            !user ||
            !clientId ||
            user?.role !== "client" ||
            activeTab !== "monthly"
        ) {
            return;
        }

        fetchMonthlyAttendance(true);

    }, [
        authLoading,
        session,
        user,
        clientId,
        activeTab,
        billingMonth,
        fetchMonthlyAttendance,
    ]);

    // ========================================================
    // REFRESH
    // ========================================================

    const handleRefresh = async () => {

        try {

            setRefreshing(true);

            if (activeTab === "daily") {

                await fetchDailyAttendance(false);

            } else {

                await fetchMonthlyAttendance(false);

            }

        } finally {

            setRefreshing(false);

        }
    };

    // ========================================================
    // DAILY FILTERING
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
                        getStatus(record);

                    const matchesStatus =
                        statusFilter === "all" ||
                        status === statusFilter;

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
    // MONTHLY FILTERING
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
    // DAILY SUMMARY CARDS
    // ========================================================

    const dailyStats = useMemo(() => {

        let present = 0;
        let absent = 0;
        let leave = 0;
        let overtime = 0;

        dailyAttendance.forEach(
            (record) => {

                const status =
                    getStatus(record);

                if (status === "present") {
                    present++;
                }

                if (status === "absent") {
                    absent++;
                }

                if (status === "leave") {
                    leave++;
                }

                overtime +=
                    getOvertime(record);
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

    }, [dailyAttendance]);

    // ========================================================
    // MONTHLY SUMMARY
    // ========================================================

    const monthlyStats = useMemo(() => {

        const employees =
            monthlyAttendance.length;

        let present = 0;
        let absent = 0;
        let leave = 0;
        let overtime = 0;

        monthlyAttendance.forEach(
            (record) => {

                present += Number(
                    record?.present_days || 0
                );

                absent += Number(
                    record?.absent_days || 0
                );

                leave += Number(
                    record?.leave_days || 0
                );

                overtime += Number(
                    record?.overtime_hours || 0
                );
            }
        );

        return {
            employees,
            present,
            absent,
            leave,
            overtime:
                Math.round(
                    overtime * 100
                ) / 100,
        };

    }, [monthlyAttendance]);

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

    const getStatusBadge = (status) => {

        const normalized =
            normalizeStatus(status);

        let className =
            "bg-slate-100 text-slate-600";

        let label =
            status || "Unknown";

        if (normalized === "present") {

            className =
                "bg-emerald-50 text-emerald-700";

            label = "Present";

        } else if (normalized === "absent") {

            className =
                "bg-red-50 text-red-600";

            label = "Absent";

        } else if (normalized === "leave") {

            className =
                "bg-blue-50 text-blue-600";

            label = "Leave";

        } else if (normalized === "half_day") {

            className =
                "bg-amber-50 text-amber-700";

            label = "Half Day";
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
    // INVALID SESSION / USER
    // ========================================================

    if (!session || !user) {

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
    // RENDER
    // ========================================================

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-6">

            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                clientName={clientName}
                onLogout={handleLogout}
            />

            <div className="mx-auto max-w-[1280px]">

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
                        onClick={handleRefresh}
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

                                <input
                                    type="month"
                                    value={billingMonth}
                                    onChange={(e) =>
                                        setBillingMonth(
                                            e.target.value
                                        )
                                    }
                                    className="h-[43px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                                    value={attendanceDate}
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
                                    value={searchEmployee}
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
                                    {activeTab === "daily"
                                        ? "Records today"
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
                                    {activeTab === "daily"
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
                                    {activeTab === "daily"
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
                                    {activeTab === "daily"
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
                                    ).toFixed(2)}{" "}
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
                    MAIN ATTENDANCE CARD
                ================================================== */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                    {/* Tabs */}

                    <div className="flex border-b border-slate-200">

                        <button
                            type="button"
                            onClick={() =>
                                setActiveTab("daily")
                            }
                            className={`relative px-6 py-4 text-sm font-semibold transition ${
                                activeTab === "daily"
                                    ? "text-indigo-600"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >

                            Daily Attendance

                            {activeTab === "daily" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                            )}

                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setActiveTab("monthly")
                            }
                            className={`relative px-6 py-4 text-sm font-semibold transition ${
                                activeTab === "monthly"
                                    ? "text-indigo-600"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                        >

                            Monthly Attendance

                            {activeTab === "monthly" && (
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
                        STATUS FILTER
                    ================================================== */}

                    {activeTab === "daily" && (
                        <div className="flex justify-end border-b border-slate-200 px-6 py-6">

                            <div className="relative">

                                <select
                                    value={statusFilter}
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

                    ) : activeTab === "daily" ? (

                        filteredDailyAttendance.length === 0 ? (

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
                                    statusFilter !== "all"
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
                                                                ) || "—"}
                                                            </p>

                                                        </div>

                                                    </td>

                                                    <td className="px-6 py-4 text-sm text-slate-600">
                                                        {formatDateForDisplay(
                                                            record?.attendance_date
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4 text-sm text-slate-600">
                                                        {record?.check_in || "—"}
                                                    </td>

                                                    <td className="px-6 py-4 text-sm text-slate-600">
                                                        {record?.check_out || "—"}
                                                    </td>

                                                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                                                        {record?.working_hours ?? "—"}
                                                    </td>

                                                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                                                        {getOvertime(
                                                            record
                                                        ).toFixed(2)}{" "}
                                                        hrs
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        {getStatusBadge(
                                                            record?.status
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

                        filteredMonthlyAttendance.length === 0 ? (

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
                                        : `No attendance records were found for ${billingMonth}.`}

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
                                                        record?.employee_id ??
                                                        index
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
                                                                ) || "—"}
                                                            </p>

                                                        </div>

                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-emerald-700">
                                                        {record?.present_days ?? 0}
                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">
                                                        {record?.absent_days ?? 0}
                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-blue-600">
                                                        {record?.leave_days ?? 0}
                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-amber-600">
                                                        {record?.half_days ?? 0}
                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-slate-700">
                                                        {record?.working_days ?? 0}
                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">
                                                        {record?.lop_days ?? 0}
                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm font-semibold text-indigo-600">
                                                        {Number(
                                                            record?.overtime_hours ?? 0
                                                        ).toFixed(2)}{" "}
                                                        hrs
                                                    </td>

                                                    <td className="px-6 py-4 text-center text-sm text-slate-600">
                                                        {record?.total_records ?? 0}
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

        </div>
    );
};

export default ClientAttendance;