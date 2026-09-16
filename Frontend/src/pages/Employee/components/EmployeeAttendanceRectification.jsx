import React, {
useEffect,
useMemo,
useState,
} from "react";

import {
AlertCircle,
CalendarDays,
CheckCircle2,
Clock,
FileEdit,
RefreshCw,
Search,
Send,
UserCheck,
X,
XCircle,
} from "lucide-react";
import Sidebar from "../../Employee/components/EmployeeSidebar";
import api from "../../services/api";
import { useAuth } from "../../../auth/AuthProvider";

// ============================================================
// EMPLOYEE ATTENDANCE RECTIFICATION
//
// API:
//   GET  /api/employee/attendance/rectifications
//   POST /api/employee/attendance/:id/rectify
//
// Employee can:
//   - View own attendance
//   - Submit rectification
//   - View Pending / Approved / Rejected requests
//
// Employee CANNOT:
//   - Approve
//   - Reject
//   - Directly edit attendance
// ============================================================

const EmployeeAttendanceRectification = () => {
const { user } = useAuth();


// ========================================================
// STATE
// ========================================================

const [attendance, setAttendance] =
    useState([]);

const [requests, setRequests] =
    useState([]);

const [loading, setLoading] =
    useState(true);

const [refreshing, setRefreshing] =
    useState(false);

const [submitting, setSubmitting] =
    useState(false);

const [error, setError] =
    useState("");

const [search, setSearch] =
    useState("");

const [statusFilter, setStatusFilter] =
    useState("All");

const [showModal, setShowModal] =
    useState(false);

const [selectedAttendance, setSelectedAttendance] =
    useState(null);

const [form, setForm] =
    useState({
        requested_check_in: "",
        requested_check_out: "",
        reason: "",
    });


// ========================================================
// DATE FORMAT
// ========================================================

const formatDate = (value) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
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


// ========================================================
// TIME FORMAT
// ========================================================

const formatTime = (value) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return date.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit",
        }
    );
};


// ========================================================
// STATUS NORMALIZATION
// ========================================================

const normalizeStatus = (value) => {
    return String(
        value || ""
    )
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
};


// ========================================================
// STATUS LABEL
// ========================================================

const getStatusLabel = (status) => {
    const normalized =
        normalizeStatus(status);

    if (
        normalized ===
        "pending"
    ) {
        return "Pending";
    }

    if (
        normalized ===
        "approved"
    ) {
        return "Approved";
    }

    if (
        normalized ===
        "rejected"
    ) {
        return "Rejected";
    }

    return status || "Unknown";
};


// ========================================================
// STATUS STYLE
// ========================================================

