import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// =====================================================
// AUTH
// =====================================================

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import Unauthorized from "./pages/admin/Unauthorized";

// =====================================================
// AUTH PAGES
// =====================================================

import Login from "./pages/admin/Login/Login";
import ClientSignup from "./pages/admin/Login/ClientSignup";
import AdminSignup from "./pages/admin/Login/AdminSignup";

// =====================================================
// ADMIN
// =====================================================

import AdminDashboard from "./pages/admin/AdminDashboard";

import ClientManagement from "./pages/admin/Clients/ClientManagement";
import ContractManagement from "./pages/admin/Clients/ContractManagement";

import JobRequirements from "./pages/admin/Recruitment/JobRequirements";
import Candidates from "./pages/admin/Recruitment/Candidates";

import ClientBilling from "./pages/admin/Billing/ClientBilling";
import PaymentConfirmations from "./pages/admin/Billing/PaymentConfirmations";

import EmployeeDeployment from "./pages/admin/Deployment/EmployeeDeployment";
import Unassiged from "./pages/admin/Deployment/Unassiged";

import Attendance from "./pages/admin/Attendance/Attendance";

import Reports from "./pages/admin/Reports";

import Payroll from "./pages/admin/PayrollModule";

import AddEmployee from "./pages/admin/Deployment/AddEmployee";

import EmployeeDetails from "./pages/admin/Deployment/EmployeeDetails";

import CreateEmployeeAccount from "./pages/admin/Deployment/CreateEmployeeAccount";

// =====================================================
// EMPLOYEE
// =====================================================

import EmployeeDashboard from "./pages/Employee/components/EmployeeDashboard";
import EmployeeAttendance from "./pages/Employee/components/EmployeeAttendance";
import EmployeeMonthlyAttendance from "./pages/Employee/components/EmployeeMonthlyAttendance";
import EmployeePayslip from "./pages/Employee/components/EmployeePayslip";
import EmployeeProfile from "./pages/Employee/components/EmployeeProfile";

// =====================================================
// CLIENT
// =====================================================

import ClientPortalDashboard from "./pages/client/components/ClientPortalDashboard";

import ClientAttendance from "./pages/client/components/AttedanceApproval/ClientAttendance";

import JobRequirementsClient from "./pages/client/components/Recruitment/JobRequirementsClient";

import ClientCandidates from "./pages/client/components/Recruitment/ClientCandidates";

import ClientInvoiceManagement from "./pages/client/components/Billing/ClientInvoiceManagement";

// =====================================================
// APP
// =====================================================

function App() {
    return (
        <AuthProvider>

            <div className="min-h-screen bg-slate-50">

                <Routes>

                    {/* =====================================================
                        PUBLIC ROUTES
                    ===================================================== */}

                    <Route
                        path="/"
                        element={
                            <Navigate
                                to="/login"
                                replace
                            />
                        }
                    />

                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route
                        path="/signup/client"
                        element={<ClientSignup />}
                    />

                    <Route
                        path="/signup/admin"
                        element={<AdminSignup />}
                    />

                    <Route
                        path="/unauthorized"
                        element={<Unauthorized />}
                    />


                    {/* =====================================================
                        ADMIN PORTAL
                    ===================================================== */}

                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={[
                                    "admin",
                                    "superadmin",
                                ]}
                            />
                        }
                    >

                        <Route
                            path="/admindashboard"
                            element={<AdminDashboard />}
                        />

                        <Route
                            path="/clients"
                            element={<ClientManagement />}
                        />

                        <Route
                            path="/contracts"
                            element={<ContractManagement />}
                        />

                        <Route
                            path="/admin-job-requirements"
                            element={<JobRequirements />}
                        />

                        <Route
                            path="/candidates"
                            element={<Candidates />}
                        />

                        <Route
                            path="/employees"
                            element={<EmployeeDeployment />}
                        />

                        <Route
                            path="/attendance"
                            element={<Attendance />}
                        />

                        <Route
                            path="/unassigned"
                            element={<Unassiged />}
                        />

                        <Route
                            path="/addEmployee"
                            element={<AddEmployee />}
                        />

                        <Route
                            path="/employee/details/:id"
                            element={<EmployeeDetails />}
                        />

                        <Route
                            path="/employee/create-account/:id"
                            element={<CreateEmployeeAccount />}
                        />

                        <Route
                            path="/client-billing"
                            element={<ClientBilling />}
                        />

                        <Route
                            path="/payment-confirmations"
                            element={<PaymentConfirmations />}
                        />

                        <Route
                            path="/payroll"
                            element={<Payroll />}
                        />

                        <Route
                            path="/reports"
                            element={<Reports />}
                        />

                    </Route>


                    {/* =====================================================
                        EMPLOYEE PORTAL
                    ===================================================== */}

                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={[
                                    "employee",
                                ]}
                            />
                        }
                    >

                        <Route
                            path="/employee-portal"
                            element={
                                <EmployeeDashboard />
                            }
                        />

                        <Route
                            path="/employee-portal/attendance"
                            element={
                                <EmployeeAttendance />
                            }
                        />

                        <Route
                            path="/employee-portal/monthly"
                            element={
                                <EmployeeMonthlyAttendance />
                            }
                        />

                        <Route
                            path="/employee-portal/payslips"
                            element={
                                <EmployeePayslip />
                            }
                        />

                        <Route
                            path="/employee-portal/profile"
                            element={
                                <EmployeeProfile />
                            }
                        />

                    </Route>


                    {/* =====================================================
                        CLIENT PORTAL
                    ===================================================== */}

                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={[
                                    "client",
                                ]}
                            />
                        }
                    >

                        <Route
                            path="/client-dashboard"
                            element={
                                <ClientPortalDashboard />
                            }
                        />

                        <Route
                            path="/client-dashboard/requirements"
                            element={
                                <JobRequirementsClient />
                            }
                        />

                        <Route
                            path="/client-dashboard/candidates"
                            element={
                                <ClientCandidates />
                            }
                        />

                        <Route
                            path="/client-dashboard/attendance-approval"
                            element={
                                <ClientAttendance />
                            }
                        />

                        <Route
                            path="/client-dashboard/invoices"
                            element={
                                <ClientInvoiceManagement />
                            }
                        />

                    </Route>


                    {/* =====================================================
                        OTHER SECTIONS
                    ===================================================== */}

                    <Route
                        element={
                            <ProtectedRoute
                                allowedRoles={[
                                    "employee",
                                    "client",
                                    "admin",
                                    "superadmin",
                                ]}
                            />
                        }
                    >

                        {[
                            "it",
                            "learning",
                            "reviews",
                            "goals",
                            "career",
                            "development",
                            "surveys",
                        ].map((tab) => (

                            <Route
                                key={tab}
                                path={`/${tab}`}
                                element={
                                    <div className="min-h-screen bg-slate-50 p-8">

                                        <h2 className="text-2xl font-bold text-slate-900 capitalize">
                                            {tab} Management
                                        </h2>

                                        <p className="mt-2 text-sm text-slate-500">
                                            Currently viewing the{" "}
                                            {tab} section.
                                        </p>

                                    </div>
                                }
                            />

                        ))}

                    </Route>


                    {/* =====================================================
                        UNKNOWN URL
                    ===================================================== */}

                    <Route
                        path="*"
                        element={
                            <Navigate
                                to="/login"
                                replace
                            />
                        }
                    />

                </Routes>

            </div>

        </AuthProvider>
    );
}

export default App;