// =====================================================
// Attendance.jsx
// =====================================================
//
// CLIENT ATTENDANCE ONLY
//
// FEATURES:
//   1. Daily Attendance
//   2. Monthly Attendance
//   3. Employee Monthly Details
//
// NO ATTENDANCE APPROVAL
//
// =====================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Users,
  X,
  Search,
  Eye,
  RefreshCw,
  Loader2,
  UserCheck,
  UserX,
  Coffee,
  Timer,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import Sidebar from "../Layout/Sidebar";

// =====================================================
// API
// =====================================================

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// =====================================================
// HELPERS
// =====================================================

const normalizeStatus = (value) => {
  if (!value) return "";

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
};

// =====================================================
// DATE
// =====================================================

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// =====================================================
// TIME
// =====================================================

const formatTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// =====================================================
// HOURS
// =====================================================

const formatHours = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return value;
  }

  return `${number.toFixed(2)} hrs`;
};

// =====================================================
// CURRENT MONTH
// =====================================================

const getCurrentMonth = () => {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  return `${year}-${month}`;
};

// =====================================================
// CURRENT DATE
// =====================================================

const getInitialDate = () => {
  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// =====================================================
// MONTH LABEL
// =====================================================

const getMonthLabel = (month) => {
  if (!month) return "";

  const [year, monthNumber] =
    month.split("-");

  const date = new Date(
    Number(year),
    Number(monthNumber) - 1,
    1
  );

  return date.toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    }
  );
};

// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({ status }) {
  const normalized =
    normalizeStatus(status);

  let className =
    "bg-slate-100 text-slate-600 border-slate-200";

  let label =
    status || "Unknown";

  if (
    normalized === "present"
  ) {
    className =
      "bg-emerald-50 text-emerald-700 border-emerald-200";

    label = "Present";
  } else if (
    normalized === "absent"
  ) {
    className =
      "bg-red-50 text-red-700 border-red-200";

    label = "Absent";
  } else if (
    normalized === "leave" ||
    normalized === "on_leave"
  ) {
    className =
      "bg-blue-50 text-blue-700 border-blue-200";

    label = "Leave";
  } else if (
    normalized === "half_day" ||
    normalized === "halfday"
  ) {
    className =
      "bg-purple-50 text-purple-700 border-purple-200";

    label = "Half Day";
  } else if (
    normalized === "holiday"
  ) {
    className =
      "bg-orange-50 text-orange-700 border-orange-200";

    label = "Holiday";
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${className}`}
    >
      {label}
    </span>
  );
}

// =====================================================
// EMPTY STATE
// =====================================================

function EmptyState({
  icon: Icon = CalendarDays,
  title,
  description,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>

      <h3 className="font-bold text-slate-800">
        {title}
      </h3>

      <p className="text-sm text-slate-500 mt-1 max-w-md">
        {description}
      </p>
    </div>
  );
}

// =====================================================
// STAT CARD
// =====================================================

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  iconClass =
    "bg-indigo-50 text-indigo-600",
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>

          <p className="text-2xl font-black text-slate-900 mt-2">
            {value}
          </p>

          {description && (
            <p className="text-xs text-slate-500 mt-1">
              {description}
            </p>
          )}
        </div>

        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconClass}`}
        >
          <Icon className="w-5 h-5" />
        </div>

      </div>
    </div>
  );
}

// =====================================================
// MONTHLY DETAIL DRAWER
// =====================================================

