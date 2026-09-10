import React, { useState } from "react";

export default function EmployeeCreateAccountModal({
    employee,
    onClose,
    onCreated,
    API_BASE,
}) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // ============================================================
    // CLOSE MODAL
    // ============================================================

    const handleClose = () => {
        if (loading) return;

        setPassword("");
        setConfirmPassword("");

        onClose?.();
    };

    // ============================================================
    // CREATE ACCOUNT
    // ============================================================

    const handleCreate = async () => {
        // --------------------------------------------------------
        // EMPLOYEE ID
        // --------------------------------------------------------

        const employeeId = Number(employee?.id);

        if (!Number.isInteger(employeeId) || employeeId <= 0) {
            alert("Employee ID is missing or invalid.");
            return;
        }

        // --------------------------------------------------------
        // EMAIL
        // --------------------------------------------------------

        const employeeEmail = String(
            employee?.email || ""
        ).trim();

        if (!employeeEmail) {
            alert(
                "Employee email is required before creating an account."
            );
            return;
        }

        // --------------------------------------------------------
        // PASSWORD
        // --------------------------------------------------------

        if (!password) {
            alert("Please enter a password.");
            return;
        }

        if (password.length < 8) {
            alert(
                "Password must be at least 8 characters."
            );
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        try {
            setLoading(true);

            // ====================================================
            // API REQUEST
            // ====================================================

            const response = await fetch(
                `${API_BASE}/employee-users/create-account`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                    },

                    body: JSON.stringify({
                        employee_id: employeeId,
                        password: password,
                    }),
                }
            );

            // ====================================================
            // SAFE JSON RESPONSE
            // ====================================================

            const data = await response
                .json()
                .catch(() => ({}));

            // ====================================================
            // API ERROR
            // ====================================================

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    "Failed to create employee account."
                );
            }

            // ====================================================
            // SUCCESS
            // ====================================================

            alert(
                data?.message ||
                "Employee account created successfully."
            );
            console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("Employee email:", employeeEmail);
console.log("Sending employee account email...");

            // Clear password fields
            setPassword("");
            setConfirmPassword("");

            // Refresh EmployeeDeployment
            await onCreated?.(data);

            // Close modal
            onClose?.();

        } catch (error) {
            console.error(
                "Create employee account error:",
                error
            );

            alert(
                error?.message ||
                "Failed to create employee account."
            );

        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // UI
    // ============================================================

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
            onMouseDown={(e) => {
                if (
                    e.target === e.currentTarget &&
                    !loading
                ) {
                    handleClose();
                }
            }}
        >
            <div className="w-full max-w-md rounded-xl bg-white shadow-xl">

                {/* ==================================================
                    HEADER
                ================================================== */}

                <div className="flex items-center justify-between border-b px-6 py-4">

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Create Employee Account
                        </h2>

                        <p className="text-sm text-gray-500">
                            {employee?.name ||
                                "Employee"}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="text-xl text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Close"
                    >
                        ×
                    </button>

                </div>

                {/* ==================================================
                    BODY
                ================================================== */}

                <div className="space-y-4 px-6 py-5">

                    {/* EMAIL */}

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Login Email
                        </label>

                        <input
                            type="email"
                            value={
                                employee?.email || ""
                            }
                            disabled
                            className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-600"
                        />
                    </div>

                    {/* PASSWORD */}

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Initial Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(e) =>
                                setPassword(
                                    e.target.value
                                )
                            }
                            placeholder="Minimum 8 characters"
                            disabled={loading}
                            autoComplete="new-password"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                        />

                        <p className="mt-1 text-xs text-gray-400">
                            Minimum 8 characters
                        </p>
                    </div>

                    {/* CONFIRM PASSWORD */}

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Confirm Password
                        </label>

                        <input
                            type="password"
                            value={
                                confirmPassword
                            }
                            onChange={(e) =>
                                setConfirmPassword(
                                    e.target.value
                                )
                            }
                            placeholder="Re-enter password"
                            disabled={loading}
                            autoComplete="new-password"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                        />

                        {confirmPassword &&
                            password !==
                                confirmPassword && (
                                <p className="mt-1 text-xs text-red-500">
                                    Passwords do not match.
                                </p>
                            )}
                    </div>

                    {/* INFORMATION */}

                    <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">

                        <p className="font-medium">
                            Employee Login
                        </p>

                        <p className="mt-1 text-xs leading-5">
                            The employee will use this email
                            and password to log in to the
                            employee portal.
                        </p>

                        <p className="mt-2 text-xs leading-5">
                            After the account is created,
                            the login details will be sent
                            to the employee's email.
                        </p>

                    </div>

                    {/* SECURITY NOTE */}

                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
                        The password is used only to create
                        the Supabase Auth account. It is not
                        stored in the employee profile table.
                    </div>

                </div>

                {/* ==================================================
                    FOOTER
                ================================================== */}

                <div className="flex justify-end gap-3 border-t bg-gray-50 px-6 py-4">

                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={loading}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={
                            loading ||
                            !employee?.id ||
                            !employee?.email
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading
                            ? "Creating..."
                            : "Create Account"}
                    </button>

                </div>

            </div>
        </div>
    );
}