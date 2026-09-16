import React, { useEffect, useState } from "react";
import {
    AlertCircle,
    Check,
    Clock,
    RefreshCw,
    Settings,
    X,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import api from "../../services/api";
import { useAuth } from "../../auth/AuthProvider";


// =====================================================
// DEFAULT POLICY
// =====================================================

const defaultPolicy = {
    full_day_hours: 8,
    half_day_min_hours: 4,
    sandwich_rule_enabled: false,
    holiday_ot_enabled: true,
    weekly_off_ot_enabled: true,
    comp_off_enabled: true,
    ot_multiplier: 1.5,
};


// =====================================================
// HELPERS
// =====================================================

const getPolicy = (response) => {
    const data = response?.data;

    if (data?.data && !Array.isArray(data.data)) {
        return data.data;
    }

    if (data?.policy) {
        return data.policy;
    }

    if (data && !Array.isArray(data)) {
        return data;
    }

    return null;
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

export default function AttendancePolicy() {
    const { user } = useAuth();

    const [policy, setPolicy] = useState(defaultPolicy);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    // =====================================================
    // FETCH POLICY
    // =====================================================

    const fetchPolicy = async (showRefresh = false) => {
        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            setError("");

            const response = await api.get(
                "/client/attendance-policy"
            );

            const existing = getPolicy(response);

            if (existing) {
                setPolicy({
                    ...defaultPolicy,
                    ...existing,
                });
            }
        } catch (err) {
            console.error("FETCH ATTENDANCE POLICY ERROR:", err);

            setError(
                getErrorMessage(
                    err,
                    "Unable to load attendance policy."
                )
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    useEffect(() => {
        fetchPolicy();
    }, []);


    // =====================================================
    // CHANGE
    // =====================================================

    const updatePolicy = (field, value) => {
        setPolicy((previous) => ({
            ...previous,
            [field]: value,
        }));

        setSuccess("");
    };


    // =====================================================
    // SAVE
    // =====================================================

    const handleSave = async (event) => {
        event.preventDefault();

        if (
            Number(policy.full_day_hours) <= 0 ||
            Number(policy.half_day_min_hours) < 0
        ) {
            setError("Please enter valid attendance hours.");
            return;
        }

        if (
            Number(policy.half_day_min_hours) >=
            Number(policy.full_day_hours)
        ) {
            setError(
                "Half-day minimum hours must be less than full-day hours."
            );
            return;
        }

        if (Number(policy.ot_multiplier) <= 0) {
            setError("OT multiplier must be greater than zero.");
            return;
        }

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            const payload = {
                full_day_hours: Number(policy.full_day_hours),
                half_day_min_hours: Number(
                    policy.half_day_min_hours
                ),

                sandwich_rule_enabled:
                    Boolean(policy.sandwich_rule_enabled),

                holiday_ot_enabled:
                    Boolean(policy.holiday_ot_enabled),

                weekly_off_ot_enabled:
                    Boolean(policy.weekly_off_ot_enabled),

                comp_off_enabled:
                    Boolean(policy.comp_off_enabled),

                ot_multiplier: Number(policy.ot_multiplier),
            };

            await api.put(
                "/client/attendance-policy",
                payload
            );

            setSuccess(
                "Attendance policy updated successfully."
            );

            await fetchPolicy(true);
        } catch (err) {
            console.error("SAVE ATTENDANCE POLICY ERROR:", err);

            setError(
                getErrorMessage(
                    err,
                    "Unable to save attendance policy."
                )
            );
        } finally {
            setSaving(false);
        }
    };


    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar activeTab="attendance-policy" />

            <main className="flex-1 p-6 lg:p-8">

                {/* HEADER */}
                <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div className="flex items-center gap-3">

                        <div className="rounded-xl bg-indigo-100 p-3">
                            <Settings
                                size={22}
                                className="text-indigo-600"
                            />
                        </div>

                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                Attendance Policy
                            </h1>

                            <p className="text-sm text-slate-500">
                                Configure attendance, overtime and comp-off rules
                            </p>
                        </div>

                    </div>


                    <button
                        onClick={() => fetchPolicy(true)}
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


                {/* ALERTS */}
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

                {success && (
                    <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                        <Check size={18} />

                        <span>{success}</span>
                    </div>
                )}


                {loading ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
                        Loading attendance policy...
                    </div>
                ) : (

                    <form onSubmit={handleSave}>

                        {/* ATTENDANCE HOURS */}
                        <div className="mb-6 rounded-2xl border border-slate-200 bg-white">

                            <div className="border-b border-slate-200 p-5">

                                <div className="flex items-center gap-3">

                                    <Clock
                                        size={20}
                                        className="text-indigo-600"
                                    />

                                    <div>
                                        <h2 className="font-bold text-slate-900">
                                            Attendance Hours
                                        </h2>

                                        <p className="text-sm text-slate-500">
                                            Define full-day and half-day thresholds
                                        </p>
                                    </div>

                                </div>

                            </div>


                            <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">

                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Full Day Hours
                                    </label>

                                    <input
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={policy.full_day_hours}
                                        onChange={(e) =>
                                            updatePolicy(
                                                "full_day_hours",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"
                                    />

                                    <p className="mt-1.5 text-xs text-slate-400">
                                        Default: 8 hours
                                    </p>
                                </div>


                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Half Day Minimum Hours
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={
                                            policy.half_day_min_hours
                                        }
                                        onChange={(e) =>
                                            updatePolicy(
                                                "half_day_min_hours",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500"
                                    />

                                    <p className="mt-1.5 text-xs text-slate-400">
                                        Default: 4 hours
                                    </p>
                                </div>

                            </div>

                        </div>


                        {/* OT */}
                        <div className="mb-6 rounded-2xl border border-slate-200 bg-white">

                            <div className="border-b border-slate-200 p-5">
                                <h2 className="font-bold text-slate-900">
                                    Overtime & Comp-Off
                                </h2>

                                <p className="text-sm text-slate-500">
                                    Configure treatment of holiday and weekly-off work
                                </p>
                            </div>


                            <div className="space-y-4 p-5">

                                {/* HOLIDAY OT */}
                                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50">

                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            Holiday Overtime
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            Generate overtime when an employee works on a holiday
                                        </p>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={
                                            policy.holiday_ot_enabled
                                        }
                                        onChange={(e) =>
                                            updatePolicy(
                                                "holiday_ot_enabled",
                                                e.target.checked
                                            )
                                        }
                                        className="h-5 w-5"
                                    />

                                </label>


                                {/* WEEKLY OFF */}
                                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50">

                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            Weekly-Off Overtime
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            Generate overtime when an employee works on weekly off
                                        </p>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={
                                            policy.weekly_off_ot_enabled
                                        }
                                        onChange={(e) =>
                                            updatePolicy(
                                                "weekly_off_ot_enabled",
                                                e.target.checked
                                            )
                                        }
                                        className="h-5 w-5"
                                    />

                                </label>


                                {/* COMPOFF */}
                                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50">

                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            Comp-Off
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            Automatically create comp-off when eligible holiday/weekly-off work is detected
                                        </p>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={
                                            policy.comp_off_enabled
                                        }
                                        onChange={(e) =>
                                            updatePolicy(
                                                "comp_off_enabled",
                                                e.target.checked
                                            )
                                        }
                                        className="h-5 w-5"
                                    />

                                </label>


                                {/* OT MULTIPLIER */}
                                <div className="pt-2">

                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        OT Multiplier
                                    </label>

                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        value={
                                            policy.ot_multiplier
                                        }
                                        onChange={(e) =>
                                            updatePolicy(
                                                "ot_multiplier",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-indigo-500 md:w-64"
                                    />

                                    <p className="mt-1.5 text-xs text-slate-400">
                                        Example: 1.5 means 1.5 × normal hourly rate
                                    </p>

                                </div>

                            </div>

                        </div>


                        {/* SANDWICH */}
                        <div className="mb-6 rounded-2xl border border-slate-200 bg-white">

                            <div className="p-5">

                                <label className="flex cursor-pointer items-center justify-between">

                                    <div>
                                        <h2 className="font-bold text-slate-900">
                                            Sandwich Rule
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Treat intervening holidays or weekly offs as LOP when absence occurs on both sides.
                                        </p>

                                        <p className="mt-2 text-xs text-slate-400">
                                            Example: Friday Absent + Saturday Holiday + Sunday Weekly Off + Monday Absent.
                                        </p>
                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={
                                            policy.sandwich_rule_enabled
                                        }
                                        onChange={(e) =>
                                            updatePolicy(
                                                "sandwich_rule_enabled",
                                                e.target.checked
                                            )
                                        }
                                        className="ml-4 h-5 w-5 shrink-0"
                                    />

                                </label>

                            </div>

                        </div>


                        {/* SAVE */}
                        <div className="flex justify-end">

                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                            >
                                <Check size={17} />

                                {saving
                                    ? "Saving..."
                                    : "Save Policy"}
                            </button>

                        </div>

                    </form>

                )}

            </main>
        </div>
    );
}