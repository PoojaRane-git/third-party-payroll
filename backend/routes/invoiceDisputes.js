const express = require("express");
const router = express.Router();

const { createClient } = require("@supabase/supabase-js");

// =====================================================
// SUPABASE
// =====================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// HELPERS
// =====================================================

function getId(req) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function sendError(res, status, message, details = null) {
  console.error(message, details || "");

  return res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}

// =====================================================
// GET ALL INVOICE DISPUTES
// GET /api/invoice-disputes
// =====================================================

router.get("/invoice-disputes", async (req, res) => {
  try {
    console.log("=========================================");
    console.log("GET /api/invoice-disputes");
    console.log("=========================================");

    // -------------------------------------------------
    // 1. Get disputes
    // ACTUAL TABLE:
    // client_invoice_disputes
    // -------------------------------------------------

    const {
      data: disputes,
      error: disputeError,
    } = await supabase
      .from("client_invoice_disputes")
      .select("*")
      .order("submitted_at", {
        ascending: false,
      });

    if (disputeError) {
      return sendError(
        res,
        500,
        "Failed to load invoice disputes.",
        disputeError
      );
    }

    if (!disputes || disputes.length === 0) {
      console.log("No invoice disputes found.");
      return res.json([]);
    }

    // -------------------------------------------------
    // 2. Get invoice IDs
    // -------------------------------------------------

    const invoiceIds = [
      ...new Set(
        disputes
          .map((dispute) => Number(dispute.invoice_id))
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      ),
    ];

    // -------------------------------------------------
    // 3. Get invoices
    // -------------------------------------------------

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
          "Invoice lookup failed:",
          invoiceError
        );
      } else {
        invoices = data || [];
      }
    }

    // -------------------------------------------------
    // 4. Get client IDs
    // -------------------------------------------------

    const clientIds = [
      ...new Set(
        [
          ...disputes.map(
            (dispute) => dispute.client_id
          ),
          ...invoices.map(
            (invoice) => invoice.client_id
          ),
        ]
          .map(Number)
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      ),
    ];

    // -------------------------------------------------
    // 5. Get clients
    //
    // IMPORTANT:
    // clients table has company_name
    // clients table DOES NOT have name
    // -------------------------------------------------

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
          "Client lookup failed:",
          clientError
        );

        // Do not fail the whole request.
        // We can still return the dispute.
        clients = [];
      } else {
        clients = data || [];
      }
    }

    // -------------------------------------------------
    // 6. Create lookup maps
    // -------------------------------------------------

    const invoiceMap = new Map();

    invoices.forEach((invoice) => {
      invoiceMap.set(
        Number(invoice.id),
        invoice
      );
    });

    const clientMap = new Map();

    clients.forEach((client) => {
      clientMap.set(
        Number(client.id),
        client
      );
    });

    // -------------------------------------------------
    // 7. Format response
    // Matches PaymentConfirmations.jsx
    // -------------------------------------------------

    const result = disputes.map((dispute) => {
      const invoice = invoiceMap.get(
        Number(dispute.invoice_id)
      );

      const clientId =
        dispute.client_id ??
        invoice?.client_id ??
        null;

      const client = clientMap.get(
        Number(clientId)
      );

      return {
        id: dispute.id,

        invoice_id: dispute.invoice_id,

        invoice_number:
          invoice?.invoice_number ||
          `INV-${dispute.invoice_id}`,

        invoice_amount:
          Number(invoice?.total_amount) || 0,

        client_id: clientId,

        client_name:
          client?.company_name ||
          "Unknown Client",

        dispute_type:
          dispute.dispute_type ||
          "General",

        reason:
          dispute.reason || "",

        submitted_at:
          dispute.submitted_at ||
          dispute.created_at ||
          null,

        status:
          dispute.status ||
          "Pending",

        admin_response:
          dispute.admin_response ||
          "",

        reviewed_by:
          dispute.reviewed_by ||
          null,

        reviewed_at:
          dispute.reviewed_at ||
          null,
      };
    });

    console.log(
      "Invoice disputes returned:",
      result.length
    );

    return res.json(result);
  } catch (error) {
    console.error(
      "GET /api/invoice-disputes exception:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load invoice disputes.",
      error: error.message,
    });
  }
});

// =====================================================
// RESOLVE INVOICE DISPUTE
//
// PATCH /api/invoice-disputes/:id/resolve
// =====================================================

router.patch(
  "/invoice-disputes/:id/resolve",
  async (req, res) => {
    try {
      console.log(
        "========================================="
      );
      console.log(
        `PATCH /api/invoice-disputes/${req.params.id}/resolve`
      );
      console.log(
        "========================================="
      );

      // -------------------------------------------------
      // 1. Validate ID
      // -------------------------------------------------

      const id = getId(req);

      if (!id) {
        return sendError(
          res,
          400,
          "Invalid dispute ID."
        );
      }

      // -------------------------------------------------
      // 2. Get admin response
      // -------------------------------------------------

      const adminResponse =
        req.body?.admin_response ??
        req.body?.response ??
        req.body?.adminResponse ??
        "";

      const cleanResponse =
        String(adminResponse).trim();

      if (!cleanResponse) {
        return sendError(
          res,
          400,
          "Admin response is required."
        );
      }

      // -------------------------------------------------
      // 3. Find dispute
      // -------------------------------------------------

      const {
        data: existingDispute,
        error: findError,
      } = await supabase
        .from("client_invoice_disputes")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (findError) {
        return sendError(
          res,
          500,
          "Failed to find invoice dispute.",
          findError
        );
      }

      if (!existingDispute) {
        return sendError(
          res,
          404,
          "Invoice dispute not found."
        );
      }

      // -------------------------------------------------
      // 4. Check current status
      //
      // Your database can contain:
      // Pending
      // Verified
      // Resolved
      // Closed
      // -------------------------------------------------

      const currentStatus = String(
        existingDispute.status || ""
      )
        .trim()
        .toLowerCase();

      if (
        currentStatus === "verified" ||
        currentStatus === "resolved" ||
        currentStatus === "closed"
      ) {
        return sendError(
          res,
          400,
          "This dispute has already been resolved."
        );
      }

      // -------------------------------------------------
      // 5. Update dispute
      // -------------------------------------------------

      const {
        data: updatedDispute,
        error: updateError,
      } = await supabase
        .from("client_invoice_disputes")
        .update({
          status: "Resolved",
          admin_response: cleanResponse,
          reviewed_by: "Admin",
          reviewed_at:
            new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        return sendError(
          res,
          500,
          "Failed to resolve invoice dispute.",
          updateError
        );
      }

      // -------------------------------------------------
      // 6. Success
      // -------------------------------------------------

      console.log(
        "Invoice dispute resolved:",
        updatedDispute.id
      );

      return res.json({
        success: true,
        message:
          "Invoice dispute resolved successfully.",
        dispute: updatedDispute,
      });
    } catch (error) {
      console.error(
        "PATCH /api/invoice-disputes/:id/resolve exception:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to resolve invoice dispute.",
        error: error.message,
      });
    }
  }
);

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;