// =====================================================
// SERVER.JS
// Third-Party Payroll Management System
// Backend Port: 5000
// =====================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");




// =====================================================
// APP INITIALIZATION
// =====================================================

const app = express();

const PORT = Number(process.env.PORT) || 5000;

// =====================================================
// ENVIRONMENT CHECK
// =====================================================

console.log("==============================================");
console.log("Starting Third-Party Payroll Backend");
console.log("==============================================");

console.log(
  "SUPABASE_URL:",
  process.env.SUPABASE_URL ? "Loaded" : "Missing"
);

console.log(
  "SUPABASE_SERVICE_ROLE_KEY:",
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "Loaded"
    : "Missing"
);

// =====================================================
// MIDDLEWARE
// =====================================================

const allowedOrigins = [
    "https://third-party-payroll.vercel.app",
    "http://localhost:5173",
];

// Matches ANY preview deployment of this specific project,
// e.g. https://third-party-payroll-<anything>-poojarane514-1612s-projects.vercel.app
const previewOriginPattern =
    /^https:\/\/third-party-payroll-[a-z0-9]+-poojarane514-1612s-projects\.vercel\.app$/;

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        if (
            allowedOrigins.includes(origin) ||
            previewOriginPattern.test(origin)
        ) {
            return callback(null, true);
        }

        console.error("❌ CORS blocked origin:", origin);
        return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "apikey",
        "x-client-info",
    ],

    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));


app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// =====================================================
// REQUEST LOGGER
// =====================================================

app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// =====================================================
// AUTH / AUTHORIZATION
// =====================================================

const authenticate = require("./middleware/authenticate");
const authorize = require("./middleware/authorize");

// =====================================================
// MAIN ROUTES
// =====================================================

const clientRoutes = require("./routes/clients");
const contractRoutes = require("./routes/contracts");
const candidateRoutes = require("./routes/candidates");
const employee_attdanceRoutes = require("./routes/emp_attedance");
const deploymentRoutes = require("./routes/deployments");
const timesheetRoutes = require("./routes/timesheets");
const thirdPartyAttendanceRoutes = require("./routes/thirdPartyAttendance");
const employeeAttendanceRoutes = require("./routes/employeeAttendance");
const payrollRoutes = require("./routes/payroll");
const billingRoutes = require("./routes/billing");
const paymentRoutes = require("./routes/payments");
const invoiceDisputeRoutes = require("./routes/invoiceDisputes");
const reportsRoutes = require("./routes/reports");
const ClientjobRequirementRoutes = require("./routes/client/ClientjobRequirements")



const AdminjobRequirementRoutes =
  require("./routes/AdminjobRequirements");

app.use(
  "/api/admin-job-requirements",
  AdminjobRequirementRoutes
);
// =====================================================
// EMPLOYEE USERS
// =====================================================

const employeeUsersRouter =
  require("./routes/employeeUsers");

const loginRequestsRoutes = require("./routes/loginRequests");
app.use("/api/login-requests", loginRequestsRoutes);



// =====================================================
// CLIENT PORTAL ROUTES
// =====================================================

const clientPortalRoutes =
  require("./routes/client/clientPortal");

const attendanceApprovalRouter =
  require("./routes/client/attendanceApprovalRouter");

const clientEmployeesRouter =
  require("./routes/client/Clientemployee");

const clientCandidatesRouter =
  require("./routes/client/Clientcandidates");

// =====================================================
// CLIENT INVOICE MANAGEMENT
// =====================================================

const clientManagementInvoicesRouter =
  require("./routes/client/clientManagementInvoices");

// =====================================================
// CLIENT PAYMENT CONFIRMATION + DISPUTES
// =====================================================

const clientPaymentActionsRouter =
  require("./routes/client/clientPaymentActions");

// =====================================================
// NEW CANDIDATES
// =====================================================

const candidatesRouter =
  require("./routes/newcandidates");



// =====================================================
// BASIC ROUTES
// =====================================================

