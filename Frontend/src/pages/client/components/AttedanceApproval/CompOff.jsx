import React, { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    CalendarDays,
    Clock,
    RefreshCw,
    Search,
    X,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import api from "../../services/api";
import { useAuth } from "../../../auth/AuthProvider";


// =====================================================
// HELPERS
// =====================================================

const getArray = (response) => {
    const data = response?.data;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.compoff)) return data.compoff;
    if (Array.isArray(data?.rows)) return data.rows;

    return [];
};

const getErrorMessage = (error, fallback) => {
    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        fallback
    );
};


// =====================================================
// COMPONENT
// =====================================================

export default function CompOff() {
    const { user } = useAuth();

    const [records, setRecords] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");


    // =====================================================
    // FETCH
    // =====================================================

    const fetchCompOff = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const response = await api.get(
                "/client/compoff"
            );

            setRecords(getArray(response));
        } catch (err) {
            console.error("FETCH COMPOFF ERROR:", err);

            setError(
                getErrorMessage(
                    err,
                    "Unable to load comp-off records."
                )
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    useEffect(() => {
        fetchCompOff();
    }, []);


    // =====================================================
    // FILTER
    // =====================================================

    const filteredRecords = useMemo(() => {
        const value = search.trim().toLowerCase();

        return records.filter((item) => {

            const status =
                item.status || "Available";

            if (
                statusFilter !== "All" &&
                status !== statusFilter
            ) {
                return false;
            }

            if (!value) return true;

            const employee =
                item.employee_name ||
                item.employeeName ||
                item.name ||
                "";

            const source =
                item.source_type ||
                item.sourceType ||
                "";

            return (
                String(employee)
                    .toLowerCase()
                    .includes(value) ||
                String(source)
                    .toLowerCase()
                    .includes(value)
            );
        });
    }, [records, search, statusFilter]);


    // =====================================================
    // COUNTS
    // =====================================================

    const availableCount = records.filter(
        (item) => (item.status || "Available") === "Available"
    ).length;

    const redeemedCount = records.filter(
        (item) => item.status === "Redeemed"
    ).length;

    const totalHours = records.reduce(
        (sum, item) =>
            sum + Number(item.hours || 0),
        0
    );


    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar activeTab="compoff" />

            <main className="flex-1 p-6 lg:p-8">

                {/* HEADER */}
                <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div className="flex items-center gap-3">

                        <div className="rounded-xl bg-indigo-100 p-3">
                            <Clock
                                size={22}
                                className="text-indigo-600"
                            />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Comp-Off
                            </h1>

                            <p className="text-sm text-slate-500">
                                View automatically generated compensatory off records
                            </p>
                        </div>

                    </div>


                    <button
                        onClick={() => fetchCompOff(true)}
                        disabled={refreshing}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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


                {/* ERROR */}
                {error && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                        <AlertCircle
                            size={18}
                            className="mt-0.5 shrink-0"
                        />

                        <span>{error}</span>

                        <button
                            className="ml-auto"
                            onClick={() => setError("")}
                        >
                            <X size={16} />
                        </button>

                    </div>
                )}


                {/* SUMMARY */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">
                            Available
                        </p>

                        <p className="mt-2 text-2xl font-bold text-emerald-600">
                            {availableCount}
                        </p>
                    </div>


                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">
                            Redeemed
                        </p>

                        <p className="mt-2 text-2xl font-bold text-indigo-600">
                            {redeemedCount}
                        </p>
                    </div>


                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <p className="text-sm text-slate-500">
                            Total Comp-Off Hours
                        </p>

                        <p className="mt-2 text-2xl font-bold text-slate-900">
                            {totalHours.toFixed(2)}
                        </p>
                    </div>

                </div>


                {/* FILTERS */}
                <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">

                        <div className="relative">

                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                value={search}
                                onChange={(e) =>
                                    setSearch(e.target.value)
                                }
                                placeholder="Search employee or source..."
                                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
                            />

                        </div>


                        <select
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(e.target.value)
                            }
                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                        >
                            <option value="All">
                                All Status
                            </option>

                            <option value="Available">
                                Available
                            </option>

                            <option value="Redeemed">
                                Redeemed
                            </option>

                            <option value="Expired">
                                Expired
                            </option>
                        </select>

                    </div>

                </div>


                {/* TABLE */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

                    {loading ? (
                        <div className="p-10 text-center text-sm text-slate-500">
                            Loading comp-off records...
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-10 text-center">

                            <Clock
                                size={36}
                                className="mx-auto text-slate-300"
                            />

                            <p className="mt-3 font-medium text-slate-700">
                                No comp-off records found
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                Eligible holiday or weekly-off work will appear here automatically.
                            </p>

                        </div>
                    ) : (
                        <div className="overflow-x-auto">

                            <table className="w-full text-left text-sm">

                                <thead className="border-b border-slate-200 bg-slate-50">

                                    <tr>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Employee
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Earned Date
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Source
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Hours
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Status
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Expiry
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Redeemed Date
                                        </th>

                                    </tr>

                                </thead>


                                <tbody className="divide-y divide-slate-100">

                                    {filteredRecords.map((item) => {

                                        const status =
                                            item.status ||
                                            "Available";

                                        return (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-slate-50"
                                            >

                                                <td className="px-5 py-4">

                                                    <div className="font-semibold text-slate-800">
                                                        {
                                                            item.employee_name ||
                                                            item.employeeName ||
                                                            item.name ||
                                                            `Employee #${item.employee_id}`
                                                        }
                                                    </div>

                                                </td>


                                                <td className="px-5 py-4">

                                                    <div className="flex items-center gap-2 text-slate-600">

                                                        <CalendarDays
                                                            size={15}
                                                            className="text-slate-400"
                                                        />

                                                        {item.earned_date
                                                            ? new Date(
                                                                  item.earned_date
                                                              ).toLocaleDateString(
                                                                  "en-IN"
                                                              )
                                                            : "-"}

                                                    </div>

                                                </td>


                                                <td className="px-5 py-4">

                                                    <span
                                                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                                            (
                                                                item.source_type ||
                                                                ""
                                                            ) ===
                                                            "HOLIDAY"
                                                                ? "bg-amber-50 text-amber-700"
                                                                : "bg-indigo-50 text-indigo-700"
                                                        }`}
                                                    >
                                                        {
                                                            item.source_type ===
                                                            "HOLIDAY"
                                                                ? "Holiday"
                                                                : item.source_type ===
                                                                  "WEEKLY_OFF"
                                                                ? "Weekly Off"
                                                                : item.source_type ||
                                                                  "-"
                                                        }
                                                    </span>

                                                </td>


                                                <td className="px-5 py-4 font-semibold text-slate-800">
                                                    {Number(
                                                        item.hours || 0
                                                    ).toFixed(2)}
                                                </td>


                                                <td className="px-5 py-4">

                                                    <span
                                                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                                            status ===
                                                            "Available"
                                                                ? "bg-emerald-50 text-emerald-700"
                                                                : status ===
                                                                  "Redeemed"
                                                                ? "bg-indigo-50 text-indigo-700"
                                                                : "bg-slate-100 text-slate-600"
                                                        }`}
                                                    >
                                                        {status}
                                                    </span>

                                                </td>


                                                <td className="px-5 py-4 text-slate-600">

                                                    {item.expires_date
                                                        ? new Date(
                                                              item.expires_date
                                                          ).toLocaleDateString(
                                                              "en-IN"
                                                          )
                                                        : "-"}

                                                </td>


                                                <td className="px-5 py-4 text-slate-600">

                                                    {item.redeemed_date
                                                        ? new Date(
                                                              item.redeemed_date
                                                          ).toLocaleDateString(
                                                              "en-IN"
                                                          )
                                                        : "-"}

                                                </td>

                                            </tr>
                                        );
                                    })}

                                </tbody>

                            </table>

                        </div>
                    )}

                </div>

            </main>
        </div>
    );
}