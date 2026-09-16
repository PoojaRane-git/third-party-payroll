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
    Edit3,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";
import api from "../../../services/api";
import { useAuth } from "../../../../auth/AuthProvider";

// ============================================================
// HELPERS
// ============================================================

const getToday = () => {
    const date = new Date();

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
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
                  `${stringValue.slice(
                      0,
                      10
                  )}T00:00:00`
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

const getMonthName = (value) => {

    if (!value) {
        return "";
    }

    const date =
        new Date(
            `${String(value).slice(
                0,
                10
            )}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            month: "long",
            year: "numeric",
        }
    );
};

const normalizeHolidayType = (
    value
) => {

    return String(
        value || "Full Day"
    )
        .trim()
        .toLowerCase();
};

// ============================================================
// COMPONENT
// ============================================================

const HolidayCalendar = () => {

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
        useState("holiday");

    // ========================================================
    // DATA
    // ========================================================

    const [holidays, setHolidays] =
        useState([]);

    // ========================================================
    // FILTERS
    // ========================================================

    const [searchHoliday, setSearchHoliday] =
        useState("");

    const [yearFilter, setYearFilter] =
        useState(
            String(
                new Date().getFullYear()
            )
        );

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
    // MODAL
    // ========================================================

    const [showModal, setShowModal] =
        useState(false);

    const [editingHoliday, setEditingHoliday] =
        useState(null);

    const [saving, setSaving] =
        useState(false);

    // ========================================================
    // FORM
    // ========================================================

    const [form, setForm] =
        useState({
            holiday_date: getToday(),
            name: "",
            holiday_type: "Full Day",
            is_paid: true,
        });

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
                "Holiday calendar logout error:",
                error
            );

            window.location.href =
                "/login";
        }
    };

    // ========================================================
    // FETCH HOLIDAYS
    //
    // GET
    // /api/client/holidays
    // ========================================================

    const fetchHolidays =
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
                        "FETCH CLIENT HOLIDAYS"
                    );

                    const response =
                        await api.get(
                            "/client/holidays"
                        );

                    const result =
                        response?.data || {};

                    console.log(
                        "CLIENT HOLIDAYS RESPONSE:",
                        result
                    );

                    if (
                        result.success !== true
                    ) {

                        throw new Error(
                            result.error ||
                            result.message ||
                            "Failed to load holidays."
                        );
                    }

                    const records =
                        Array.isArray(
                            result.data
                        )
                            ? result.data
                            : [];

                    setHolidays(
                        records
                    );

                } catch (err) {

                    console.error(
                        "Fetch holidays error:",
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
                            "You do not have permission to manage the holiday calendar."
                        );

                    } else {

                        setError(
                            err?.response?.data?.error ||
                            err?.response?.data?.message ||
                            err?.message ||
                            "Failed to load holidays."
                        );
                    }

                    setHolidays([]);

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

        fetchHolidays(true);

    }, [
        authLoading,
        session,
        user,
        fetchHolidays,
    ]);

    // ========================================================
    // REFRESH
    // ========================================================

    const handleRefresh = async () => {

        try {

            setRefreshing(true);

            await fetchHolidays(
                false
            );

        } finally {

            setRefreshing(false);
        }
    };

    // ========================================================
    // FORM CHANGE
    // ========================================================

    const handleFormChange = (
        field,
        value
    ) => {

        setForm(
            (previous) => ({
                ...previous,
                [field]: value,
            })
        );
    };

    // ========================================================
    // OPEN ADD MODAL
    // ========================================================

    const openAddModal = () => {

        setEditingHoliday(null);

        setForm({
            holiday_date: getToday(),
            name: "",
            holiday_type: "Full Day",
            is_paid: true,
        });

        setError("");

        setShowModal(true);
    };

    // ========================================================
    // OPEN EDIT MODAL
    // ========================================================

    const openEditModal = (
        holiday
    ) => {

        setEditingHoliday(
            holiday
        );

        setForm({
            holiday_date:
                holiday?.holiday_date
                    ? String(
                          holiday.holiday_date
                      ).slice(
                          0,
                          10
                      )
                    : getToday(),

            name:
                holiday?.name ||
                "",

            holiday_type:
                holiday?.holiday_type ||
                "Full Day",

            is_paid:
                holiday?.is_paid !==
                false,
        });

        setError("");

        setShowModal(true);
    };

    // ========================================================
    // CLOSE MODAL
    // ========================================================

    const closeModal = () => {

        if (saving) {
            return;
        }

        setShowModal(false);

        setEditingHoliday(
            null
        );

        setForm({
            holiday_date: getToday(),
            name: "",
            holiday_type: "Full Day",
            is_paid: true,
        });
    };

    // ========================================================
    // SAVE HOLIDAY
    //
    // POST /api/client/holidays
    // PUT  /api/client/holidays/:id
    // ========================================================

    const handleSave = async (
        event
    ) => {

        event.preventDefault();

        const holidayDate =
            form.holiday_date.trim();

        const holidayName =
            form.name.trim();

        if (!holidayDate) {

            setError(
                "Please select a holiday date."
            );

            return;
        }

        if (!holidayName) {

            setError(
                "Please enter a holiday name."
            );

            return;
        }

        try {

            setSaving(true);

            setError("");

            const payload = {
                holiday_date:
                    holidayDate,

                name:
                    holidayName,

                holiday_type:
                    form.holiday_type,

                is_paid:
                    Boolean(
                        form.is_paid
                    ),
            };

            let response;

            if (
                editingHoliday?.id
            ) {

                response =
                    await api.put(
                        `/client/holidays/${editingHoliday.id}`,
                        payload
                    );

            } else {

                response =
                    await api.post(
                        "/client/holidays",
                        payload
                    );
            }

            const result =
                response?.data || {};

            if (
                result.success !== true
            ) {

                throw new Error(
                    result.error ||
                    result.message ||
                    "Failed to save holiday."
                );
            }

            closeModal();

            await fetchHolidays(
                false
            );

        } catch (err) {

            console.error(
                "Save holiday error:",
                err
            );

            setError(
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to save holiday."
            );

        } finally {

            setSaving(false);
        }
    };

    // ========================================================
    // DELETE HOLIDAY
    //
    // DELETE
    // /api/client/holidays/:id
    // ========================================================

    const handleDelete = async (
        holiday
    ) => {

        if (!holiday?.id) {
            return;
        }

        const confirmed =
            window.confirm(
                `Delete "${holiday.name}" from the holiday calendar?`
            );

        if (!confirmed) {
            return;
        }

        try {

            setError("");

            const response =
                await api.delete(
                    `/client/holidays/${holiday.id}`
                );

            const result =
                response?.data || {};

            if (
                result.success !== true
            ) {

                throw new Error(
                    result.error ||
                    result.message ||
                    "Failed to delete holiday."
                );
            }

            await fetchHolidays(
                false
            );

        } catch (err) {

            console.error(
                "Delete holiday error:",
                err
            );

            setError(
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                "Failed to delete holiday."
            );
        }
    };

    // ========================================================
    // AVAILABLE YEARS
    // ========================================================

    const availableYears =
        useMemo(() => {

            const years =
                holidays
                    .map(
                        (holiday) => {

                            const value =
                                holiday?.holiday_date;

                            if (!value) {
                                return null;
                            }

                            return String(
                                value
                            ).slice(
                                0,
                                4
                            );
                        }
                    )
                    .filter(Boolean);

            const currentYear =
                String(
                    new Date().getFullYear()
                );

            return [
                ...new Set([
                    currentYear,
                    ...years,
                ]),
            ].sort(
                (a, b) =>
                    Number(b) -
                    Number(a)
            );

        }, [
            holidays,
        ]);

    // ========================================================
    // FILTERED HOLIDAYS
    // ========================================================

    const filteredHolidays =
        useMemo(() => {

            const search =
                searchHoliday
                    .trim()
                    .toLowerCase();

            return holidays
                .filter(
                    (holiday) => {

                        const holidayDate =
                            String(
                                holiday?.holiday_date ||
                                ""
                            ).slice(
                                0,
                                10
                            );

                        const holidayYear =
                            holidayDate.slice(
                                0,
                                4
                            );

                        const holidayName =
                            String(
                                holiday?.name ||
                                ""
                            ).toLowerCase();

                        const matchesYear =
                            yearFilter ===
                                "all" ||
                            holidayYear ===
                                String(
                                    yearFilter
                                );

                        const matchesSearch =
                            !search ||
                            holidayName.includes(
                                search
                            ) ||
                            holidayDate.includes(
                                search
                            );

                        return (
                            matchesYear &&
                            matchesSearch
                        );
                    }
                )
                .sort(
                    (a, b) =>
                        String(
                            a?.holiday_date ||
                            ""
                        ).localeCompare(
                            String(
                                b?.holiday_date ||
                                ""
                            )
                        )
                );

        }, [
            holidays,
            searchHoliday,
            yearFilter,
        ]);

    // ========================================================
    // SUMMARY
    // ========================================================

    const summary = useMemo(() => {

        const selectedYear =
            yearFilter === "all"
                ? null
                : String(
                      yearFilter
                  );

        const yearHolidays =
            holidays.filter(
                (holiday) => {

                    if (
                        !selectedYear
                    ) {
                        return true;
                    }

                    return String(
                        holiday?.holiday_date ||
                            ""
                    ).slice(
                        0,
                        4
                    ) ===
                        selectedYear;
                }
            );

        const paid =
            yearHolidays.filter(
                (holiday) =>
                    holiday?.is_paid !==
                    false
            ).length;

        const fullDay =
            yearHolidays.filter(
                (holiday) =>
                    normalizeHolidayType(
                        holiday?.holiday_type
                    ) ===
                    "full day"
            ).length;

        const halfDay =
            yearHolidays.filter(
                (holiday) =>
                    normalizeHolidayType(
                        holiday?.holiday_type
                    ) ===
                    "half day"
            ).length;

        return {
            total:
                yearHolidays.length,
            paid,
            fullDay,
            halfDay,
        };

    }, [
        holidays,
        yearFilter,
    ]);

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
                        Loading holiday calendar...
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
                        Please login again to manage the holiday calendar.
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

                                <CalendarDays
                                    size={26}
                                    className="text-indigo-600"
                                />

                                <h1 className="text-[30px] font-bold leading-none text-slate-900">
                                    Holiday Calendar
                                </h1>

                            </div>

                            <p className="mt-2 text-sm text-slate-500">
                                Manage client holidays and paid holiday schedules.
                            </p>

                        </div>

                        <div className="flex items-center gap-3">

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

                            <button
                                type="button"
                                onClick={
                                    openAddModal
                                }
                                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                            >

                                <Plus
                                    size={17}
                                />

                                Add Holiday

                            </button>

                        </div>

                    </div>

                    {/* ==================================================
                        FILTERS
                    ================================================== */}

                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                            {/* Year */}

                            <div>

                                <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Year
                                </label>

                                <select
                                    value={
                                        yearFilter
                                    }
                                    onChange={(e) =>
                                        setYearFilter(
                                            e.target.value
                                        )
                                    }
                                    className="h-[43px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                >

                                    <option value="all">
                                        All Years
                                    </option>

                                    {availableYears.map(
                                        (
                                            year
                                        ) => (
                                            <option
                                                key={
                                                    year
                                                }
                                                value={
                                                    year
                                                }
                                            >
                                                {year}
                                            </option>
                                        )
                                    )}

                                </select>

                            </div>

                            {/* Search */}

                            <div>

                                <label className="mb-2 block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                                    Search Holiday
                                </label>

                                <div className="relative">

                                    <Search
                                        size={17}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />

                                    <input
                                        type="text"
                                        value={
                                            searchHoliday
                                        }
                                        onChange={(e) =>
                                            setSearchHoliday(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Holiday name or date..."
                                        className="h-[43px] w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    />

                                </div>

                            </div>

                        </div>

                    </div>

                    {/* ==================================================
                        SUMMARY
                    ================================================== */}

                    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                        {/* Total */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Total Holidays
                            </p>

                            <p className="mt-2 text-2xl font-bold text-slate-950">
                                {summary.total}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                {yearFilter ===
                                "all"
                                    ? "All calendar years"
                                    : `For ${yearFilter}`}
                            </p>

                        </div>

                        {/* Paid */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Paid Holidays
                            </p>

                            <p className="mt-2 text-2xl font-bold text-slate-950">
                                {summary.paid}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Included in payroll
                            </p>

                        </div>

                        {/* Full Day */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Full Day
                            </p>

                            <p className="mt-2 text-2xl font-bold text-slate-950">
                                {summary.fullDay}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Full-day holidays
                            </p>

                        </div>

                        {/* Half Day */}

                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

                            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Half Day
                            </p>

                            <p className="mt-2 text-2xl font-bold text-slate-950">
                                {summary.halfDay}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                                Half-day holidays
                            </p>

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
                        HOLIDAY TABLE
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
                                        Loading holidays...
                                    </p>

                                </div>

                            </div>

                        ) : filteredHolidays.length ===
                          0 ? (

                            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">

                                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100">

                                    <CalendarDays
                                        size={28}
                                        className="text-slate-400"
                                    />

                                </div>

                                <h3 className="text-base font-bold text-slate-900">
                                    No holidays found
                                </h3>

                                <p className="mt-2 text-sm text-slate-500">
                                    Add a holiday to start building the client holiday calendar.
                                </p>

                                <button
                                    type="button"
                                    onClick={
                                        openAddModal
                                    }
                                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                                >

                                    <Plus
                                        size={16}
                                    />

                                    Add Holiday

                                </button>

                            </div>

                        ) : (

                            <div className="overflow-x-auto">

                                <table className="w-full min-w-[900px]">

                                    <thead>

                                        <tr className="border-b border-slate-200 bg-slate-50">

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Date
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Holiday
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Type
                                            </th>

                                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Paid
                                            </th>

                                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wide text-slate-500">
                                                Actions
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                                        {filteredHolidays.map(
                                            (
                                                holiday,
                                                index
                                            ) => {

                                                const holidayType =
                                                    normalizeHolidayType(
                                                        holiday?.holiday_type
                                                    );

                                                return (
                                                    <tr
                                                        key={
                                                            holiday?.id ??
                                                            index
                                                        }
                                                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                                                    >

                                                        {/* Date */}

                                                        <td className="px-6 py-5">

                                                            <div className="flex items-center gap-3">

                                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">

                                                                    <CalendarDays
                                                                        size={18}
                                                                        className="text-indigo-600"
                                                                    />

                                                                </div>

                                                                <div>

                                                                    <p className="text-sm font-semibold text-slate-900">
                                                                        {formatDate(
                                                                            holiday?.holiday_date
                                                                        )}
                                                                    </p>

                                                                    <p className="mt-1 text-xs text-slate-400">
                                                                        {getMonthName(
                                                                            holiday?.holiday_date
                                                                        )}
                                                                    </p>

                                                                </div>

                                                            </div>

                                                        </td>

                                                        {/* Holiday Name */}

                                                        <td className="px-6 py-5">

                                                            <p className="text-sm font-semibold text-slate-900">
                                                                {holiday?.name ||
                                                                    "Unnamed Holiday"}
                                                            </p>

                                                        </td>

                                                        {/* Type */}

                                                        <td className="px-6 py-5">

                                                            {holidayType ===
                                                            "half day" ? (
                                                                <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                                                    Half Day
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                                                    Full Day
                                                                </span>
                                                            )}

                                                        </td>

                                                        {/* Paid */}

                                                        <td className="px-6 py-5">

                                                            {holiday?.is_paid !==
                                                            false ? (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">

                                                                    <Check
                                                                        size={13}
                                                                    />

                                                                    Paid

                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">

                                                                    <X
                                                                        size={13}
                                                                    />

                                                                    Unpaid

                                                                </span>
                                                            )}

                                                        </td>

                                                        {/* Actions */}

                                                        <td className="px-6 py-5">

                                                            <div className="flex justify-end gap-2">

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        openEditModal(
                                                                            holiday
                                                                        )
                                                                    }
                                                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                                                >

                                                                    <Edit3
                                                                        size={14}
                                                                    />

                                                                    Edit

                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleDelete(
                                                                            holiday
                                                                        )
                                                                    }
                                                                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                                                                >

                                                                    <Trash2
                                                                        size={14}
                                                                    />

                                                                    Delete

                                                                </button>

                                                            </div>

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

            {/* ==================================================
                ADD / EDIT MODAL
            ================================================== */}

            {showModal && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">

                    <div className="w-full max-w-[560px] rounded-2xl bg-white shadow-2xl">

                        {/* Modal Header */}

                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">

                            <div>

                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingHoliday
                                        ? "Edit Holiday"
                                        : "Add Holiday"}
                                </h2>

                                <p className="mt-1 text-xs text-slate-500">
                                    Configure the holiday for this client.
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={
                                    closeModal
                                }
                                disabled={
                                    saving
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                            >

                                <X
                                    size={19}
                                />

                            </button>

                        </div>

                        {/* Modal Form */}

                        <form
                            onSubmit={
                                handleSave
                            }
                        >

                            <div className="space-y-5 px-6 py-6">

                                {/* Date */}

                                <div>

                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Holiday Date
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            form.holiday_date
                                        }
                                        onChange={(e) =>
                                            handleFormChange(
                                                "holiday_date",
                                                e.target.value
                                            )
                                        }
                                        className="h-[45px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        required
                                    />

                                </div>

                                {/* Name */}

                                <div>

                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Holiday Name
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            form.name
                                        }
                                        onChange={(e) =>
                                            handleFormChange(
                                                "name",
                                                e.target.value
                                            )
                                        }
                                        placeholder="e.g. Independence Day"
                                        className="h-[45px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                        required
                                    />

                                </div>

                                {/* Type */}

                                <div>

                                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                                        Holiday Type
                                    </label>

                                    <select
                                        value={
                                            form.holiday_type
                                        }
                                        onChange={(e) =>
                                            handleFormChange(
                                                "holiday_type",
                                                e.target.value
                                            )
                                        }
                                        className="h-[45px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                    >

                                        <option value="Full Day">
                                            Full Day
                                        </option>

                                        <option value="Half Day">
                                            Half Day
                                        </option>

                                    </select>

                                </div>

                                {/* Paid */}

                                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">

                                    <div>

                                        <p className="text-sm font-semibold text-slate-700">
                                            Paid Holiday
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            Include this holiday as a paid day in payroll.
                                        </p>

                                    </div>

                                    <input
                                        type="checkbox"
                                        checked={
                                            form.is_paid
                                        }
                                        onChange={(e) =>
                                            handleFormChange(
                                                "is_paid",
                                                e.target.checked
                                            )
                                        }
                                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />

                                </label>

                            </div>

                            {/* Modal Footer */}

                            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">

                                <button
                                    type="button"
                                    onClick={
                                        closeModal
                                    }
                                    disabled={
                                        saving
                                    }
                                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        saving
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >

                                    {saving ? (
                                        <RefreshCw
                                            size={15}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Check
                                            size={15}
                                        />
                                    )}

                                    {editingHoliday
                                        ? "Save Changes"
                                        : "Add Holiday"}

                                </button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

        </div>
    );
};

export default HolidayCalendar;