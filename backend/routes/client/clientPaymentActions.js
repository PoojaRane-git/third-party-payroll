// ============================================================
// routes/clientPaymentActions.js
//
// CLIENT PORTAL - PAYMENT CONFIRMATION & DISPUTE SUBMISSION
//
// POST /api/client/invoices/:invoiceId/payment-confirmation
// POST /api/client/invoices/:invoiceId/dispute
//
// IMPORTANT:
// - Mounted at /api/client in your main server file:
//     app.use('/api/client', require('./routes/clientPaymentActions'));
// - This is intentionally separate from clientManagementInvoices.js
//   (mounted at /api/client-management), which handles read-only
//   invoice viewing for clients.
// ============================================================

const express = require("express");
const router = express.Router();

const supabase = require("../../supabaseClient"); // adjust path to match your project

// ============================================================
// POST /api/client/invoices/:invoiceId/payment-confirmation
// ============================================================

router.post(
  "/invoices/:invoiceId/payment-confirmation",
  async (req, res) => {
    try {
      const invoiceId = Number(req.params.invoiceId);

      const {
        client_id,
        amount_reported,
        payment_date,
        payment_mode,
        reference_number,
        payment_proof_url,
        notes,
      } = req.body;

      const clientId = Number(client_id);
      const amount = Number(amount_reported);

      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid invoice ID is required",
        });
      }

      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid client_id is required",
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid payment amount is required",
        });
      }

      if (!payment_date) {
        return res.status(400).json({
          success: false,
          error: "Payment date is required",
        });
      }

      if (!payment_mode || !String(payment_mode).trim()) {
        return res.status(400).json({
          success: false,
          error: "Payment mode is required",
        });
      }

      if (
        !reference_number ||
        !String(reference_number).trim()
      ) {
        return res.status(400).json({
          success: false,
          error: "UTR / transaction reference is required",
        });
      }

      // -------------------------------------------------
      // PAYMENT DATE CANNOT BE FUTURE
      // -------------------------------------------------

      const today = new Date();

      const todayString =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");

      if (payment_date > todayString) {
        return res.status(400).json({
          success: false,
          error: "Payment date cannot be in the future",
        });
      }

      // -------------------------------------------------
      // GET INVOICE
      // -------------------------------------------------

      const {
        data: invoice,
        error: invoiceError,
      } = await supabase
        .from("client_billing_invoices")
        .select(`
          id,
          client_id,
          invoice_number,
          total_amount,
          payment_status,
          lifecycle_state,
          due_date
        `)
        .eq("id", invoiceId)
        .eq("client_id", clientId)
        .single();

      if (invoiceError || !invoice) {
        return res.status(404).json({
          success: false,
          error: "Invoice not found for this client",
        });
      }

      // -------------------------------------------------
      // CHECK ACTIVE DISPUTE
      //
      // Pending / Pending Review = BLOCK PAYMENT
      // Verified = RESOLVED, PAYMENT ALLOWED
      // Rejected = no active dispute
      // -------------------------------------------------

      const {
        data: activeDispute,
        error: disputeError,
      } = await supabase
        .from("client_invoice_disputes")
        .select(`
          id,
          status,
          dispute_type,
          reason
        `)
        .eq("invoice_id", invoiceId)
        .eq("client_id", clientId)
        .in("status", [
          "Pending",
          "Pending Review",
        ])
        .limit(1)
        .maybeSingle();

      if (disputeError) {
        console.error(
          "Active dispute check error:",
          disputeError
        );

        return res.status(500).json({
          success: false,
          error: disputeError.message,
        });
      }

      if (activeDispute) {
        return res.status(409).json({
          success: false,
          error:
            "Payment cannot be submitted while this invoice dispute is unresolved.",
          dispute: activeDispute,
        });
      }

      // -------------------------------------------------
      // GET EXISTING PAYMENT CONFIRMATIONS
      // -------------------------------------------------

      const {
        data: existingConfirmations,
        error: confirmationFetchError,
      } = await supabase
        .from("payment_confirmations")
        .select(`
          id,
          amount_reported,
          status,
          submitted_at
        `)
        .eq("invoice_id", invoiceId)
        .eq("client_id", clientId)
        .order("submitted_at", {
          ascending: false,
        });

      if (confirmationFetchError) {
        console.error(
          "Payment confirmation fetch error:",
          confirmationFetchError
        );

        return res.status(500).json({
          success: false,
          error: confirmationFetchError.message,
        });
      }

      // -------------------------------------------------
      // BLOCK DUPLICATE PENDING PAYMENT
      // -------------------------------------------------

      const pendingConfirmation =
        (existingConfirmations || []).find(
          (item) =>
            String(item.status || "")
              .trim()
              .toLowerCase() ===
            "pending verification"
        );

      if (pendingConfirmation) {
        return res.status(409).json({
          success: false,
          error:
            "A payment confirmation for this invoice is already awaiting verification.",
        });
      }

      // -------------------------------------------------
      // CALCULATE VERIFIED PAYMENT AMOUNT
      //
      // Rejected confirmations are NOT counted.
      // -------------------------------------------------

      const {
        data: verifiedPayments,
        error: verifiedPaymentError,
      } = await supabase
        .from("payment_confirmations")
        .select(`
          amount_reported
        `)
        .eq("invoice_id", invoiceId)
        .eq("client_id", clientId)
        .eq("status", "Verified");

      if (verifiedPaymentError) {
        console.error(
          "Verified payment fetch error:",
          verifiedPaymentError
        );

        return res.status(500).json({
          success: false,
          error: verifiedPaymentError.message,
        });
      }

      const verifiedAmount =
        (verifiedPayments || []).reduce(
          (sum, payment) =>
            sum + Number(payment.amount_reported || 0),
          0
        );

      // -------------------------------------------------
      // CALCULATE OUTSTANDING
      // -------------------------------------------------

      const totalAmount =
        Number(invoice.total_amount || 0);

      const outstanding = Math.max(
        0,
        totalAmount - verifiedAmount
      );

      // -------------------------------------------------
      // BLOCK IF ALREADY FULLY PAID
      // -------------------------------------------------

      if (outstanding <= 0) {
        return res.status(409).json({
          success: false,
          error:
            "This invoice has already been fully paid.",
        });
      }

      // -------------------------------------------------
      // PAYMENT CANNOT EXCEED OUTSTANDING
      // -------------------------------------------------

      if (amount > outstanding) {
        return res.status(400).json({
          success: false,
          error:
            `Payment amount cannot exceed outstanding amount of ₹${outstanding.toFixed(
              2
            )}`,
        });
      }

      // -------------------------------------------------
      // INSERT NEW PAYMENT CONFIRMATION
      //
      // A rejected old confirmation is NOT reused.
      // A completely new confirmation is created.
      // -------------------------------------------------

      const {
        data: confirmation,
        error: insertError,
      } = await supabase
        .from("payment_confirmations")
        .insert({
          invoice_id: invoiceId,
          client_id: clientId,
          amount_reported: amount,
          payment_date,
          payment_mode: String(payment_mode).trim(),
          reference_number: String(reference_number).trim(),
          payment_proof_url:
            payment_proof_url
              ? String(payment_proof_url).trim()
              : null,
          notes:
            notes
              ? String(notes).trim()
              : null,
          status: "Pending Verification",
        })
        .select()
        .single();

      if (insertError) {
        console.error(
          "Payment confirmation insert error:",
          insertError
        );

        return res.status(500).json({
          success: false,
          error: insertError.message,
        });
      }

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.status(201).json({
        success: true,
        message:
          "Payment confirmation submitted successfully",
        confirmation,
      });
    } catch (error) {
      console.error(
        "Client payment confirmation error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Server error submitting payment confirmation",
      });
    }
  }
);

