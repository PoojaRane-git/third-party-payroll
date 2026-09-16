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

import Sidebar from "../Layout/Sidebar";
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

const formatDateForDisplay = (dateString) => {
    if (!dateString) return "—";

    const value = String(dateString);

    if (value.includes("T")) {
        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            });
        }
    }

    const [year, month, day] =
        value.split("-");

    if (!year || !month || !day) {
        return value;
    }

    return `${day}/${month}/${year}`;
};

const formatDateLong = (dateString) => {
    if (!dateString) return "—";

    const value = String(dateString);

    const date = value.includes("T")
        ? new Date(value)
        : new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
};

const formatDateTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return String(value);
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

const getAttendanceDate = (record) => {
    return (
        record?.attendance_date ||
        record?.attendance?.attendance_date ||
        ""
    );
};

const getOriginalCheckIn = (record) => {
    return (
        record?.original_check_in ??
        record?.check_in ??
        record?.attendance?.check_in ??
        null
    );
};

const getOriginalCheckOut = (record) => {
    return (
        record?.original_check_out ??
        record?.check_out ??
        record?.attendance?.check_out ??
        null
    );
};

const getRequestedCheckIn = (record) => {
    return (
        record?.requested_check_in ??
        null
    );
};

const getRequestedCheckOut = (record) => {
    return (
        record?.requested_check_out ??
        null
    );
};

const getReason = (record) => {
    return (
        record?.reason ||
        record?.rectification_reason ||
        "No reason provided"
    );
};

const getRequestStatus = (record) => {
    return normalizeStatus(
        record?.status
    );
};

// ============================================================
// COMPONENT
// ============================================================

