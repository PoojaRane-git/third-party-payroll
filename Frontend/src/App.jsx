import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// =====================================================
// AUTH
// =====================================================

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";

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

import AttendanceApproval from "./pages/client/components/AttedanceApproval/AttendanceApproval";

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

                    {/* DEFAULT */}

                    <Route
                        path="/"
                        element={
                            <Navigate
                                to="/login"
                                replace
                            />
                        }
                    />

                    {/* LOGIN */}

                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    {/* CLIENT SIGNUP */}

                    <Route
                        path="/signup/client"
                        element={<ClientSignup />}
                    />

                    {/* ADMIN SIGNUP */}

                    <Route
                        path="/signup/admin"
                        element={<AdminSignup />}
                    />


                    {/* =====================================================
                        PROTECTED ROUTES
                    ===================================================== */}

                    <Route element={<ProtectedRoute />}>

                        {/* =================================================
                            ADMIN DASHBOARD
                        ================================================= */}

                        <Route
                            path="/admindashboard"
                            element={
                                <AdminDashboard />
                            }
                        />


                        {/* =================================================
                            ADMIN - CLIENT MANAGEMENT
                        ================================================= */}

                        <Route
                            path="/clients"
                            element={
                                <ClientManagement />
                            }
                        />

                        <Route
                            path="/contracts"
                            element={
                                <ContractManagement />
                            }
                        />


                        {/* =================================================
                            ADMIN - RECRUITMENT
                        ================================================= */}

                        <Route
                            path="/admin-job-requirements"
                            element={
                                <JobRequirements />
                            }
                        />

                        <Route
                            path="/candidates"
                            element={
                                <Candidates />
                            }
                        />


                        {/* =================================================
                            ADMIN - EMPLOYEE / DEPLOYMENT
                        ================================================= */}

                        <Route
                            path="/employees"
                            element={
                                <EmployeeDeployment />
                            }
                        />

                        <Route
                            path="/attendance"
                            element={
                                <Attendance />
                            }
                        />

                        <Route
                            path="/unassigned"
                            element={
                                <Unassiged />
                            }
                        />

                        <Route
                            path="/addEmployee"
                            element={
                                <AddEmployee />
                            }
                        />

                        <Route
                            path="/employee/details/:id"
                            element={
                                <EmployeeDetails />
                            }
                        />

                        <Route
                            path="/employee/create-account/:id"
                            element={
                                <CreateEmployeeAccount />
                            }
                        />


                        {/* =================================================
                            ADMIN - BILLING
                        ================================================= */}

                        <Route
                            path="/client-billing"
                            element={
                                <ClientBilling />
                            }
                        />

                        <Route
                            path="/payment-confirmations"
                            element={
                                <PaymentConfirmations />
                            }
                        />


                        {/* =================================================
                            ADMIN - PAYROLL
                        ================================================= */}

                        <Route
                            path="/payroll"
                            element={
                                <Payroll />
                            }
                        />


                        {/* =================================================
                            ADMIN - REPORTS
                        ================================================= */}

                        <Route
                            path="/reports"
                            element={
                                <Reports />
                            }
                        />


                        {/* =================================================
                            EMPLOYEE PORTAL
                        ================================================= */}

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


                        {/* =================================================
                            CLIENT PORTAL
                        ================================================= */}

                        <Route
                            path="/client-dashboard"
                            element={
                                <ClientPortalDashboard />
                            }
                        />


                        {/* CLIENT REQUIREMENTS */}

                        <Route
                            path="/client-dashboard/requirements"
                            element={
                                <JobRequirementsClient />
                            }
                        />


                        {/* CLIENT CANDIDATES */}

                        <Route
                            path="/client-dashboard/candidates"
                            element={
                                <ClientCandidates />
                            }
                        />


                        {/* CLIENT ATTENDANCE APPROVAL */}

                        <Route
                            path="/client-dashboard/attendance-approval"
                            element={
                                <AttendanceApproval />
                            }
                        />


                        {/* CLIENT INVOICES */}

                        <Route
                            path="/client-dashboard/invoices"
                            element={
                                <ClientInvoiceManagement />
                            }
                        />


                        {/* =================================================
                            OTHER SECTIONS
                        ================================================= */}

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