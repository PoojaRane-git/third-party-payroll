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
    X,
} from "lucide-react";

import Sidebar from "../../components/Layout/Sidebar";
import api from "../../../services/api";
import { useAuth } from "../../../../auth/AuthProvider";

// =====================================================
// HELPERS
// =====================================================

const getArray = (response) => {
    const data = response?.data;

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.roster)) return data.roster;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.employees)) return data.employees;

    return [];
};

const getErrorMessage = (
    error,
    fallback = "Something went wrong."
) => {
    return (
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        fallback
    );
};

const emptyForm = {
    employee_id: "",
    deployment_id: "",
    roster_name: "General Shift",

    monday_working: true,
    tuesday_working: true,
    wednesday_working: true,
    thursday_working: true,
    friday_working: true,
    saturday_working: true,
    sunday_working: false,

    effective_from:
        new Date().toISOString().split("T")[0],

    effective_to: "",
};

// =====================================================
// COMPONENT
// =====================================================

export default function Roster() {

    // =====================================================
    // AUTH
    // =====================================================

    const {
        user,
        session,
        loading: authLoading,
    } = useAuth();

    // =====================================================
    // DATA
    // =====================================================

    const [roster, setRoster] = useState([]);
    const [employees, setEmployees] = useState([]);

    // =====================================================
    // LOADING
    // =====================================================

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // =====================================================
    // ERROR
    // =====================================================

    const [error, setError] = useState("");

    // =====================================================
    // SEARCH
    // =====================================================

    const [search, setSearch] = useState("");

    // =====================================================
    // MODAL
    // =====================================================

    const [showModal, setShowModal] = useState(false);
    const [editingRoster, setEditingRoster] =
        useState(null);

    const [form, setForm] = useState(emptyForm);

    // =====================================================
    // CLIENT ID
    // =====================================================

    const clientId = useMemo(() => {

        return (
            user?.client_id ??
            user?.clientId ??
            user?.profile?.client_id ??
            user?.profile?.clientId ??
            null
        );

    }, [user]);

    // =====================================================
    // FETCH ROSTER
    // =====================================================

    const fetchRoster = useCallback(
        async (showRefresh = false) => {

            if (
                authLoading ||
                !session ||
                !user
            ) {
                return;
            }

            try {

                if (showRefresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                setError("");

                const response =
                    await api.get(
                        "/client/roster"
                    );

                setRoster(
                    getArray(response)
                );

            } catch (err) {

                console.error(
                    "FETCH ROSTER ERROR:",
                    err
                );

                setError(
                    getErrorMessage(
                        err,
                        "Unable to load roster."
                    )
                );

            } finally {

                setLoading(false);
                setRefreshing(false);
            }
        },
        [
            authLoading,
            session,
            user,
        ]
    );

    // =====================================================
    // FETCH EMPLOYEES
    //
    // IMPORTANT:
    // Existing Attendance page uses:
    //
    // /attendance/employees?client_id=1
    //
    // So Roster must also send client_id.
    // =====================================================

    const fetchEmployees = useCallback(
        async () => {

            if (
                authLoading ||
                !session ||
                !user
            ) {
                return;
            }

            if (!clientId) {

                console.error(
                    "FETCH EMPLOYEES: client_id not found."
                );

                return;
            }

            try {

                const response =
                    await api.get(
                        `/attendance/employees?client_id=${clientId}`
                    );

                const data =
                    response?.data;

                if (Array.isArray(data)) {

                    setEmployees(data);

                } else if (
                    Array.isArray(data?.data)
                ) {

                    setEmployees(
                        data.data
                    );

                } else if (
                    Array.isArray(
                        data?.employees
                    )
                ) {

                    setEmployees(
                        data.employees
                    );

                } else {

                    setEmployees([]);
                }

            } catch (err) {

                console.error(
                    "FETCH EMPLOYEES ERROR:",
                    err
                );

                setEmployees([]);
            }
        },
        [
            authLoading,
            session,
            user,
            clientId,
        ]
    );

    // =====================================================
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {

        if (
            authLoading ||
            !session ||
            !user
        ) {
            return;
        }

        fetchRoster();
        fetchEmployees();

    }, [
        authLoading,
        session,
        user,
        fetchRoster,
        fetchEmployees,
    ]);

    // =====================================================
    // FORM CHANGE
    // =====================================================

    const updateForm = (
        field,
        value
    ) => {

        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    };

    // =====================================================
    // OPEN ADD
    // =====================================================

    const openAddModal = () => {

        setEditingRoster(null);

        setForm({
            ...emptyForm,

            effective_from:
                new Date()
                    .toISOString()
                    .split("T")[0],
        });

        setShowModal(true);
        setError("");
    };

    // =====================================================
    // OPEN EDIT
    // =====================================================

    const openEditModal = (
        item
    ) => {

        setEditingRoster(item);

        setForm({

            employee_id:
                item.employee_id ??
                "",

            deployment_id:
                item.deployment_id ??
                "",

            roster_name:
                item.roster_name ??
                "General Shift",

            monday_working:
                Boolean(
                    item.monday_working
                ),

            tuesday_working:
                Boolean(
                    item.tuesday_working
                ),

            wednesday_working:
                Boolean(
                    item.wednesday_working
                ),

            thursday_working:
                Boolean(
                    item.thursday_working
                ),

            friday_working:
                Boolean(
                    item.friday_working
                ),

            saturday_working:
                Boolean(
                    item.saturday_working
                ),

            sunday_working:
                Boolean(
                    item.sunday_working
                ),

            effective_from:
                item.effective_from
                    ?.split("T")[0] ||
                item.effective_from ||
                "",

            effective_to:
                item.effective_to
                    ?.split("T")[0] ||
                item.effective_to ||
                "",
        });

        setShowModal(true);
        setError("");
    };

    // =====================================================
    // SAVE
    // =====================================================

    const handleSave = async (
        event
    ) => {

        event.preventDefault();

        if (!form.employee_id) {

            setError(
                "Please select an employee."
            );

            return;
        }

        if (!form.effective_from) {

            setError(
                "Effective from date is required."
            );

            return;
        }

        try {

            setSaving(true);
            setError("");

            const payload = {

                employee_id:
                    Number(
                        form.employee_id
                    ),

                deployment_id:
                    form.deployment_id
                        ? Number(
                              form.deployment_id
                          )
                        : null,

                roster_name:
                    form.roster_name,

                monday_working:
                    form.monday_working,

                tuesday_working:
                    form.tuesday_working,

                wednesday_working:
                    form.wednesday_working,

                thursday_working:
                    form.thursday_working,

                friday_working:
                    form.friday_working,

                saturday_working:
                    form.saturday_working,

                sunday_working:
                    form.sunday_working,

                effective_from:
                    form.effective_from,

                effective_to:
                    form.effective_to ||
                    null,
            };

            if (editingRoster) {

                await api.put(
                    `/client/roster/${editingRoster.id}`,
                    payload
                );

            } else {

                await api.post(
                    "/client/roster",
                    payload
                );
            }

            setShowModal(false);
            setEditingRoster(null);
            setForm({
                ...emptyForm,
                effective_from:
                    new Date()
                        .toISOString()
                        .split("T")[0],
            });

            await fetchRoster(true);

        } catch (err) {

            console.error(
                "SAVE ROSTER ERROR:",
                err
            );

            setError(
                getErrorMessage(
                    err,
                    "Unable to save roster."
                )
            );

        } finally {

            setSaving(false);
        }
    };

    // =====================================================
    // FILTER
    // =====================================================

    const filteredRoster =
        useMemo(() => {

            const value =
                search
                    .trim()
                    .toLowerCase();

            if (!value) {
                return roster;
            }

            return roster.filter(
                (item) => {

                    const employeeName =
                        item.employee_name ||
                        item.employeeName ||
                        item.name ||
                        "";

                    const employeeCode =
                        item.employee_code ||
                        item.employeeCode ||
                        "";

                    const rosterName =
                        item.roster_name ||
                        "";

                    return (
                        String(
                            employeeName
                        )
                            .toLowerCase()
                            .includes(value) ||

                        String(
                            employeeCode
                        )
                            .toLowerCase()
                            .includes(value) ||

                        String(
                            rosterName
                        )
                            .toLowerCase()
                            .includes(value)
                    );
                }
            );

        }, [
            roster,
            search,
        ]);

    // =====================================================
    // WORKING DAYS
    // =====================================================

    const getWorkingDays = (
        item
    ) => {

        const days = [];

        if (
            item.monday_working
        ) {
            days.push("Mon");
        }

        if (
            item.tuesday_working
        ) {
            days.push("Tue");
        }

        if (
            item.wednesday_working
        ) {
            days.push("Wed");
        }

        if (
            item.thursday_working
        ) {
            days.push("Thu");
        }

        if (
            item.friday_working
        ) {
            days.push("Fri");
        }

        if (
            item.saturday_working
        ) {
            days.push("Sat");
        }

        if (
            item.sunday_working
        ) {
            days.push("Sun");
        }

        return days;
    };

    // =====================================================
    // AUTH LOADING
    // =====================================================

    if (authLoading) {

        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">

                <div className="flex flex-col items-center gap-3">

                    <RefreshCw
                        size={26}
                        className="animate-spin text-indigo-600"
                    />

                    <p className="text-sm text-slate-500">
                        Loading roster...
                    </p>

                </div>

            </div>
        );
    }

    // =====================================================
    // INVALID SESSION
    // =====================================================

    if (!session || !user) {

        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">

                <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">

                    <h2 className="text-lg font-bold text-slate-900">
                        Session not found
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                        Please login again.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            (window.location.href =
                                "/login")
                        }
                        className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        Login Again
                    </button>

                </div>

            </div>
        );
    }

    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="flex min-h-screen bg-slate-50">

            {/* =====================================================
                SIDEBAR
            ===================================================== */}

            <Sidebar
                activeTab="roster"
            />

            {/* =====================================================
                MAIN CONTENT
            ===================================================== */}

            <main className="min-w-0 flex-1 p-6 lg:p-8">

                {/* HEADER */}

                <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div>

                        <div className="flex items-center gap-3">

                            <div className="rounded-xl bg-indigo-100 p-3">

                                <CalendarDays
                                    size={22}
                                    className="text-indigo-600"
                                />

                            </div>

                            <div>

                                <h1 className="text-2xl font-bold text-slate-900">
                                    Employee Roster
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Manage employee working days and weekly offs
                                </p>

                            </div>

                        </div>

                    </div>

                    <div className="flex gap-2">

                        <button
                            type="button"
                            onClick={() =>
                                fetchRoster(true)
                            }
                            disabled={
                                refreshing
                            }
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                        >

                            <Plus size={17} />

                            Add Roster

                        </button>

                    </div>

                </div>

                {/* ERROR */}

                {error && (
                    <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                        <AlertCircle
                            size={18}
                            className="mt-0.5 shrink-0"
                        />

                        <span>
                            {error}
                        </span>

                        <button
                            type="button"
                            className="ml-auto"
                            onClick={() =>
                                setError("")
                            }
                        >
                            <X size={16} />
                        </button>

                    </div>
                )}

                {/* SUMMARY */}

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">

                        <p className="text-sm text-slate-500">
                            Total Rosters
                        </p>

                        <p className="mt-2 text-2xl font-bold text-slate-900">
                            {roster.length}
                        </p>

                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">

                        <p className="text-sm text-slate-500">
                            Active Rosters
                        </p>

                        <p className="mt-2 text-2xl font-bold text-emerald-600">

                            {
                                roster.filter(
                                    (item) => {

                                        if (
                                            !item.effective_to
                                        ) {
                                            return true;
                                        }

                                        return (
                                            new Date(
                                                item.effective_to
                                            ) >=
                                            new Date()
                                        );
                                    }
                                ).length
                            }

                        </p>

                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">

                        <p className="text-sm text-slate-500">
                            Weekly Off Patterns
                        </p>

                        <p className="mt-2 text-2xl font-bold text-indigo-600">

                            {
                                new Set(
                                    roster.map(
                                        (item) =>
                                            item.roster_name ||
                                            "General Shift"
                                    )
                                ).size
                            }

                        </p>

                    </div>

                </div>

                {/* SEARCH */}

                <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">

                    <div className="relative">

                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            type="text"
                            value={search}
                            onChange={(e) =>
                                setSearch(
                                    e.target.value
                                )
                            }
                            placeholder="Search employee or roster..."
                            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-500"
                        />

                    </div>

                </div>

                {/* TABLE */}

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">

                    {loading ? (

                        <div className="p-10 text-center text-sm text-slate-500">
                            Loading roster...
                        </div>

                    ) : filteredRoster.length === 0 ? (

                        <div className="p-10 text-center">

                            <CalendarDays
                                size={35}
                                className="mx-auto text-slate-300"
                            />

                            <p className="mt-3 font-medium text-slate-700">
                                No roster found
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                                Add a roster to configure employee working days.
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
                                            Roster
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Working Days
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Weekly Off
                                        </th>

                                        <th className="px-5 py-4 font-semibold text-slate-600">
                                            Effective From
                                        </th>

                                        <th className="px-5 py-4 text-right font-semibold text-slate-600">
                                            Action
                                        </th>

                                    </tr>

                                </thead>

                                <tbody className="divide-y divide-slate-100">

                                    {filteredRoster.map(
                                        (item) => {

                                            const workingDays =
                                                getWorkingDays(
                                                    item
                                                );

                                            const allDays = [
                                                [
                                                    "Mon",
                                                    item.monday_working,
                                                ],
                                                [
                                                    "Tue",
                                                    item.tuesday_working,
                                                ],
                                                [
                                                    "Wed",
                                                    item.wednesday_working,
                                                ],
                                                [
                                                    "Thu",
                                                    item.thursday_working,
                                                ],
                                                [
                                                    "Fri",
                                                    item.friday_working,
                                                ],
                                                [
                                                    "Sat",
                                                    item.saturday_working,
                                                ],
                                                [
                                                    "Sun",
                                                    item.sunday_working,
                                                ],
                                            ];

                                            const weeklyOff =
                                                allDays
                                                    .filter(
                                                        ([, working]) =>
                                                            !working
                                                    )
                                                    .map(
                                                        ([day]) =>
                                                            day
                                                    );

                                            return (
                                                <tr
                                                    key={
                                                        item.id
                                                    }
                                                    className="hover:bg-slate-50"
                                                >

                                                    {/* Employee */}

                                                    <td className="px-5 py-4">

                                                        <div className="font-semibold text-slate-800">

                                                            {
                                                                item.employee_name ||
                                                                item.employeeName ||
                                                                item.name ||
                                                                `Employee #${item.employee_id}`
                                                            }

                                                        </div>

                                                        {
                                                            (
                                                                item.employee_code ||
                                                                item.employeeCode
                                                            ) && (
                                                                <div className="text-xs text-slate-400">

                                                                    {
                                                                        item.employee_code ||
                                                                        item.employeeCode
                                                                    }

                                                                </div>
                                                            )
                                                        }

                                                    </td>

                                                    {/* Roster */}

                                                    <td className="px-5 py-4">

                                                        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">

                                                            {
                                                                item.roster_name ||
                                                                "General Shift"
                                                            }

                                                        </span>

                                                    </td>

                                                    {/* Working Days */}

                                                    <td className="px-5 py-4">

                                                        <div className="flex flex-wrap gap-1">

                                                            {
                                                                workingDays.map(
                                                                    (
                                                                        day
                                                                    ) => (
                                                                        <span
                                                                            key={
                                                                                day
                                                                            }
                                                                            className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                                                                        >
                                                                            {
                                                                                day
                                                                            }
                                                                        </span>
                                                                    )
                                                                )
                                                            }

                                                        </div>

                                                    </td>

                                                    {/* Weekly Off */}

                                                    <td className="px-5 py-4">

                                                        {
                                                            weeklyOff.length >
                                                            0 ? (

                                                                <div className="flex flex-wrap gap-1">

                                                                    {
                                                                        weeklyOff.map(
                                                                            (
                                                                                day
                                                                            ) => (
                                                                                <span
                                                                                    key={
                                                                                        day
                                                                                    }
                                                                                    className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                                                                                >
                                                                                    {
                                                                                        day
                                                                                    }
                                                                                </span>
                                                                            )
                                                                        )
                                                                    }

                                                                </div>

                                                            ) : (

                                                                <span className="text-xs text-slate-400">
                                                                    None
                                                                </span>

                                                            )
                                                        }

                                                    </td>

                                                    {/* Effective From */}

                                                    <td className="px-5 py-4 text-slate-600">

                                                        {
                                                            item.effective_from
                                                                ? new Date(
                                                                      item.effective_from
                                                                  ).toLocaleDateString(
                                                                      "en-IN"
                                                                  )
                                                                : "-"
                                                        }

                                                    </td>

                                                    {/* Action */}

                                                    <td className="px-5 py-4 text-right">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                openEditModal(
                                                                    item
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                        >

                                                            <Edit3
                                                                size={
                                                                    14
                                                                }
                                                            />

                                                            Edit

                                                        </button>

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

            {/* =====================================================
                MODAL
            ===================================================== */}

            {showModal && (

                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

                        {/* MODAL HEADER */}

                        <div className="flex items-center justify-between border-b border-slate-200 p-5">

                            <div>

                                <h2 className="text-lg font-bold text-slate-900">

                                    {
                                        editingRoster
                                            ? "Edit Roster"
                                            : "Add Roster"
                                    }

                                </h2>

                                <p className="text-sm text-slate-500">
                                    Configure employee working days
                                </p>

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowModal(
                                        false
                                    )
                                }
                                className="rounded-lg p-2 hover:bg-slate-100"
                            >

                                <X size={19} />

                            </button>

                        </div>

                        {/* FORM */}

                        <form
                            onSubmit={
                                handleSave
                            }
                            className="space-y-5 p-5"
                        >

                            {/* EMPLOYEE */}

                            <div>

                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Employee
                                </label>

                                <select
                                    value={
                                        form.employee_id
                                    }
                                    onChange={(e) =>
                                        updateForm(
                                            "employee_id",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                                >

                                    <option value="">
                                        Select employee
                                    </option>

                                    {employees.map(
                                        (
                                            employee
                                        ) => {

                                            const employeeId =
                                                employee.id ||
                                                employee.employee_id ||
                                                employee.candidate_id;

                                            return (
                                                <option
                                                    key={
                                                        employeeId
                                                    }
                                                    value={
                                                        employeeId
                                                    }
                                                >

                                                    {
                                                        employee.name ||
                                                        employee.employee_name ||
                                                        employee.full_name ||
                                                        `Employee #${employeeId}`
                                                    }

                                                </option>
                                            );
                                        }
                                    )}

                                </select>

                                {employees.length ===
                                    0 && (
                                    <p className="mt-2 text-xs text-amber-600">
                                        No employees available for this client.
                                    </p>
                                )}

                            </div>

                            {/* ROSTER NAME */}

                            <div>

                                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                    Roster Name
                                </label>

                                <input
                                    type="text"
                                    value={
                                        form.roster_name
                                    }
                                    onChange={(e) =>
                                        updateForm(
                                            "roster_name",
                                            e.target.value
                                        )
                                    }
                                    placeholder="General Shift"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                                />

                            </div>

                            {/* DAYS */}

                            <div>

                                <label className="mb-3 block text-sm font-semibold text-slate-700">
                                    Working Days
                                </label>

                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                                    {[
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
                                    ].map(
                                        ([
                                            label,
                                            field,
                                        ]) => (

                                            <label
                                                key={
                                                    field
                                                }
                                                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                                            >

                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        Boolean(
                                                            form[
                                                                field
                                                            ]
                                                        )
                                                    }
                                                    onChange={(
                                                        e
                                                    ) =>
                                                        updateForm(
                                                            field,
                                                            e
                                                                .target
                                                                .checked
                                                        )
                                                    }
                                                    className="h-4 w-4 rounded"
                                                />

                                                <span className="text-sm font-medium text-slate-700">
                                                    {
                                                        label
                                                    }
                                                </span>

                                            </label>

                                        )
                                    )}

                                </div>

                            </div>

                            {/* DATES */}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                                <div>

                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Effective From
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            form.effective_from
                                        }
                                        onChange={(e) =>
                                            updateForm(
                                                "effective_from",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                                    />

                                </div>

                                <div>

                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Effective To
                                    </label>

                                    <input
                                        type="date"
                                        value={
                                            form.effective_to
                                        }
                                        onChange={(e) =>
                                            updateForm(
                                                "effective_to",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                                    />

                                </div>

                            </div>

                            {/* ACTIONS */}

                            <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowModal(
                                            false
                                        )
                                    }
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={
                                        saving
                                    }
                                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >

                                    {saving ? (
                                        <RefreshCw
                                            size={
                                                16
                                            }
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <Check
                                            size={
                                                16
                                            }
                                        />
                                    )}

                                    {
                                        saving
                                            ? "Saving..."
                                            : editingRoster
                                            ? "Update Roster"
                                            : "Save Roster"
                                    }

                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

        </div>
    );
}