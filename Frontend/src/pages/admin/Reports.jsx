
import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import axios from "axios";

import {
  FileText,
  Users,
  UserCheck,
  Wallet,
  Building2,
  IndianRupee,
  Download,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertCircle,
} from "lucide-react";

import Sidebar from "./Layout/Sidebar";

import api from '../services/api'

function Reports({
  activeTab,
  setActiveTab,
}) {
  // =========================================================
  // STATE
  // =========================================================

  const [employees, setEmployees] =
    useState([]);

  const [deployments, setDeployments] =
    useState([]);

  const [payroll, setPayroll] =
    useState([]);

  const [attendance, setAttendance] =
    useState([]);

  const [invoices, setInvoices] =
    useState([]);

  const [payments, setPayments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [reportType, setReportType] =
    useState("overview");

  const [month, setMonth] =
    useState("2026-08");

  // =========================================================
  // HELPERS
  // =========================================================

  const normalize = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();

  const getMonthValue = (value) => {
    if (!value) return "";

    const stringValue =
      String(value);

    // Handles:
    // 2026-08
    // 2026-08-01
    // 2026-08-01T00:00:00
    return stringValue.slice(0, 7);
  };

  const formatCurrency = (value) => {
    const amount = Number(value ?? 0);

    return `₹ ${amount.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  // =========================================================
  // FETCH REPORTS
  // =========================================================

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError("");

      console.log(
        "========================================="
      );

      console.log(
        "Loading Reports"
      );

      console.log(
        "Month:",
        month
      );

      console.log(
        "URL:",
        `${API_BASE}/reports/summary`
      );

      console.log(
        "========================================="
      );

      const response = await api.get("/reports/summary", {
  params: {
    month,
  },
  timeout: 15000,
});

      const data =
        response?.data;

      console.log(
        "REPORT API RESPONSE:",
        data
      );

      // -------------------------------------------------------
      // Validate response
      // -------------------------------------------------------

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to load reports."
        );
      }

      // -------------------------------------------------------
      // Store only arrays
      // -------------------------------------------------------

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setDeployments(
        Array.isArray(
          data.deployments
        )
          ? data.deployments
          : []
      );

      setPayroll(
        Array.isArray(
          data.payroll
        )
          ? data.payroll
          : []
      );

      setAttendance(
        Array.isArray(
          data.attendance
        )
          ? data.attendance
          : []
      );

      setInvoices(
        Array.isArray(
          data.invoices
        )
          ? data.invoices
          : []
      );

      setPayments(
        Array.isArray(
          data.payments
        )
          ? data.payments
          : []
      );

    } catch (err) {
      console.error(
        "Reports loading error:",
        err
      );

      console.error(
        "Reports response:",
        err?.response?.data
      );

      // Clear data on error
      setEmployees([]);
      setDeployments([]);
      setPayroll([]);
      setAttendance([]);
      setInvoices([]);
      setPayments([]);

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Failed to load reports."
      );

    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOAD WHEN MONTH CHANGES
  // =========================================================

  useEffect(() => {
    fetchReports();
  }, [month]);

  // =========================================================
  // EMPLOYEE LOOKUP
  // =========================================================

  const employeeMap = useMemo(() => {
    const map = new Map();

    employees.forEach(
      (employee) => {
        map.set(
          Number(employee.id),
          employee
        );
      }
    );

    return map;
  }, [employees]);

  // =========================================================
  // DEPLOYMENT LOOKUP
  // =========================================================

  const deploymentMap =
    useMemo(() => {
      const map = new Map();

      deployments.forEach(
        (deployment) => {
          map.set(
            Number(deployment.id),
            deployment
          );
        }
      );

      return map;
    }, [deployments]);

  // =========================================================
  // MONTH FILTERS
  // =========================================================

  const selectedMonthPayroll =
    useMemo(() => {
      return payroll.filter(
        (item) =>
          getMonthValue(
            item.salary_month ??
              item.month
          ) === month
      );
    }, [payroll, month]);

  const selectedMonthAttendance =
    useMemo(() => {
      return attendance
        .filter(
          (item) =>
            getMonthValue(
              item.billing_month ??
                item.month ??
                item.attendance_month
            ) === month
        )
        .sort(
          (a, b) =>
            Number(b.employee_id ?? 0) -
            Number(a.employee_id ?? 0)
        );
    }, [attendance, month]);

  const selectedMonthInvoices =
    useMemo(() => {
      return invoices.filter(
        (item) =>
          getMonthValue(
            item.billing_month ??
              item.invoice_month ??
              item.month ??
              item.invoice_date
          ) === month
      );
    }, [invoices, month]);

  const selectedMonthPayments =
    useMemo(() => {
      return payments.filter(
        (item) =>
          getMonthValue(
            item.payment_date
          ) === month
      );
    }, [payments, month]);

  // =========================================================
  // STATS
  // =========================================================

  const stats = useMemo(() => {

    // -------------------------------------------------------
    // Active employees
    // employees table uses employment_status
    // -------------------------------------------------------

    const activeEmployees =
      employees.filter(
        (employee) =>
          normalize(
            employee.employment_status
          ) === "active"
      ).length;

    // -------------------------------------------------------
    // Active deployments
    // -------------------------------------------------------

    const activeDeployments =
      deployments.filter(
        (deployment) => {
          const status =
            normalize(
              deployment.status
            );

          return (
            status === "active" ||
            status === "deployed"
          );
        }
      ).length;

    // -------------------------------------------------------
    // Payroll
    // -------------------------------------------------------

    const totalPayroll =
      selectedMonthPayroll.reduce(
        (sum, item) =>
          sum +
          Number(
            item.net_salary ??
              item.netSalary ??
              0
          ),
        0
      );

    const grossPayroll =
      selectedMonthPayroll.reduce(
        (sum, item) =>
          sum +
          Number(
            item.gross_salary ??
              item.grossSalary ??
              0
          ),
        0
      );

    // -------------------------------------------------------
    // Billing
    // -------------------------------------------------------

    const totalBilling =
      selectedMonthInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(
            invoice.total_amount ??
              invoice.invoice_amount ??
              invoice.amount ??
              0
          ),
        0
      );

    // -------------------------------------------------------
    // Payments
    // -------------------------------------------------------

    const totalPaid =
      selectedMonthPayments.reduce(
        (sum, payment) =>
          sum +
          Number(
            payment.amount_received ??
              payment.amount_paid ??
              payment.amount_reported ??
              0
          ),
        0
      );

    // -------------------------------------------------------
    // Payroll statuses
    // -------------------------------------------------------

    const pendingPayroll =
      selectedMonthPayroll.filter(
        (item) => {
          const status =
            normalize(
              item.status
            );

          return (
            status === "pending" ||
            status === "draft"
          );
        }
      ).length;

    const approvedPayroll =
      selectedMonthPayroll.filter(
        (item) =>
          normalize(
            item.status
          ) === "approved"
      ).length;

    // -------------------------------------------------------
    // Attendance statuses
    // -------------------------------------------------------

    const pendingAttendance =
      selectedMonthAttendance.filter(
        (item) =>
          normalize(
            item.status
          ) === "pending"
      ).length;

    const approvedAttendance =
      selectedMonthAttendance.filter(
        (item) =>
          normalize(
            item.status
          ) === "approved"
      ).length;

    // -------------------------------------------------------
    // Invoice statuses
    // -------------------------------------------------------

    const pendingInvoices =
      selectedMonthInvoices.filter(
        (item) => {
          const status =
            normalize(
              item.payment_status
            );

          return (
            status === "pending" ||
            status === "unpaid"
          );
        }
      ).length;

    return {
      activeEmployees,
      activeDeployments,
      totalPayroll,
      grossPayroll,
      totalBilling,
      totalPaid,
      pendingPayroll,
      approvedPayroll,
      pendingAttendance,
      approvedAttendance,
      pendingInvoices,
    };
  }, [
    employees,
    deployments,
    selectedMonthPayroll,
    selectedMonthAttendance,
    selectedMonthInvoices,
    selectedMonthPayments,
  ]);

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const exportCSV = () => {
    let rows = [];

    // -------------------------------------------------------
    // PAYROLL
    // -------------------------------------------------------

    if (
      reportType ===
      "payroll"
    ) {
      rows =
        selectedMonthPayroll.map(
          (item) => ({
            Employee:
              item.employee_name ||
              employeeMap.get(
                Number(
                  item.employee_ref_id
                )
              )?.full_name ||
              `EMP-${item.employee_ref_id || item.id}`,

            Month:
              item.salary_month ||
              month,

            "Basic Salary":
              item.basic_salary ??
              0,

            Allowances:
              item.allowances ??
              0,

            Overtime:
              item.overtime ??
              0,

            "Gross Salary":
              item.gross_salary ??
              0,

            PF:
              item.pf ??
              0,

            ESIC:
              item.esic ??
              0,

            TDS:
              item.tax ??
              0,

            LOP:
              item.lop ??
              0,

            "Professional Tax":
              item.professional_tax ??
              0,

            "Total Deductions":
              item.total_deductions ??
              0,

            "Net Salary":
              item.net_salary ??
              0,

            Status:
              item.status ||
              "",
          })
        );
    }

    // -------------------------------------------------------
    // ATTENDANCE
    // -------------------------------------------------------

    else if (
      reportType ===
      "attendance"
    ) {
      rows =
        selectedMonthAttendance.map(
          (item) => {

            const employee =
              employeeMap.get(
                Number(
                  item.employee_id ??
                    item.employee_ref_id
                )
              );

            return {
              Employee:
                employee?.full_name ||
                `EMP-${
                  item.employee_id ??
                  item.employee_ref_id ??
                  item.id
                }`,

              Month:
                item.billing_month ||
                month,

              "Total Days":
                item.total_days ??
                0,

              "Present Days":
                item.present_days ??
                0,

              "Absent Days":
                item.absent_days ??
                0,

              "Leave Days":
                item.leave_days ??
                0,

              "LOP Days":
                item.lop_days ??
                0,

              "Payable Days":
                item.payable_days ??
                0,

              "OT Hours":
                item.overtime_hours ??
                item.ot_hours ??
                0,

              Status:
                item.status ||
                "",
            };
          }
        );
    }

    // -------------------------------------------------------
    // BILLING
    // -------------------------------------------------------

    else if (
      reportType ===
      "billing"
    ) {
      rows =
        selectedMonthInvoices.map(
          (item) => ({
            "Invoice Number":
              item.invoice_number ||
              `INV-${item.id}`,

            Client:
              item.client_name ||
              item.company_name ||
              `Client #${
                item.client_id || ""
              }`,

            "Invoice Amount":
              item.total_amount ??
              item.invoice_amount ??
              0,

            "Payment Status":
              item.payment_status ||
              "",

            "Billing Month":
              item.billing_month ||
              month,

            "Invoice Date":
              item.invoice_date ||
              item.created_at ||
              "",
          })
        );
    }

    // -------------------------------------------------------
    // OVERVIEW
    // -------------------------------------------------------

    else {
      rows =
        selectedMonthPayroll.map(
          (item) => ({
            Employee:
              item.employee_name ||
              employeeMap.get(
                Number(
                  item.employee_ref_id
                )
              )?.full_name ||
              `EMP-${item.employee_ref_id || item.id}`,

            Month:
              item.salary_month ||
              month,

            "Gross Salary":
              item.gross_salary ??
              0,

            "Net Salary":
              item.net_salary ??
              0,

            Status:
              item.status ||
              "",
          })
        );
    }

    if (!rows.length) {
      alert(
        "No data available for export."
      );
      return;
    }

    const headers =
      Object.keys(rows[0]);

    const csv = [
      headers.join(","),

      ...rows.map(
        (row) =>
          headers
            .map((header) => {
              const value =
                row[header] ??
                "";

              return `"${String(
                value
              ).replace(
                /"/g,
                '""'
              )}"`;
            })
            .join(",")
      ),
    ].join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `Talent-Corner-${reportType}-${month}.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );
  };

  // =========================================================
  // STAT CARD
  // =========================================================

  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
  }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {title}
          </p>

          <h3 className="text-2xl font-bold text-slate-900 mt-2">
            {value}
          </h3>

          {subtitle && (
            <p className="text-xs text-slate-400 mt-1">
              {subtitle}
            </p>
          )}

        </div>

        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
          <Icon className="h-5 w-5" />
        </div>

      </div>

    </div>
  );

  // =========================================================
  // STATUS BADGE
  // =========================================================

  const StatusBadge = ({
    status,
  }) => {

    const value =
      normalize(status);

    let classes =
      "bg-slate-100 text-slate-600";

    if (
      value === "approved" ||
      value === "verified" ||
      value === "paid" ||
      value === "active"
    ) {
      classes =
        "bg-emerald-50 text-emerald-600";
    }

    if (
      value === "pending" ||
      value === "draft"
    ) {
      classes =
        "bg-amber-50 text-amber-600";
    }

    if (
      value === "rejected" ||
      value === "failed"
    ) {
      classes =
        "bg-rose-50 text-rose-600";
    }

    return (
      <span
        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${classes}`}
      >
        {status || "N/A"}
      </span>
    );
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="flex min-h-screen bg-slate-50">

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">

          <div>

            <div className="flex items-center gap-2">

              <FileText className="h-6 w-6 text-indigo-600" />

              <h1 className="text-2xl font-bold text-slate-900">
                Reports
              </h1>

            </div>

            <p className="text-sm text-slate-500 mt-1">
              Payroll, attendance, billing and workforce reports.
            </p>

          </div>

          <div className="flex items-center gap-3 flex-wrap">

            <input
              type="month"
              value={month}
              onChange={(e) =>
                setMonth(
                  e.target.value
                )
              }
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />

            <button
              onClick={
                fetchReports
              }
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >

              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh

            </button>

            <button
              onClick={
                exportCSV
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
            >

              <Download className="h-4 w-4" />

              Export CSV

            </button>

          </div>

        </div>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ===================================================
            TABS
        =================================================== */}

        <div className="bg-white border border-slate-200 rounded-2xl p-2 mb-6 flex flex-wrap gap-2">

          {[
            [
              "overview",
              "Overview",
            ],
            [
              "payroll",
              "Payroll",
            ],
            [
              "attendance",
              "Attendance",
            ],
            [
              "billing",
              "Billing",
            ],
          ].map(
            ([id, label]) => (
              <button
                key={id}
                onClick={() =>
                  setReportType(
                    id
                  )
                }
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  reportType ===
                  id
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            )
          )}

        </div>

        {/* ===================================================
            LOADING
        =================================================== */}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">

            <RefreshCw className="h-7 w-7 animate-spin mx-auto text-indigo-600" />

            <p className="text-sm text-slate-500 mt-3">
              Loading reports...
            </p>

          </div>
        ) : (
          <>

            {/* =================================================
                OVERVIEW
            ================================================= */}

            {reportType ===
              "overview" && (
              <>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">

                  <StatCard
                    title="Active Employees"
                    value={
                      stats.activeEmployees
                    }
                    subtitle="Current workforce"
                    icon={Users}
                  />

                  <StatCard
                    title="Active Deployments"
                    value={
                      stats.activeDeployments
                    }
                    subtitle="Employees deployed"
                    icon={Building2}
                  />

                  <StatCard
                    title="Net Payroll"
                    value={formatCurrency(
                      stats.totalPayroll
                    )}
                    subtitle={month}
                    icon={
                      IndianRupee
                    }
                  />

                  <StatCard
                    title="Client Billing"
                    value={formatCurrency(
                      stats.totalBilling
                    )}
                    subtitle={month}
                    icon={Wallet}
                  />

                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                  {/* Payroll Summary */}

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">

                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">

                      <div>

                        <h2 className="font-bold text-slate-900">
                          Payroll Summary
                        </h2>

                        <p className="text-xs text-slate-400 mt-1">
                          {month}
                        </p>

                      </div>

                      <TrendingUp className="h-5 w-5 text-indigo-500" />

                    </div>

                    <div className="p-5 space-y-4">

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Gross Payroll
                        </span>

                        <span className="font-bold text-slate-900">
                          {formatCurrency(
                            stats.grossPayroll
                          )}
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Net Payroll
                        </span>

                        <span className="font-bold text-indigo-600">
                          {formatCurrency(
                            stats.totalPayroll
                          )}
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Approved Payroll
                        </span>

                        <span className="font-bold text-emerald-600">
                          {
                            stats.approvedPayroll
                          }
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Pending Payroll
                        </span>

                        <span className="font-bold text-amber-600">
                          {
                            stats.pendingPayroll
                          }
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* Attendance Summary */}

                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">

                    <div className="p-5 border-b border-slate-100 flex justify-between items-center">

                      <div>

                        <h2 className="font-bold text-slate-900">
                          Attendance Summary
                        </h2>

                        <p className="text-xs text-slate-400 mt-1">
                          {month}
                        </p>

                      </div>

                      <UserCheck className="h-5 w-5 text-indigo-500" />

                    </div>

                    <div className="p-5 space-y-4">

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Approved
                        </span>

                        <span className="font-bold text-emerald-600">
                          {
                            stats.approvedAttendance
                          }
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Pending Approval
                        </span>

                        <span className="font-bold text-amber-600">
                          {
                            stats.pendingAttendance
                          }
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Payroll Records
                        </span>

                        <span className="font-bold text-slate-900">
                          {
                            selectedMonthPayroll.length
                          }
                        </span>

                      </div>

                      <div className="flex justify-between">

                        <span className="text-sm text-slate-500">
                          Client Invoices
                        </span>

                        <span className="font-bold text-slate-900">
                          {
                            selectedMonthInvoices.length
                          }
                        </span>

                      </div>

                    </div>

                  </div>

                </div>

                {/* Financial Snapshot */}

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6">

                  <div className="p-5 border-b border-slate-100">

                    <h2 className="font-bold text-slate-900">
                      Financial Snapshot
                    </h2>

                    <p className="text-xs text-slate-400 mt-1">
                      Payroll and client collections for {month}
                    </p>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">

                    <div className="p-5">

                      <p className="text-xs text-slate-400">
                        Payroll Cost
                      </p>

                      <p className="text-xl font-bold text-slate-900 mt-1">
                        {formatCurrency(
                          stats.totalPayroll
                        )}
                      </p>

                    </div>

                    <div className="p-5">

                      <p className="text-xs text-slate-400">
                        Client Billing
                      </p>

                      <p className="text-xl font-bold text-indigo-600 mt-1">
                        {formatCurrency(
                          stats.totalBilling
                        )}
                      </p>

                    </div>

                    <div className="p-5">

                      <p className="text-xs text-slate-400">
                        Payments Reported
                      </p>

                      <p className="text-xl font-bold text-emerald-600 mt-1">
                        {formatCurrency(
                          stats.totalPaid
                        )}
                      </p>

                    </div>

                  </div>

                </div>

              </>
            )}

            {/* =================================================
                PAYROLL
            ================================================= */}

            {reportType ===
              "payroll" && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                <div className="p-5 border-b border-slate-100">

                  <h2 className="font-bold text-slate-900">
                    Payroll Report
                  </h2>

                  <p className="text-xs text-slate-400 mt-1">
                    Payroll records for {month}
                  </p>

                </div>

                {selectedMonthPayroll.length ===
                0 ? (
                  <div className="p-12 text-center">

                    <AlertCircle className="h-8 w-8 mx-auto text-slate-300" />

                    <p className="text-sm text-slate-500 mt-3">
                      No payroll records found for this month.
                    </p>

                  </div>
                ) : (
                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead className="bg-slate-50 border-b border-slate-200">

                        <tr className="text-xs uppercase text-slate-500 font-bold">

                          <th className="p-4">
                            Employee
                          </th>

                          <th className="p-4">
                            Basic
                          </th>

                          <th className="p-4">
                            Gross
                          </th>

                          <th className="p-4">
                            LOP
                          </th>

                          <th className="p-4">
                            Deductions
                          </th>

                          <th className="p-4">
                            Net Salary
                          </th>

                          <th className="p-4">
                            Status
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {selectedMonthPayroll.map(
                          (item) => {

                            const employee =
                              employeeMap.get(
                                Number(
                                  item.employee_ref_id
                                )
                              );

                            return (
                              <tr
                                key={
                                  item.id
                                }
                                className="hover:bg-slate-50"
                              >

                                <td className="p-4">

                                  <p className="font-semibold text-slate-900">

                                    {item.employee_name ||
                                      employee?.full_name ||
                                      `EMP-${item.employee_ref_id || item.id}`}

                                  </p>

                                  <p className="text-xs text-slate-400">
                                    EMP-
                                    {item.employee_ref_id ||
                                      item.id}
                                  </p>

                                </td>

                                <td className="p-4 text-sm">
                                  {formatCurrency(
                                    item.basic_salary
                                  )}
                                </td>

                                <td className="p-4 text-sm font-semibold">
                                  {formatCurrency(
                                    item.gross_salary
                                  )}
                                </td>

                                <td className="p-4 text-sm text-rose-600">
                                  {formatCurrency(
                                    item.lop
                                  )}
                                </td>

                                <td className="p-4 text-sm">
                                  {formatCurrency(
                                    item.total_deductions
                                  )}
                                </td>

                                <td className="p-4 text-sm font-bold text-indigo-600">
                                  {formatCurrency(
                                    item.net_salary
                                  )}
                                </td>

                                <td className="p-4">

                                  <StatusBadge
                                    status={
                                      item.status
                                    }
                                  />

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
            )}

            {/* =================================================
                ATTENDANCE
            ================================================= */}

            {reportType ===
              "attendance" && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                <div className="p-5 border-b border-slate-100">

                  <h2 className="font-bold text-slate-900">
                    Attendance Report
                  </h2>

                  <p className="text-xs text-slate-400 mt-1">
                    Attendance approval summary for {month}
                  </p>

                </div>

                {selectedMonthAttendance.length ===
                0 ? (
                  <div className="p-12 text-center">

                    <Clock className="h-8 w-8 mx-auto text-slate-300" />

                    <p className="text-sm text-slate-500 mt-3">
                      No attendance records found for {month}.
                    </p>

                  </div>
                ) : (
                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead className="bg-slate-50 border-b border-slate-200">

                        <tr className="text-xs uppercase text-slate-500 font-bold">

                          <th className="p-4">
                            Employee
                          </th>

                          <th className="p-4">
                            Total Days
                          </th>

                          <th className="p-4">
                            Present
                          </th>

                          <th className="p-4">
                            LOP
                          </th>

                          <th className="p-4">
                            OT Hours
                          </th>

                          <th className="p-4">
                            Status
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {selectedMonthAttendance.map(
                          (item) => {

                            const employee =
                              employeeMap.get(
                                Number(
                                  item.employee_id ??
                                    item.employee_ref_id
                                )
                              );

                            const employeeId =
                              item.employee_id ??
                              item.employee_ref_id ??
                              item.id;

                            const employeeName =
                              employee?.full_name ||
                              item.employee_name ||
                              `EMP-${employeeId}`;

                            return (
                              <tr
                                key={
                                  item.id
                                }
                                className="hover:bg-slate-50"
                              >

                                {/* EMPLOYEE */}

                                <td className="p-4">

                                  <p className="font-semibold text-slate-900">

                                    {employeeName}

                                  </p>

                                  <p className="text-xs text-slate-400">

                                    EMP-
                                    {employeeId}

                                  </p>

                                </td>

                                {/* TOTAL DAYS */}

                                <td className="p-4 text-sm text-slate-700">

                                  {item.total_days ??
                                    0}

                                </td>

                                {/* PRESENT */}

                                <td className="p-4 text-sm font-semibold text-emerald-600">

                                  {item.present_days ??
                                    0}

                                </td>

                                {/* LOP */}

                                <td className="p-4 text-sm font-semibold text-rose-600">

                                  {item.lop_days ??
                                    0}

                                </td>

                                {/* OT HOURS */}

                                <td className="p-4 text-sm text-slate-700">

                                  {item.overtime_hours ??
                                    item.ot_hours ??
                                    0}

                                </td>

                                {/* STATUS */}

                                <td className="p-4">

                                  <StatusBadge
                                    status={
                                      item.status
                                    }
                                  />

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
            )}

            {/* =================================================
                BILLING
            ================================================= */}

            {reportType ===
              "billing" && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                <div className="p-5 border-b border-slate-100">

                  <h2 className="font-bold text-slate-900">
                    Client Billing Report
                  </h2>

                  <p className="text-xs text-slate-400 mt-1">
                    Client invoices for {month}
                  </p>

                </div>

                {selectedMonthInvoices.length ===
                0 ? (
                  <div className="p-12 text-center">

                    <Wallet className="h-8 w-8 mx-auto text-slate-300" />

                    <p className="text-sm text-slate-500 mt-3">
                      No invoices found for {month}.
                    </p>

                  </div>
                ) : (
                  <div className="overflow-x-auto">

                    <table className="w-full text-left">

                      <thead className="bg-slate-50 border-b border-slate-200">

                        <tr className="text-xs uppercase text-slate-500 font-bold">

                          <th className="p-4">
                            Invoice
                          </th>

                          <th className="p-4">
                            Client
                          </th>

                          <th className="p-4">
                            Invoice Amount
                          </th>

                          <th className="p-4">
                            Payment Status
                          </th>

                          <th className="p-4">
                            Invoice Date
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-slate-100">

                        {selectedMonthInvoices.map(
                          (invoice) => (
                            <tr
                              key={
                                invoice.id
                              }
                              className="hover:bg-slate-50"
                            >

                              <td className="p-4 font-semibold text-slate-900">

                                {invoice.invoice_number ||
                                  `INV-${invoice.id}`}

                              </td>

                              <td className="p-4">

                                {invoice.client_name ||
                                  invoice.company_name ||
                                  `Client #${
                                    invoice.client_id ||
                                    ""
                                  }`}

                              </td>

                              <td className="p-4 font-bold text-indigo-600">

                                {formatCurrency(
                                  invoice.total_amount ??
                                    invoice.invoice_amount ??
                                    invoice.amount
                                )}

                              </td>

                              <td className="p-4">

                                <StatusBadge
                                  status={
                                    invoice.payment_status
                                  }
                                />

                              </td>

                              <td className="p-4 text-sm text-slate-500">

                                {invoice.invoice_date ||
                                  invoice.created_at ||
                                  "N/A"}

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

          </>
        )}

      </main>

    </div>
  );
}

export default Reports;

