import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import api from "../../services/api";

function ClientSignup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gstin: "",
    billing_address: "",
    state_code: "",
    credit_terms: "Net 30",
    service_fee: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // =====================================================
  // HANDLE INPUT CHANGE
  // =====================================================

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // =====================================================
  // RESET FORM
  // =====================================================

  const resetForm = () => {
    setFormData({
      company_name: "",
      contact_person: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      gstin: "",
      billing_address: "",
      state_code: "",
      credit_terms: "Net 30",
      service_fee: "",
    });
  };

  // =====================================================
  // CLIENT SIGNUP
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (
      !formData.company_name ||
      !formData.email ||
      !formData.password
    ) {
      setError(
        "Company name, email and password are required."
      );
      return;
    }

    if (formData.password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
  "/auth/signup-client",
  {
    company_name: formData.company_name,
    contact_person: formData.contact_person,
    email: formData.email,
    phone: formData.phone,
    password: formData.password,
    gstin: formData.gstin,
    billing_address: formData.billing_address,
    state_code: formData.state_code,
    credit_terms: formData.credit_terms,
    service_fee: formData.service_fee,
  }
);

      if (response.data.success) {
        setSuccess(
          "Client registration submitted successfully. Your account is waiting for admin approval."
        );

        // IMPORTANT:
        // Keep email because we need it to check approval status.
        setSubmitted(true);
      }
    } catch (err) {
      console.error(
        "Client signup error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to create client account."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CHECK CLIENT APPROVAL
  // =====================================================

  useEffect(() => {
    if (!submitted || !formData.email) {
      return;
    }

    let interval;

    const checkClientApproval = async () => {
      try {
        const response = await api.get(
  "/auth/client-status",
  {
    params: {
      email: formData.email,
    },
  }
);

        if (!response.data?.success) {
          return;
        }

        const status = String(
          response.data.status || ""
        ).toLowerCase();

        console.log(
          "Client approval status:",
          status
        );

        // =================================================
        // CLIENT APPROVED
        // =================================================

        if (status === "active") {
          clearInterval(interval);

          alert(
            "Your client account has been approved by the administrator! You can now login."
          );

          navigate("/login", {
            replace: true,
          });

          return;
        }

        // =================================================
        // CLIENT REJECTED
        // =================================================

        if (status === "rejected") {
          clearInterval(interval);

          alert(
            "Your client registration has been rejected by the administrator."
          );

          setError(
            "Your client registration was rejected."
          );

          return;
        }
      } catch (error) {
        console.error(
          "Client approval status check error:",
          error
        );
      }
    };

    // Check immediately
    checkClientApproval();

    // Check every 5 seconds
    interval = setInterval(
      checkClientApproval,
      5000
    );

    return () => {
      clearInterval(interval);
    };
  }, [
    submitted,
    formData.email,
    navigate,
  ]);

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-10">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Client Signup
          </h1>

          <p className="text-gray-500 mt-2">
            Register your company with Talent Corner
          </p>
        </div>

        {/* =================================================
            PENDING INFORMATION
        ================================================= */}

        {!submitted && (
          <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              Your client account will remain pending
              until a Talent Corner administrator approves
              your registration.
            </p>
          </div>
        )}

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">
            {error}
          </div>
        )}

        {/* =================================================
            SUCCESS
        ================================================= */}

        {success && (
          <div className="mb-5 rounded-lg bg-green-50 border border-green-200 text-green-700 p-3">
            {success}
          </div>
        )}

        {/* =================================================
            SUBMITTED / WAITING
        ================================================= */}

        {submitted ? (
          <div className="text-center space-y-5">

            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-5">

              <p className="font-semibold text-yellow-800">
                Waiting for administrator approval
              </p>

              <p className="text-sm text-yellow-700 mt-2">
                Your client account has been created
                successfully.
              </p>

              <p className="text-sm text-yellow-700 mt-2">
                We are checking your approval status
                automatically.
              </p>

              <p className="text-xs text-yellow-600 mt-3">
                You will receive an alert as soon as
                your account is approved.
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                navigate("/login")
              }
              className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 rounded-lg"
            >
              Go to Login
            </button>

            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setSuccess("");
                setError("");
                resetForm();
              }}
              className="text-sm text-gray-500 hover:underline"
            >
              Register another client account
            </button>

          </div>
        ) : (
          <>
            {/* =================================================
                FORM
            ================================================= */}

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              {/* Company Name */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Company Name *
                </label>

                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Enter company name"
                />
              </div>

              {/* Contact Person */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Contact Person
                </label>

                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Enter contact person name"
                />
              </div>

              {/* Email */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Login Email *
                </label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="client@example.com"
                />
              </div>

              {/* Phone */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone
                </label>

                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="+91 9876543210"
                />
              </div>

              {/* GSTIN */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  GSTIN
                </label>

                <input
                  type="text"
                  name="gstin"
                  value={formData.gstin}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Enter GSTIN"
                />
              </div>

              {/* Billing Address */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Billing Address
                </label>

                <textarea
                  name="billing_address"
                  value={formData.billing_address}
                  onChange={handleChange}
                  rows={3}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Enter billing address"
                />
              </div>

              {/* State Code */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  State Code
                </label>

                <input
                  type="text"
                  name="state_code"
                  value={formData.state_code}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Example: 27"
                />
              </div>

              {/* Credit Terms */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Credit Terms
                </label>

                <select
                  name="credit_terms"
                  value={formData.credit_terms}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                >
                  <option value="Net 15">
                    Net 15
                  </option>

                  <option value="Net 30">
                    Net 30
                  </option>

                  <option value="Net 45">
                    Net 45
                  </option>

                  <option value="Net 60">
                    Net 60
                  </option>
                </select>
              </div>

              {/* Service Fee */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Service Fee
                </label>

                <input
                  type="number"
                  name="service_fee"
                  value={formData.service_fee}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Enter service fee"
                />
              </div>

              {/* Password */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Password *
                </label>

                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Minimum 8 characters"
                />
              </div>

              {/* Confirm Password */}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Confirm Password *
                </label>

                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Confirm password"
                />
              </div>

              {/* Submit */}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 rounded-lg disabled:opacity-50"
              >
                {loading
                  ? "Submitting..."
                  : "Register as Client"}
              </button>

            </form>

            {/* Login */}

            <div className="text-center mt-6">
              <p className="text-gray-500">
                Already have an account?
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate("/login")
                }
                className="text-blue-600 font-semibold mt-1"
              >
                Login
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default ClientSignup;