const getStatusClass = (status) => {
    const normalized =
        normalizeStatus(status);

    if (
        normalized ===
        "approved"
    ) {
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (
        normalized ===
        "rejected"
    ) {
        return "bg-red-50 text-red-700 border-red-200";
    }

    if (
        normalized ===
        "pending"
    ) {
        return "bg-amber-50 text-amber-700 border-amber-200";
    }

    return "bg-slate-50 text-slate-600 border-slate-200";
};


// ========================================================
// FETCH ATTENDANCE
//
// Uses your EXISTING employee attendance API.
//
// GET /api/emp-attendance
//
// Because your server mounts the same router at
// /api/employee, this can also be:
//
// GET /api/employee
//
// We use /emp-attendance here to avoid conflicts.
// ========================================================

const fetchAttendance = async () => {
    try {
        const response =
            await api.get(
                "/emp-attendance"
            );

        const data =
            response?.data;

        if (
            data?.success === false
        ) {
            throw new Error(
                data?.message ||
                "Failed to fetch attendance."
            );
        }

        setAttendance(
            Array.isArray(
                data?.attendance
            )
                ? data.attendance
                : []
        );
    } catch (err) {
        console.error(
            "EMPLOYEE ATTENDANCE FETCH ERROR:",
            err
        );

        throw err;
    }
};


// ========================================================
// FETCH RECTIFICATION REQUESTS
// ========================================================

const fetchRequests = async () => {
    try {
        const response =
            await api.get(
                "/employee/attendance/rectifications"
            );

        const data =
            response?.data;

        if (
            data?.success === false
        ) {
            throw new Error(
                data?.message ||
                "Failed to fetch rectification requests."
            );
        }

        setRequests(
            Array.isArray(
                data?.requests
            )
                ? data.requests
                : []
        );
    } catch (err) {
        console.error(
            "RECTIFICATION REQUEST FETCH ERROR:",
            err
        );

        throw err;
    }
};


// ========================================================
// LOAD PAGE
// ========================================================

const loadData = async (
    showRefresh = false
) => {
    try {
        if (showRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        await Promise.all([
            fetchAttendance(),
            fetchRequests(),
        ]);
    } catch (err) {
        setError(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load attendance rectification data."
        );
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
};


// ========================================================
// INITIAL LOAD
// ========================================================

useEffect(() => {
    if (user) {
        loadData();
    }
}, [user]);


// ========================================================
// CHECK IF ATTENDANCE ALREADY HAS PENDING REQUEST
// ========================================================

const hasPendingRequest = (
    attendanceId
) => {
    return requests.some(
        (request) =>
            Number(
                request.attendance_id
            ) ===
                Number(
                    attendanceId
                ) &&
            normalizeStatus(
                request.status
            ) === "pending"
    );
};


// ========================================================
// CHECK IF ATTENDANCE HAS ALREADY BEEN RECTIFIED
// ========================================================

const hasApprovedRequest = (
    attendanceId
) => {
    return requests.some(
        (request) =>
            Number(
                request.attendance_id
            ) ===
                Number(
                    attendanceId
                ) &&
            normalizeStatus(
                request.status
            ) === "approved"
    );
};


// ========================================================
// OPEN RECTIFICATION MODAL
// ========================================================

const openRectification = (
    record
) => {
    setSelectedAttendance(
        record
    );

    setForm({
        requested_check_in:
            record?.check_in
                ? toDateTimeLocal(
                      record.check_in
                  )
                : "",

        requested_check_out:
            record?.check_out
                ? toDateTimeLocal(
                      record.check_out
                  )
                : "",

        reason: "",
    });

    setError("");
    setShowModal(true);
};


// ========================================================
// CLOSE MODAL
// ========================================================

const closeModal = () => {
    if (submitting) {
        return;
    }

    setShowModal(false);
    setSelectedAttendance(
        null
    );

    setForm({
        requested_check_in: "",
        requested_check_out: "",
        reason: "",
    });
};


// ========================================================
// CONVERT ISO DATE TO DATETIME-LOCAL
// ========================================================

const toDateTimeLocal = (
    value
) => {
    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

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

    const hours =
        String(
            date.getHours()
        ).padStart(2, "0");

    const minutes =
        String(
            date.getMinutes()
        ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
};


// ========================================================
// SUBMIT RECTIFICATION
// ========================================================

const submitRectification =
    async (event) => {
        event.preventDefault();

        if (
            !selectedAttendance?.id
        ) {
            return;
        }

        if (
            !form.reason.trim()
        ) {
            setError(
                "Please enter a reason for the correction."
            );

            return;
        }

        if (
            form.requested_check_in &&
            form.requested_check_out
        ) {
            const checkIn =
                new Date(
                    form.requested_check_in
                );

            const checkOut =
                new Date(
                    form.requested_check_out
                );

            if (
                checkOut <=
                checkIn
            ) {
                setError(
                    "Requested check-out must be after requested check-in."
                );

                return;
            }
        }

        try {
            setSubmitting(true);
            setError("");

            const payload = {
                requested_check_in:
                    form.requested_check_in
                        ? new Date(
                              form.requested_check_in
                          ).toISOString()
                        : null,

                requested_check_out:
                    form.requested_check_out
                        ? new Date(
                              form.requested_check_out
                          ).toISOString()
                        : null,

                reason:
                    form.reason.trim(),
            };

            const response =
                await api.post(
                    `/employee/attendance/${selectedAttendance.id}/rectify`,
                    payload
                );

            const data =
                response?.data;

            if (
                data?.success === false
            ) {
                throw new Error(
                    data?.message ||
                    "Failed to submit rectification request."
                );
            }

            closeModal();

            await fetchRequests();

            window.alert(
                "Attendance rectification request submitted successfully."
            );
        } catch (err) {
            console.error(
                "RECTIFICATION SUBMIT ERROR:",
                err
            );

            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Failed to submit rectification request."
            );
        } finally {
            setSubmitting(false);
        }
    };


// ========================================================
// FILTER ATTENDANCE
// ========================================================

const filteredAttendance =
    useMemo(() => {
        const searchValue =
            search
                .trim()
                .toLowerCase();

        return attendance.filter(
            (record) => {
                const date =
                    String(
                        record?.attendance_date ||
                        ""
                    ).toLowerCase();

                const status =
                    String(
                        record?.status ||
                        ""
                    ).toLowerCase();

                const remarks =
                    String(
                        record?.remarks ||
                        ""
                    ).toLowerCase();

                if (
                    !searchValue
                ) {
                    return true;
                }

                return (
                    date.includes(
                        searchValue
                    ) ||
                    status.includes(
                        searchValue
                    ) ||
                    remarks.includes(
                        searchValue
                    )
                );
            }
        );
    }, [
        attendance,
        search,
    ]);


// ========================================================
// FILTER REQUESTS
// ========================================================

const filteredRequests =
    useMemo(() => {
        const searchValue =
            search
                .trim()
                .toLowerCase();

        return requests.filter(
            (request) => {
                const requestStatus =
                    getStatusLabel(
                        request?.status
                    );

                if (
                    statusFilter !==
                        "All" &&
                    requestStatus !==
                        statusFilter
                ) {
                    return false;
                }

                if (
                    !searchValue
                ) {
                    return true;
                }

                const reason =
                    String(
                        request?.reason ||
                        ""
                    ).toLowerCase();

                const date =
                    String(
                        request
                            ?.attendance
                            ?.attendance_date ||
                        ""
                    ).toLowerCase();

                return (
                    reason.includes(
                        searchValue
                    ) ||
                    date.includes(
                        searchValue
                    ) ||
                    requestStatus
                        .toLowerCase()
                        .includes(
                            searchValue
                        )
                );
            }
        );
    }, [
        requests,
        search,
        statusFilter,
    ]);


// ========================================================
// SUMMARY
// ========================================================

const summary = useMemo(() => {
    const pending =
        requests.filter(
            (request) =>
                normalizeStatus(
                    request.status
                ) === "pending"
        ).length;

    const approved =
        requests.filter(
            (request) =>
                normalizeStatus(
                    request.status
                ) === "approved"
        ).length;

    const rejected =
        requests.filter(
            (request) =>
                normalizeStatus(
                    request.status
                ) === "rejected"
        ).length;

    const missingPunches =
        attendance.filter(
            (record) =>
                record?.check_in &&
                !record?.check_out
        ).length;

    return {
        pending,
        approved,
        rejected,
        missingPunches,
    };
}, [
    requests,
    attendance,
]);


// ========================================================
// RENDER
// ========================================================

return (
    <div className="min-h-screen bg-slate-50">
        <Sidebar
            activeTab="attendance-rectification"
        />

        <main className="ml-64 p-8">

            {/* ================================================= */}
            {/* HEADER */}
            {/* ================================================= */}

            <div className="flex items-start justify-between mb-8">

                <div>
                    <div className="flex items-center gap-3">

                        <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
                            <FileEdit
                                size={22}
                                className="text-indigo-600"
                            />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Attendance Rectification
                            </h1>

                            <p className="text-sm text-slate-500 mt-1">
                                Request corrections for incorrect or incomplete attendance.
                            </p>
                        </div>

                    </div>
                </div>


                <button
                    type="button"
                    onClick={() =>
                        loadData(true)
                    }
                    disabled={
                        refreshing
                    }
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
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


            {/* ================================================= */}
            {/* ERROR */}
            {/* ================================================= */}

            {error && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">

                    <AlertCircle
                        size={19}
                        className="mt-0.5 shrink-0"
                    />

                    <div className="text-sm">
                        {error}
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            setError("")
                        }
                        className="ml-auto"
                    >
                        <X
                            size={17}
                        />
                    </button>

                </div>
            )}


            {/* ================================================= */}
            {/* SUMMARY CARDS */}
            {/* ================================================= */}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">

                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-sm text-slate-500">
                                Pending
                            </p>

                            <p className="text-2xl font-bold text-slate-900 mt-1">
                                {summary.pending}
                            </p>
                        </div>

                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                            <Clock
                                size={20}
                                className="text-amber-600"
                            />
                        </div>

                    </div>
                </div>


                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-sm text-slate-500">
                                Approved
                            </p>

                            <p className="text-2xl font-bold text-slate-900 mt-1">
                                {summary.approved}
                            </p>
                        </div>

                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2
                                size={20}
                                className="text-emerald-600"
                            />
                        </div>

                    </div>
                </div>


                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-sm text-slate-500">
                                Rejected
                            </p>

                            <p className="text-2xl font-bold text-slate-900 mt-1">
                                {summary.rejected}
                            </p>
                        </div>

                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                            <XCircle
                                size={20}
                                className="text-red-600"
                            />
                        </div>

                    </div>
                </div>


                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between">

                        <div>
                            <p className="text-sm text-slate-500">
                                Missing Punches
                            </p>

                            <p className="text-2xl font-bold text-slate-900 mt-1">
                                {summary.missingPunches}
                            </p>
                        </div>

                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <UserCheck
                                size={20}
                                className="text-indigo-600"
                            />
                        </div>

                    </div>
                </div>

            </div>


            {/* ================================================= */}
            {/* SEARCH + FILTER */}
            {/* ================================================= */}

            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6">

                <div className="flex flex-col lg:flex-row gap-4">

                    <div className="relative flex-1">

                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            type="text"
                            value={search}
                            onChange={(event) =>
                                setSearch(
                                    event.target.value
                                )
                            }
                            placeholder="Search by date, status or reason..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                    </div>


                    <select
                        value={
                            statusFilter
                        }
                        onChange={(
                            event
                        ) =>
                            setStatusFilter(
                                event.target.value
                            )
                        }
                        className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="All">
                            All Requests
                        </option>

                        <option value="Pending">
                            Pending
                        </option>

                        <option value="Approved">
                            Approved
                        </option>

                        <option value="Rejected">
                            Rejected
                        </option>
                    </select>

                </div>

            </div>


            {/* ================================================= */}
            {/* ATTENDANCE RECORDS */}
            {/* ================================================= */}

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">

                <div className="px-6 py-5 border-b border-slate-200">

                    <div className="flex items-center gap-2">

                        <CalendarDays
                            size={19}
                            className="text-indigo-600"
                        />

                        <h2 className="font-semibold text-slate-900">
                            My Attendance
                        </h2>

                    </div>

                    <p className="text-sm text-slate-500 mt-1">
                        Select an attendance record to request a correction.
                    </p>

                </div>


                {loading ? (
                    <div className="py-16 text-center text-slate-500">
                        Loading attendance...
                    </div>
                ) : filteredAttendance.length === 0 ? (

                    <div className="py-16 text-center">

                        <CalendarDays
                            size={36}
                            className="mx-auto text-slate-300"
                        />

                        <p className="mt-3 text-slate-500">
                            No attendance records found.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                            <thead className="bg-slate-50 border-b border-slate-200">

                                <tr>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Date
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Check In
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Check Out
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Hours
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Status
                                    </th>

                                    <th className="text-right px-6 py-4 font-semibold text-slate-600">
                                        Action
                                    </th>

                                </tr>

                            </thead>


                            <tbody className="divide-y divide-slate-100">

                                {filteredAttendance.map(
                                    (
                                        record
                                    ) => {

                                        const pending =
                                            hasPendingRequest(
                                                record.id
                                            );

                                        const approved =
                                            hasApprovedRequest(
                                                record.id
                                            );

                                        const missingPunch =
                                            record?.check_in &&
                                            !record?.check_out;

                                        return (
                                            <tr
                                                key={
                                                    record.id
                                                }
                                                className="hover:bg-slate-50"
                                            >

                                                <td className="px-6 py-4">

                                                    <div className="font-medium text-slate-900">
                                                        {formatDate(
                                                            record.attendance_date
                                                        )}
                                                    </div>

                                                </td>


                                                <td className="px-6 py-4 text-slate-600">

                                                    <div className="flex items-center gap-2">

                                                        <Clock
                                                            size={15}
                                                            className="text-slate-400"
                                                        />

                                                        {formatTime(
                                                            record.check_in
                                                        )}

                                                    </div>

                                                </td>


                                                <td className="px-6 py-4 text-slate-600">

                                                    {missingPunch ? (
                                                        <span className="text-amber-600 font-medium">
                                                            Missing
                                                        </span>
                                                    ) : (
                                                        formatTime(
                                                            record.check_out
                                                        )
                                                    )}

                                                </td>


                                                <td className="px-6 py-4 text-slate-600">

                                                    {Number(
                                                        record.working_hours ||
                                                        0
                                                    ).toFixed(
                                                        2
                                                    )}{" "}
                                                    hrs

                                                </td>


                                                <td className="px-6 py-4">

                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusClass(
                                                        record.status
                                                    )}`}>

                                                        {record.status ||
                                                            "—"}

                                                    </span>

                                                </td>


                                                <td className="px-6 py-4 text-right">

                                                    {pending ? (

                                                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">

                                                            <Clock
                                                                size={14}
                                                            />

                                                            Pending

                                                        </span>

                                                    ) : approved ? (

                                                        <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">

                                                            <CheckCircle2
                                                                size={14}
                                                            />

                                                            Rectified

                                                        </span>

                                                    ) : (

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openRectification(
                                                                    record
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                                                        >

                                                            <FileEdit
                                                                size={14}
                                                            />

                                                            Request Correction

                                                        </button>

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


            {/* ================================================= */}
            {/* REQUEST HISTORY */}
            {/* ================================================= */}

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

                <div className="px-6 py-5 border-b border-slate-200">

                    <div className="flex items-center gap-2">

                        <Send
                            size={19}
                            className="text-indigo-600"
                        />

                        <h2 className="font-semibold text-slate-900">
                            Rectification Requests
                        </h2>

                    </div>

                    <p className="text-sm text-slate-500 mt-1">
                        Track the correction requests submitted to your client.
                    </p>

                </div>


                {filteredRequests.length === 0 ? (

                    <div className="py-14 text-center">

                        <FileEdit
                            size={35}
                            className="mx-auto text-slate-300"
                        />

                        <p className="mt-3 text-slate-500">
                            No rectification requests found.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                            <thead className="bg-slate-50 border-b border-slate-200">

                                <tr>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Attendance Date
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Original
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Requested
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Reason
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Status
                                    </th>

                                    <th className="text-left px-6 py-4 font-semibold text-slate-600">
                                        Submitted
                                    </th>

                                </tr>

                            </thead>


                            <tbody className="divide-y divide-slate-100">

                                {filteredRequests.map(
                                    (
                                        request
                                    ) => {

                                        const original =
                                            request?.attendance;

                                        return (
                                            <tr
                                                key={
                                                    request.id
                                                }
                                                className="hover:bg-slate-50"
                                            >

                                                <td className="px-6 py-4 font-medium text-slate-900">

                                                    {formatDate(
                                                        original?.attendance_date
                                                    )}

                                                </td>


                                                <td className="px-6 py-4 text-slate-600">

                                                    <div>
                                                        In:{" "}
                                                        {formatTime(
                                                            original?.check_in
                                                        )}
                                                    </div>

                                                    <div>
                                                        Out:{" "}
                                                        {formatTime(
                                                            original?.check_out
                                                        )}
                                                    </div>

                                                </td>


                                                <td className="px-6 py-4 text-slate-600">

                                                    <div>
                                                        In:{" "}
                                                        {formatTime(
                                                            request.requested_check_in
                                                        )}
                                                    </div>

                                                    <div>
                                                        Out:{" "}
                                                        {formatTime(
                                                            request.requested_check_out
                                                        )}
                                                    </div>

                                                </td>


                                                <td className="px-6 py-4 max-w-xs">

                                                    <p className="text-slate-600 truncate">
                                                        {request.reason ||
                                                            "—"}
                                                    </p>

                                                </td>


                                                <td className="px-6 py-4">

                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusClass(
                                                        request.status
                                                    )}`}>

                                                        {getStatusLabel(
                                                            request.status
                                                        )}

                                                    </span>

                                                </td>


                                                <td className="px-6 py-4 text-slate-500">

                                                    {formatDate(
                                                        request.created_at
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

        </main>


        {/* =================================================== */}
        {/* RECTIFICATION MODAL */}
        {/* =================================================== */}

        {showModal &&
            selectedAttendance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

                    <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl">

                        {/* HEADER */}

                        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">

                            <div>

                                <h2 className="text-lg font-semibold text-slate-900">
                                    Request Attendance Correction
                                </h2>

                                <p className="text-sm text-slate-500 mt-1">
                                    {formatDate(
                                        selectedAttendance.attendance_date
                                    )}
                                </p>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    closeModal
                                }
                                disabled={
                                    submitting
                                }
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                            >
                                <X
                                    size={19}
                                />
                            </button>

                        </div>


                        <form
                            onSubmit={
                                submitRectification
                            }
                        >

                            <div className="p-6 space-y-5">

                                {/* CURRENT ATTENDANCE */}

                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">

                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                                        Current Attendance
                                    </p>

                                    <div className="grid grid-cols-2 gap-4">

                                        <div>

                                            <p className="text-xs text-slate-500">
                                                Check In
                                            </p>

                                            <p className="font-medium text-slate-800 mt-1">
                                                {formatTime(
                                                    selectedAttendance.check_in
                                                )}
                                            </p>

                                        </div>


                                        <div>

                                            <p className="text-xs text-slate-500">
                                                Check Out
                                            </p>

                                            <p className="font-medium text-slate-800 mt-1">
                                                {formatTime(
                                                    selectedAttendance.check_out
                                                )}
                                            </p>

                                        </div>

                                    </div>

                                </div>


                                {/* REQUESTED CHECK IN */}

                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Requested Check In
                                    </label>

                                    <input
                                        type="datetime-local"
                                        value={
                                            form.requested_check_in
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setForm(
                                                (
                                                    previous
                                                ) => ({
                                                    ...previous,
                                                    requested_check_in:
                                                        event
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    />

                                </div>


                                {/* REQUESTED CHECK OUT */}

                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Requested Check Out
                                    </label>

                                    <input
                                        type="datetime-local"
                                        value={
                                            form.requested_check_out
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setForm(
                                                (
                                                    previous
                                                ) => ({
                                                    ...previous,
                                                    requested_check_out:
                                                        event
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                    />

                                </div>


                                {/* REASON */}

                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Reason
                                        <span className="text-red-500">
                                            {" "}*
                                        </span>
                                    </label>

                                    <textarea
                                        value={
                                            form.reason
                                        }
                                        onChange={(
                                            event
                                        ) =>
                                            setForm(
                                                (
                                                    previous
                                                ) => ({
                                                    ...previous,
                                                    reason:
                                                        event
                                                            .target
                                                            .value,
                                                })
                                            )
                                        }
                                        rows={4}
                                        placeholder="Explain why your attendance needs to be corrected..."
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-indigo-500"
                                    />

                                </div>


                                {/* INFO */}

                                <div className="flex items-start gap-3 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">

                                    <AlertCircle
                                        size={18}
                                        className="text-indigo-600 mt-0.5 shrink-0"
                                    />

                                    <p className="text-xs leading-5 text-indigo-700">
                                        Your request will be sent to the client for review. Your attendance will only be changed after the client approves the request.
                                    </p>

                                </div>

                            </div>


                            {/* FOOTER */}

                            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">

                                <button
                                    type="button"
                                    onClick={
                                        closeModal
                                    }
                                    disabled={
                                        submitting
                                    }
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>


                                <button
                                    type="submit"
                                    disabled={
                                        submitting
                                    }
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                >

                                    {submitting ? (
                                        <>
                                            <RefreshCw
                                                size={15}
                                                className="animate-spin"
                                            />

                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send
                                                size={15}
                                            />

                                            Submit Request
                                        </>
                                    )}

                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

    </div>
);
}
export default EmployeeAttendanceRectification;
