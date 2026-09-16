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
FileText,
Plus,
RefreshCw,
Search,
X,
XCircle,
} from "lucide-react";

import Sidebar from "../../Employee/components/EmployeeSidebar";
import api from "../../services/api";
import { useAuth } from "../../../auth/AuthProvider";

const EmployeeLeave = () => {
const { user } = useAuth();


const [leaves, setLeaves] = useState([]);
const [balances, setBalances] = useState([]);

const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [saving, setSaving] = useState(false);

const [error, setError] = useState("");

const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] =
    useState("All");

const [showModal, setShowModal] =
    useState(false);

const [form, setForm] = useState({
    leave_type: "Casual Leave",
    start_date: "",
    end_date: "",
    reason: "",
});


const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};


const normalizeStatus = (value) => {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");
};


const statusClass = (status) => {
    const normalized =
        normalizeStatus(status);

    if (normalized === "approved") {
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (normalized === "rejected") {
        return "bg-red-50 text-red-700 border-red-200";
    }

    if (normalized === "cancelled") {
        return "bg-slate-50 text-slate-600 border-slate-200";
    }

    return "bg-amber-50 text-amber-700 border-amber-200";
};


const calculateDays = (
    start,
    end
) => {
    if (!start || !end) return 0;

    const startDate =
        new Date(`${start}T00:00:00`);

    const endDate =
        new Date(`${end}T00:00:00`);

    if (
        Number.isNaN(
            startDate.getTime()
        ) ||
        Number.isNaN(
            endDate.getTime()
        )
    ) {
        return 0;
    }

    const difference =
        endDate.getTime() -
        startDate.getTime();

    if (difference < 0) {
        return 0;
    }

    return (
        Math.floor(
            difference /
                (1000 * 60 * 60 * 24)
        ) + 1
    );
};


const fetchLeaves = async () => {
    const response =
        await api.get(
            "/employee/leave"
        );

    const data = response?.data;

    if (data?.success === false) {
        throw new Error(
            data?.message ||
            "Failed to fetch leave applications."
        );
    }

    setLeaves(
        Array.isArray(data?.leaves)
            ? data.leaves
            : Array.isArray(data?.applications)
            ? data.applications
            : []
    );
};


const fetchBalances = async () => {
    const response =
        await api.get(
            "/employee/leave/balance"
        );

    const data = response?.data;

    if (data?.success === false) {
        throw new Error(
            data?.message ||
            "Failed to fetch leave balance."
        );
    }

    setBalances(
        Array.isArray(data?.balances)
            ? data.balances
            : []
    );
};


const loadData = async (
    refresh = false
) => {
    try {
        if (refresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        await Promise.all([
            fetchLeaves(),
            fetchBalances(),
        ]);
    } catch (err) {
        console.error(
            "EMPLOYEE LEAVE LOAD ERROR:",
            err
        );

        setError(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load leave data."
        );
    } finally {
        setLoading(false);
        setRefreshing(false);
    }
};


useEffect(() => {
    if (user) {
        loadData();
    }
}, [user]);


const openModal = () => {
    setForm({
        leave_type: "Casual Leave",
        start_date: "",
        end_date: "",
        reason: "",
    });

    setError("");
    setShowModal(true);
};


const closeModal = () => {
    if (saving) return;

    setShowModal(false);
};


const submitLeave = async (
    event
) => {
    event.preventDefault();

    if (!form.start_date) {
        setError(
            "Please select a start date."
        );
        return;
    }

    if (!form.end_date) {
        setError(
            "Please select an end date."
        );
        return;
    }

    if (
        form.end_date <
        form.start_date
    ) {
        setError(
            "End date cannot be before start date."
        );
        return;
    }

    // Get deployment assigned to the logged-in employee
    const deploymentId =
        sessionStorage.getItem(
            "deployment_id"
        );

    if (!deploymentId) {
        setError(
            "Deployment information not found. Please login again."
        );
        return;
    }

    try {
        setSaving(true);
        setError("");

        console.log(
            "LEAVE SUBMIT DATA:",
            {
                leave_type:
                    form.leave_type,
                start_date:
                    form.start_date,
                end_date:
                    form.end_date,
                reason:
                    form.reason.trim(),
                deployment_id:
                    Number(deploymentId),
            }
        );

        const response =
            await api.post(
                "/employee/leave/apply",
                {
                    leave_type:
                        form.leave_type,
                    start_date:
                        form.start_date,
                    end_date:
                        form.end_date,
                    reason:
                        form.reason.trim(),
                    deployment_id:
                        Number(deploymentId),
                }
            );

        const data =
            response?.data;

        if (
            data?.success === false
        ) {
            throw new Error(
                data?.message ||
                "Failed to apply for leave."
            );
        }

        setShowModal(false);

        await fetchLeaves();

        window.alert(
            "Leave application submitted successfully."
        );
    } catch (err) {
        console.error(
            "LEAVE APPLY ERROR:",
            err?.response?.data || err
        );

        setError(
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            "Failed to submit leave application."
        );
    } finally {
        setSaving(false);
    }
};



const filteredLeaves = useMemo(() => {
    const value =
        search
            .trim()
            .toLowerCase();

    return leaves.filter(
        (leave) => {
            const status =
                String(
                    leave?.status ||
                    ""
                );

            if (
                statusFilter !==
                    "All" &&
                status.toLowerCase() !==
                    statusFilter.toLowerCase()
            ) {
                return false;
            }

            if (!value) {
                return true;
            }

            return (
                String(
                    leave?.leave_type ||
                    ""
                )
                    .toLowerCase()
                    .includes(value) ||
                String(
                    leave?.reason ||
                    ""
                )
                    .toLowerCase()
                    .includes(value) ||
                String(
                    leave?.start_date ||
                    ""
                )
                    .toLowerCase()
                    .includes(value) ||
                String(
                    leave?.end_date ||
                    ""
                )
                    .toLowerCase()
                    .includes(value)
            );
        }
    );
}, [
    leaves,
    search,
    statusFilter,
]);


const summary = useMemo(() => {
    return {
        pending: leaves.filter(
            (item) =>
                normalizeStatus(
                    item.status
                ) === "pending"
        ).length,

        approved: leaves.filter(
            (item) =>
                normalizeStatus(
                    item.status
                ) === "approved"
        ).length,

        rejected: leaves.filter(
            (item) =>
                normalizeStatus(
                    item.status
                ) === "rejected"
        ).length,
    };
}, [leaves]);


return (
    <div className="min-h-screen bg-slate-50">

        <Sidebar activeTab="leave" />

        <main className="ml-64 p-8">

            <div className="flex items-start justify-between mb-8">

                <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <CalendarDays
                            size={22}
                            className="text-indigo-600"
                        />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Leave
                        </h1>

                        <p className="text-sm text-slate-500 mt-1">
                            Apply for leave and track your applications.
                        </p>
                    </div>

                </div>


                <div className="flex gap-3">

                    <button
                        onClick={() =>
                            loadData(true)
                        }
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
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


                    <button
                        onClick={openModal}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                    >
                        <Plus size={17} />

                        Apply Leave
                    </button>

                </div>

            </div>


            {error && (
                <div className="mb-6 flex gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700">

                    <AlertCircle size={18} />

                    <span className="text-sm">
                        {error}
                    </span>

                </div>
            )}


            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-sm text-slate-500">
                        Pending
                    </p>

                    <p className="text-2xl font-bold mt-1">
                        {summary.pending}
                    </p>
                </div>


                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-sm text-slate-500">
                        Approved
                    </p>

                    <p className="text-2xl font-bold mt-1">
                        {summary.approved}
                    </p>
                </div>


                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                    <p className="text-sm text-slate-500">
                        Rejected
                    </p>

                    <p className="text-2xl font-bold mt-1">
                        {summary.rejected}
                    </p>
                </div>

            </div>


            {/* LEAVE BALANCES */}

            <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">

                <h2 className="font-semibold text-slate-900 mb-5">
                    Leave Balance
                </h2>

                {balances.length === 0 ? (

                    <p className="text-sm text-slate-500">
                        No leave balance configured.
                    </p>

                ) : (

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                        {balances.map(
                            (balance) => (
                                <div
                                    key={
                                        balance.id ||
                                        balance.leave_type
                                    }
                                    className="border border-slate-200 rounded-xl p-4"
                                >

                                    <p className="text-sm text-slate-500">
                                        {balance.leave_type}
                                    </p>

                                    <p className="text-2xl font-bold text-slate-900 mt-1">
                                        {balance.balance}
                                    </p>

                                    <p className="text-xs text-slate-400 mt-1">
                                        Available
                                    </p>

                                </div>
                            )
                        )}

                    </div>

                )}

            </div>


            {/* SEARCH */}

            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6">

                <div className="flex gap-4">

                    <div className="relative flex-1">

                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                            placeholder="Search leave applications..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                    </div>


                    <select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(
                                e.target.value
                            )
                        }
                        className="px-4 py-2.5 border border-slate-200 rounded-xl bg-white"
                    >
                        <option value="All">
                            All
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


            {/* APPLICATIONS */}

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

                <div className="px-6 py-5 border-b border-slate-200">

                    <h2 className="font-semibold text-slate-900">
                        My Leave Applications
                    </h2>

                </div>


                {loading ? (

                    <div className="py-16 text-center text-slate-500">
                        Loading leave applications...
                    </div>

                ) : filteredLeaves.length === 0 ? (

                    <div className="py-16 text-center text-slate-500">
                        No leave applications found.
                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                            <thead className="bg-slate-50 border-b">

                                <tr>

                                    <th className="text-left px-6 py-4">
                                        Leave Type
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Dates
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Days
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Reason
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Status
                                    </th>

                                </tr>

                            </thead>


                            <tbody className="divide-y">

                                {filteredLeaves.map(
                                    (leave) => (
                                        <tr
                                            key={
                                                leave.id
                                            }
                                            className="hover:bg-slate-50"
                                        >

                                            <td className="px-6 py-4 font-medium">
                                                {leave.leave_type}
                                            </td>

                                            <td className="px-6 py-4">

                                                {formatDate(
                                                    leave.start_date
                                                )}

                                                {" → "}

                                                {formatDate(
                                                    leave.end_date
                                                )}

                                            </td>

                                            <td className="px-6 py-4">
                                                {calculateDays(
                                                    leave.start_date,
                                                    leave.end_date
                                                )}
                                            </td>

                                            <td className="px-6 py-4 max-w-xs truncate">
                                                {leave.reason ||
                                                    "—"}
                                            </td>

                                            <td className="px-6 py-4">

                                                <span
                                                    className={`px-2.5 py-1 rounded-full border text-xs font-medium ${statusClass(
                                                        leave.status
                                                    )}`}
                                                >
                                                    {leave.status ||
                                                        "Pending"}
                                                </span>

                                            </td>

                                        </tr>
                                    )
                                )}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>

        </main>


        {/* MODAL */}

        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

                <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl">

                    <div className="flex items-center justify-between px-6 py-5 border-b">

                        <div>
                            <h2 className="font-semibold text-lg">
                                Apply for Leave
                            </h2>

                            <p className="text-sm text-slate-500 mt-1">
                                Your request will be sent to the client.
                            </p>
                        </div>

                        <button
                            onClick={closeModal}
                            disabled={saving}
                            className="p-2 hover:bg-slate-100 rounded-lg"
                        >
                            <X size={18} />
                        </button>

                    </div>


                    <form onSubmit={submitLeave}>

                        <div className="p-6 space-y-5">

                            <div>

                                <label className="block text-sm font-medium mb-2">
                                    Leave Type
                                </label>

                                <select
                                    value={
                                        form.leave_type
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            (prev) => ({
                                                ...prev,
                                                leave_type:
                                                    e.target.value,
                                            })
                                        )
                                    }
                                    className="w-full px-4 py-2.5 border rounded-xl"
                                >
                                    <option>
                                        Casual Leave
                                    </option>

                                    <option>
                                        Sick Leave
                                    </option>

                                    <option>
                                        Earned Leave
                                    </option>

                                    <option>
                                        Privilege Leave
                                    </option>

                                    <option>
                                        Other
                                    </option>
                                </select>

                            </div>


                            <div className="grid grid-cols-2 gap-4">

                                <div>

                                    <label className="block text-sm font-medium mb-2">
                                        Start Date
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            form.start_date
                                        }
                                        onChange={(e) =>
                                            setForm(
                                                (prev) => ({
                                                    ...prev,
                                                    start_date:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 border rounded-xl"
                                    />

                                </div>


                                <div>

                                    <label className="block text-sm font-medium mb-2">
                                        End Date
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            form.end_date
                                        }
                                        onChange={(e) =>
                                            setForm(
                                                (prev) => ({
                                                    ...prev,
                                                    end_date:
                                                        e.target.value,
                                                })
                                            )
                                        }
                                        className="w-full px-4 py-2.5 border rounded-xl"
                                    />

                                </div>

                            </div>


                            <div>

                                <label className="block text-sm font-medium mb-2">
                                    Reason
                                </label>

                                <textarea
                                    rows={4}
                                    value={
                                        form.reason
                                    }
                                    onChange={(e) =>
                                        setForm(
                                            (prev) => ({
                                                ...prev,
                                                reason:
                                                    e.target.value,
                                            })
                                        )
                                    }
                                    placeholder="Enter reason..."
                                    className="w-full px-4 py-3 border rounded-xl resize-none"
                                />

                            </div>

                        </div>


                        <div className="flex justify-end gap-3 px-6 py-4 border-t">

                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={saving}
                                className="px-4 py-2.5 border rounded-xl"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl"
                            >
                                {saving
                                    ? "Submitting..."
                                    : "Submit Leave"}
                            </button>

                        </div>

                    </form>

                </div>

            </div>
        )}

    </div>
);


};

export default EmployeeLeave;