// ============================================================
// POST /api/client/invoices/:invoiceId/dispute
// ============================================================

router.post(
  "/invoices/:invoiceId/dispute",
  async (req, res) => {
    try {
      const invoiceId = Number(req.params.invoiceId);

      const {
        client_id,
        dispute_type,
        reason,
      } = req.body;

      const clientId = Number(client_id);

      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid invoice ID is required",
        });
      }

      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Valid client_id is required",
        });
      }

      if (
        !dispute_type ||
        !String(dispute_type).trim()
      ) {
        return res.status(400).json({
          success: false,
          error: "Dispute type is required",
        });
      }

      if (
        !reason ||
        String(reason).trim().length < 10
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Please provide a detailed dispute reason",
        });
      }

      if (String(reason).trim().length > 1000) {
        return res.status(400).json({
          success: false,
          error:
            "Dispute reason cannot exceed 1000 characters",
        });
      }

      // -------------------------------------------------
      // CHECK INVOICE
      // -------------------------------------------------

      const {
        data: invoice,
        error: invoiceError,
      } = await supabase
        .from("client_billing_invoices")
        .select(`
          id,
          client_id,
          invoice_number,
          total_amount,
          payment_status,
          lifecycle_state
        `)
        .eq("id", invoiceId)
        .eq("client_id", clientId)
        .single();

      if (invoiceError || !invoice) {
        return res.status(404).json({
          success: false,
          error:
            "Invoice not found for this client",
        });
      }

      // -------------------------------------------------
      // CHECK EXISTING ACTIVE DISPUTE
      //
      // ONLY Pending / Pending Review are active.
      //
      // Verified = resolved
      // Rejected = closed
      // -------------------------------------------------

      const {
        data: existingDispute,
        error: existingError,
      } = await supabase
        .from("client_invoice_disputes")
        .select(`
          id,
          status
        `)
        .eq("invoice_id", invoiceId)
        .eq("client_id", clientId)
        .in("status", [
          "Pending",
          "Pending Review",
        ])
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.error(
          "Existing dispute check error:",
          existingError
        );

        return res.status(500).json({
          success: false,
          error: existingError.message,
        });
      }

      if (existingDispute) {
        return res.status(409).json({
          success: false,
          error:
            "An active dispute already exists for this invoice.",
        });
      }

      // -------------------------------------------------
      // CREATE NEW DISPUTE
      // -------------------------------------------------

      const {
        data: dispute,
        error: disputeError,
      } = await supabase
        .from("client_invoice_disputes")
        .insert({
          invoice_id: invoiceId,
          client_id: clientId,
          dispute_type: String(
            dispute_type
          ).trim(),
          reason: String(reason).trim(),

          // Use the same status your DB workflow expects
          status: "Pending",
        })
        .select()
        .single();

      if (disputeError) {
        console.error(
          "Create invoice dispute error:",
          disputeError
        );

        return res.status(500).json({
          success: false,
          error: disputeError.message,
        });
      }

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.status(201).json({
        success: true,
        message:
          "Invoice dispute submitted successfully",
        dispute,
      });
    } catch (error) {
      console.error(
        "Client invoice dispute error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Server error submitting invoice dispute",
      });
    }
  }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;