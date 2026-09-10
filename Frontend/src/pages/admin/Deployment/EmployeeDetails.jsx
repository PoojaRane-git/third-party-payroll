import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  UserPlus,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Wallet,
  ShieldCheck,
  GraduationCap,
  CalendarDays,
  User,
  Building2,
  AlertCircle,
  CheckCircle2,
  Send,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";

const API_BASE = "http://localhost:5000/api";

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // FETCH EMPLOYEE
  // ============================================================

  useEffect(() => {
    if (id) {
      fetchEmployee();
    }
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
    } catch (err) {
      console.error(
        "EMPLOYEE DETAILS ERROR:",
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
  // FORMAT DATE
  // ============================================================

  const formatDate = (date) => {
    if (!date) return "N/A";

    try {
      return new Date(date).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return date;
    }
  };

  // ============================================================
  // FORMAT MONEY
  // ============================================================

  const formatMoney = (amount) => {
    if (
      amount === null ||
      amount === undefined ||
      amount === ""
    ) {
      return "N/A";
    }

    const value = Number(amount);

    if (!Number.isFinite(value)) {
      return "N/A";
    }

    return `₹${value.toLocaleString("en-IN")}`;
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
            Loading employee details...
          </div>
        </main>
      </div>
    );
  }

  // ============================================================
  // ERROR
  // ============================================================

  if (error || !employee) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar activePage="/employee-management" />

        <main className="flex-1 p-8">

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3 text-red-700">

            <AlertCircle className="h-5 w-5" />

            <div>
              <p className="font-semibold">
                Unable to load employee
              </p>

              <p className="text-sm mt-1">
                {error ||
                  "Employee not found."}
              </p>
            </div>

          </div>

        </main>
      </div>
    );
  }

  // ============================================================
  // EMPLOYEE STATE
  // ============================================================

  const hasAccount =
    Boolean(employee.auth_user_id);

  const isDeployed =
    employee.deployment_id !== null &&
    employee.deployment_id !== undefined &&
    employee.deployment_id !== "";

  // ============================================================
  // MAIN
  // ============================================================

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar
        activePage="/employee-management"
      />

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="flex-1 min-w-0">

        <div className="p-8 max-w-7xl mx-auto space-y-6">

          {/* =================================================
              HEADER
          ================================================== */}

          <div className="flex items-center justify-between gap-4">

            <div>

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-3"
              >
                <ArrowLeft className="h-4 w-4" />

                Back to Employee Management
              </button>

              <div className="flex items-center gap-4">

                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-bold">
                  {employee.full_name
                    ?.charAt(0)
                    ?.toUpperCase() || "E"}
                </div>

                <div>

                  <h1 className="text-2xl font-bold text-slate-900">
                    {employee.full_name ||
                      "Unnamed Employee"}
                  </h1>

                  <p className="text-sm text-slate-500 mt-1">

                    {employee.employee_code ||
                      `Employee ID: ${employee.id}`}

                    {" • "}

                    {employee.designation ||
                      "N/A"}

                  </p>

                </div>

              </div>

            </div>

            {/* =================================================
                ACCOUNT BUTTON
            ================================================== */}

            {hasAccount ? (

              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold">

                <CheckCircle2 className="h-4 w-4" />

                Account Created

              </div>

            ) : isDeployed ? (

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/employee/create-account/${employee.id}`
                  )
                }
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition shadow-sm"
              >

                <UserPlus className="h-4 w-4" />

                Create Account

              </button>

            ) : (

              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-sm font-semibold">

                <AlertCircle className="h-4 w-4" />

                Deploy Employee First

              </div>

            )}

          </div>

          {/* =================================================
              STATUS
          ================================================== */}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">

            <div className="flex flex-wrap items-center gap-3">

              {/* Employment Status */}

              <span
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  String(
                    employee.employment_status || ""
                  ).toLowerCase() === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {employee.employment_status ||
                  "Available"}
              </span>

              {/* Deployment Status */}

              {isDeployed ? (

                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                  Deployed
                </span>

              ) : (

                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                  Not Assigned
                </span>

              )}

              {/* Login Status */}

              {hasAccount && (

                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1.5">

                  <ShieldCheck className="h-3.5 w-3.5" />

                  Login Enabled

                </span>

              )}

            </div>

          </div>

          {/* =================================================
              UNASSIGNED EMPLOYEE ACTION
          ================================================== */}

          {!isDeployed && (

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">

              <div className="flex items-start justify-between gap-4">

                <div className="flex items-start gap-3">

                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">

                    <Send className="h-5 w-5 text-blue-600" />

                  </div>

                  <div>

                    <h3 className="font-bold text-blue-900">
                      Employee is not deployed
                    </h3>

                    <p className="text-sm text-blue-700 mt-1">
                      Deploy this employee to a client
                      before creating their login account.
                    </p>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/employee-deployments?candidate=${employee.id}`
                    )
                  }
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition"
                >

                  <Send className="h-4 w-4" />

                  Deploy Employee

                </button>

              </div>

            </div>

          )}

          {/* =================================================
              PERSONAL INFORMATION
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            <SectionHeader
              icon={User}
              title="Personal Information"
              description="Employee personal and contact details"
            />

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <InfoItem
                icon={User}
                label="Full Name"
                value={employee.full_name}
              />

              <InfoItem
                icon={Mail}
                label="Email"
                value={employee.email}
              />

              <InfoItem
                icon={Phone}
                label="Phone"
                value={employee.phone}
              />

              <InfoItem
                icon={CalendarDays}
                label="Date of Birth"
                value={formatDate(employee.dob)}
              />

              <InfoItem
                icon={User}
                label="Gender"
                value={employee.gender}
              />

              <InfoItem
                icon={MapPin}
                label="Address"
                value={employee.address}
              />

              <InfoItem
                label="City"
                value={employee.city}
              />

              <InfoItem
                label="State"
                value={employee.state}
              />

              <InfoItem
                label="Pincode"
                value={employee.pincode}
              />

            </div>

          </section>

          {/* =================================================
              EMPLOYMENT INFORMATION
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            <SectionHeader
              icon={Briefcase}
              title="Employment Information"
              description="Job and employment details"
            />

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <InfoItem
                label="Employee Code"
                value={
                  employee.employee_code ||
                  `EMP${String(
                    employee.id
                  ).padStart(3, "0")}`
                }
              />

              <InfoItem
                icon={Briefcase}
                label="Designation"
                value={employee.designation}
              />

              <InfoItem
                icon={Building2}
                label="Department"
                value={employee.department}
              />

              <InfoItem
                label="Employment Type"
                value={employee.employment_type}
              />

              <InfoItem
                label="Work Location"
                value={employee.work_location}
              />

              <InfoItem
                icon={CalendarDays}
                label="Date of Joining"
                value={formatDate(
                  employee.date_of_joining
                )}
              />

              <InfoItem
                label="Experience"
                value={employee.experience}
              />

              <InfoItem
                icon={GraduationCap}
                label="Education"
                value={employee.education}
              />

              <InfoItem
                label="Skills"
                value={employee.skills}
              />

              <InfoItem
                label="Deployment ID"
                value={
                  isDeployed
                    ? employee.deployment_id
                    : "Not Assigned"
                }
              />

            </div>

          </section>

          {/* =================================================
              PAYROLL INFORMATION
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            <SectionHeader
              icon={Wallet}
              title="Payroll Information"
              description="Employee payroll configuration"
            />

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              <InfoItem
                icon={Wallet}
                label="Monthly Pay Rate"
                value={formatMoney(
                  employee.pay_rate
                )}
              />

              <InfoItem
                label="PF Applicable"
                value={
                  employee.pf_applicable
                    ? "Yes"
                    : "No"
                }
              />

              <InfoItem
                label="ESIC Applicable"
                value={
                  employee.esic_applicable
                    ? "Yes"
                    : "No"
                }
              />

              <InfoItem
                label="PAN Number"
                value={employee.pan_number}
              />

              <InfoItem
                label="UAN Number"
                value={employee.uan_number}
              />

              <InfoItem
                label="ESIC Number"
                value={employee.esic_number}
              />

              <InfoItem
                label="Bank Name"
                value={employee.bank_name}
              />

              <InfoItem
                label="Bank Account"
                value={employee.bank_account_number}
              />

              <InfoItem
                label="IFSC Code"
                value={employee.ifsc_code}
              />

            </div>

          </section>

          {/* =================================================
              EMERGENCY CONTACT
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            <SectionHeader
              title="Emergency Contact"
            />

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

              <InfoItem
                label="Contact Name"
                value={
                  employee.emergency_contact_name
                }
              />

              <InfoItem
                icon={Phone}
                label="Contact Phone"
                value={
                  employee.emergency_contact_phone
                }
              />

            </div>

          </section>

          {/* =================================================
              ACCOUNT INFORMATION
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            <SectionHeader
              icon={ShieldCheck}
              title="Account Information"
            />

            <div className="p-6">

              {/* ACCOUNT EXISTS */}

              {hasAccount ? (

                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">

                  <ShieldCheck className="h-5 w-5 text-emerald-600" />

                  <div>

                    <p className="text-sm font-bold text-emerald-800">
                      Employee account is active
                    </p>

                    <p className="text-xs text-emerald-700 mt-1">
                      Auth User ID:{" "}
                      {employee.auth_user_id}
                    </p>

                  </div>

                </div>

              ) : isDeployed ? (

                /* DEPLOYED BUT NO ACCOUNT */

                <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4">

                  <div className="flex items-center gap-3">

                    <AlertCircle className="h-5 w-5 text-amber-600" />

                    <div>

                      <p className="text-sm font-bold text-amber-800">
                        No login account created
                      </p>

                      <p className="text-xs text-amber-700 mt-1">
                        This employee is deployed and
                        can now receive a login account.
                      </p>

                    </div>

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/employee/create-account/${employee.id}`
                      )
                    }
                    className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                  >

                    <UserPlus className="h-4 w-4" />

                    Create Account

                  </button>

                </div>

              ) : (

                /* UNASSIGNED */

                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">

                  <AlertCircle className="h-5 w-5 text-slate-500" />

                  <div>

                    <p className="text-sm font-bold text-slate-700">
                      Account creation unavailable
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Deploy the employee first.
                      An employee account can only be
                      created after deployment.
                    </p>

                  </div>

                </div>

              )}

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

// ============================================================
// SECTION HEADER
// ============================================================

function SectionHeader({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="px-6 py-4 border-b border-slate-200">

      <div className="flex items-center gap-2">

        {Icon && (
          <Icon className="h-5 w-5 text-slate-700" />
        )}

        <div>

          <h2 className="font-bold text-slate-900">
            {title}
          </h2>

          {description && (
            <p className="text-xs text-slate-500 mt-0.5">
              {description}
            </p>
          )}

        </div>

      </div>

    </div>
  );
}

// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({
  icon: Icon,
  label,
  value,
}) {
  const displayValue =
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
      ? String(value)
      : "N/A";

  return (
    <div>

      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase">

        {Icon && (
          <Icon className="h-3.5 w-3.5" />
        )}

        {label}

      </div>

      <p className="text-sm font-semibold text-slate-800 mt-1.5 break-words">
        {displayValue}
      </p>

    </div>
  );
}