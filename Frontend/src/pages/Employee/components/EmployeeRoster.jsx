import React, {
useEffect,
useState,
} from "react";

import {
AlertCircle,
CalendarDays,
Clock,
RefreshCw,
} from "lucide-react";

import Sidebar from "../../Employee/components/EmployeeSidebar";
import api from "../../services/api";
import { useAuth } from "../../../auth/AuthProvider";


const EmployeeRoster = () => {
const { user } = useAuth();


const [roster, setRoster] =
    useState(null);

const [loading, setLoading] =
    useState(true);

const [refreshing, setRefreshing] =
    useState(false);

const [error, setError] =
    useState("");


const fetchRoster = async () => {
    const response =
        await api.get(
            "/employee/roster"
        );

    const data =
        response?.data;

    if (data?.success === false) {
        throw new Error(
            data?.message ||
            "Failed to fetch roster."
        );
    }

    if (
        Array.isArray(
            data?.roster
        )
    ) {
        setRoster(
            data.roster[0] ||
            null
        );
    } else {
        setRoster(
            data?.roster ||
            null
        );
    }
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

        await fetchRoster();
    } catch (err) {
        console.error(
            "EMPLOYEE ROSTER ERROR:",
            err
        );

        setError(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load roster."
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


const days = [
    [
        "Monday",
        "monday_working",
    ],
    [
        "Tuesday",
        "tuesday_working",
    ],
    [
        "Wednesday",
        "wednesday_working",
    ],
    [
        "Thursday",
        "thursday_working",
    ],
    [
        "Friday",
        "friday_working",
    ],
    [
        "Saturday",
        "saturday_working",
    ],
    [
        "Sunday",
        "sunday_working",
    ],
];


return (
    <div className="min-h-screen bg-slate-50">

        <Sidebar activeTab="roster" />

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
                            My Roster
                        </h1>

                        <p className="text-sm text-slate-500 mt-1">
                            View your assigned working schedule.
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


            {loading ? (

                <div className="bg-white border rounded-2xl py-16 text-center text-slate-500">
                    Loading roster...
                </div>

            ) : (

                <>

                    <div className="bg-white border rounded-2xl p-6 mb-6">

                        <div className="flex items-center gap-3 mb-6">

                            <Clock
                                size={20}
                                className="text-indigo-600"
                            />

                            <div>

                                <h2 className="font-semibold">
                                    {roster?.roster_name ||
                                        "General Shift"}
                                </h2>

                                <p className="text-sm text-slate-500">
                                    Current roster
                                </p>

                            </div>

                        </div>


                        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">

                            {days.map(
                                ([
                                    day,
                                    field,
                                ]) => {

                                    const working =
                                        roster
                                            ? Boolean(
                                                  roster[
                                                      field
                                                  ]
                                              )
                                            : [
                                                  "Monday",
                                                  "Tuesday",
                                                  "Wednesday",
                                                  "Thursday",
                                                  "Friday",
                                              ].includes(
                                                  day
                                              );

                                    return (
                                        <div
                                            key={
                                                day
                                            }
                                            className={`rounded-xl border p-4 text-center ${
                                                working
                                                    ? "bg-emerald-50 border-emerald-200"
                                                    : "bg-slate-50 border-slate-200"
                                            }`}
                                        >

                                            <p className="font-medium text-slate-800">
                                                {day}
                                            </p>

                                            <p
                                                className={`text-xs mt-2 font-medium ${
                                                    working
                                                        ? "text-emerald-700"
                                                        : "text-slate-500"
                                                }`}
                                            >
                                                {working
                                                    ? "Working"
                                                    : "Weekly Off"}
                                            </p>

                                        </div>
                                    );
                                }
                            )}

                        </div>

                    </div>


                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">

                        <p className="text-sm text-indigo-700">

                            <strong>
                                Attendance rule:
                            </strong>{" "}
                            Working days require attendance. Days without attendance on a working day may be treated as Absent/LOP by the attendance calculation system.

                        </p>

                    </div>

                </>

            )}

        </main>

    </div>
);


};

export default EmployeeRoster;
