const express = require("express");
const router = express.Router();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// =====================================================
// GET ALL PAYMENT CONFIRMATIONS
// GET /api/payments
// =====================================================
router.get("/payments", async (req, res) => {
  try {
    console.log("========================================");
    console.log("GET /api/payments");
    console.log("========================================");

    // =====================================================
    // 1. GET PAYMENT CONFIRMATIONS
    // =====================================================
    const { data: confirmations, error: confirmationError } =
      await supabase
        .from("payment_confirmations")
        .select(`
          id,
          invoice_id,
          client_id,
          amount_reported,
          payment_date,
          payment_mode,
          reference_number,
          payment_proof_url,
          notes,
          status,
          submitted_at,
          verified_by,
          verified_at,
          rejection_reason
        `)
        .order("submitted_at", { ascending: false });

    if (confirmationError) {
      console.error(
        "Payment confirmations error:",
        confirmationError
      );

      return res.status(500).json({
        success: false,
        message: "Failed to load payment confirmations.",
        error: confirmationError.message,
      });
    }

    console.log(
      "Payment confirmations found:",
      confirmations?.length || 0
    );

    // =====================================================
    // 2. NO DATA
    // =====================================================
    if (!confirmations || confirmations.length === 0) {
      return res.json({
        success: true,
        payments: [],
      });
    }

    // =====================================================
    // 3. GET INVOICE IDs
    // =====================================================
    const invoiceIds = [
      ...new Set(
        confirmations
          .map((p) => Number(p.invoice_id))
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      ),
    ];

    // =====================================================
    // 4. GET INVOICES
    // =====================================================
    let invoices = [];

    if (invoiceIds.length > 0) {
      const {
        data,
        error: invoiceError,
      } = await supabase
        .from("client_billing_invoices")
        .select("*")
        .in("id", invoiceIds);

      if (invoiceError) {
        console.error(
          "Invoice lookup error:",
          invoiceError
        );
      } else {
        invoices = data || [];
      }
    }

    // =====================================================
    // 5. GET CLIENT IDs
    // =====================================================
    const clientIds = [
      ...new Set(
        invoices
          .map((invoice) => Number(invoice.client_id))
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      ),
    ];

    // =====================================================
    // 6. GET CLIENTS
    // =====================================================
    let clients = [];

    if (clientIds.length > 0) {
      const {
        data,
        error: clientError,
      } = await supabase
        .from("clients")
        .select(
          "id, company_name, email, contact_person"
        )
        .in("id", clientIds);

      if (clientError) {
        console.error(
          "Client lookup error:",
          clientError
        );
      } else {
        clients = data || [];
      }
    }

    // =====================================================
    // 7. CREATE LOOKUP MAPS
    // =====================================================
    const invoiceMap = new Map(
      invoices.map((invoice) => [
        Number(invoice.id),
        invoice,
      ])
    );

    const clientMap = new Map(
      clients.map((client) => [
        Number(client.id),
        client,
      ])
    );

    // =====================================================
    // 8. CREATE RESULT
    // =====================================================
    const result = confirmations.map((confirmation) => {
      const invoice = invoiceMap.get(
        Number(confirmation.invoice_id)
      );

      const client = invoice
        ? clientMap.get(
            Number(invoice.client_id)
          )
        : null;

      const invoiceAmount =
        Number(invoice?.total_amount) || 0;

      const currentAmount =
        Number(confirmation.amount_reported) || 0;

      // ===================================================
      // TOTAL VERIFIED PAYMENTS FOR THIS INVOICE
      // ===================================================
      const verifiedPaymentsForInvoice =
        confirmations.filter(
          (p) =>
            Number(p.invoice_id) ===
              Number(confirmation.invoice_id) &&
            String(p.status || "").toLowerCase() ===
              "verified"
        );

      const totalPaid =
        verifiedPaymentsForInvoice.reduce(
          (sum, p) =>
            sum +
            (Number(p.amount_reported) || 0),
          0
        );

      // ===================================================
      // OUTSTANDING
      // ===================================================
      const outstandingAmount = Math.max(
        0,
        invoiceAmount - totalPaid
      );

      // ===================================================
      // INVOICE PAYMENT STATUS
      // ===================================================
      let invoicePaymentStatus = "Pending";

      if (
        invoiceAmount > 0 &&
        totalPaid >= invoiceAmount
      ) {
        invoicePaymentStatus = "Paid";
      } else if (totalPaid > 0) {
        invoicePaymentStatus = "Partially Paid";
      }

      // ===================================================
      // CONFIRMATION STATUS
      // ===================================================
      const confirmationStatus =
        confirmation.status || "Pending";

      // ===================================================
      // RETURN OBJECT
      // ===================================================
      return {
        id: confirmation.id,

        invoice_id:
          confirmation.invoice_id,

        client_id:
          confirmation.client_id,

        invoice_number:
          invoice?.invoice_number ||
          `INV-${confirmation.invoice_id}`,

        client_name:
          client?.company_name ||
          "Unknown Client",

        client_email:
          client?.email ||
          "",

        contact_person:
          client?.contact_person ||
          "",

        // Invoice amount
        invoice_amount:
          invoiceAmount,

        // Current confirmation amount
        amount_reported:
          currentAmount,

        // Total verified amount
        amount_paid:
          totalPaid,

        // Outstanding invoice amount
        outstanding_amount:
          outstandingAmount,

        outstanding:
          outstandingAmount,

        // Invoice-level payment status
        invoice_payment_status:
          invoicePaymentStatus,

        // Confirmation-level status
        confirmation_status:
          confirmationStatus,

        status:
          confirmationStatus,

        payment_date:
          confirmation.payment_date ||
          null,

        payment_mode:
          confirmation.payment_mode ||
          "",

        reference_number:
          confirmation.reference_number ||
          "",

        payment_proof_url:
          confirmation.payment_proof_url ||
          null,

        notes:
          confirmation.notes ||
          "",

        submitted_at:
          confirmation.submitted_at ||
          null,

        verified_by:
          confirmation.verified_by ||
          null,

        verified_at:
          confirmation.verified_at ||
          null,

        rejection_reason:
          confirmation.rejection_reason ||
          null,

        created_at:
          confirmation.submitted_at ||
          null,
      };
    });

    console.log(
      "Returning payment confirmations:",
      result.length
    );

    return res.json({
      success: true,
      payments: result,
    });
  } catch (error) {
    console.error(
      "GET /api/payments error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to load payment confirmations.",
      error: error.message,
    });
  }
});

