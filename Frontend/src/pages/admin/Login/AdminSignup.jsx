import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import api from "../../services/api";

function AdminSignup() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // =====================================================
  // FORM CHANGE
  // =====================================================

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // =====================================================
  // ADMIN SIGNUP
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (
      !formData.name ||
      !formData.email ||
      !formData.password
    ) {
      setError(
        "Name, email and password are required."
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
  "/auth/signup/admin",
  {
    name: formData.name,
    email: formData.email,
    password: formData.password,
  }
);

      if (response.data.success) {
        setSuccess(
          "Admin registration submitted successfully. Your account is waiting for approval."
        );

        setSubmitted(true);
      }
    } catch (err) {
      console.error(
        "Admin signup error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to create admin account."
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CHECK ADMIN APPROVAL
  // =====================================================

  useEffect(() => {
    if (!submitted || !formData.email) {
      return;
    }

    let interval;

    const checkApproval = async () => {
      try {
        const response = await api.get("/auth/admin-status", {
  params: {
    email: formData.email,
  },
});

        if (!response.data?.success) {
          return;
        }

        const status = String(
          response.data.status || ""
        ).toLowerCase();

        // =================================================
        // ADMIN APPROVED
        // =================================================

        if (
          status === "active" ||
          status === "approved"
        ) {
          clearInterval(interval);

          alert(
            "Your admin account has been approved by the administrator! You can now login."
          );

          navigate("/login");
        }

        // =================================================
        // ADMIN REJECTED
        // =================================================

        if (status === "rejected") {
          clearInterval(interval);

          alert(
            "Your admin registration has been rejected by the administrator."
          );

          setError(
            "Your admin registration was rejected."
          );
        }
      } catch (error) {
        console.error(
          "Approval status check error:",
          error
        );
      }
    };

    // Check immediately
    checkApproval();

    // Check every 5 seconds
    interval = setInterval(
      checkApproval,
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Admin Signup
          </h1>

          <p className="text-gray-500 mt-2">
            Register as a Talent Corner administrator
          </p>
        </div>

        {!submitted && (
          <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-800">
              Your administrator account will remain
              pending until an existing Talent Corner
              administrator approves it.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 p-3">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg bg-green-50 border border-green-200 text-green-700 p-3">
            {success}
          </div>
        )}

        {submitted ? (
          <div className="text-center space-y-5">

            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-5">
              <p className="font-semibold text-yellow-800">
                Waiting for administrator approval
              </p>

              <p className="text-sm text-yellow-700 mt-2">
                We are checking your account status
                automatically.
              </p>

              <p className="text-xs text-yellow-600 mt-2">
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

                setFormData({
                  name: "",
                  email: "",
                  password: "",
                  confirmPassword: "",
                });
              }}
              className="text-sm text-gray-500 hover:underline"
            >
              Register another admin account
            </button>

          </div>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              <div>
                <label className="block text-sm font-medium mb-1">
                  Administrator Name *
                </label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="Enter administrator name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Email *
                </label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  className="w-full border rounded-lg px-4 py-3"
                  placeholder="admin@example.com"
                />
              </div>

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

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-black text-white font-semibold py-3 rounded-lg disabled:opacity-50"
              >
                {loading
                  ? "Submitting..."
                  : "Register as Admin"}
              </button>

            </form>

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

export default AdminSignup;