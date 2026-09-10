import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Eye,
  Loader2,
  Filter,
  RefreshCw,
  CalendarDays,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";

import API_BASE_URL from "../../config/api";
// =====================================================
// HELPERS
// =====================================================

const firstValue = (...values) => {
  for (const value of values) {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "null"
    ) {
      return value;
    }
  }

  return null;
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

// =====================================================
// EMPLOYEE
// =====================================================

const getEmployeeName = (record) =>
  firstValue(
    record.employee_name,
    record.employeeName,
    record.employee?.name,
    record.employees?.name,
    "Unknown Employee"
  );

const getEmployeeId = (record) =>
  firstValue(
    record.employee_id,
    record.employeeId,
    record.employee?.id,
    record.employees?.id,
    null
  );

// =====================================================
// CLIENT
// =====================================================

const getClientName = (record) =>
  firstValue(
    record.client,
    record.client_name,
    record.clientName,
    record.clients?.company_name,
    record.client?.company_name,
    record.client?.name,
    "Unknown Client"
  );

const getClientId = (record) =>
  firstValue(
    record.client_id,
    record.clientId,
    record.clients?.id,
    record.client?.id,
    null
  );

// =====================================================
// BILLING MONTH
// =====================================================

const getBillingMonth = (record) =>
  firstValue(
    record.billing_month,
    record.billingMonth,
    record.month,
    "N/A"
  );

// =====================================================
// ATTENDANCE VALUES
// =====================================================

const getPresentDays = (record) =>
  toNumber(
    firstValue(
      record.present_days,
      record.presentDays,
      record.total_present_days,
      0
    )
  );

const getLeaveDays = (record) =>
  toNumber(
    firstValue(
      record.leave_days,
      record.leaveDays,
      0
    )
  );

const getAbsentDays = (record) =>
  toNumber(
    firstValue(
      record.lop_days,
      record.lopDays,
      record.absent_days,
      record.absentDays,
      0
    )
  );

const getOvertime = (record) =>
  toNumber(
    firstValue(
      record.ot_hours,
      record.overtime_hours,
      record.overtimeHours,
      record.overtime,
      0
    )
  );

const getTotalDays = (record) =>
  toNumber(
    firstValue(
      record.total_days,
      record.totalDays,
      0
    )
  );

// =====================================================
// MAIN COMPONENT
// =====================================================