// Root
app.get("/", (req, res) => {
  return res.json({
    success: true,
    message:
      "Third-Party Payroll Management API is running",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get("/api/health", (req, res) => {
  return res.json({
    success: true,
    status: "healthy",
    message: "Backend server is running",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// AUTH ROUTES
//
// NOTE:
// /api/auth/me, /api/auth/send-login-otp,
// /api/auth/verify-login-otp, signup routes, etc.
// all live inside routes/auth.js and are mounted below.
//
// A duplicate inline "/api/auth/me" route used to be
// defined here directly on `app`, which shadowed the
// real handler in routes/auth.js (Express matches routes
// in registration order, and this one was registered
// first). It has been removed so routes/auth.js is the
// single source of truth for this endpoint.
// =====================================================

// =====================================================
// ADMIN / COMMON ROUTES
// =====================================================

const adminDashboardRoutes =
  require("./routes/adminDashboard");

app.use(
  "/api/admin",
  adminDashboardRoutes
);

const authRoutes =
  require("./routes/auth");

app.use(
  "/api/auth",
  authRoutes
);

// =====================================================
// CLIENTS
// =====================================================

app.use(
  "/api/clients",
  clientRoutes
);

// =====================================================
// CONTRACTS
// =====================================================

app.use(
  "/api/contracts",
  contractRoutes
);

// =====================================================
// CANDIDATES
// =====================================================

app.use(
  "/api/candidates",
  candidateRoutes
);

// =====================================================
// EMPLOYEES - ADMIN
// =====================================================

app.use(
  "/api/employee",
  employee_attdanceRoutes
);

// =====================================================
// DEPLOYMENTS
// =====================================================

app.use(
  "/api/deployments",
  deploymentRoutes
);

// =====================================================
// EMPLOYEE USERS
//
// FINAL ROUTES:
//
// GET
// /api/employee-users
//
// POST
// /api/employee-users/create-account
// =====================================================

app.use(
  "/api/employee-users",
  employeeUsersRouter
);

// =====================================================
// TIMESHEETS
// =====================================================

app.use(
  "/api/timesheets",
  timesheetRoutes
);

// =====================================================
// THIRD-PARTY ATTENDANCE
// =====================================================

app.use(
  "/api/third-party-attendance",
  thirdPartyAttendanceRoutes
);

// =====================================================
// EMPLOYEE ATTENDANCE
// =====================================================

app.use(
  "/api/emp-attendance",
  employeeAttendanceRoutes
);

// =====================================================
// PAYROLL
// =====================================================

app.use(
  "/api/payroll",
  payrollRoutes
);

// =====================================================
// BILLING
// =====================================================

app.use(
  "/api",
  billingRoutes
);

// =====================================================
// PAYMENTS
// =====================================================

app.use(
  "/api",
  paymentRoutes
);

// =====================================================
// INVOICE DISPUTES
// =====================================================

app.use(
  "/api",
  invoiceDisputeRoutes
);

// =====================================================
// JOB REQUIREMENTS
// =====================================================




app.use(
  "/api",
  candidatesRouter
);
app.use(
  "/api/client-job-requirements",
  ClientjobRequirementRoutes
)

// =====================================================
// REPORTS
// =====================================================

app.use(
  "/api/reports",
  reportsRoutes
);

// =====================================================
// CLIENT PORTAL
// =====================================================

app.use(
  "/api/client-portal",
  clientPortalRoutes
);

// =====================================================
// CLIENT ATTENDANCE APPROVAL
// =====================================================

app.use(
  "/api",
  attendanceApprovalRouter
);

// =====================================================
// CLIENT EMPLOYEES
// =====================================================

app.use(
  "/api/employees",
  clientEmployeesRouter
);

// =====================================================
// CLIENT CANDIDATES
// =====================================================

app.use(
  "/api/client-candidates",
  clientCandidatesRouter
);

// =====================================================
// CLIENT INVOICE MANAGEMENT
// =====================================================

app.use(
  "/api/client-management",
  clientManagementInvoicesRouter
);

// =====================================================
// CLIENT PAYMENT CONFIRMATION + DISPUTES
// =====================================================

app.use(
  "/api/client",
  clientPaymentActionsRouter
);

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
  console.log(
    "404:",
    req.method,
    req.originalUrl
  );

  return res.status(404).json({
    success: false,
    message:
      "API endpoint not found",
    path:
      req.originalUrl,
    method:
      req.method,
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (err, req, res, next) => {

    console.error(
      "=============================================="
    );

    console.error(
      "GLOBAL SERVER ERROR"
    );

    console.error(
      "=============================================="
    );

    console.error(err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(
      err.status || 500
    ).json({
      success: false,
      message:
        err.message ||
        "Internal server error",
    });
  }
);

console.log("==============================================");
console.log("ROUTE TYPE CHECK");
console.log("==============================================");

console.log(
  "clientRoutes:",
  typeof clientRoutes
);

console.log(
  "contractRoutes:",
  typeof contractRoutes
);

console.log(
  "candidateRoutes:",
  typeof candidateRoutes
);

console.log(
  "employee_attdanceRoutes:",
  typeof employee_attdanceRoutes
);

console.log(
  "deploymentRoutes:",
  typeof deploymentRoutes
);

console.log(
  "timesheetRoutes:",
  typeof timesheetRoutes
);

console.log(
  "thirdPartyAttendanceRoutes:",
  typeof thirdPartyAttendanceRoutes
);

console.log(
  "employeeAttendanceRoutes:",
  typeof employeeAttendanceRoutes
);

console.log(
  "payrollRoutes:",
  typeof payrollRoutes
);

console.log(
  "billingRoutes:",
  typeof billingRoutes
);

console.log(
  "paymentRoutes:",
  typeof paymentRoutes
);

console.log(
  "invoiceDisputeRoutes:",
  typeof invoiceDisputeRoutes
);


console.log(
  "reportsRoutes:",
  typeof reportsRoutes
);

console.log(
  "ClientjobRequirementRoutes:",
  typeof ClientjobRequirementRoutes
);

console.log(
  "employeeUsersRouter:",
  typeof employeeUsersRouter
);

console.log(
  "clientPortalRoutes:",
  typeof clientPortalRoutes
);

console.log(
  "attendanceApprovalRouter:",
  typeof attendanceApprovalRouter
);

console.log(
  "clientEmployeesRouter:",
  typeof clientEmployeesRouter
);

console.log(
  "clientCandidatesRouter:",
  typeof clientCandidatesRouter
);

console.log(
  "clientManagementInvoicesRouter:",
  typeof clientManagementInvoicesRouter
);

console.log(
  "clientPaymentActionsRouter:",
  typeof clientPaymentActionsRouter
);

console.log(
  "candidatesRouter:",
  typeof candidatesRouter
);

console.log("==============================================");

// =====================================================
// START SERVER
// =====================================================

// Only listen locally — Vercel handles invocation via the exported app
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("==============================================");
    console.log("Third-Party Payroll Backend Started");
    console.log("==============================================");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    // ...keep the rest of your console.logs here
  });
}

module.exports = app;