// =====================================================
// VERIFY PAYMENT
// PATCH /api/payments/:id/verify
// =====================================================
router.patch("/payments/:id/verify", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    // -------------------------------------------------
    // Find payment confirmation
    // -------------------------------------------------
    const { data: confirmation, error: findError } =
      await supabase
        .from("payment_confirmations")
        .select("*")
        .eq("id", id)
        .single();

    if (findError || !confirmation) {
      console.error(
        "Payment confirmation not found:",
        findError
      );

      return res.status(404).json({
        success: false,
        message: "Payment confirmation not found.",
      });
    }

    // -------------------------------------------------
    // Check whether already verified
    // -------------------------------------------------
    if (
      String(confirmation.status || "").toLowerCase() ===
      "verified"
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment is already verified.",
      });
    }

    // -------------------------------------------------
    // Check for pending invoice dispute
    // -------------------------------------------------
    const { data: disputes, error: disputeError } =
      await supabase
        .from("client_invoice_disputes")
        .select("id, status")
        .eq("invoice_id", confirmation.invoice_id);

    if (disputeError) {
      console.error(
        "Dispute lookup error:",
        disputeError
      );
    }

    const hasPendingDispute =
      (disputes || []).some((dispute) => {
        const status = String(
          dispute.status || ""
        ).toLowerCase();

        return (
          status === "pending" ||
          status === "pending review"
        );
      });

    if (hasPendingDispute) {
      return res.status(409).json({
        success: false,
        message:
          "This payment cannot be verified while the invoice has a pending dispute.",
      });
    }

    // -------------------------------------------------
    // VERIFY PAYMENT CONFIRMATION
    // -------------------------------------------------
    const { data, error } = await supabase
      .from("payment_confirmations")
      .update({
        status: "Verified",
        rejection_reason: null,
        verified_by: "Admin",
        verified_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(
        "Verify payment error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to verify payment.",
        error: error.message,
      });
    }

    // -------------------------------------------------
    // OPTIONAL:
    // Keep payments_ledger synchronized
    // -------------------------------------------------
    //
    // If you are using payments_ledger as the financial
    // ledger, insert/update the verified confirmation there.
    //
    // This prevents duplicate ledger entries.
    // -------------------------------------------------

    const { data: existingLedger } =
      await supabase
        .from("payments_ledger")
        .select("id")
        .eq("invoice_id", confirmation.invoice_id)
        .eq(
          "reference_number",
          confirmation.reference_number
        )
        .maybeSingle();

    if (!existingLedger) {
      const { error: ledgerError } =
        await supabase
          .from("payments_ledger")
          .insert({
            invoice_id:
              confirmation.invoice_id,

            amount_received:
              Number(
                confirmation.amount_reported
              ) || 0,

            tds_deducted: 0,

            payment_date:
              confirmation.payment_date,

            payment_mode:
              confirmation.payment_mode,

            reference_number:
              confirmation.reference_number,

            created_at:
              new Date().toISOString(),
          });

      if (ledgerError) {
        console.error(
          "Ledger synchronization error:",
          ledgerError
        );

        // Important:
        // Confirmation was already verified.
        // Do not fail the whole request because the
        // optional ledger sync failed.
      }
    }

    return res.json({
      success: true,
      message:
        "Payment verified successfully.",
      payment: data,
    });
  } catch (error) {
    console.error(
      "Verify payment exception:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to verify payment.",
      error: error.message,
    });
  }
});


