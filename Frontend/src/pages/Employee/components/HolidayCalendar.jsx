import React, {
useEffect,
useMemo,
useState,
} from "react";

import {
AlertCircle,
CalendarDays,
CheckCircle2,
RefreshCw,
Search,
} from "lucide-react";

import Sidebar from "../../components/Sidebar";
import api from "../../services/api";
import { useAuth } from "../../auth/AuthProvider";

const HolidayCalendar = () => {
const { user } = useAuth();


const [holidays, setHolidays] =
    useState([]);

const [loading, setLoading] =
    useState(true);

const [refreshing, setRefreshing] =
    useState(false);

const [error, setError] =
    useState("");

const [search, setSearch] =
    useState("");

const [year, setYear] =
    useState(
        new Date().getFullYear()
    );


const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
        }
    );
};


const fetchHolidays = async () => {
    const response =
        await api.get(
            "/employee/holidays"
        );

    const data =
        response?.data;

    if (data?.success === false) {
        throw new Error(
            data?.message ||
            "Failed to fetch holidays."
        );
    }

    setHolidays(
        Array.isArray(
            data?.holidays
        )
            ? data.holidays
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

        await fetchHolidays();
    } catch (err) {
        console.error(
            "EMPLOYEE HOLIDAY ERROR:",
            err
        );

        setError(
            err?.response?.data?.message ||
            err?.message ||
            "Failed to load holiday calendar."
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


const filteredHolidays =
    useMemo(() => {
        const value =
            search
                .trim()
                .toLowerCase();

        return holidays
            .filter((holiday) => {
                const date =
                    String(
                        holiday?.holiday_date ||
                        ""
                    );

                return (
                    date.startsWith(
                        String(year)
                    ) ||
                    year === "All"
                );
            })
            .filter((holiday) => {
                if (!value) {
                    return true;
                }

                return (
                    String(
                        holiday?.name ||
                        ""
                    )
                        .toLowerCase()
                        .includes(value) ||
                    String(
                        holiday?.holiday_type ||
                        ""
                    )
                        .toLowerCase()
                        .includes(value)
                );
            })
            .sort(
                (a, b) =>
                    String(
                        a.holiday_date
                    ).localeCompare(
                        String(
                            b.holiday_date
                        )
                    )
            );
    }, [
        holidays,
        year,
        search,
    ]);


const years = useMemo(() => {
    const values =
        holidays.map(
            (holiday) =>
                String(
                    holiday.holiday_date ||
                    ""
                ).substring(0, 4)
        );

    return [
        ...new Set(
            values.filter(Boolean)
        ),
    ].sort();
}, [holidays]);


return (
    <div className="min-h-screen bg-slate-50">

        <Sidebar activeTab="holiday" />

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
                            Holiday Calendar
                        </h1>

                        <p className="text-sm text-slate-500 mt-1">
                            View holidays configured by your client.
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


            <div className="bg-white border rounded-2xl p-4 mb-6">

                <div className="flex flex-col md:flex-row gap-4">

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
                            placeholder="Search holidays..."
                            className="w-full pl-10 pr-4 py-2.5 border rounded-xl"
                        />

                    </div>


                    <select
                        value={year}
                        onChange={(e) =>
                            setYear(
                                e.target.value ===
                                    "All"
                                    ? "All"
                                    : Number(
                                          e.target.value
                                      )
                            )
                        }
                        className="px-4 py-2.5 border rounded-xl bg-white"
                    >
                        <option value="All">
                            All Years
                        </option>

                        {years.map(
                            (item) => (
                                <option
                                    key={
                                        item
                                    }
                                    value={
                                        item
                                    }
                                >
                                    {item}
                                </option>
                            )
                        )}

                    </select>

                </div>

            </div>


            <div className="bg-white border rounded-2xl overflow-hidden">

                <div className="px-6 py-5 border-b">

                    <h2 className="font-semibold">
                        Holidays
                    </h2>

                </div>


                {loading ? (

                    <div className="py-16 text-center text-slate-500">
                        Loading holidays...
                    </div>

                ) : filteredHolidays.length === 0 ? (

                    <div className="py-16 text-center text-slate-500">
                        No holidays found.
                    </div>

                ) : (

                    <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                            <thead className="bg-slate-50 border-b">

                                <tr>

                                    <th className="text-left px-6 py-4">
                                        Date
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Holiday
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Type
                                    </th>

                                    <th className="text-left px-6 py-4">
                                        Paid
                                    </th>

                                </tr>

                            </thead>


                            <tbody className="divide-y">

                                {filteredHolidays.map(
                                    (
                                        holiday
                                    ) => (
                                        <tr
                                            key={
                                                holiday.id
                                            }
                                            className="hover:bg-slate-50"
                                        >

                                            <td className="px-6 py-4 font-medium">
                                                {formatDate(
                                                    holiday.holiday_date
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                {holiday.name}
                                            </td>

                                            <td className="px-6 py-4">
                                                {holiday.holiday_type ||
                                                    "Full Day"}
                                            </td>

                                            <td className="px-6 py-4">

                                                {holiday.is_paid ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700">
                                                        <CheckCircle2
                                                            size={15}
                                                        />
                                                        Paid
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500">
                                                        Unpaid
                                                    </span>
                                                )}

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

    </div>
);


};

export default HolidayCalendar;
