import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Building2,
  Calendar,
  Users,
  Wallet,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  Clock,
  CreditCard,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { supabase } from "../../../lib/supabaseClient";
import Sidebar from "./Layout/Sidebar";

// =====================================================
// CONFIG
// =====================================================

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5001/api";

// =====================================================
// CLIENT PORTAL DASHBOARD
// =====================================================

function ClientPortalDashboard() {
  const navigate = useNavigate();

  // ===================================================
  // STATE
  // ===================================================

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [clientName, setClientName] =
    useState("Loading Workspace...");

  const [stats, setStats] = useState({
    total_deployed: 0,
    active_job_requirements: 0,
  });

  const [billingLogs, setBillingLogs] =
    useState([]);

  // ===================================================
  // GET SUPABASE ACCESS TOKEN
  // ===================================================

  const getAccessToken = async () => {
    const { data, error } =
      await supabase.auth.getSession();

    if (error) {
      console.error(
        "Supabase session error:",
        error
      );

      return null;
    }

    return data?.session?.access_token || null;
  };

  // ===================================================
  // AUTHENTICATED FETCH
  // ===================================================

  const authFetch = async (
    url,
    options = {}
  ) => {
    const token =
      await getAccessToken();

    if (!token) {
      throw new Error(
        "Your session has expired. Please login again."
      );
    }

    const response =
      await fetch(url, {
        ...options,

        headers: {
          "Content-Type":
            "application/json",

          ...(options.headers || {}),

          Authorization:
            `Bearer ${token}`,
        },
      });

    // =================================================
    // UNAUTHORIZED
    // =================================================

    if (response.status === 401) {
      await supabase.auth.signOut();

      sessionStorage.removeItem("client_id");
      sessionStorage.removeItem("client_name");
      sessionStorage.removeItem("company_name");
      sessionStorage.removeItem("user_role");

      navigate("/login");

      throw new Error(
        "Session expired. Please login again."
      );
    }

    return response;
  };

  // ===================================================
  // FETCH CLIENT PROFILE
  // ===================================================

  const fetchClientProfile =
    useCallback(async () => {
      const response =
        await authFetch(
          `${API_BASE}/client-portal/me`
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to load client profile"
        );
      }

      const client =
        data.data;

      const name =
        client?.company_name ||
        client?.client?.company_name ||
        client?.name ||
        client?.client?.name ||
        "Client Portal";

      setClientName(name);

      return client;
    }, []);

  // ===================================================
  // FETCH DASHBOARD STATS
  // ===================================================

  const fetchDashboardStats =
    useCallback(async () => {
      const response =
        await authFetch(
          `${API_BASE}/client-portal/dashboard-stats`
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "Failed to load dashboard statistics"
        );
      }

      setStats({
        total_deployed:
          Number(
            data.data
              ?.total_deployed || 0
          ),

        active_job_requirements:
          Number(
            data.data
              ?.active_job_requirements || 0
          ),
      });

      if (
        data.data?.company_name
      ) {
        setClientName(
          data.data.company_name
        );
      }
    }, []);

  // ===================================================
  // FETCH BILLING
  // ===================================================

  const fetchBilling =
    useCallback(async () => {
      const response =
        await authFetch(
          `${API_BASE}/client-portal/billing`
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "Failed to load billing"
        );
      }

      setBillingLogs(
        Array.isArray(data.data)
          ? data.data
          : []
      );
    }, []);

  // ===================================================
  // LOAD ALL CLIENT DATA
  // ===================================================

  const fetchClientData =
    useCallback(
      async (showRefresh = false) => {
        try {
          if (showRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          // -------------------------------------------
          // CHECK SESSION
          // -------------------------------------------

          const {
            data,
            error,
          } =
            await supabase.auth.getSession();

          if (
            error ||
            !data?.session
          ) {
            navigate("/login");
            return;
          }

          // -------------------------------------------
          // CLIENT PROFILE
          // -------------------------------------------

          await fetchClientProfile();

          // -------------------------------------------
          // DASHBOARD DATA
          //
          // NO ATTENDANCE API
          // -------------------------------------------

          await Promise.all([
            fetchDashboardStats(),
            fetchBilling(),
          ]);
        } catch (error) {
          console.error(
            "Client portal loading error:",
            error
          );

          if (
            error.message
              ?.toLowerCase()
              .includes("session") ||
            error.message?.includes(
              "Session expired"
            )
          ) {
            await supabase.auth.signOut();
            navigate("/login");
          }
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        navigate,
        fetchClientProfile,
        fetchDashboardStats,
        fetchBilling,
      ]
    );

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    fetchClientData(false);
  }, [fetchClientData]);

  // ===================================================
  // REFRESH
  // ===================================================

  const handleRefresh = () => {
    fetchClientData(true);
  };

  // ===================================================
  // LOGOUT
  // ===================================================

  const handleLogout =
    async () => {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error(
          "Logout error:",
          error
        );
      } finally {
        sessionStorage.removeItem("client_id");
        sessionStorage.removeItem("client_name");
        sessionStorage.removeItem("company_name");
        sessionStorage.removeItem("user_role");

        navigate("/login");
      }
    };

  // ===================================================
  // PAYMENT STATUS
  // ===================================================

  const getPaymentStatus =
    (invoice) => {
      const status =
        String(
          invoice?.payment_status ||
          "Pending"
        )
          .trim()
          .toLowerCase();

      if (status === "paid") {
        return {
          label: "Paid",

          className:
            "bg-emerald-950/60 text-emerald-400 border-emerald-800/50",

          icon: CheckCircle2,
        };
      }

      if (
        status === "partially paid"
      ) {
        return {
          label: "Partially Paid",

          className:
            "bg-blue-950/60 text-blue-400 border-blue-800/50",

          icon: CreditCard,
        };
      }

      if (
        status === "overdue"
      ) {
        return {
          label: "Overdue",

          className:
            "bg-red-950/60 text-red-400 border-red-800/50",

          icon: AlertCircle,
        };
      }

      return {
        label: "Pending",

        className:
          "bg-amber-950/60 text-amber-400 border-amber-800/50",

        icon: Clock,
      };
    };

  // ===================================================
  // FORMAT CURRENCY
  // ===================================================

  const formatCurrency =
    (amount) => {
      return Number(
        amount || 0
      ).toLocaleString(
        "en-IN",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      );
    };

  // ===================================================
  // FORMAT DATE
  // ===================================================

  const formatDate =
    (date) => {
      if (!date) {
        return "-";
      }

      const parsed =
        new Date(date);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return date;
      }

      return parsed.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    };

  // ===================================================
  // FORMAT BILLING MONTH
  // ===================================================

  const formatBillingMonth =
    (date) => {
      if (!date) {
        return "Invoice";
      }

      const parsed =
        new Date(date);

      if (
        Number.isNaN(
          parsed.getTime()
        )
      ) {
        return date;
      }

      return parsed.toLocaleDateString(
        "en-IN",
        {
          month: "short",
          year: "numeric",
        }
      );
    };

  // ===================================================
  // LOADING SCREEN
  // ===================================================

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19] text-indigo-400 gap-3">

        <Loader2 className="h-8 w-8 animate-spin" />

        <span className="font-bold text-sm tracking-wide">
          Loading Client Workspace...
        </span>

      </div>
    );
  }

  // ===================================================
  // MAIN CLIENT DASHBOARD
  // ===================================================

  return (
    <div className="flex min-h-screen w-full bg-[#0b0f19] text-slate-100 font-sans antialiased">

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

      <main className="flex-1 min-w-0 overflow-y-auto">

        <div className="p-6 md:p-10">

          <div className="max-w-[1500px] mx-auto w-full space-y-6">

            {/* =================================================
                HEADER
            ================================================= */}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#111627] border border-slate-800/80 p-6 rounded-2xl shadow-sm">

              <div className="flex items-center gap-4">

                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">

                  <Building2 className="h-6 w-6" />

                </div>

                <div>

                  <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight">
                    {clientName} Workspace
                  </h1>

                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Client Performance & Workforce Monitor · Third-Party B2B Portal
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-3 flex-wrap">

                <div className="flex items-center gap-3 bg-[#0b0f19] border border-slate-700/60 px-4 py-2.5 rounded-xl shadow-inner">

                  <Calendar className="h-4 w-4 text-indigo-400" />

                  <span className="text-xs font-bold text-slate-300">

                    Operational Block:{" "}

                    <span className="text-white">
                      {new Date().toLocaleDateString("en-IN", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>

                  </span>

                </div>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh dashboard"
                  className="p-3 rounded-xl bg-[#0b0f19] border border-slate-700/60 text-slate-300 hover:text-white hover:border-indigo-500/50 transition"
                >

                  <RefreshCw
                    className={`h-4 w-4 ${refreshing
                        ? "animate-spin"
                        : ""
                      }`}
                  />

                </button>

              </div>

            </div>

            {/* =================================================
                CORE METRICS
            ================================================= */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* =================================================
                  STAFFING VOLUME
              ================================================= */}

              <div className="bg-[#111627] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">

                <div className="flex justify-between items-start">

                  <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">
                    STAFFING VOLUME
                  </span>

                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">

                    <Users className="h-4 w-4" />

                  </div>

                </div>

                <div className="my-3">

                  <h3 className="text-2xl font-black text-slate-100 tracking-tight">
                    {stats.total_deployed} Contractors
                  </h3>

                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Active assigned workforce resources
                  </p>

                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">

                  <span>
                    Active Deployment Utilization
                  </span>

                  <span className="font-bold text-emerald-400 flex items-center gap-1">

                    <ShieldCheck className="h-3.5 w-3.5" />

                    Verified

                  </span>

                </div>

              </div>

              {/* =================================================
                  ACTIVE JOB REQUIREMENTS
              ================================================= */}

              <div className="bg-[#111627] border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-sm">

                <div className="flex justify-between items-start">

                  <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">
                    ACTIVE JOB REQUIREMENTS
                  </span>

                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">

                    <Wallet className="h-4 w-4" />

                  </div>

                </div>

                <div className="my-3">

                  <h3 className="text-2xl font-black text-slate-100 tracking-tight">
                    {stats.active_job_requirements} Openings
                  </h3>

                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Active hiring mandates logged
                  </p>

                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">

                  <span>
                    Recruitment Pipeline
                  </span>

                  <span className="font-bold text-indigo-400">
                    Active
                  </span>

                </div>

              </div>

            </div>

            {/* =================================================
                BILLING
            ================================================= */}

            <div className="bg-[#111627] border border-slate-800/80 rounded-2xl p-6 shadow-sm">

              <div className="mb-6">

                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">
                  B2B Recent Billing Log
                </h3>

                <p className="text-[11px] text-slate-400 mt-0.5">
                  Latest financial statements dispatched
                </p>

              </div>

              <div className="space-y-3">

                {billingLogs.length === 0 ? (

                  <p className="text-xs text-slate-400 text-center py-4">
                    No billing statements available.
                  </p>

                ) : (

                  billingLogs
                    .slice(0, 3)
                    .map((log) => {

                      const paymentStatus =
                        getPaymentStatus(log);

                      const StatusIcon =
                        paymentStatus.icon;

                      return (

                        <div
                          key={log.id}
                          className="bg-[#0b0f19] border border-slate-800/80 p-4 rounded-xl space-y-3"
                        >

                          <div className="flex justify-between items-start">

                            <div>

                              <p className="text-xs font-bold text-slate-100">
                                {log.invoice_number ||
                                  `Invoice #${log.id}`}
                              </p>

                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatBillingMonth(
                                  log.billing_month
                                )}
                              </p>

                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${paymentStatus.className}`}
                            >

                              <StatusIcon className="h-3 w-3" />

                              {paymentStatus.label}

                            </span>

                          </div>

                          <div className="space-y-2 pt-2 border-t border-slate-800/60">

                            <div className="flex justify-between text-[11px]">

                              <span className="text-slate-500">
                                Invoice Date
                              </span>

                              <span className="text-slate-300 font-medium">
                                {formatDate(
                                  log.invoice_date ||
                                  log.created_at
                                )}
                              </span>

                            </div>

                            <div className="flex justify-between text-[11px]">

                              <span className="text-slate-500">
                                Due Date
                              </span>

                              <span
                                className={`font-medium ${paymentStatus.label ===
                                    "Overdue"
                                    ? "text-red-400"
                                    : "text-slate-300"
                                  }`}
                              >

                                {formatDate(
                                  log.due_date
                                )}

                              </span>

                            </div>

                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-800/60 text-xs">

                            <span className="text-slate-400 font-medium">
                              Grand Total
                            </span>

                            <span className="font-black text-slate-100 text-sm">

                              ₹
                              {formatCurrency(
                                log.total_amount
                              )}

                            </span>

                          </div>

                          <div className="flex justify-between items-center">

                            <span className="text-slate-500 text-[11px]">
                              Outstanding
                            </span>

                            <span
                              className={`text-xs font-bold ${paymentStatus.label ===
                                  "Paid"
                                  ? "text-emerald-400"
                                  : paymentStatus.label ===
                                    "Overdue"
                                    ? "text-red-400"
                                    : "text-amber-400"
                                }`}
                            >

                              ₹
                              {formatCurrency(
                                log.outstanding ??
                                log.total_amount
                              )}

                            </span>

                          </div>

                        </div>

                      );
                    })

                )}

              </div>

            </div>

          </div>

        </div>

      </main>

    </div>
  );
}

export default ClientPortalDashboard;