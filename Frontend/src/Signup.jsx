
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api";

function Signup() {
    const navigate = useNavigate();

    const [accountType, setAccountType] =
        useState("client");

    const [formData, setFormData] = useState({
        // ========================================================
        // COMMON
        // ========================================================

        name: "",
        email: "",
        password: "",
        confirmPassword: "",

        // ========================================================
        // CLIENT
        // ========================================================

        company_name: "",
        gstin: "",
        billing_address: "",
        state_code: "",
        credit_terms: "Net 30",
        contact_person: "",
        phone: "",
        service_fee: "",

        // ========================================================
        // EMPLOYEE
        // ========================================================

        pan_number: "",
        bank_account_number: "",
        ifsc_code: "",
        bank_name: "",
        uan_number: "",
        esic_number: "",
        date_of_joining: "",
        designation: "",
        deployment_id: "",
    });

    const [loading, setLoading] =
        useState(false);

    const [message, setMessage] =
        useState("");

    const [error, setError] =
        useState("");

    // ============================================================
    // HANDLE INPUT
    // ============================================================

    const handleChange = (e) => {
        const {
            name,
            value,
        } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        setError("");
        setMessage("");
    };

    // ============================================================
    // CHANGE ACCOUNT TYPE
    // ============================================================

    const handleAccountTypeChange = (type) => {
        setAccountType(type);

        setError("");
        setMessage("");

        setFormData((prev) => ({
            ...prev,

            password: "",
            confirmPassword: "",
        }));
    };

    // ============================================================
    // VALIDATION
    // ============================================================

    const validateForm = () => {
        const email =
            formData.email.trim();

        const password =
            formData.password;

        if (!email) {
            return "Email is required.";
        }

        if (!password) {
            return "Password is required.";
        }

        if (password.length < 8) {
            return "Password must be at least 8 characters.";
        }

        if (
            password !==
            formData.confirmPassword
        ) {
            return "Passwords do not match.";
        }

        // ========================================================
        // CLIENT
        // ========================================================

        if (accountType === "client") {
            if (
                !formData.company_name.trim()
            ) {
                return "Company name is required.";
            }

            if (
                !formData.contact_person.trim()
            ) {
                return "Contact person is required.";
            }

            if (!formData.phone.trim()) {
                return "Phone number is required.";
            }
        }

        // ========================================================
        // EMPLOYEE
        // ========================================================

        if (accountType === "employee") {
            if (!formData.name.trim()) {
                return "Full name is required.";
            }

            if (!formData.phone.trim()) {
                return "Phone number is required.";
            }

            if (
                !formData.designation.trim()
            ) {
                return "Designation is required.";
            }

            if (
                !formData.date_of_joining
            ) {
                return "Date of joining is required.";
            }
        }

        return null;
    };

    // ============================================================
    // SUBMIT
    // ============================================================

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setMessage("");

        const validationError =
            validateForm();

        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);

        try {
            let endpoint = "";
            let body = {};

            // ====================================================
            // CLIENT
            // ====================================================

            if (
                accountType === "client"
            ) {
                endpoint =
                    "/auth/signup-client";

                body = {
                    email: formData.email
                        .trim()
                        .toLowerCase(),

                    password:
                        formData.password,

                    company_name:
                        formData.company_name.trim(),

                    gstin:
                        formData.gstin
                            .trim()
                            .toUpperCase(),

                    billing_address:
                        formData.billing_address.trim(),

                    state_code:
                        formData.state_code.trim(),

                    credit_terms:
                        formData.credit_terms.trim(),

                    contact_person:
                        formData.contact_person.trim(),

                    phone:
                        formData.phone.trim(),

                    service_fee:
                        formData.service_fee === ""
                            ? null
                            : Number(
                                  formData.service_fee
                              ),
                };
            }

            // ====================================================
            // EMPLOYEE
            // ====================================================

            if (
                accountType === "employee"
            ) {
                endpoint =
                    "/auth/signup-employee";

                body = {
                    name:
                        formData.name.trim(),

                    full_name:
                        formData.name.trim(),

                    email:
                        formData.email
                            .trim()
                            .toLowerCase(),

                    password:
                        formData.password,

                    phone:
                        formData.phone.trim(),

                    pan_number:
                        formData.pan_number
                            .trim()
                            .toUpperCase(),

                    bank_account_number:
                        formData.bank_account_number.trim(),

                    ifsc_code:
                        formData.ifsc_code
                            .trim()
                            .toUpperCase(),

                    bank_name:
                        formData.bank_name.trim(),

                    uan_number:
                        formData.uan_number.trim(),

                    esic_number:
                        formData.esic_number.trim(),

                    date_of_joining:
                        formData.date_of_joining,

                    employment_status:
                        "Pending",

                    designation:
                        formData.designation.trim(),

                    deployment_id:
                        formData.deployment_id ===
                            ""
                            ? null
                            : Number(
                                  formData.deployment_id
                              ),
                };
            }

            // ====================================================
            // SAFETY CHECK
            // ====================================================

            if (!endpoint) {
                throw new Error(
                    "Invalid account type."
                );
            }

            // ====================================================
            // API REQUEST
            // ====================================================

            const response =
                await fetch(
                    `${API_BASE_URL}${endpoint}`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify(
                            body
                        ),
                    }
                );

            // ====================================================
            // PARSE RESPONSE SAFELY
            // ====================================================

            let data;

            try {
                data =
                    await response.json();
            } catch {
                throw new Error(
                    "Invalid response from server."
                );
            }

            // ====================================================
            // API ERROR
            // ====================================================

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                        "Signup failed."
                );
            }

            // ====================================================
            // SUCCESS
            // ====================================================

            setMessage(
                data?.message ||
                    "Account created successfully."
            );

            setFormData((prev) => ({
                ...prev,

                password: "",
                confirmPassword: "",
            }));

            // ====================================================
            // CLIENT
            // ====================================================

            if (
                accountType === "client"
            ) {
                setTimeout(() => {
                    navigate("/login");
                }, 1500);

                return;
            }

            // ====================================================
            // EMPLOYEE
            // ====================================================

            if (
                accountType === "employee"
            ) {
                // Do NOT automatically login.
                //
                // Employee must be approved by admin.
                //
                // Stay on page so user can see
                // the approval message.

                return;
            }
        } catch (err) {
            console.error(
                "Signup error:",
                err
            );

            setError(
                err?.message ||
                    "Unable to create account."
            );
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // INPUT COMPONENT
    // ============================================================

    const Input = ({
        label,
        name,
        type = "text",
        required = false,
        placeholder = "",
    }) => (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
                {label}

                {required && (
                    <span className="text-red-500">
                        {" "}*
                    </span>
                )}
            </label>

            <input
                type={type}
                name={name}
                value={
                    formData[name] || ""
                }
                onChange={
                    handleChange
                }
                placeholder={
                    placeholder
                }
                required={required}
                disabled={loading}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
        </div>
    );

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">

            <div className="w-full max-w-4xl">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="text-center mb-8">

                    <h1 className="text-3xl font-bold text-slate-900">
                        Talent Corner
                    </h1>

                    <p className="mt-2 text-slate-500">
                        Create your account
                    </p>

                </div>

                {/* =================================================
                    CARD
                ================================================= */}

                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">

                    {/* =================================================
                        ACCOUNT TYPE
                    ================================================= */}

                    <div className="mb-8">

                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                            I am signing up as
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            {/* CLIENT */}

                            <button
                                type="button"
                                disabled={
                                    loading
                                }
                                onClick={() =>
                                    handleAccountTypeChange(
                                        "client"
                                    )
                                }
                                className={`rounded-xl border-2 p-4 text-left transition ${
                                    accountType ===
                                    "client"
                                        ? "border-blue-600 bg-blue-50"
                                        : "border-slate-200 hover:border-slate-300"
                                }`}
                            >
                                <div className="font-semibold text-slate-900">
                                    Client
                                </div>

                                <div className="text-sm text-slate-500 mt-1">
                                    Company / organization
                                </div>
                            </button>

                            {/* EMPLOYEE */}

                            <button
                                type="button"
                                disabled={
                                    loading
                                }
                                onClick={() =>
                                    handleAccountTypeChange(
                                        "employee"
                                    )
                                }
                                className={`rounded-xl border-2 p-4 text-left transition ${
                                    accountType ===
                                    "employee"
                                        ? "border-blue-600 bg-blue-50"
                                        : "border-slate-200 hover:border-slate-300"
                                }`}
                            >
                                <div className="font-semibold text-slate-900">
                                    Employee
                                </div>

                                <div className="text-sm text-slate-500 mt-1">
                                    Employee / candidate
                                </div>
                            </button>

                        </div>

                    </div>

                    {/* =================================================
                        ERROR
                    ================================================= */}

                    {error && (
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {/* =================================================
                        SUCCESS
                    ================================================= */}

                    {message && (
                        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                            {message}
                        </div>
                    )}

                    {/* =================================================
                        FORM
                    ================================================= */}

                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="space-y-8"
                    >

                        {/* =================================================
                            CLIENT
                        ================================================= */}

                        {accountType ===
                            "client" && (
                            <>

                                <div>

                                    <h2 className="text-lg font-semibold text-slate-900">
                                        Company Information
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">

                                        <Input
                                            label="Company Name"
                                            name="company_name"
                                            required
                                        />

                                        <Input
                                            label="GSTIN"
                                            name="gstin"
                                        />

                                        <Input
                                            label="State Code"
                                            name="state_code"
                                        />

                                        <div>

                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Credit Terms
                                            </label>

                                            <select
                                                name="credit_terms"
                                                value={
                                                    formData.credit_terms
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                                disabled={
                                                    loading
                                                }
                                                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
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

                                    </div>

                                </div>

                                <div>

                                    <h2 className="text-lg font-semibold text-slate-900">
                                        Contact Information
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">

                                        <Input
                                            label="Contact Person"
                                            name="contact_person"
                                            required
                                        />

                                        <Input
                                            label="Phone"
                                            name="phone"
                                            type="tel"
                                            required
                                        />

                                        <Input
                                            label="Service Fee"
                                            name="service_fee"
                                            type="number"
                                            placeholder="Enter service fee"
                                        />

                                        <Input
                                            label="Email"
                                            name="email"
                                            type="email"
                                            required
                                        />

                                    </div>

                                    <div className="mt-5">

                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Billing Address
                                        </label>

                                        <textarea
                                            name="billing_address"
                                            value={
                                                formData.billing_address
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            rows={3}
                                            disabled={
                                                loading
                                            }
                                            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 disabled:bg-slate-100"
                                        />

                                    </div>

                                </div>

                            </>
                        )}

                        {/* =================================================
                            EMPLOYEE
                        ================================================= */}

                        {accountType ===
                            "employee" && (
                            <>

                                <div>

                                    <h2 className="text-lg font-semibold text-slate-900">
                                        Personal Information
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">

                                        <Input
                                            label="Full Name"
                                            name="name"
                                            required
                                        />

                                        <Input
                                            label="Email"
                                            name="email"
                                            type="email"
                                            required
                                        />

                                        <Input
                                            label="Phone"
                                            name="phone"
                                            type="tel"
                                            required
                                        />

                                        <Input
                                            label="Designation"
                                            name="designation"
                                            required
                                        />

                                        <Input
                                            label="Date of Joining"
                                            name="date_of_joining"
                                            type="date"
                                            required
                                        />

                                    </div>

                                </div>

                                <div>

                                    <h2 className="text-lg font-semibold text-slate-900">
                                        Employment & Statutory Information
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">

                                        <Input
                                            label="PAN Number"
                                            name="pan_number"
                                        />

                                        <Input
                                            label="UAN Number"
                                            name="uan_number"
                                        />

                                        <Input
                                            label="ESIC Number"
                                            name="esic_number"
                                        />

                                        <Input
                                            label="Bank Name"
                                            name="bank_name"
                                        />

                                        <Input
                                            label="Bank Account Number"
                                            name="bank_account_number"
                                        />

                                        <Input
                                            label="IFSC Code"
                                            name="ifsc_code"
                                        />

                                        <Input
                                            label="Deployment ID"
                                            name="deployment_id"
                                            type="number"
                                        />

                                    </div>

                                    <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                                        <strong>
                                            Approval required:
                                        </strong>{" "}
                                        Your account will remain pending until an administrator approves it.
                                    </div>

                                </div>

                            </>
                        )}

                        {/* =================================================
                            LOGIN INFORMATION
                        ================================================= */}

                        <div>

                            <h2 className="text-lg font-semibold text-slate-900">
                                Login Information
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">

                                <Input
                                    label="Password"
                                    name="password"
                                    type="password"
                                    required
                                />

                                <Input
                                    label="Confirm Password"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                />

                            </div>

                            <p className="text-xs text-slate-500 mt-2">
                                Password must contain at least 8 characters.
                            </p>

                        </div>

                        {/* =================================================
                            SUBMIT
                        ================================================= */}

                        <button
                            type="submit"
                            disabled={
                                loading
                            }
                            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading
                                ? "Creating Account..."
                                : "Create Account"}
                        </button>

                    </form>

                    {/* =================================================
                        LOGIN
                    ================================================= */}

                    <div className="text-center mt-6 text-sm text-slate-600">

                        Already have an account?{" "}

                        <Link
                            to="/login"
                            className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                            Log in
                        </Link>

                    </div>

                </div>
            </div>
        </div>
    );
}

export default Signup;