function Attendance({
  activeTab,
  setActiveTab,
}) {
  const [attendanceRecords, setAttendanceRecords] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [clientFilter, setClientFilter] =
    useState("All");

  const [monthFilter, setMonthFilter] =
    useState("");

  // =====================================================
  // FETCH ATTENDANCE
  // =====================================================

  const fetchAttendance = async (
    isRefresh = false
  ) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_BASE}/third-party-attendance`,
        {
          method: "GET",

          headers: {
            "Content-Type":
              "application/json",

            ...(token
              ? {
                  Authorization:
                    `Bearer ${token}`,
                }
              : {}),
          },
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        console.error(
          "Admin attendance API error:",
          errorText
        );

        throw new Error(
          `Attendance request failed with status ${response.status}`
        );
      }

      const result =
        await response.json();

      console.log(
        "Third-party attendance API response:",
        result
      );

      const records =
        Array.isArray(result)
          ? result
          : Array.isArray(result.data)
          ? result.data
          : [];

      setAttendanceRecords(records);

      // =================================================
      // AUTOMATICALLY SELECT LATEST MONTH
      // =================================================

      if (records.length > 0) {
        const uniqueMonths = [
          ...new Set(
            records
              .map(getBillingMonth)
              .filter(
                (month) =>
                  month &&
                  month !== "N/A"
              )
          ),
        ];

        if (uniqueMonths.length > 0) {
          const sortedMonths =
            [...uniqueMonths].sort(
              (a, b) =>
                String(b).localeCompare(
                  String(a)
                )
            );

          setMonthFilter((current) => {
            if (
              current &&
              uniqueMonths.includes(current)
            ) {
              return current;
            }

            return sortedMonths[0];
          });
        }
      } else {
        setMonthFilter("");
      }
    } catch (err) {
      console.error(
        "Error fetching admin attendance:",
        err
      );

      setError(
        "Failed to load attendance records. Please check the server."
      );

      setAttendanceRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    fetchAttendance();
  }, []);

  // =====================================================
  // MONTH OPTIONS
  // =====================================================

  const months = useMemo(() => {
    const uniqueMonths = [
      ...new Set(
        attendanceRecords
          .map(getBillingMonth)
          .filter(
            (month) =>
              month &&
              month !== "N/A"
          )
      ),
    ];

    return uniqueMonths.sort((a, b) =>
      String(b).localeCompare(String(a))
    );
  }, [attendanceRecords]);

  // =====================================================
  // CLIENT OPTIONS
  // BASED ON SELECTED MONTH
  // =====================================================

  const clients = useMemo(() => {
    const monthRecords =
      monthFilter
        ? attendanceRecords.filter(
            (record) =>
              getBillingMonth(record) ===
              monthFilter
          )
        : attendanceRecords;

    const uniqueClients = [
      ...new Set(
        monthRecords
          .map(getClientName)
          .filter(
            (name) =>
              name &&
              name !== "Unknown Client"
          )
      ),
    ];

    return ["All", ...uniqueClients];
  }, [
    attendanceRecords,
    monthFilter,
  ]);

  // =====================================================
  // FILTERED RECORDS
  // =====================================================

  const visibleRecords = useMemo(() => {
    return attendanceRecords.filter(
      (record) => {
        const recordMonth =
          getBillingMonth(record);

        const recordClient =
          getClientName(record);

        const monthMatches =
          !monthFilter ||
          recordMonth === monthFilter;

        const clientMatches =
          clientFilter === "All" ||
          recordClient === clientFilter;

        return (
          monthMatches &&
          clientMatches
        );
      }
    );
  }, [
    attendanceRecords,
    monthFilter,
    clientFilter,
  ]);

  // =====================================================
  // SUMMARY COUNTS
  // =====================================================

  const totalStaff =
    visibleRecords.length;

  const totalClients =
    new Set(
      visibleRecords
        .map(getClientId)
        .filter(Boolean)
    ).size ||
    new Set(
      visibleRecords
        .map(getClientName)
        .filter(
          (name) =>
            name &&
            name !== "Unknown Client"
        )
    ).size;

  const totalPresentDays =
    visibleRecords.reduce(
      (total, record) =>
        total +
        getPresentDays(record),
      0
    );

  const totalLeaveDays =
    visibleRecords.reduce(
      (total, record) =>
        total +
        getLeaveDays(record),
      0
    );

  const totalAbsentDays =
    visibleRecords.reduce(
      (total, record) =>
        total +
        getAbsentDays(record),
      0
    );

  const totalOvertime =
    visibleRecords.reduce(
      (total, record) =>
        total +
        getOvertime(record),
      0
    );

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">

        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main className="flex-1 flex items-center justify-center">

          <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">

            <Loader2 className="h-5 w-5 animate-spin" />

            Loading attendance records...

          </div>

        </main>

      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="flex min-h-screen bg-slate-50">

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">

          <div>

            <h1 className="text-2xl font-bold text-slate-900">
              Attendance Monitor
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Monthly attendance summary across
              all client deployments.
            </p>

            {monthFilter && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">

                <CalendarDays className="h-4 w-4 text-slate-500" />

                <span className="text-xs font-bold text-slate-700">
                  Showing: {monthFilter}
                </span>

              </div>
            )}

          </div>

          {/* =================================================
              FILTERS
          ================================================= */}

          <div className="flex flex-wrap items-center gap-3">

            {/* MONTH */}

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">

              <CalendarDays className="h-4 w-4 text-slate-400" />

              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(
                    e.target.value
                  );

                  setClientFilter("All");
                }}
                className="text-xs font-semibold text-slate-700 bg-transparent outline-none min-w-[150px]"
              >

                {months.length === 0 ? (

                  <option value="">
                    No months
                  </option>

                ) : (

                  months.map((month) => (
                    <option
                      key={month}
                      value={month}
                    >
                      {month}
                    </option>
                  ))
                )}

              </select>

            </div>

            {/* CLIENT */}

            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">

              <Filter className="h-4 w-4 text-slate-400" />

              <select
                value={clientFilter}
                onChange={(e) =>
                  setClientFilter(
                    e.target.value
                  )
                }
                className="text-xs font-semibold text-slate-700 bg-transparent outline-none min-w-[140px]"
              >

                {clients.map(
                  (client) => (
                    <option
                      key={client}
                      value={client}
                    >
                      {client}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* REFRESH */}

            <button
              type="button"
              onClick={() =>
                fetchAttendance(true)
              }
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >

              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh"}

            </button>

          </div>

        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">

            {error}

          </div>
        )}

        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* CLIENTS */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Clients
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {totalClients}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              {monthFilter || "Selected month"}
            </p>

          </div>

          {/* STAFF */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Staff
            </p>

            <p className="text-3xl font-bold text-slate-900 mt-2">
              {totalStaff}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Employees
            </p>

          </div>

          {/* PRESENT */}

          <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">

            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Present Days
            </p>

            <p className="text-3xl font-bold text-emerald-600 mt-2">
              {totalPresentDays}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Total recorded
            </p>

          </div>

          {/* OVERTIME */}

          <div className="bg-white border border-indigo-200 rounded-2xl p-5 shadow-sm">

            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              Overtime
            </p>

            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {totalOvertime}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Total hours
            </p>

          </div>

        </div>

        {/* =================================================
            ADDITIONAL ATTENDANCE TOTALS
        ================================================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm">

            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Leave Days
            </p>

            <p className="text-3xl font-bold text-blue-600 mt-2">
              {totalLeaveDays}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Total leave recorded
            </p>

          </div>

          <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm">

            <p className="text-xs font-bold text-red-600 uppercase tracking-wider">
              Absent / LOP
            </p>

            <p className="text-3xl font-bold text-red-600 mt-2">
              {totalAbsentDays}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Total absent days
            </p>

          </div>

        </div>

        {/* =================================================
            MONTHLY ATTENDANCE TABLE
        ================================================= */}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* TABLE HEADER */}

          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <div className="flex items-center gap-3">

              <div className="p-2 rounded-lg bg-slate-100">
                <Eye className="h-4 w-4 text-slate-500" />
              </div>

              <div>

                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Monthly Attendance Summary
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  {monthFilter
                    ? `Showing attendance for ${monthFilter}`
                    : "Select a billing month"}
                </p>

              </div>

            </div>

            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">

              {visibleRecords.length} employee
              {visibleRecords.length !== 1
                ? "s"
                : ""}

            </span>

          </div>

          {/* TABLE */}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1000px] text-left border-collapse">

              <thead>

                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase">

                  <th className="p-4">
                    Employee
                  </th>

                  <th className="p-4">
                    Role
                  </th>

                  <th className="p-4">
                    Client
                  </th>

                  <th className="p-4">
                    Billing Month
                  </th>

                  <th className="p-4">
                    Present Days
                  </th>

                  <th className="p-4">
                    Leave
                  </th>

                  <th className="p-4">
                    Absent / LOP
                  </th>

                  <th className="p-4">
                    Overtime
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">

                {visibleRecords.length === 0 ? (

                  <tr>

                    <td
                      colSpan="8"
                      className="p-12 text-center"
                    >

                      <Eye className="h-10 w-10 text-slate-300 mx-auto mb-3" />

                      <p className="text-sm font-semibold text-slate-600">
                        No attendance records found
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        No attendance summary is
                        available for{" "}
                        {monthFilter ||
                          "the selected month"}.
                      </p>

                    </td>

                  </tr>

                ) : (

                  visibleRecords.map(
                    (record) => {

                      const employeeName =
                        getEmployeeName(
                          record
                        );

                      const employeeId =
                        getEmployeeId(
                          record
                        );

                      const role =
                        firstValue(
                          record.role,
                          record.designation,
                          "N/A"
                        );

                      const clientName =
                        getClientName(
                          record
                        );

                      const month =
                        getBillingMonth(
                          record
                        );

                      const presentDays =
                        getPresentDays(
                          record
                        );

                      const leaveDays =
                        getLeaveDays(
                          record
                        );

                      const absentDays =
                        getAbsentDays(
                          record
                        );

                      const overtime =
                        getOvertime(
                          record
                        );

                      const totalDays =
                        getTotalDays(
                          record
                        );

                      return (

                        <tr
                          key={
                            record.id ||
                            `${employeeId}-${month}`
                          }
                          className="hover:bg-slate-50 transition"
                        >

                          {/* EMPLOYEE */}

                          <td className="p-4">

                            <div className="font-bold text-slate-900">
                              {employeeName}
                            </div>

                            {employeeId && (
                              <div className="text-xs text-slate-400 mt-1">
                                Employee ID:{" "}
                                {employeeId}
                              </div>
                            )}

                          </td>

                          {/* ROLE */}

                          <td className="p-4">

                            <div className="font-semibold text-slate-700">
                              {role}
                            </div>

                          </td>

                          {/* CLIENT */}

                          <td className="p-4">

                            <div className="font-semibold text-slate-800">
                              {clientName}
                            </div>

                            {getClientId(
                              record
                            ) && (
                              <div className="text-xs text-slate-400 mt-1">
                                Client ID:{" "}
                                {getClientId(
                                  record
                                )}
                              </div>
                            )}

                          </td>

                          {/* MONTH */}

                          <td className="p-4">

                            <div className="text-sm font-semibold text-slate-700">
                              {month}
                            </div>

                            {totalDays > 0 && (
                              <div className="text-xs text-slate-400 mt-1">
                                {totalDays} calendar days
                              </div>
                            )}

                          </td>

                          {/* PRESENT */}

                          <td className="p-4">

                            <span className="font-bold text-emerald-600">
                              {presentDays}
                            </span>

                            <span className="text-slate-400 ml-1 text-xs">
                              days
                            </span>

                          </td>

                          {/* LEAVE */}

                          <td className="p-4">

                            <span className="font-semibold text-blue-600">
                              {leaveDays}
                            </span>

                            <span className="text-slate-400 ml-1 text-xs">
                              days
                            </span>

                          </td>

                          {/* ABSENT */}

                          <td className="p-4">

                            <span className="font-semibold text-red-600">
                              {absentDays}
                            </span>

                            <span className="text-slate-400 ml-1 text-xs">
                              days
                            </span>

                          </td>

                          {/* OVERTIME */}

                          <td className="p-4">

                            <span className="font-semibold text-slate-700">
                              {overtime}
                            </span>

                            <span className="text-slate-400 ml-1 text-xs">
                              hrs
                            </span>

                          </td>

                        </tr>

                      );
                    }
                  )

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-400">

          <p>
            Attendance access:
            <span className="ml-1 font-semibold text-slate-500">
              Read Only
            </span>
          </p>

          <p>
            Payroll attendance data:
            <span className="ml-1 font-semibold text-slate-500">
              Monthly Summary
            </span>
          </p>

        </div>

      </main>

    </div>
  );
}

export default Attendance;