const AttendanceRectifications = () => {

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
        useState("attendance");

    // ========================================================
    // DATA
    // ========================================================

    const [rectifications, setRectifications] =
        useState([]);

    // ========================================================
    // FILTERS
    // ========================================================

    const [searchEmployee, setSearchEmployee] =
        useState("");

    const [statusFilter, setStatusFilter] =
        useState("Pending");

    // ========================================================
    // LOADING / ERROR
    // ========================================================

    const [loading, setLoading] =
        useState(false);

    const [refreshing, setRefreshing] =
        useState(false);

    const [error, setError] =
        useState("");

    // ========================================================
    // ACTION STATE
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
                "Attendance rectification logout error:",
                error
            );

            window.location.href =
                "/login";
        }
    };

    // ========================================================
    // FETCH RECTIFICATIONS
    //
    // GET
    // /api/client/attendance/rectifications
    // ========================================================

    const fetchRectifications =
        useCallback(
            async (showLoader = true) => {

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
                        "FETCH ATTENDANCE RECTIFICATIONS"
                    );

                    const response =
                        await api.get(
                            "/client/attendance/rectifications"
                        );

                    const result =
                        response?.data || {};

                    console.log(
                        "ATTENDANCE RECTIFICATIONS RESPONSE:",
                        result
                    );

                    if (
                        result.success !== true
                    ) {

                        throw new Error(
                            result.error ||
                            result.message ||
                            "Failed to load attendance rectification requests."
                        );
                    }

                    const records =
                        Array.isArray(
                            result.data
                        )
                            ? result.data
                            : [];

                    setRectifications(
                        records
                    );

                } catch (err) {

                    console.error(
                        "Fetch attendance rectifications error:",
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
                            "You do not have permission to view attendance rectification requests."
                        );

                    } else {

                        setError(
                            err?.response?.data?.error ||
                            err?.response?.data?.message ||
                            err?.message ||
                            "Failed to load attendance rectification requests."
                        );
                    }

                    setRectifications([]);

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
    // INITIAL LOAD
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

        fetchRectifications(true);

    }, [
        authLoading,
        session,
        user,
        fetchRectifications,
    ]);

    // ========================================================
    // REFRESH
    // ========================================================

    const handleRefresh = async () => {

        try {

            setRefreshing(true);

            await fetchRectifications(
                false
            );

        } finally {

            setRefreshing(false);
        }
    };

    // ========================================================
    // APPROVE
    //
    // PATCH
    // /api/client/attendance/rectifications/:id/approve
    // ========================================================

    const handleApprove = async (
        record
    ) => {

        const rectificationId =
            record?.id;

        if (!rectificationId) {
            return;
        }

        const employeeName =
            getEmployeeName(record);

        const confirmed =
            window.confirm(
                `Approve attendance rectification for ${employeeName}?`
            );

        if (!confirmed) {
            return;
        }

        try {

            setProcessingId(
                rectificationId
            );

            setError("");

            const response =
                await api.patch(
                    `/client/attendance/rectifications/${rectificationId}/approve`
                );

            const result =
                response?.data || {};

            if (
                result.success !== true
            ) {

                throw new Error(
                    result.error ||
                    result.message ||
                    "Failed to approve rectification."
                );
            }

            await fetchRectifications(
                false
            );

        } catch (err) {

            console.error(
                "Approve rectification error:",
                err
            );

            setError(
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to approve attendance rectification."
            );

        } finally {

            setProcessingId(
                null
            );
        }
    };

    // ========================================================
    // REJECT
    //
    // PATCH
    // /api/client/attendance/rectifications/:id/reject
    // ========================================================

    const handleReject = async (
        record
    ) => {

        const rectificationId =
            record?.id;

        if (!rectificationId) {
            return;
        }

        const employeeName =
            getEmployeeName(record);

        const confirmed =
            window.confirm(
                `Reject attendance rectification for ${employeeName}?`
            );

        if (!confirmed) {
            return;
        }

        try {

            setProcessingId(
                rectificationId
            );

            setError("");

            const response =
                await api.patch(
                    `/client/attendance/rectifications/${rectificationId}/reject`
                );

            const result =
                response?.data || {};

            if (
                result.success !== true
            ) {

                throw new Error(
                    result.error ||
                    result.message ||
                    "Failed to reject rectification."
                );
            }

            await fetchRectifications(
                false
            );

        } catch (err) {

            console.error(
                "Reject rectification error:",
                err
            );

            setError(
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to reject attendance rectification."
            );

        } finally {

            setProcessingId(
                null
            );
        }
    };

    // ========================================================
    // SUMMARY COUNTS
    // ========================================================

    const summary = useMemo(() => {

        let pending = 0;
        let approved = 0;
        let rejected = 0;

        rectifications.forEach(
            (record) => {

                const status =
                    getRequestStatus(
                        record
                    );

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
                rectifications.length,
            pending,
            approved,
            rejected,
        };

    }, [
        rectifications,
    ]);

    // ========================================================
    // FILTERED RECORDS
    // ========================================================

    const filteredRectifications =
        useMemo(() => {

            const search =
                searchEmployee
                    .trim()
                    .toLowerCase();

            return rectifications.filter(
                (record) => {

                    const status =
                        getRequestStatus(
                            record
                        );

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

                    const matchesStatus =
                        statusFilter === "all" ||
                        status ===
                            normalizeStatus(
                                statusFilter
                            );

                    return (
                        matchesSearch &&
                        matchesStatus
                    );
                }
            );

        }, [
            rectifications,
            searchEmployee,
            statusFilter,
        ]);

    // ========================================================
    // STATUS BADGE
    // ========================================================

    const getStatusBadge = (
        status
    ) => {

        const normalized =
            normalizeStatus(status);

        let className =
            "bg-slate-100 text-slate-600";

        let label =
            status || "Unknown";

        if (
            normalized === "pending"
        ) {

            className =
                "bg-amber-50 text-amber-700";

            label =
                "Pending";

        } else if (
            normalized === "approved"
        ) {

            className =
                "bg-emerald-50 text-emerald-700";

            label =
                "Approved";

        } else if (
            normalized === "rejected"
        ) {

            className =
                "bg-red-50 text-red-600";

            label =
                "Rejected";
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
                        Loading rectification requests...
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
                        Please login again to view attendance rectifications.
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

                                <AlertCircle
                                    size={25}
                                    strokeWidth={2}
                                    className="text-indigo-600"
                                />

                                <h1 className="text-[30px] font-bold leading-none text-slate-900">
                                    Attendance Rectifications
                                </h1>

                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                Review employee attendance correction requests.
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

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

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
                                    className="h-[43px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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

                        </div>

                    </div>

                    {/* ==================================================
                        SUMMARY CARDS
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
                                        All rectification requests
                                    </p>

                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">

                                    <AlertCircle
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
                                        Awaiting client review
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
                                        Approved requests
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
                                        Rejected requests
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
                        MAIN CARD
                    ================================================== */}

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                        {/* ==================================================
                            TABLE
                        ================================================== */}

                        {loading ? (

                            <div className="flex min-h-[400px] items-center justify-center">

                                <div className="flex flex-col items-center gap-3">

                                    <RefreshCw
                                        size={26}
                                        className="animate-spin text-indigo-600"
                                    />

                                    <p className="text-sm text-slate-500">
                                        Loading rectification requests...
                                    </p>

                                </div>

                            </div>

                        ) : filteredRectifications.length === 0 ? (

                            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">

                                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">

                                    <CalendarDays
                                        size={27}
                                        className="text-slate-400"
                                    />

                                </div>

                                <h3 className="text-base font-bold text-slate-900">
                                    No rectification requests
                                </h3>

                                <p className="mt-2 text-sm text-slate-500">

                                    {searchEmployee ||
                                    statusFilter !==
                                        "all"
                                        ? "No requests match your current filters."
                                        : "There are no attendance rectification requests yet."}

                                </p>

                            </div>

                        ) : (

                            <div className="overflow-x-auto">

                                <table className="w-full min-w-[1250px]">

                                    <thead>

                                        <tr className="border-b border-slate-200 bg-slate-50">

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Employee
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Attendance Date
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Original
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Requested
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

                                        {filteredRectifications.map(
                                            (
                                                record,
                                                index
                                            ) => {

                                                const requestId =
                                                    record?.id;

                                                const status =
                                                    getRequestStatus(
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

                                                        {/* Date */}

                                                        <td className="px-6 py-5">

                                                            <p className="text-sm font-medium text-slate-700">
                                                                {formatDateForDisplay(
                                                                    getAttendanceDate(
                                                                        record
                                                                    )
                                                                )}
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {formatDateLong(
                                                                    getAttendanceDate(
                                                                        record
                                                                    )
                                                                )}
                                                            </p>

                                                        </td>

                                                        {/* Original */}

                                                        <td className="px-6 py-5">

                                                            <div className="space-y-1">

                                                                <p className="text-xs text-slate-500">
                                                                    In:{" "}
                                                                    <span className="font-semibold text-slate-700">
                                                                        {formatTime(
                                                                            getOriginalCheckIn(
                                                                                record
                                                                            )
                                                                        )}
                                                                    </span>
                                                                </p>

                                                                <p className="text-xs text-slate-500">
                                                                    Out:{" "}
                                                                    <span className="font-semibold text-slate-700">
                                                                        {formatTime(
                                                                            getOriginalCheckOut(
                                                                                record
                                                                            )
                                                                        )}
                                                                    </span>
                                                                </p>

                                                            </div>

                                                        </td>

                                                        {/* Requested */}

                                                        <td className="px-6 py-5">

                                                            <div className="space-y-1">

                                                                <p className="text-xs text-slate-500">
                                                                    In:{" "}
                                                                    <span className="font-semibold text-indigo-700">
                                                                        {formatTime(
                                                                            getRequestedCheckIn(
                                                                                record
                                                                            )
                                                                        )}
                                                                    </span>
                                                                </p>

                                                                <p className="text-xs text-slate-500">
                                                                    Out:{" "}
                                                                    <span className="font-semibold text-indigo-700">
                                                                        {formatTime(
                                                                            getRequestedCheckOut(
                                                                                record
                                                                            )
                                                                        )}
                                                                    </span>
                                                                </p>

                                                            </div>

                                                        </td>

                                                        {/* Reason */}

                                                        <td className="max-w-[260px] px-6 py-5">

                                                            <p className="text-sm leading-5 text-slate-600">
                                                                {getReason(
                                                                    record
                                                                )}
                                                            </p>

                                                            {record?.created_at && (
                                                                <p className="mt-2 text-xs text-slate-400">
                                                                    Submitted{" "}
                                                                    {formatDateTime(
                                                                        record.created_at
                                                                    )}
                                                                </p>
                                                            )}

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

export default AttendanceRectifications;