function AttendanceDetailDrawer({
  attendance,
  onClose,
}) {
  if (!attendance) {
    return null;
  }

  const dailyRecords =
    attendance.attendance ||
    attendance.daily_records ||
    attendance.records ||
    [];

  return (
    <div className="fixed inset-0 z-50">

      {/* Overlay */}

      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}

      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">

        {/* Header */}

        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between z-10">

          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
              Monthly Attendance
            </p>

            <h2 className="text-xl font-black text-slate-900 mt-1">
              {attendance.employee_name ||
                attendance.full_name ||
                "Employee"}
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              {attendance.billing_month
                ? getMonthLabel(
                    attendance.billing_month
                  )
                : ""}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>

        </div>

        {/* Body */}

        <div className="p-6 space-y-6">

          {/* Summary */}

          <div className="grid grid-cols-2 gap-3">

            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                Present
              </p>

              <p className="text-xl font-bold text-emerald-600 mt-1">
                {attendance.present_days ??
                  attendance.summary
                    ?.present_days ??
                  0}
              </p>
            </div>

            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                Absent
              </p>

              <p className="text-xl font-bold text-red-600 mt-1">
                {attendance.absent_days ??
                  attendance.summary
                    ?.absent_days ??
                  0}
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                Leave
              </p>

              <p className="text-xl font-bold text-blue-600 mt-1">
                {attendance.leave_days ??
                  attendance.summary
                    ?.leave_days ??
                  0}
              </p>
            </div>

            <div className="bg-orange-50 rounded-xl p-4">
              <p className="text-xs text-slate-500">
                LOP
              </p>

              <p className="text-xl font-bold text-orange-600 mt-1">
                {attendance.lop_days ??
                  attendance.summary
                    ?.lop_days ??
                  0}
              </p>
            </div>

          </div>

          {/* Summary Details */}

          <div className="border border-slate-200 rounded-2xl overflow-hidden">

            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800">
                Attendance Summary
              </h3>
            </div>

            <div className="divide-y divide-slate-100">

              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-slate-500">
                  Half Days
                </span>

                <span className="text-sm font-semibold text-slate-800">
                  {attendance.half_days ??
                    attendance.summary
                      ?.half_days ??
                    0}
                </span>
              </div>

              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-slate-500">
                  Working Days
                </span>

                <span className="text-sm font-semibold text-slate-800">
                  {attendance.working_days ??
                    attendance.summary
                      ?.working_days ??
                    0}
                </span>
              </div>

              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-slate-500">
                  Total Records
                </span>

                <span className="text-sm font-semibold text-slate-800">
                  {attendance.total_records ??
                    attendance.summary
                      ?.total_records ??
                    0}
                </span>
              </div>

              <div className="px-4 py-3 flex justify-between">
                <span className="text-sm text-slate-500">
                  Overtime
                </span>

                <span className="text-sm font-semibold text-indigo-600">
                  {formatHours(
                    attendance.overtime_hours ??
                      attendance.summary
                        ?.overtime_hours
                  )}
                </span>
              </div>

            </div>
          </div>

          {/* Daily Records */}

          <div>

            <div className="flex items-center justify-between mb-3">

              <h3 className="font-bold text-slate-800">
                Daily Records
              </h3>

              <span className="text-xs text-slate-500">
                {dailyRecords.length} records
              </span>

            </div>

            {dailyRecords.length ===
            0 ? (
              <div className="rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                No daily attendance records available.
              </div>
            ) : (
              <div className="space-y-2">

                {dailyRecords.map(
                  (
                    record,
                    index
                  ) => (
                    <div
                      key={
                        record.id ||
                        index
                      }
                      className="border border-slate-200 rounded-xl p-4"
                    >

                      <div className="flex items-center justify-between gap-3">

                        <div>
                          <p className="font-semibold text-sm text-slate-800">
                            {formatDate(
                              record.attendance_date
                            )}
                          </p>

                          <p className="text-xs text-slate-500 mt-1">
                            {formatTime(
                              record.check_in
                            )}
                            {" - "}
                            {formatTime(
                              record.check_out
                            )}
                          </p>
                        </div>

                        <StatusBadge
                          status={
                            record.status
                          }
                        />

                      </div>

                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">

                        <span>
                          Hours:{" "}
                          <b className="text-slate-700">
                            {formatHours(
                              record.working_hours
                            )}
                          </b>
                        </span>

                        <span>
                          OT:{" "}
                          <b className="text-indigo-600">
                            {formatHours(
                              record.overtime_hours
                            )}
                          </b>
                        </span>

                        {record.work_mode && (
                          <span>
                            Mode:{" "}
                            <b className="text-slate-700">
                              {
                                record.work_mode
                              }
                            </b>
                          </span>
                        )}

                      </div>

                      {record.remarks && (
                        <p className="text-xs text-slate-500 mt-3">
                          {record.remarks}
                        </p>
                      )}

                    </div>
                  )
                )}

              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function Attendance() {

  // ===================================================
  // NAVIGATION
  // ===================================================

  const navigate =
    useNavigate();

  // ===================================================
  // CLIENT
  // ===================================================

  const [clientId] =
    useState(() => {
      return (
        localStorage.getItem(
          "client_id"
        ) || "1"
      );
    });

  const [clientName] =
    useState(() => {
      return (
        localStorage.getItem(
          "client_name"
        ) ||
        localStorage.getItem(
          "clientName"
        ) ||
        "Client"
      );
    });

  // ===================================================
  // LOGOUT
  // ===================================================

  const handleLogout =
    useCallback(() => {
      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "access_token"
      );

      localStorage.removeItem(
        "client_id"
      );

      localStorage.removeItem(
        "client_name"
      );

      localStorage.removeItem(
        "clientName"
      );

      navigate("/login");
    }, [navigate]);

  // ===================================================
  // FILTERS
  // ===================================================

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    getCurrentMonth()
  );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    getInitialDate()
  );

  // ===================================================
  // DATA
  // ===================================================

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    dailyAttendance,
    setDailyAttendance,
  ] = useState([]);

  const [
    monthlyAttendance,
    setMonthlyAttendance,
  ] = useState([]);

  const [
    selectedAttendance,
    setSelectedAttendance,
  ] = useState(null);

  // ===================================================
  // LOADING
  // ===================================================

  const [
    loadingEmployees,
    setLoadingEmployees,
  ] = useState(false);

  const [
    loadingDaily,
    setLoadingDaily,
  ] = useState(false);

  const [
    loadingMonthly,
    setLoadingMonthly,
  ] = useState(false);

  const [
    loadingDetails,
    setLoadingDetails,
  ] = useState(false);

  // ===================================================
  // UI
  // ===================================================

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    activeTab,
    setActiveTab,
  ] = useState("daily");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  // ===================================================
  // FETCH EMPLOYEES
  // ===================================================

  const fetchEmployees =
    useCallback(
      async () => {
        try {
          setLoadingEmployees(
            true
          );

          const response =
            await api.get(
              "/employees",
              {
                params: {
                  client_id:
                    Number(
                      clientId
                    ),
                },
              }
            );

          const data =
            response?.data;

          const list =
            Array.isArray(
              data?.employees
            )
              ? data.employees
              : Array.isArray(
                  data?.data
                )
              ? data.data
              : [];

          setEmployees(list);
        } catch (err) {
          console.error(
            "Failed to fetch employees:",
            err
          );

          setError(
            err?.response
              ?.data?.error ||
              "Unable to load employees."
          );
        } finally {
          setLoadingEmployees(
            false
          );
        }
      },
      [clientId]
    );

  // ===================================================
  // FETCH DAILY ATTENDANCE
  // ===================================================

  const fetchDailyAttendance =
    useCallback(
      async () => {
        try {
          setLoadingDaily(
            true
          );

          const response =
            await api.get(
              "/attendance/daily",
              {
                params: {
                  client_id:
                    Number(
                      clientId
                    ),

                  attendance_date:
                    selectedDate,
                },
              }
            );

          const data =
            response?.data;

          const list =
            Array.isArray(
              data?.attendance
            )
              ? data.attendance
              : Array.isArray(
                  data?.data
                )
              ? data.data
              : [];

          setDailyAttendance(
            list
          );
        } catch (err) {
          console.error(
            "Failed to fetch daily attendance:",
            err
          );

          setError(
            err?.response
              ?.data?.error ||
              "Unable to load daily attendance."
          );

          setDailyAttendance([]);
        } finally {
          setLoadingDaily(
            false
          );
        }
      },
      [
        clientId,
        selectedDate,
      ]
    );

  // ===================================================
  // FETCH MONTHLY ATTENDANCE
  // ===================================================

  const fetchMonthlyAttendance =
    useCallback(
      async () => {
        try {
          setLoadingMonthly(
            true
          );

          const response =
            await api.get(
              "/attendance/monthly",
              {
                params: {
                  client_id:
                    Number(
                      clientId
                    ),

                  billing_month:
                    selectedMonth,
                },
              }
            );

          const data =
            response?.data;

          const list =
            Array.isArray(
              data?.data
            )
              ? data.data
              : Array.isArray(
                  data?.attendance
                )
              ? data.attendance
              : [];

          setMonthlyAttendance(
            list
          );
        } catch (err) {
          console.error(
            "Failed to fetch monthly attendance:",
            err
          );

          setError(
            err?.response
              ?.data?.error ||
              "Unable to load monthly attendance."
          );

          setMonthlyAttendance([]);
        } finally {
          setLoadingMonthly(
            false
          );
        }
      },
      [
        clientId,
        selectedMonth,
      ]
    );

  // ===================================================
  // FETCH EMPLOYEE MONTHLY DETAILS
  // ===================================================

  const openEmployeeDetails =
    async (employee) => {
      const employeeId =
        employee?.employee_id ||
        employee?.id;

      if (!employeeId) {
        setError(
          "Invalid employee ID."
        );
        return;
      }

      try {
        setLoadingDetails(
          true
        );

        setError("");

        const response =
          await api.get(
            "/attendance/monthly/employee",
            {
              params: {
                client_id:
                  Number(
                    clientId
                  ),

                employee_id:
                  Number(
                    employeeId
                  ),

                billing_month:
                  selectedMonth,
              },
            }
          );

        const data =
          response?.data;

        if (
          data?.success === false
        ) {
          throw new Error(
            data?.error ||
              "Unable to load employee attendance."
          );
        }

        setSelectedAttendance(
          data
        );
      } catch (err) {
        console.error(
          "Employee monthly attendance error:",
          err
        );

        setError(
          err?.response
            ?.data?.error ||
            err?.message ||
            "Unable to load employee attendance."
        );
      } finally {
        setLoadingDetails(
          false
        );
      }
    };

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ===================================================
  // DAILY LOAD
  // ===================================================

  useEffect(() => {
    fetchDailyAttendance();
  }, [fetchDailyAttendance]);

  // ===================================================
  // MONTHLY LOAD
  // ===================================================

  useEffect(() => {
    fetchMonthlyAttendance();
  }, [fetchMonthlyAttendance]);

  // ===================================================
  // FILTER DAILY
  // ===================================================

  const filteredDailyAttendance =
    useMemo(() => {
      let data = [
        ...dailyAttendance,
      ];

      if (
        statusFilter !==
        "all"
      ) {
        data =
          data.filter(
            (record) =>
              normalizeStatus(
                record?.status
              ) ===
              normalizeStatus(
                statusFilter
              )
          );
      }

      const search =
        searchTerm
          .trim()
          .toLowerCase();

      if (search) {
        data =
          data.filter(
            (record) => {
              const name =
                String(
                  record?.employee_name ||
                    record?.full_name ||
                    ""
                ).toLowerCase();

              const employeeId =
                String(
                  record?.employee_id ||
                    ""
                ).toLowerCase();

              return (
                name.includes(
                  search
                ) ||
                employeeId.includes(
                  search
                )
              );
            }
          );
      }

      return data;
    }, [
      dailyAttendance,
      searchTerm,
      statusFilter,
    ]);

  // ===================================================
  // FILTER MONTHLY
  // ===================================================

  const filteredMonthlyAttendance =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      if (!search) {
        return monthlyAttendance;
      }

      return monthlyAttendance.filter(
        (record) => {
          const name =
            String(
              record?.employee_name ||
                record?.full_name ||
                ""
            ).toLowerCase();

          const employeeId =
            String(
              record?.employee_id ||
                ""
            ).toLowerCase();

          return (
            name.includes(
              search
            ) ||
            employeeId.includes(
              search
            )
          );
        }
      );
    }, [
      monthlyAttendance,
      searchTerm,
    ]);

  // ===================================================
  // DAILY STATS
  // ===================================================

  const dailyStats =
    useMemo(() => {
      const total =
        dailyAttendance.length;

      let present = 0;
      let absent = 0;
      let leave = 0;
      let halfDay = 0;
      let overtime = 0;

      dailyAttendance.forEach(
        (record) => {
          const status =
            normalizeStatus(
              record?.status
            );

          if (
            status ===
            "present"
          ) {
            present++;
          }

          if (
            status ===
            "absent"
          ) {
            absent++;
          }

          if (
            status ===
              "leave" ||
            status ===
              "on_leave"
          ) {
            leave++;
          }

          if (
            status ===
              "half_day" ||
            status ===
              "halfday"
          ) {
            halfDay++;
          }

          overtime +=
            Number(
              record?.overtime_hours ||
                0
            );
        }
      );

      return {
        total,
        present,
        absent,
        leave,
        halfDay,
        overtime:
          Number(
            overtime.toFixed(
              2
            )
          ),
      };
    }, [dailyAttendance]);

  // ===================================================
  // REFRESH
  // ===================================================

  const handleRefresh =
    async () => {
      setError("");
      setSuccessMessage("");

      await Promise.all([
        fetchEmployees(),
        fetchDailyAttendance(),
        fetchMonthlyAttendance(),
      ]);

      setSuccessMessage(
        "Attendance data refreshed successfully."
      );
    };

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <Sidebar
        clientName={clientName}
        onLogout={handleLogout}
      />

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <main className="flex-1 min-w-0 overflow-x-auto">

        <div className="p-4 md:p-6">

          <div className="max-w-7xl mx-auto">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">

              <div>

                <div className="flex items-center gap-2">

                  <CalendarDays className="w-6 h-6 text-indigo-600" />

                  <h1 className="text-2xl md:text-3xl font-black text-slate-900">
                    Attendance
                  </h1>

                </div>

                <p className="text-sm text-slate-500 mt-1">
                  View employee daily and monthly attendance.
                </p>

              </div>

              <button
                onClick={
                  handleRefresh
                }
                disabled={
                  loadingEmployees ||
                  loadingDaily ||
                  loadingMonthly
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >

                <RefreshCw
                  className={`w-4 h-4 ${
                    loadingDaily ||
                    loadingMonthly
                      ? "animate-spin"
                      : ""
                  }`}
                />

                Refresh

              </button>

            </div>

            {/* =================================================
                ALERTS
            ================================================= */}

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">

                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />

                <div className="flex-1 text-sm font-medium">
                  {error}
                </div>

                <button
                  onClick={() =>
                    setError("")
                  }
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>

              </div>
            )}

            {successMessage && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">

                <CheckCircle2 className="w-5 h-5 shrink-0" />

                <div className="flex-1 text-sm font-medium">
                  {successMessage}
                </div>

                <button
                  onClick={() =>
                    setSuccessMessage(
                      ""
                    )
                  }
                  className="text-emerald-500 hover:text-emerald-700"
                >
                  <X className="w-4 h-4" />
                </button>

              </div>
            )}

            {/* =================================================
                FILTERS
            ================================================= */}

            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm">

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* MONTH */}

                <div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Billing Month
                  </label>

                  <div className="relative">

                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                    <input
                      type="month"
                      value={
                        selectedMonth
                      }
                      onChange={(
                        e
                      ) =>
                        setSelectedMonth(
                          e.target
                            .value
                        )
                      }
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />

                  </div>

                </div>

                {/* DATE */}

                <div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Attendance Date
                  </label>

                  <div className="relative">

                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                    <input
                      type="date"
                      value={
                        selectedDate
                      }
                      onChange={(
                        e
                      ) =>
                        setSelectedDate(
                          e.target
                            .value
                        )
                      }
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />

                  </div>

                </div>

                {/* SEARCH */}

                <div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Search Employee
                  </label>

                  <div className="relative">

                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

                    <input
                      type="text"
                      value={
                        searchTerm
                      }
                      onChange={(
                        e
                      ) =>
                        setSearchTerm(
                          e.target
                            .value
                        )
                      }
                      placeholder="Name or employee ID..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />

                  </div>

                </div>

              </div>

            </div>

            {/* =================================================
                STATS
            ================================================= */}

            {activeTab ===
              "daily" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">

                <StatCard
                  title="Employees"
                  value={
                    dailyStats.total
                  }
                  icon={Users}
                  description="Records today"
                />

                <StatCard
                  title="Present"
                  value={
                    dailyStats.present
                  }
                  icon={UserCheck}
                  description="Present today"
                  iconClass="bg-emerald-50 text-emerald-600"
                />

                <StatCard
                  title="Absent"
                  value={
                    dailyStats.absent
                  }
                  icon={UserX}
                  description="Absent today"
                  iconClass="bg-red-50 text-red-600"
                />

                <StatCard
                  title="Leave"
                  value={
                    dailyStats.leave
                  }
                  icon={Coffee}
                  description="On leave"
                  iconClass="bg-blue-50 text-blue-600"
                />

                <StatCard
                  title="Overtime"
                  value={`${dailyStats.overtime.toFixed(
                    2
                  )} hrs`}
                  icon={Timer}
                  description="Total OT"
                  iconClass="bg-indigo-50 text-indigo-600"
                />

              </div>
            )}

            {/* =================================================
                TABS
            ================================================= */}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

              <div className="border-b border-slate-200 px-4 md:px-6">

                <div className="flex gap-6">

                  <button
                    onClick={() =>
                      setActiveTab(
                        "daily"
                      )
                    }
                    className={`py-4 text-sm font-bold border-b-2 ${
                      activeTab ===
                      "daily"
                        ? "text-indigo-600 border-indigo-600"
                        : "text-slate-500 border-transparent hover:text-slate-800"
                    }`}
                  >
                    Daily Attendance
                  </button>

                  <button
                    onClick={() =>
                      setActiveTab(
                        "monthly"
                      )
                    }
                    className={`py-4 text-sm font-bold border-b-2 ${
                      activeTab ===
                      "monthly"
                        ? "text-indigo-600 border-indigo-600"
                        : "text-slate-500 border-transparent hover:text-slate-800"
                    }`}
                  >
                    Monthly Attendance
                  </button>

                </div>

              </div>

              {/* =================================================
                  DAILY TAB
              ================================================= */}

              {activeTab ===
                "daily" && (
                <div>

                  <div className="p-4 md:p-6 border-b border-slate-200">

                    <div className="flex justify-end">

                      <select
                        value={
                          statusFilter
                        }
                        onChange={(
                          e
                        ) =>
                          setStatusFilter(
                            e.target
                              .value
                          )
                        }
                        className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
                      >

                        <option value="all">
                          All Status
                        </option>

                        <option value="present">
                          Present
                        </option>

                        <option value="absent">
                          Absent
                        </option>

                        <option value="leave">
                          Leave
                        </option>

                        <option value="half_day">
                          Half Day
                        </option>

                      </select>

                    </div>

                  </div>

                  {loadingDaily ? (
                    <div className="py-16 flex items-center justify-center">

                      <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />

                    </div>
                  ) : filteredDailyAttendance.length ===
                    0 ? (
                    <EmptyState
                      icon={
                        CalendarDays
                      }
                      title="No daily attendance"
                      description={`No attendance records were found for ${formatDate(
                        selectedDate
                      )}.`}
                    />
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full text-left">

                        <thead className="bg-slate-50 border-b border-slate-200">

                          <tr>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Employee
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Date
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Check In
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Check Out
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Hours
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              OT
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Status
                            </th>

                          </tr>

                        </thead>

                        <tbody className="divide-y divide-slate-100">

                          {filteredDailyAttendance.map(
                            (
                              record,
                              index
                            ) => (
                              <tr
                                key={
                                  record?.id ||
                                  `${record?.employee_id}-${index}`
                                }
                                className="hover:bg-slate-50/70"
                              >

                                <td className="px-5 py-4">

                                  <div className="font-bold text-sm text-slate-800">
                                    {record?.employee_name ||
                                      record?.full_name ||
                                      "Unknown Employee"}
                                  </div>

                                  <div className="text-xs text-slate-500 mt-1">
                                    ID:{" "}
                                    {record?.employee_id ||
                                      "-"}
                                  </div>

                                </td>

                                <td className="px-5 py-4 text-sm text-slate-600">
                                  {formatDate(
                                    record?.attendance_date
                                  )}
                                </td>

                                <td className="px-5 py-4 text-sm text-slate-600">
                                  {formatTime(
                                    record?.check_in
                                  )}
                                </td>

                                <td className="px-5 py-4 text-sm text-slate-600">
                                  {formatTime(
                                    record?.check_out
                                  )}
                                </td>

                                <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                  {formatHours(
                                    record?.working_hours
                                  )}
                                </td>

                                <td className="px-5 py-4 text-sm font-semibold text-indigo-600">
                                  {formatHours(
                                    record?.overtime_hours
                                  )}
                                </td>

                                <td className="px-5 py-4">

                                  <StatusBadge
                                    status={
                                      record?.status
                                    }
                                  />

                                </td>

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>
                  )}

                </div>
              )}

              {/* =================================================
                  MONTHLY TAB
              ================================================= */}

              {activeTab ===
                "monthly" && (
                <div>

                  {loadingMonthly ? (
                    <div className="py-16 flex items-center justify-center">

                      <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />

                    </div>
                  ) : filteredMonthlyAttendance.length ===
                    0 ? (
                    <EmptyState
                      icon={
                        CalendarDays
                      }
                      title="No monthly attendance"
                      description={`No attendance records were found for ${getMonthLabel(
                        selectedMonth
                      )}.`}
                    />
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full text-left">

                        <thead className="bg-slate-50 border-b border-slate-200">

                          <tr>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Employee
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Present
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Absent
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Leave
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Half Days
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Working Days
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              LOP
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Overtime
                            </th>

                            <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500 text-right">
                              Details
                            </th>

                          </tr>

                        </thead>

                        <tbody className="divide-y divide-slate-100">

                          {filteredMonthlyAttendance.map(
                            (
                              record,
                              index
                            ) => (
                              <tr
                                key={
                                  record?.employee_id ||
                                  index
                                }
                                className="hover:bg-slate-50/70"
                              >

                                <td className="px-5 py-4">

                                  <div className="font-bold text-sm text-slate-800">
                                    {record?.employee_name ||
                                      record?.full_name ||
                                      "Unknown Employee"}
                                  </div>

                                  <div className="text-xs text-slate-500 mt-1">
                                    ID:{" "}
                                    {record?.employee_id ||
                                      "-"}
                                  </div>

                                </td>

                                <td className="px-5 py-4 text-sm font-bold text-emerald-600">
                                  {record?.present_days ??
                                    0}
                                </td>

                                <td className="px-5 py-4 text-sm font-bold text-red-600">
                                  {record?.absent_days ??
                                    0}
                                </td>

                                <td className="px-5 py-4 text-sm font-bold text-blue-600">
                                  {record?.leave_days ??
                                    0}
                                </td>

                                <td className="px-5 py-4 text-sm font-bold text-purple-600">
                                  {record?.half_days ??
                                    0}
                                </td>

                                <td className="px-5 py-4 text-sm font-bold text-slate-700">
                                  {record?.working_days ??
                                    0}
                                </td>

                                <td className="px-5 py-4 text-sm font-bold text-orange-600">
                                  {record?.lop_days ??
                                    0}
                                </td>

                                <td className="px-5 py-4 text-sm font-bold text-indigo-600">
                                  {formatHours(
                                    record?.overtime_hours
                                  )}
                                </td>

                                <td className="px-5 py-4 text-right">

                                  <button
                                    onClick={() =>
                                      openEmployeeDetails(
                                        record
                                      )
                                    }
                                    disabled={
                                      loadingDetails
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                                  >

                                    {loadingDetails ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}

                                    View

                                  </button>

                                </td>

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>
                  )}

                </div>
              )}

            </div>

          </div>

        </div>

      </main>

      {/* =================================================
          DETAIL DRAWER
      ================================================= */}

      {selectedAttendance && (
        <AttendanceDetailDrawer
          attendance={
            selectedAttendance
          }
          onClose={() =>
            setSelectedAttendance(
              null
            )
          }
        />
      )}

    </div>
  );
}