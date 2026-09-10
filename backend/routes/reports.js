
const express = require("express");
const router = express.Router();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// HELPERS
// =====================================================

const normalizeStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const sendError = (res, message, error = null) => {
  console.error(message, error || "");

  return res.status(500).json({
    success: false,
    message,
    error: error?.message || error || null,
  });
};

// =====================================================
// EMPLOYEES
// GET /api/reports/employees
// =====================================================

router.get("/employees", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return sendError(
        res,
        "Failed to load employees.",
        error
      );
    }

    return res.json({
      success: true,
      employees: data || [],
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to load employees.",
      error
    );
  }
});

// =====================================================
// DEPLOYMENTS
// GET /api/reports/deployments
// =====================================================

router.get("/deployments", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deployments")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      return sendError(
        res,
        "Failed to load deployments.",
        error
      );
    }

    return res.json({
      success: true,
      deployments: data || [],
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to load deployments.",
      error
    );
  }
});

// =====================================================
// PAYROLL
// GET /api/reports/payroll
// GET /api/reports/payroll?month=2026-08
// =====================================================

router.get("/payroll", async (req, res) => {
  try {
    const month = req.query.month;

    let query = supabase
      .from("third_party_payroll")
      .select("*")
      .order("id", { ascending: false });

    if (month) {
      query = query.eq("salary_month", month);
    }

    const { data, error } = await query;

    if (error) {
      return sendError(
        res,
        "Failed to load payroll.",
        error
      );
    }

    return res.json({
      success: true,
      payroll: data || [],
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to load payroll.",
      error
    );
  }
});

// =====================================================
// ATTENDANCE
//
// Uses:
// third_party_attendance_summary
//
// GET /api/reports/attendance
// GET /api/reports/attendance?month=2026-08
// =====================================================

router.get("/attendance", async (req, res) => {
  try {
    const month = req.query.month;

    let query = supabase
      .from("third_party_attendance_summary")
      .select("*")
      .order("id", { ascending: false });

    if (month) {
      query = query.eq("billing_month", month);
    }

    const { data, error } = await query;

    if (error) {
      console.error(
        "Attendance report database error:",
        error
      );

      return sendError(
        res,
        "Failed to load attendance report.",
        error
      );
    }

    console.log(
      `Attendance report: ${data?.length || 0} records for ${month || "all months"}`
    );

    return res.json({
      success: true,
      attendance: data || [],
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to load attendance report.",
      error
    );
  }
});

// =====================================================
// BILLING
//
// IMPORTANT:
// Do NOT force billing_month filtering here.
// We fetch invoices and let frontend determine
// the relevant month using available invoice fields.
// =====================================================

router.get("/billing", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("client_billing_invoices")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return sendError(
        res,
        "Failed to load billing report.",
        error
      );
    }

    return res.json({
      success: true,
      invoices: data || [],
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to load billing report.",
      error
    );
  }
});

// =====================================================
// PAYMENTS
// GET /api/reports/payments
// =====================================================

router.get("/payments", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("payments_ledger")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return sendError(
        res,
        "Failed to load payments.",
        error
      );
    }

    return res.json({
      success: true,
      payments: data || [],
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to load payments.",
      error
    );
  }
});

// =====================================================
// COMPLETE REPORT SUMMARY
//
// GET /api/reports/summary
// GET /api/reports/summary?month=2026-08
// =====================================================

router.get("/summary", async (req, res) => {
  try {
    const month = req.query.month;

    // -------------------------------------------------
    // Load employees
    // -------------------------------------------------

    const employeesResult = await supabase
      .from("candidates")
      .select("*")
      .order("id", { ascending: true });

    if (employeesResult.error) {
      return sendError(
        res,
        "Failed to load employees.",
        employeesResult.error
      );
    }

    // -------------------------------------------------
    // Load deployments
    // -------------------------------------------------

    const deploymentsResult = await supabase
      .from("deployments")
      .select("*")
      .order("id", { ascending: true });

    if (deploymentsResult.error) {
      return sendError(
        res,
        "Failed to load deployments.",
        deploymentsResult.error
      );
    }

    // -------------------------------------------------
    // Load payroll
    // -------------------------------------------------

    let payrollQuery = supabase
      .from("third_party_payroll")
      .select("*")
      .order("id", { ascending: false });

    if (month) {
      payrollQuery = payrollQuery.eq(
        "salary_month",
        month
      );
    }

    const payrollResult = await payrollQuery;

    if (payrollResult.error) {
      return sendError(
        res,
        "Failed to load payroll.",
        payrollResult.error
      );
    }

    // -------------------------------------------------
    // Load attendance
    // -------------------------------------------------

    let attendanceQuery = supabase
      .from("third_party_attendance_summary")
      .select("*")
      .order("id", { ascending: false });

    if (month) {
      attendanceQuery = attendanceQuery.eq(
        "billing_month",
        month
      );
    }

    const attendanceResult = await attendanceQuery;

    if (attendanceResult.error) {
      return sendError(
        res,
        "Failed to load attendance.",
        attendanceResult.error
      );
    }

    // -------------------------------------------------
    // Load ALL invoices
    //
    // Don't filter here because invoice month/date
    // field can differ depending on invoice record.
    // -------------------------------------------------

    const invoicesResult = await supabase
      .from("client_billing_invoices")
      .select("*")
      .order("id", { ascending: false });

    if (invoicesResult.error) {
      return sendError(
        res,
        "Failed to load invoices.",
        invoicesResult.error
      );
    }

    // -------------------------------------------------
    // Load ALL payments
    // -------------------------------------------------

    const paymentsResult = await supabase
      .from("payments_ledger")
      .select("*")
      .order("id", { ascending: false });

    if (paymentsResult.error) {
      return sendError(
        res,
        "Failed to load payments.",
        paymentsResult.error
      );
    }

    // -------------------------------------------------
    // RESULTS
    // -------------------------------------------------

    const employees =
      employeesResult.data || [];

    const deployments =
      deploymentsResult.data || [];

    const payroll =
      payrollResult.data || [];

    const attendance =
      attendanceResult.data || [];

    const invoices =
      invoicesResult.data || [];

    const payments =
      paymentsResult.data || [];

    // -------------------------------------------------
    // DEBUG
    // -------------------------------------------------

    console.log(
      "========================================="
    );

    console.log(
      "REPORT SUMMARY:",
      month || "ALL"
    );

    console.log(
      "Employees:",
      employees.length
    );

    console.log(
      "Deployments:",
      deployments.length
    );

    console.log(
      "Payroll:",
      payroll.length
    );

    console.log(
      "Attendance:",
      attendance.length
    );

    console.log(
      "Invoices:",
      invoices.length
    );

    console.log(
      "Payments:",
      payments.length
    );

    console.log(
      "========================================="
    );

    // -------------------------------------------------
    // Return everything
    // -------------------------------------------------

    return res.json({
      success: true,

      month: month || null,

      employees,

      deployments,

      payroll,

      attendance,

      invoices,

      payments,
    });
  } catch (error) {
    return sendError(
      res,
      "Failed to load report summary.",
      error
    );
  }
});

// =====================================================
// EXPORT
// =====================================================

module.exports = router;

