import React, { useState } from "react";
import axios from "axios";
import { supabase } from "../../../../lib/supabaseClient";

// =====================================================
// CLIENT PORTAL API
// =====================================================

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api";

// =====================================================
// MONTHLY ATTENDANCE SUMMARY
// =====================================================

function MonthlyAttendanceSummary() {
  const [billingMonth, setBillingMonth] = useState("2026-09");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // =====================================================
  // GET SUPABASE ACCESS TOKEN
  // =====================================================

  const getAccessToken = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(
        sessionError.message ||
          "Unable to get login session."
      );
    }

    if (!session?.access_token) {
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    return session.access_token;
  };

  // =====================================================
  // GENERATE MONTHLY SUMMARY
  // =====================================================

  const generateSummary = async () => {
    try {
      setLoading(true);
      setMessage("");
      setError("");

      // -------------------------------------------------
      // VALIDATE BILLING MONTH
      // -------------------------------------------------

      if (!billingMonth) {
        throw new Error(
          "Please select a billing month."
        );
      }

      // -------------------------------------------------
      // GET SUPABASE SESSION TOKEN
      // -------------------------------------------------

      const accessToken =
        await getAccessToken();

      console.log(
        "Generating monthly attendance summary:",
        billingMonth
      );

      // -------------------------------------------------
      // CALL CLIENT PORTAL BACKEND
      //
      // IMPORTANT:
      // DO NOT SEND client_id.
      //
      // Backend gets:
      // access_token
      //      ↓
      // auth.users.id
      //      ↓
      // client_users
      //      ↓
      // client_id
      // -------------------------------------------------

      const response = await axios.post(
        `${API_BASE}/client-portal/attendance/generate-summary`,
        {
          billing_month: billingMonth,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "Monthly Summary Response:",
        response.data
      );

      // -------------------------------------------------
      // SUCCESS
      // -------------------------------------------------

      const employeesProcessed =
        response.data?.employees_processed ?? 0;

      setMessage(
        `Summary generated successfully for ${billingMonth}. ` +
          `${employeesProcessed} employees processed.`
      );

    } catch (err) {
      console.error(
        "Generate summary error:",
        err
      );

      // -------------------------------------------------
      // HANDLE 401
      // -------------------------------------------------

      if (err.response?.status === 401) {
        await supabase.auth.signOut();

        setError(
          "Your session has expired. Please log in again."
        );

        return;
      }

      // -------------------------------------------------
      // HANDLE 403
      // -------------------------------------------------

      if (err.response?.status === 403) {
        setError(
          err.response?.data?.message ||
            "You are not authorized to generate this summary."
        );

        return;
      }

      // -------------------------------------------------
      // HANDLE OTHER ERRORS
      // -------------------------------------------------

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Failed to generate monthly summary."
      );

    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <div className="mb-5">

        <h3 className="text-lg font-bold text-slate-900">
          Monthly Attendance Summary
        </h3>

        <p className="text-sm text-slate-500 mt-1">
          Generate monthly attendance summary from daily
          attendance records.
        </p>

      </div>

      {/* ================================================= */}
      {/* CONTROLS */}
      {/* ================================================= */}

      <div className="flex flex-col sm:flex-row sm:items-end gap-4">

        {/* BILLING MONTH */}

        <div>

          <label
            htmlFor="billing-month"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Billing Month
          </label>

          <input
            id="billing-month"
            type="month"
            value={billingMonth}
            onChange={(e) => {
              setBillingMonth(e.target.value);
              setMessage("");
              setError("");
            }}
            disabled={loading}
            className="
              border border-slate-300
              rounded-lg
              px-4 py-2.5
              text-sm
              bg-white
              focus:outline-none
              focus:ring-2
              focus:ring-blue-500
              focus:border-blue-500
              disabled:bg-slate-100
              disabled:cursor-not-allowed
            "
          />

        </div>

        {/* GENERATE BUTTON */}

        <button
          type="button"
          onClick={generateSummary}
          disabled={
            loading ||
            !billingMonth
          }
          className="
            px-5 py-2.5
            rounded-lg
            text-white
            font-medium
            bg-blue-600
            hover:bg-blue-700
            disabled:opacity-50
            disabled:cursor-not-allowed
            transition
          "
        >
          {loading
            ? "Generating..."
            : "Generate Summary"}
        </button>

      </div>

      {/* ================================================= */}
      {/* SUCCESS MESSAGE */}
      {/* ================================================= */}

      {message && (
        <div
          className="
            mt-4
            p-3
            rounded-lg
            bg-green-50
            border border-green-200
            text-green-700
            text-sm
          "
        >
          {message}
        </div>
      )}

      {/* ================================================= */}
      {/* ERROR MESSAGE */}
      {/* ================================================= */}

      {error && (
        <div
          className="
            mt-4
            p-3
            rounded-lg
            bg-red-50
            border border-red-200
            text-red-700
            text-sm
          "
        >
          {error}
        </div>
      )}

    </div>
  );
}

export default MonthlyAttendanceSummary;