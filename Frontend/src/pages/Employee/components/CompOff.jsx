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
Gift,
RefreshCw,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import api from "../../api/api";
import { useAuth } from "../../auth/AuthProvider";

const CompOff = () => {
const { user } = useAuth();


const [compoffs, setCompoffs] =
    useState([]);

const [loading, setLoading] =
    useState(true);

const [refreshing, setRefreshing] =
    useState(false);

const [redeeming, setRedeeming] =
    useState(null);

const [error, setError] =
    useState("");


const formatDate = (value) => {
    if (!value) return "—";

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


const normalizeStatus = (value) => {
    return String(value || "")
        .trim()
        .toLowerCase();
};


const fetchCompOff = async () => {
    const response =
        await api.get(
            "/employee/compoff"
        );

    const data =
        response?.data;

    if (data?.success === false) {
        throw new Error(
            data?.message ||
            "Failed to fetch comp-off."
        );
    }

    setCompoffs(
        Array.isArray(
            data?.compoffs
        )
            ? data.compoffs
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

        await fetchCompOff();
    } catch (err) {
        console.error(
            "EMPLOYEE COMPOFF ERROR:",
            err
        );

        setError(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load comp-off."
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


const available = useMemo(
    () =>
        compoffs.filter(
            (item) =>
                normalizeStatus(
                    item.status
                ) === "available"
        ),
    [compoffs]
);


const redeemed = useMemo(
    () =>
        compoffs.filter(
            (item) =>
                normalizeStatus(
                    item.status
                ) === "redeemed"
        ),
    [compoffs]
);


const availableHours =
    available.reduce(
        (sum, item) =>
            sum +
            Number(
                item.hours || 0
            ),
        0
    );


const redeemCompOff = async (
    id
) => {
    const confirmed =
        window.confirm(
            "Are you sure you want to redeem this comp-off?"
        );

    if (!confirmed) {
        return;
    }

    try {
        setRedeeming(id);
        setError("");

        const response =
            await api.post(
                `/employee/compoff/${id}/redeem`
            );

        const data =
            response?.data;

        if (
            data?.success === false
        ) {
            throw new Error(
                data?.message ||
                "Failed to redeem comp-off."
            );
        }

        await fetchCompOff();

        window.alert(
            "Comp-off redeemed successfully."
        );
    } catch (err) {
        console.error(
            "COMPOFF REDEEM ERROR:",
            err
        );

        setError(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to redeem comp-off."
        );
    } finally {
        setRedeeming(null);
    }
};


return (
    <div className="min-h-screen bg-slate-50">

        <Sidebar activeTab="compoff" />

        <main className="ml-64 p-8">

            <div className="flex items-start justify-between mb-8">

                <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Gift
                            size={22}
                            className="text-indigo-600"
                        />
                    </div>

                    <div>

                        <h1 className="text-2xl font-bold text-slate-900">
                            Comp-Off
                        </h1>

                        <p className="text-sm text-slate-500 mt-1">
                            View and redeem your earned compensatory off.
                        </p>

                    </div>

                </div>


                <button
                    onClick={() =>
                        loadData(true)
                    }
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm"
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


            {error && (
                <div className="mb-6 flex gap-3 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">

                    <AlertCircle size={18} />

                    <span className="text-sm">
                        {error}
                    </span>

                </div>
            )}


            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

                <div className="bg-white border rounded-2xl p-5">

                    <p className="text-sm text-slate-500">
                        Available Records
                    </p>

                    <p className="text-2xl font-bold mt-1">
                        {available.length}
                    </p>

                </div>


                <div className="bg-white border rounded-2xl p-5">

                    <p className="text-sm text-slate-500">
                        Available Hours
                    </p>

                    <p className="text-2xl font-bold mt-1">
                        {availableHours.toFixed(
                            2
                        )}
                    </p>

                </div>


                <div className="bg-white border rounded-2xl p-5">

                    <p className="text-sm text-slate-500">
                        Redeemed
                    </p>

                    <p className="text-2xl font-bold mt-1">
                        {redeemed.length}
                    </p>

                </div>

            </div>


            <div className="bg-white border rounded-2xl overflow-hidden">

                <div className="px-6 py-5 border-b">

                    <h2 className="font-semibold">
                        My Comp-Off Ledger
                    </h2>

                    <p className="text-sm text-slate-500 mt-1">
                        Comp-off is generated from eligible holiday or weekly-off work according to the client policy.
                    </p>

                </div>


                {loading ? (

                    <div className="py-16 text-center text-slate-500">
                        Loading comp-off...
                    </div>

                ) : compoffs.length === 0 ? (

                    <div className="py-16 text-center">

                        <Gift
                            size={36}
                            className="mx-auto text-slate-300"
                        />

                        <p className="mt-3 text-slate-500">
                            No comp-off records found.
                        </p>

                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                            <thead className="bg-slate-50 border-b">

                                <tr>

                                    <th className="text-left px-6 py-4">
                                        Earned Date
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Source
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Hours
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Status
                                    </th>

                                    <th className="text-right px-6 py-4">
                                        Action
                                    </th>

                                </tr>

                            </thead>


                            <tbody className="divide-y">

                                {compoffs.map(
                                    (item) => {

                                        const status =
                                            normalizeStatus(
                                                item.status
                                            );

                                        return (
                                            <tr
                                                key={
                                                    item.id
                                                }
                                                className="hover:bg-slate-50"
                                            >

                                                <td className="px-6 py-4">

                                                    <div className="flex items-center gap-2">

                                                        <CalendarDays
                                                            size={15}
                                                            className="text-slate-400"
                                                        />

                                                        {formatDate(
                                                            item.earned_date
                                                        )}

                                                    </div>

                                                </td>


                                                <td className="px-6 py-4">

                                                    {item.source_type ===
                                                    "HOLIDAY"
                                                        ? "Holiday Worked"
                                                        : "Weekly Off Worked"}

                                                </td>


                                                <td className="px-6 py-4 font-medium">

                                                    {Number(
                                                        item.hours ||
                                                        0
                                                    ).toFixed(
                                                        2
                                                    )}{" "}
                                                    hrs

                                                </td>


                                                <td className="px-6 py-4">

                                                    {status ===
                                                    "available" ? (

                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium">

                                                            <CheckCircle2
                                                                size={13}
                                                            />

                                                            Available

                                                        </span>

                                                    ) : status ===
                                                      "redeemed" ? (

                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200 text-xs font-medium">

                                                            Redeemed

                                                        </span>

                                                    ) : (

                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium">

                                                            {item.status}

                                                        </span>

                                                    )}

                                                </td>


                                                <td className="px-6 py-4 text-right">

                                                    {status ===
                                                    "available" ? (

                                                        <button
                                                            onClick={() =>
                                                                redeemCompOff(
                                                                    item.id
                                                                )
                                                            }
                                                            disabled={
                                                                redeeming ===
                                                                item.id
                                                            }
                                                            className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                                                        >

                                                            {redeeming ===
                                                            item.id ? (
                                                                <>
                                                                    <RefreshCw
                                                                        size={
                                                                            13
                                                                        }
                                                                        className="animate-spin"
                                                                    />

                                                                    Redeeming...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Clock
                                                                        size={
                                                                            13
                                                                        }
                                                                    />

                                                                    Redeem
                                                                </>
                                                            )}

                                                        </button>

                                                    ) : (

                                                        <span className="text-slate-400 text-xs">
                                                            —
                                                        </span>

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

    </div>
);


};

export default CompOff;