// =====================================================
// REJECT PAYMENT
// PATCH /api/payments/:id/reject
// =====================================================
router.patch("/payments/:id/reject", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID.",
      });
    }

    // -------------------------------------------------
    // Get rejection reason
    // -------------------------------------------------
    const reason = String(
      req.body?.rejection_reason ||
      req.body?.reason ||
      ""
    ).trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message:
          "Rejection reason is required.",
      });
    }

    // -------------------------------------------------
    // Find payment confirmation
    // -------------------------------------------------
    const {
      data: confirmation,
      error: findError,
    } = await supabase
      .from("payment_confirmations")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !confirmation) {
      console.error(
        "Payment confirmation not found:",
        findError
      );

      return res.status(404).json({
        success: false,
        message:
          "Payment confirmation not found.",
      });
    }

    // -------------------------------------------------
    // Do not reject an already verified payment
    // -------------------------------------------------
    if (
      String(
        confirmation.status || ""
      ).toLowerCase() === "verified"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A verified payment cannot be rejected.",
      });
    }

    // -------------------------------------------------
    // REJECT PAYMENT CONFIRMATION
    // -------------------------------------------------
    const {
      data,
      error,
    } = await supabase
      .from("payment_confirmations")
      .update({
        status: "Rejected",
        rejection_reason: reason,
        verified_by: "Admin",
        verified_at:
          new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(
        "Reject payment error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to reject payment.",
        error: error.message,
      });
    }

    return res.json({
      success: true,
      message:
        "Payment rejected successfully.",
      payment: data,
    });
  } catch (error) {
    console.error(
      "Reject payment exception:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to reject payment.",
      error: error.message,
    });
  }
});

module.exports = router;