import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    AlertCircle,
    CalendarDays,
    Check,
    Clock,
    RefreshCw,
    Search,
    UserCheck,
    UserX,
    X,
} from "lucide-react";

import Sidebar from "../../components/Layout/Sidebar";
import api from "../../../services/api";
import { useAuth } from "../../../../auth/AuthProvider";


// ============================================================
// HELPERS
// ============================================================

const normalizeStatus = (status) => {
    return String(status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
};

const getEmployeeName = (record) => {
    return (
        record?.employee_name ||
        record?.full_name ||
        record?.name ||
        record?.candidate_name ||
        record?.employee?.full_name ||
        record?.employee?.name ||
        record?.candidate?.full_name ||
        record?.candidate?.name ||
        record?.candidates?.full_name ||
        record?.candidates?.name ||
        "Unknown Employee"
    );
};

const getEmployeeId = (record) => {
    return (
        record?.employee_id ??
        record?.candidate_id ??
        record?.candidates_id ??
        record?.employee?.id ??
        record?.candidate?.id ??
        ""
    );
};

const getLeaveType = (record) => {
    return (
        record?.leave_type ||
        record?.type ||
        "Leave"
    );
};

const getReason = (record) => {
    return (
        record?.reason ||
        "No reason provided"
    );
};

const getStatus = (record) => {
    return normalizeStatus(
        record?.status
    );
};

const getStartDate = (record) => {
    return (
        record?.start_date ||
        record?.from_date ||
        record?.leave_start_date ||
        ""
    );
};

const getEndDate = (record) => {
    return (
        record?.end_date ||
        record?.to_date ||
        record?.leave_end_date ||
        ""
    );
};

const formatDate = (value) => {

    if (!value) {
        return "—";
    }

    const stringValue =
        String(value);

    const date =
        stringValue.includes("T")
            ? new Date(stringValue)
            : new Date(
                  `${stringValue}T00:00:00`
              );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return stringValue;
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
};

const formatDateRange = (
    record
) => {

    const start =
        getStartDate(record);

    const end =
        getEndDate(record);

    if (!start && !end) {
        return "—";
    }

    if (
        start &&
        end &&
        String(start) ===
            String(end)
    ) {
        return formatDate(start);
    }

    return `${formatDate(start)} – ${formatDate(end)}`;
};

const calculateLeaveDays = (
    record
) => {

    const start =
        getStartDate(record);

    const end =
        getEndDate(record);

    if (!start || !end) {
        return "—";
    }

    const startDate =
        new Date(
            `${String(start).slice(
                0,
                10
            )}T00:00:00`
        );

    const endDate =
        new Date(
            `${String(end).slice(
                0,
                10
            )}T00:00:00`
        );

    if (
        Number.isNaN(
            startDate.getTime()
        ) ||
        Number.isNaN(
            endDate.getTime()
        )
    ) {
        return "—";
    }

    const difference =
        endDate.getTime() -
        startDate.getTime();

    const days =
        Math.floor(
            difference /
                (1000 *
                    60 *
                    60 *
                    24)
        ) + 1;

    return days > 0
        ? days
        : "—";
};

const formatSubmittedDate = (
    value
) => {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
};

// ============================================================
// COMPONENT
// ============================================================

const Leave = () => {

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
    // SIDEBAR
    // ========================================================

    const [activeTab, setActiveTab] =
        useState("leave");

    // ========================================================
    // DATA
    // ========================================================

    const [leaveRequests, setLeaveRequests] =
        useState([]);

    // ========================================================
    // FILTERS
    // ========================================================

    const [searchEmployee, setSearchEmployee] =
        useState("");

    const [statusFilter, setStatusFilter] =
        useState("Pending");

    const [leaveTypeFilter, setLeaveTypeFilter] =
        useState("all");

    // ========================================================
    // LOADING
    // ========================================================

    const [loading, setLoading] =
        useState(false);

    const [refreshing, setRefreshing] =
        useState(false);

    const [error, setError] =
        useState("");

    // ========================================================
    // PROCESSING
    // ========================================================

    const [processingId, setProcessingId] =
        useState(null);

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
    // LOGOUT
    // ========================================================

    const handleLogout = async () => {

        try {

            await logout();

            window.location.href =
                "/login";

        } catch (error) {

            console.error(
                "Leave logout error:",
                error
            );

            window.location.href =
                "/login";
        }
    };

    // ========================================================
    // FETCH LEAVE REQUESTS
    //
    // GET
    // /api/client/leave/pending
    // ========================================================

    const fetchLeaveRequests =
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

                try {

                    if (showLoader) {
                        setLoading(true);
                    }

                    setError("");

                    console.log(
                        "FETCH CLIENT LEAVE REQUESTS"
                    );

                    const response =
                        await api.get(
                            "/client/leave/pending"
                        );

                    const result =
                        response?.data || {};

                    console.log(
                        "CLIENT LEAVE RESPONSE:",
                        result
                    );

                    if (
                        result.success !== true
                    ) {

                        throw new Error(
                            result.error ||
                            result.message ||
                            "Failed to load leave requests."
                        );
                    }

                    const records =
                        Array.isArray(
                            result.data
                        )
                            ? result.data
                            : [];

                    setLeaveRequests(
                        records
                    );

                } catch (err) {

                    console.error(
                        "Fetch leave requests error:",
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
                            "You do not have permission to view leave requests."
                        );

                    } else {

                        setError(
                            err?.response?.data?.error ||
                            err?.response?.data?.message ||
                            err?.message ||
                            "Failed to load leave requests."
                        );
                    }

                    setLeaveRequests([]);

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
            ]
        );

    // ========================================================
    // INITIAL FETCH
    // ========================================================

    useEffect(() => {

        if (
            authLoading ||
            !session ||
            !user ||
            user?.role !== "client"
        ) {
            return;
        }

        fetchLeaveRequests(true);

    }, [
        authLoading,
        session,
        user,
        fetchLeaveRequests,
    ]);

    // ========================================================
    // REFRESH
    // ========================================================

    const handleRefresh = async () => {

        try {

            setRefreshing(true);

            await fetchLeaveRequests(
                false
            );

        } finally {

            setRefreshing(false);
        }
    };

    // ========================================================
    // APPROVE LEAVE
    //
    // PATCH
    // /api/client/leave/:id/approve
    // ========================================================

    const handleApprove = async (
        record
    ) => {

        const requestId =
            record?.id;

        if (!requestId) {
            return;
        }

        const employeeName =
            getEmployeeName(record);

        const leaveType =
            getLeaveType(record);

        const confirmed =
            window.confirm(
                `Approve ${leaveType} for ${employeeName}?`
            );

        if (!confirmed) {
            return;
        }

        try {

            setProcessingId(
                requestId
            );

            setError("");

            const response =
                await api.patch(
                    `/client/leave/${requestId}/approve`
                );

            const result =
                response?.data || {};

            if (
                result.success !== true
            ) {

                throw new Error(
                    result.error ||
                    result.message ||
                    "Failed to approve leave."
                );
            }

            await fetchLeaveRequests(
                false
            );

        } catch (err) {

            console.error(
                "Approve leave error:",
                err
            );

            setError(
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to approve leave request."
            );

        } finally {

            setProcessingId(
                null
            );
        }
    };

    // ========================================================
    // REJECT LEAVE
    //
    // PATCH
    // /api/client/leave/:id/reject
    // ========================================================

    const handleReject = async (
        record
    ) => {

        const requestId =
            record?.id;

        if (!requestId) {
            return;
        }

        const employeeName =
            getEmployeeName(record);

        const confirmed =
            window.confirm(
                `Reject leave request from ${employeeName}?`
            );

        if (!confirmed) {
            return;
        }

        try {

            setProcessingId(
                requestId
            );

            setError("");

            const response =
                await api.patch(
                    `/client/leave/${requestId}/reject`
                );

            const result =
                response?.data || {};

            if (
                result.success !== true
            ) {

                throw new Error(
                    result.error ||
                    result.message ||
                    "Failed to reject leave."
                );
            }

            await fetchLeaveRequests(
                false
            );

        } catch (err) {

            console.error(
                "Reject leave error:",
                err
            );

            setError(
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to reject leave request."
            );

        } finally {

            setProcessingId(
                null
            );
        }
    };

    // ========================================================
    // SUMMARY
    // ========================================================

    const summary = useMemo(() => {

        let pending = 0;
        let approved = 0;
        let rejected = 0;

        leaveRequests.forEach(
            (record) => {

                const status =
                    getStatus(record);

                if (
                    status === "pending"
                ) {
                    pending++;
                }

                if (
                    status === "approved"
                ) {
                    approved++;
                }

                if (
                    status === "rejected"
                ) {
                    rejected++;
                }
            }
        );

        return {
            total:
                leaveRequests.length,
            pending,
            approved,
            rejected,
        };

    }, [
        leaveRequests,
    ]);

    // ========================================================
    // LEAVE TYPES
    // ========================================================

    const leaveTypes =
        useMemo(() => {

            const types =
                leaveRequests
                    .map(
                        (record) =>
                            getLeaveType(
                                record
                            )
                    )
                    .filter(Boolean);

            return [
                ...new Set(types),
            ];

        }, [
            leaveRequests,
        ]);

    // ========================================================
    // FILTERED DATA
    // ========================================================

    const filteredRequests =
        useMemo(() => {

            const search =
                searchEmployee
                    .trim()
                    .toLowerCase();

            return leaveRequests.filter(
                (record) => {

                    const status =
                        getStatus(record);

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

                    const leaveType =
                        getLeaveType(
                            record
                        );

                    const matchesSearch =
                        !search ||
                        employeeName.includes(
                            search
                        ) ||
                        employeeId.includes(
                            search
                        );

                    const matchesStatus =
                        statusFilter ===
                            "all" ||
                        status ===
                            normalizeStatus(
                                statusFilter
                            );

                    const matchesLeaveType =
                        leaveTypeFilter ===
                            "all" ||
                        normalizeStatus(
                            leaveType
                        ) ===
                            normalizeStatus(
                                leaveTypeFilter
                            );

                    return (
                        matchesSearch &&
                        matchesStatus &&
                        matchesLeaveType
                    );
                }
            );

        }, [
            leaveRequests,
            searchEmployee,
            statusFilter,
            leaveTypeFilter,
        ]);

    // ========================================================
    // STATUS BADGE
    // ========================================================

    const getStatusBadge = (
        status
    ) => {

        const normalized =
            normalizeStatus(status);

        if (
            normalized === "pending"
        ) {

            return (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Pending
                </span>
            );
        }

        if (
            normalized === "approved"
        ) {

            return (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Approved
                </span>
            );
        }

        if (
            normalized === "rejected"
        ) {

            return (
                <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                    Rejected
                </span>
            );
        }

        return (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {status || "Unknown"}
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
                        Loading leave requests...
                    </p>

                </div>

            </div>
        );
    }

    // ========================================================
    // SESSION CHECK
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
                        Please login again to view leave requests.
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
                MAIN
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
                                    size={26}
                                    className="text-indigo-600"
                                />

                                <h1 className="text-[30px] font-bold leading-none text-slate-900">
                                    Leave Requests
                                </h1>

                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                Review and manage employee leave requests.
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

                            {/* Status */}

                            <div>

                                <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Request Status
                                </label>

                                <select
                                    value={
                                        statusFilter
                                    }
                                    onChange={(e) =>
                                        setStatusFilter(
                                            e.target.value
                                        )
                                    }
                                    className="h-[43px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                >

                                    <option value="Pending">
                                        Pending
                                    </option>

                                    <option value="Approved">
                                        Approved
                                    </option>

                                    <option value="Rejected">
                                        Rejected
                                    </option>

                                    <option value="all">
                                        All Status
                                    </option>

                                </select>

                            </div>

                            {/* Leave Type */}

                            <div>

                                <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Leave Type
                                </label>

                                <select
                                    value={
                                        leaveTypeFilter
                                    }
                                    onChange={(e) =>
                                        setLeaveTypeFilter(
                                            e.target.value
                                        )
                                    }
                                    className="h-[43px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                >

                                    <option value="all">
                                        All Leave Types
                                    </option>

                                    {leaveTypes.map(
                                        (
                                            type
                                        ) => (
                                            <option
                                                key={
                                                    type
                                                }
                                                value={
                                                    type
                                                }
                                            >
                                                {type}
                                            </option>
                                        )
                                    )}

                                </select>

                            </div>

                        </div>

                    </div>

                    {/* ==================================================
                        SUMMARY
                    ================================================== */}

                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                        {/* Total */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Total Requests
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {summary.total}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        All leave requests
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">

                                    <CalendarDays
                                        size={21}
                                        className="text-indigo-600"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* Pending */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Pending
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {summary.pending}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Awaiting review
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">

                                    <Clock
                                        size={21}
                                        className="text-amber-600"
                                    />

                                </div>

                            </div>

                        </div>

                        {/* Approved */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Approved
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {summary.approved}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Approved leave
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

                        {/* Rejected */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <div className="flex items-start justify-between">

                                <div>

                                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        Rejected
                                    </p>

                                    <p className="mt-2 text-2xl font-bold text-slate-950">
                                        {summary.rejected}
                                    </p>

                                    <p className="mt-1 text-xs text-slate-500">
                                        Rejected leave
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

                    </div>

                    {/* ==================================================
                        ERROR
                    ================================================== */}

                    {error && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

                            <AlertCircle
                                size={18}
                                className="mt-0.5 shrink-0"
                            />

                            <span>
                                {error}
                            </span>

                        </div>
                    )}

                    {/* ==================================================
                        TABLE
                    ================================================== */}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                        {loading ? (

                            <div className="flex min-h-[400px] items-center justify-center">

                                <div className="flex flex-col items-center gap-3">

                                    <RefreshCw
                                        size={26}
                                        className="animate-spin text-indigo-600"
                                    />

                                    <p className="text-sm text-slate-500">
                                        Loading leave requests...
                                    </p>

                                </div>

                            </div>

                        ) : filteredRequests.length === 0 ? (

                            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">

                                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">

                                    <CalendarDays
                                        size={28}
                                        className="text-slate-400"
                                    />

                                </div>

                                <h3 className="text-base font-bold text-slate-900">
                                    No leave requests
                                </h3>

                                <p className="mt-2 text-sm text-slate-500">

                                    {searchEmployee ||
                                    statusFilter !==
                                        "all" ||
                                    leaveTypeFilter !==
                                        "all"
                                        ? "No leave requests match your current filters."
                                        : "There are no employee leave requests yet."}

                                </p>

                            </div>

                        ) : (

                            <div className="overflow-x-auto">

                                <table className="w-full min-w-[1200px]">

                                    <thead>

                                        <tr className="border-b border-slate-200 bg-slate-50">

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Employee
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Leave Type
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Leave Dates
                                            </th>

                                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Days
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Reason
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Status
                                            </th>

                                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Action
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {filteredRequests.map(
                                            (
                                                record,
                                                index
                                            ) => {

                                                const requestId =
                                                    record?.id;

                                                const status =
                                                    getStatus(
                                                        record
                                                    );

                                                const isProcessing =
                                                    processingId ===
                                                    requestId;

                                                return (
                                                    <tr
                                                        key={
                                                            requestId ??
                                                            index
                                                        }
                                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                                                    >

                                                        {/* Employee */}

                                                        <td className="px-6 py-5">

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

                                                        </td>

                                                        {/* Leave Type */}

                                                        <td className="px-6 py-5">

                                                            <span className="inline-flex rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                                                                {getLeaveType(
                                                                    record
                                                                )}
                                                            </span>

                                                        </td>

                                                        {/* Dates */}

                                                        <td className="px-6 py-5">

                                                            <p className="text-sm font-medium text-slate-700">
                                                                {formatDateRange(
                                                                    record
                                                                )}
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-400">
                                                                Applied{" "}
                                                                {formatSubmittedDate(
                                                                    record?.applied_at ||
                                                                    record?.created_at
                                                                )}
                                                            </p>

                                                        </td>

                                                        {/* Days */}

                                                        <td className="px-6 py-5 text-center">

                                                            <span className="text-sm font-bold text-slate-800">
                                                                {calculateLeaveDays(
                                                                    record
                                                                )}
                                                            </span>

                                                        </td>

                                                        {/* Reason */}

                                                        <td className="max-w-[260px] px-6 py-5">

                                                            <p className="text-sm leading-5 text-slate-600">
                                                                {getReason(
                                                                    record
                                                                )}
                                                            </p>

                                                        </td>

                                                        {/* Status */}

                                                        <td className="px-6 py-5">

                                                            {getStatusBadge(
                                                                record?.status
                                                            )}

                                                        </td>

                                                        {/* Actions */}

                                                        <td className="px-6 py-5">

                                                            {status ===
                                                            "pending" ? (

                                                                <div className="flex justify-end gap-2">

                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleApprove(
                                                                                record
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isProcessing
                                                                        }
                                                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >

                                                                        {isProcessing ? (
                                                                            <RefreshCw
                                                                                size={14}
                                                                                className="animate-spin"
                                                                            />
                                                                        ) : (
                                                                            <Check
                                                                                size={14}
                                                                            />
                                                                        )}

                                                                        Approve

                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleReject(
                                                                                record
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isProcessing
                                                                        }
                                                                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >

                                                                        <X
                                                                            size={14}
                                                                        />

                                                                        Reject

                                                                    </button>

                                                                </div>

                                                            ) : (

                                                                <div className="flex justify-end">

                                                                    <span className="text-xs text-slate-400">
                                                                        No action
                                                                    </span>

                                                                </div>

                                                            )}

                                                        </td>

                                                    </tr>
                                                );
                                            }
                                        )}

                                    </tbody>

                                </table>

                            </div>

                        )}

                    </div>

                </div>

            </main>

        </div>
    );
};

export default Leave;