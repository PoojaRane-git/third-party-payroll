import React, { useState } from "react";
import {
  UserPlus,
  Loader2,
  User,
  Briefcase,
  Wallet,
  MapPin,
  Phone,
} from "lucide-react";

import Sidebar from "../Layout/Sidebar";

const API_BASE = "http://localhost:5000/api";

const INITIAL_FORM = {
  // =====================================================
  // EMPLOYEE DETAILS
  // =====================================================
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  gender: "",
  joiningDate: "",

  // =====================================================
  // PERSONAL INFORMATION
  // =====================================================
  address: "",
  city: "",
  state: "",
  pincode: "",

  // =====================================================
  // EMERGENCY CONTACT
  // =====================================================
  emergencyContactName: "",
  emergencyContactPhone: "",

  // =====================================================
  // EMPLOYMENT
  // =====================================================
  designation: "",
  department: "",
  employmentType: "Full Time",
  workLocation: "",
  skills: "",
  experience: "",
  education: "",

  // =====================================================
  // PAYROLL
  // =====================================================
  monthlyPayRate: "",
  pfApplicable: false,
  esicApplicable: false,
};

export default function AddEmployee() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // =====================================================
  // RESET
  // =====================================================

  const resetForm = () => {
    setFormData(INITIAL_FORM);
  };

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    // -----------------------------------------------------
    // REQUIRED VALIDATION
    // -----------------------------------------------------

    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.joiningDate ||
      !formData.designation.trim() ||
      !formData.monthlyPayRate
    ) {
      alert("Please fill all required fields.");
      return;
    }

    // -----------------------------------------------------
    // PHONE VALIDATION
    // -----------------------------------------------------

    if (!/^[0-9]{10}$/.test(formData.phone.trim())) {
      alert("Please enter a valid 10-digit employee phone number.");
      return;
    }

    // -----------------------------------------------------
    // EMERGENCY PHONE VALIDATION
    // -----------------------------------------------------

    if (
      formData.emergencyContactPhone.trim() &&
      !/^[0-9]{10}$/.test(formData.emergencyContactPhone.trim())
    ) {
      alert("Please enter a valid 10-digit emergency contact number.");
      return;
    }

    // -----------------------------------------------------
    // PINCODE VALIDATION
    // -----------------------------------------------------

    if (
      formData.pincode.trim() &&
      !/^[0-9]{6}$/.test(formData.pincode.trim())
    ) {
      alert("Please enter a valid 6-digit pincode.");
      return;
    }

    try {
      setLoading(true);

      // ===================================================
      // PAYLOAD
      // ===================================================

      const payload = {
        // -------------------------------------------------
        // BASIC DETAILS
        // -------------------------------------------------

        first_name: formData.firstName.trim(),

        last_name: formData.lastName.trim(),

        full_name:
          `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),

        email: formData.email.trim(),

        phone: formData.phone.trim(),

        // IMPORTANT:
        // DB column is dob
        dob: formData.dateOfBirth || null,

        gender: formData.gender || null,

        date_of_joining: formData.joiningDate,

        // -------------------------------------------------
        // PERSONAL INFORMATION
        // -------------------------------------------------

        address: formData.address.trim() || null,

        city: formData.city.trim() || null,

        state: formData.state.trim() || null,

        pincode: formData.pincode.trim() || null,

        // -------------------------------------------------
        // EMERGENCY CONTACT
        // -------------------------------------------------

        emergency_contact_name:
          formData.emergencyContactName.trim() || null,

        emergency_contact_phone:
          formData.emergencyContactPhone.trim() || null,

        // -------------------------------------------------
        // EMPLOYMENT
        // -------------------------------------------------

        designation: formData.designation.trim(),

        department:
          formData.department.trim() || null,

        employment_type:
          formData.employmentType || "Full Time",

        work_location:
          formData.workLocation.trim() || null,

        skills:
          formData.skills.trim() || null,

        experience:
          formData.experience.trim() || null,

        education:
          formData.education.trim() || null,

        // -------------------------------------------------
        // PAYROLL
        // -------------------------------------------------

        // IMPORTANT:
        // DB column is pay_rate
        pay_rate: Number(formData.monthlyPayRate),

        pf_applicable:
          Boolean(formData.pfApplicable),

        esic_applicable:
          Boolean(formData.esicApplicable),

        // -------------------------------------------------
        // INITIAL STATUS
        // -------------------------------------------------

        // Employee is created but not assigned to client.
        deployment_id: null,

        employment_status: "Available",
      };

      console.log("ADDING EMPLOYEE:", payload);

      // ===================================================
      // API REQUEST
      // ===================================================

      const response = await fetch(
        `${API_BASE}/candidates`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        }
      );

      // ===================================================
      // RESPONSE
      // ===================================================

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Failed to create employee"
        );
      }

      console.log("EMPLOYEE CREATED:", data);

      alert(
        `Employee added successfully${
          data.employee_code
            ? `\nEmployee Code: ${data.employee_code}`
            : ""
        }`
      );

      resetForm();
    } catch (error) {
      console.error("ADD EMPLOYEE ERROR:", error);

      alert(
        `Failed to add employee:\n${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* =====================================================
          SIDEBAR
      ====================================================== */}

      <Sidebar />

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="flex-1 min-w-0 p-8">

        {/* ===================================================
            HEADER
        ==================================================== */}

        <div className="mb-6">

          <div className="flex items-center gap-2">

            <UserPlus className="h-6 w-6 text-indigo-600" />

            <h1 className="text-2xl font-bold text-slate-900">
              Add Employee
            </h1>

          </div>

          <p className="text-sm text-slate-500 mt-1">
            Create an employee record before assigning the
            employee to a client.
          </p>

        </div>

        {/* ===================================================
            FORM
        ==================================================== */}

        <form
          onSubmit={handleSubmit}
          className="max-w-5xl space-y-6"
        >

          {/* =================================================
              EMPLOYEE DETAILS
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">

            <div className="px-6 py-4 border-b border-slate-200">

              <div className="flex items-center gap-2">

                <User className="h-5 w-5 text-indigo-600" />

                <div>

                  <h2 className="font-bold text-slate-900">
                    Employee Details
                  </h2>

                  <p className="text-xs text-slate-500">
                    Basic employee information
                  </p>

                </div>

              </div>

            </div>

            <div className="p-6 space-y-5">

              {/* FIRST + LAST NAME */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="field-label">
                    First Name *
                  </label>

                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    required
                    className="field-input"
                  />

                </div>

                <div>

                  <label className="field-label">
                    Last Name *
                  </label>

                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    required
                    className="field-input"
                  />

                </div>

              </div>

              {/* EMAIL + PHONE */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="field-label">
                    Email *
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="employee@example.com"
                    required
                    className="field-input"
                  />

                </div>

                <div>

                  <label className="field-label">
                    Phone *
                  </label>

                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-digit phone number"
                    maxLength="10"
                    required
                    className="field-input"
                  />

                </div>

              </div>

              {/* DOB + GENDER */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="field-label">
                    Date of Birth
                  </label>

                  <input
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="field-input"
                  />

                </div>

                <div>

                  <label className="field-label">
                    Gender
                  </label>

                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="field-input"
                  >

                    <option value="">
                      Select Gender
                    </option>

                    <option value="Male">
                      Male
                    </option>

                    <option value="Female">
                      Female
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

              </div>

              {/* JOINING DATE */}

              <div className="md:w-1/2">

                <label className="field-label">
                  Joining Date *
                </label>

                <input
                  type="date"
                  name="joiningDate"
                  value={formData.joiningDate}
                  onChange={handleChange}
                  required
                  className="field-input"
                />

              </div>

            </div>

          </section>

          {/* =================================================
              PERSONAL INFORMATION
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">

            <div className="px-6 py-4 border-b border-slate-200">

              <div className="flex items-center gap-2">

                <MapPin className="h-5 w-5 text-indigo-600" />

                <div>

                  <h2 className="font-bold text-slate-900">
                    Personal Information
                  </h2>

                  <p className="text-xs text-slate-500">
                    Address and emergency contact details
                  </p>

                </div>

              </div>

            </div>

            <div className="p-6 space-y-5">

              {/* ADDRESS */}

              <div>

                <label className="field-label">
                  Address
                </label>

                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Enter complete address"
                  rows="3"
                  className="field-input resize-none"
                />

              </div>

              {/* CITY / STATE / PINCODE */}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>

                  <label className="field-label">
                    City
                  </label>

                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="e.g. Mumbai"
                    className="field-input"
                  />

                </div>

                <div>

                  <label className="field-label">
                    State
                  </label>

                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="e.g. Maharashtra"
                    className="field-input"
                  />

                </div>

                <div>

                  <label className="field-label">
                    Pincode
                  </label>

                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="6-digit pincode"
                    maxLength="6"
                    className="field-input"
                  />

                </div>

              </div>

              {/* EMERGENCY CONTACT */}

              <div className="pt-2">

                <div className="flex items-center gap-2 mb-3">

                  <Phone className="h-4 w-4 text-indigo-600" />

                  <h3 className="text-sm font-bold text-slate-800">
                    Emergency Contact
                  </h3>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="field-label">
                      Contact Name
                    </label>

                    <input
                      type="text"
                      name="emergencyContactName"
                      value={formData.emergencyContactName}
                      onChange={handleChange}
                      placeholder="Emergency contact name"
                      className="field-input"
                    />

                  </div>

                  <div>

                    <label className="field-label">
                      Contact Phone
                    </label>

                    <input
                      type="tel"
                      name="emergencyContactPhone"
                      value={formData.emergencyContactPhone}
                      onChange={handleChange}
                      placeholder="10-digit phone number"
                      maxLength="10"
                      className="field-input"
                    />

                  </div>

                </div>

              </div>

            </div>

          </section>

          {/* =================================================
              EMPLOYMENT
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">

            <div className="px-6 py-4 border-b border-slate-200">

              <div className="flex items-center gap-2">

                <Briefcase className="h-5 w-5 text-indigo-600" />

                <div>

                  <h2 className="font-bold text-slate-900">
                    Employment
                  </h2>

                  <p className="text-xs text-slate-500">
                    Employee's employment information
                  </p>

                </div>

              </div>

            </div>

            <div className="p-6 space-y-5">

              {/* DESIGNATION / DEPARTMENT */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="field-label">
                    Designation *
                  </label>

                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g. Java Developer"
                    required
                    className="field-input"
                  />

                </div>

                <div>

                  <label className="field-label">
                    Department
                  </label>

                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="e.g. IT"
                    className="field-input"
                  />

                </div>

              </div>

              {/* EMPLOYMENT TYPE / WORK LOCATION */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="field-label">
                    Employment Type
                  </label>

                  <select
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleChange}
                    className="field-input"
                  >

                    <option value="Full Time">
                      Full Time
                    </option>

                    <option value="Part Time">
                      Part Time
                    </option>

                    <option value="Contract">
                      Contract
                    </option>

                    <option value="Intern">
                      Intern
                    </option>

                  </select>

                </div>

                <div>

                  <label className="field-label">
                    Work Location
                  </label>

                  <input
                    type="text"
                    name="workLocation"
                    value={formData.workLocation}
                    onChange={handleChange}
                    placeholder="e.g. Mumbai"
                    className="field-input"
                  />

                </div>

              </div>

              {/* SKILLS / EXPERIENCE */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div>

                  <label className="field-label">
                    Skills
                  </label>

                  <input
                    type="text"
                    name="skills"
                    value={formData.skills}
                    onChange={handleChange}
                    placeholder="e.g. Java, Spring Boot, SQL"
                    className="field-input"
                  />

                </div>

                <div>

                  <label className="field-label">
                    Experience
                  </label>

                  <input
                    type="text"
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    placeholder="e.g. 2 Years"
                    className="field-input"
                  />

                </div>

              </div>

              {/* EDUCATION */}

              <div>

                <label className="field-label">
                  Education
                </label>

                <input
                  type="text"
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                  placeholder="e.g. B.Sc Computer Science"
                  className="field-input"
                />

              </div>

            </div>

          </section>

          {/* =================================================
              PAYROLL
          ================================================== */}

          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm">

            <div className="px-6 py-4 border-b border-slate-200">

              <div className="flex items-center gap-2">

                <Wallet className="h-5 w-5 text-indigo-600" />

                <div>

                  <h2 className="font-bold text-slate-900">
                    Payroll
                  </h2>

                  <p className="text-xs text-slate-500">
                    Employee payroll configuration
                  </p>

                </div>

              </div>

            </div>

            <div className="p-6 space-y-5">

              {/* PAY RATE */}

              <div className="md:w-1/2">

                <label className="field-label">
                  Monthly Pay Rate *
                </label>

                <div className="relative">

                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                    ₹
                  </span>

                  <input
                    type="number"
                    name="monthlyPayRate"
                    value={formData.monthlyPayRate}
                    onChange={handleChange}
                    placeholder="40000"
                    min="0"
                    step="0.01"
                    required
                    className="field-input pl-8"
                  />

                </div>

              </div>

              {/* PF + ESIC */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* PF */}

                <label className="flex items-center justify-between border border-slate-200 rounded-xl p-4 cursor-pointer hover:bg-slate-50">

                  <div>

                    <p className="text-sm font-semibold text-slate-800">
                      PF Applicable
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Apply Provident Fund deduction
                    </p>

                  </div>

                  <input
                    type="checkbox"
                    name="pfApplicable"
                    checked={formData.pfApplicable}
                    onChange={handleChange}
                    className="h-5 w-5 accent-indigo-600"
                  />

                </label>

                {/* ESIC */}

                <label className="flex items-center justify-between border border-slate-200 rounded-xl p-4 cursor-pointer hover:bg-slate-50">

                  <div>

                    <p className="text-sm font-semibold text-slate-800">
                      ESIC Applicable
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Apply ESIC contribution
                    </p>

                  </div>

                  <input
                    type="checkbox"
                    name="esicApplicable"
                    checked={formData.esicApplicable}
                    onChange={handleChange}
                    className="h-5 w-5 accent-indigo-600"
                  />

                </label>

              </div>

            </div>

          </section>

          {/* =================================================
              ACTIONS
          ================================================== */}

          <div className="flex justify-end gap-3">

            <button
              type="button"
              onClick={resetForm}
              disabled={loading}
              className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Clear
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
            >

              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Add Employee
                </>
              )}

            </button>

          </div>

        </form>

      </main>

      {/* =====================================================
          FIELD STYLES
      ====================================================== */}

      <style>{`
        .field-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          color: #475569;
          margin-bottom: 0.375rem;
        }

        .field-input {
          width: 100%;
          border: 1px solid #e2e8f0;
          padding: 0.625rem 0.75rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          color: #0f172a;
          background: white;
          outline: none;
        }

        .field-input:focus {
          border-color: #818cf8;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.12);
        }

        .field-input::placeholder {
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
