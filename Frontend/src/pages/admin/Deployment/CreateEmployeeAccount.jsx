import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  UserPlus,
  Loader2,
  Mail,
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";

const API_BASE = "http://localhost:5000/api";

export default function CreateEmployeeAccount() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

  // ============================================================
  // FETCH EMPLOYEE
  // ============================================================

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/candidates/${id}`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Failed to fetch employee"
        );
      }

      const employeeData =
        data?.candidate ||
        data?.employee ||
        data?.data ||
        data;

      setEmployee(employeeData);

      setFormData((prev) => ({
        ...prev,
        email: employeeData.email || "",
      }));
    } catch (err) {
      console.error(
        "CREATE ACCOUNT FETCH ERROR:",
        err
      );

      setError(
        err?.message ||
          "Failed to load employee details."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // HANDLE CHANGE
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  // ============================================================
  // CREATE ACCOUNT
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const email = formData.email.trim();
    const password = formData.password;
    const confirmPassword =
      formData.confirmPassword;

    // ----------------------------------------------------------
    // VALIDATION
    // ----------------------------------------------------------

    if (!email) {
      setError("Employee email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (employee?.auth_user_id) {
      setError(
        "This employee already has a login account."
      );
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(
        `${API_BASE}/candidates/${id}/create-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Failed to create employee account."
        );
      }

      setSuccess(
        "Employee account created successfully."
      );

      // Update local employee object
      setEmployee((prev) => ({
        ...prev,
        auth_user_id:
          data?.auth_user_id ||
          data?.user?.id ||
          prev?.auth_user_id,
      }));

      // Clear password fields
      setFormData((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
    } catch (err) {
      console.error(
        "CREATE EMPLOYEE ACCOUNT ERROR:",
        err
      );

      setError(
        err?.message ||
          "Failed to create employee account."
      );
    } finally {
      setCreating(false);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activePage="/employee-management" />

        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading employee...
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // ERROR / NOT FOUND
  // ============================================================

  if (!employee) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activePage="/employee-management" />

        <main className="flex-1 p-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
            {error || "Employee not found."}
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // ALREADY HAS ACCOUNT
  // ============================================================

  const alreadyCreated = Boolean(
    employee.auth_user_id
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar activePage="/employee-management" />

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="flex-1 min-w-0">
        <div className="p-8">
          <div className="max-w-2xl mx-auto">

            {/* BACK */}

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/employee/details/${employee.id}`
                )
              }
              className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Employee Details
            </button>

            {/* CARD */}

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

              {/* HEADER */}

              <div className="px-6 py-5 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                    <UserPlus className="h-5 w-5" />
                  </div>

                  <div>
                    <h1 className="text-xl font-bold text-slate-900">
                      Create Employee Account
                    </h1>

                    <p className="text-xs text-slate-500 mt-1">
                      Create a Supabase login for the
                      existing employee.
                    </p>
                  </div>
                </div>
              </div>

              {/* EMPLOYEE INFO */}

              <div className="p-6 border-b border-slate-100">
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                      {employee.full_name
                        ?.charAt(0)
                        ?.toUpperCase() || "E"}
                    </div>

                    <div>
                      <p className="font-bold text-slate-900">
                        {employee.full_name ||
                          "Unnamed Employee"}
                      </p>

                      <p className="text-xs text-slate-500 mt-0.5">
                        {employee.employee_code ||
                          `Employee ID: ${employee.id}`}
                        {" • "}
                        {employee.designation ||
                          "Employee"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ALREADY CREATED */}

              {alreadyCreated ? (
                <div className="p-6">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />

                      <div>
                        <p className="font-bold text-emerald-800">
                          Account already exists
                        </p>

                        <p className="text-sm text-emerald-700 mt-1">
                          This employee already has a
                          Supabase Auth account.
                        </p>

                        <p className="text-xs text-emerald-600 mt-2 break-all">
                          Auth User ID:{" "}
                          {employee.auth_user_id}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-5">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/employee/details/${employee.id}`
                        )
                      }
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800"
                    >
                      Back to Employee
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="p-6 space-y-5"
                >
                  {/* ERROR */}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700">
                      <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />

                      <p className="text-sm font-medium">
                        {error}
                      </p>
                    </div>
                  )}

                  {/* SUCCESS */}

                  {success && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" />

                      <div>
                        <p className="text-sm font-bold">
                          {success}
                        </p>

                        <p className="text-xs mt-1">
                          The employee can now log in
                          using these credentials.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* EMAIL */}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Login Email
                    </label>

                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full border border-slate-200 pl-10 pr-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="employee@example.com"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 mt-1.5">
                      This is the email the employee will
                      use to log in.
                    </p>
                  </div>

                  {/* PASSWORD */}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Password
                    </label>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                      <input
                        type="password"
                        name="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full border border-slate-200 pl-10 pr-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="Minimum 6 characters"
                      />
                    </div>
                  </div>

                  {/* CONFIRM PASSWORD */}

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Confirm Password
                    </label>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />

                      <input
                        type="password"
                        name="confirmPassword"
                        required
                        value={
                          formData.confirmPassword
                        }
                        onChange={handleChange}
                        className="w-full border border-slate-200 pl-10 pr-3 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-slate-200"
                        placeholder="Re-enter password"
                      />
                    </div>
                  </div>

                  {/* INFO */}

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5" />

                      <div>
                        <p className="text-sm font-bold text-blue-800">
                          Secure account creation
                        </p>

                        <p className="text-xs text-blue-700 mt-1">
                          The password is handled by
                          Supabase Auth. It will not be stored
                          as the employee's database password.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BUTTONS */}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={creating}
                      onClick={() =>
                        navigate(
                          `/employee/details/${employee.id}`
                        )
                      }
                      className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={creating}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {creating && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}

                      {creating
                        ? "Creating Account..."
                        : "Create Account"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}