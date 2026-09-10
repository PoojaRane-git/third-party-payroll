const express = require("express");

const router = express.Router();

const supabase = require("../../supabaseClient");

// =====================================================
// HELPERS
// =====================================================

const isValidPositiveInteger = (value) => {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number > 0
  );
};

// =====================================================
// GET CURRENT CLIENT USER
//
// GET /api/client-portal/me
//
// Uses Supabase Auth access token
// Finds matching client_users record
// =====================================================

router.get("/me", async (req, res) => {
  try {
    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Authorization token is required",
      });
    }

    const token =
      authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Invalid authorization token",
      });
    }

    // -------------------------------------------------
    // VERIFY SUPABASE AUTH USER
    // -------------------------------------------------

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !authData?.user) {
      console.error(
        "Supabase auth verification error:",
        authError
      );

      return res.status(401).json({
        success: false,
        error: "Invalid or expired session",
      });
    }

    const authUser =
      authData.user;

    // -------------------------------------------------
    // FIND CLIENT USER
    // -------------------------------------------------

    const {
      data: clientUser,
      error: clientUserError,
    } = await supabase
      .from("client_users")
      .select(`
        id,
        user_id,
        client_id,
        name,
        email,
        role,
        status,
        created_at,
        clients (
          id,
          company_name,
          email,
          phone,
          contact_person
        )
      `)
      .eq(
        "user_id",
        authUser.id
      )
      .maybeSingle();

    if (clientUserError) {
      console.error(
        "Client user lookup error:",
        clientUserError
      );

      return res.status(500).json({
        success: false,
        error: clientUserError.message,
      });
    }

    if (!clientUser) {
      return res.status(403).json({
        success: false,
        error:
          "This account is not registered as a client user.",
      });
    }

    // -------------------------------------------------
    // CHECK ROLE
    // -------------------------------------------------

    if (
      String(clientUser.role).toLowerCase() !==
      "client"
    ) {
      return res.status(403).json({
        success: false,
        error: "Client access required.",
      });
    }

    // -------------------------------------------------
    // CHECK STATUS
    // -------------------------------------------------

    if (
      String(clientUser.status).toLowerCase() !==
      "active"
    ) {
      return res.status(403).json({
        success: false,
        error: "Client account is disabled.",
      });
    }

    // -------------------------------------------------
    // RETURN SAFE CLIENT DATA
    // -------------------------------------------------

    return res.json({
      success: true,

      data: {
        id: clientUser.id,

        user_id:
          clientUser.user_id,

        client_id:
          clientUser.client_id,

        name:
          clientUser.name,

        email:
          clientUser.email,

        role:
          clientUser.role,

        status:
          clientUser.status,

        company_name:
          clientUser.clients?.company_name ||
          "Client Portal",

        client: {
          id:
            clientUser.clients?.id ||
            clientUser.client_id,

          company_name:
            clientUser.clients?.company_name ||
            "Client Portal",

          email:
            clientUser.clients?.email ||
            null,

          phone:
            clientUser.clients?.phone ||
            null,

          contact_person:
            clientUser.clients?.contact_person ||
            null,
        },
      },
    });

  } catch (error) {
    console.error(
      "GET /client-portal/me error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// =====================================================
// CLIENT DASHBOARD STATS
//
// GET /api/client-portal/dashboard-stats
//
// client_id is taken from authenticated client user
// =====================================================

router.get(
  "/dashboard-stats",
  async (req, res) => {
    try {
      const authHeader =
        req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Authorization token is required",
        });
      }

      const token =
        authHeader
          .replace("Bearer ", "")
          .trim();

      // -------------------------------------------------
      // VERIFY AUTH USER
      // -------------------------------------------------

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser(token);

      if (
        authError ||
        !authData?.user
      ) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired session",
        });
      }

      // -------------------------------------------------
      // FIND CLIENT USER
      // -------------------------------------------------

      const {
        data: clientUser,
        error: clientUserError,
      } = await supabase
        .from("client_users")
        .select(`
          id,
          user_id,
          client_id,
          name,
          email,
          role,
          status,
          clients (
            id,
            company_name
          )
        `)
        .eq(
          "user_id",
          authData.user.id
        )
        .maybeSingle();

      if (clientUserError) {
        throw clientUserError;
      }

      if (!clientUser) {
        return res.status(403).json({
          success: false,
          error:
            "Client user profile not found",
        });
      }

      if (
        String(clientUser.role).toLowerCase() !==
        "client"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client access required",
        });
      }

      if (
        String(clientUser.status).toLowerCase() !==
        "active"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client account is disabled",
        });
      }

      const clientId =
        Number(clientUser.client_id);

      if (
        !isValidPositiveInteger(clientId)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Client account is not linked to a valid client",
        });
      }

      // -------------------------------------------------
      // EMPLOYEE COUNT
      //
      // Prefer deployments because these represent
      // actual assigned employees.
      // -------------------------------------------------

      let employeeCount = 0;

      const {
        count: deploymentCount,
        error: deploymentError,
      } = await supabase
        .from("deployments")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "client_id",
          clientId
        )
        .eq(
          "status",
          "Active"
        );

      if (!deploymentError) {
        employeeCount =
          deploymentCount || 0;
      } else {
        console.warn(
          "Deployment count error:",
          deploymentError.message
        );

        // -------------------------------------------------
        // FALLBACK
        // -------------------------------------------------

        const {
          count: outsourcedCount,
          error: outsourcedError,
        } = await supabase
          .from(
            "outsourced_employees"
          )
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq(
            "client_id",
            clientId
          );

        if (!outsourcedError) {
          employeeCount =
            outsourcedCount || 0;
        }
      }

      // -------------------------------------------------
      // JOB COUNT
      // -------------------------------------------------

      const {
        count: jobCount,
        error: jobError,
      } = await supabase
        .from("job_requirements")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq(
          "client_id",
          clientId
        )
        .eq(
          "status",
          "Active"
        );

      if (jobError) {
        throw jobError;
      }

      // -------------------------------------------------
      // CLIENT
      // -------------------------------------------------

      const {
        data: clientData,
        error: clientError,
      } = await supabase
        .from("clients")
        .select(`
          id,
          company_name
        `)
        .eq(
          "id",
          clientId
        )
        .maybeSingle();

      if (clientError) {
        throw clientError;
      }

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.json({
        success: true,

        data: {
          client_id:
            clientId,

          total_deployed:
            employeeCount,

          active_job_requirements:
            jobCount || 0,

          company_name:
            clientData?.company_name ||
            clientUser.clients?.company_name ||
            "Client Portal",
        },
      });

    } catch (error) {
      console.error(
        "Dashboard stats error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// =====================================================
// GET THIRD-PARTY ATTENDANCE
//
// GET /api/client-portal/attendance
//
// IMPORTANT:
// Client ID is taken from authenticated client user.
// Client cannot request another client's data.
// =====================================================

router.get(
  "/attendance",
  async (req, res) => {
    try {
      const authHeader =
        req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Authorization token is required",
        });
      }

      const token =
        authHeader
          .replace("Bearer ", "")
          .trim();

      // -------------------------------------------------
      // AUTH USER
      // -------------------------------------------------

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser(token);

      if (
        authError ||
        !authData?.user
      ) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired session",
        });
      }

      // -------------------------------------------------
      // CLIENT USER
      // -------------------------------------------------

      const {
        data: clientUser,
        error: clientUserError,
      } = await supabase
        .from("client_users")
        .select(`
          client_id,
          role,
          status
        `)
        .eq(
          "user_id",
          authData.user.id
        )
        .maybeSingle();

      if (clientUserError) {
        throw clientUserError;
      }

      if (!clientUser) {
        return res.status(403).json({
          success: false,
          error: "Client user not found",
        });
      }

      if (
        String(clientUser.role).toLowerCase() !==
        "client"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client access required",
        });
      }

      if (
        String(clientUser.status).toLowerCase() !==
        "active"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client account is disabled",
        });
      }

      const clientId =
        Number(clientUser.client_id);

      if (
        !isValidPositiveInteger(clientId)
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid client account",
        });
      }

      // -------------------------------------------------
      // FETCH ATTENDANCE
      // -------------------------------------------------

      const {
        data,
        error,
      } = await supabase
        .from(
          "third_party_attendance_approval"
        )
        .select(`
          id,
          billing_month,
          total_days,
          present_days,
          lop_days,
          ot_hours,
          status,
          created_at,
          client_id,
          employee_ref_id,
          attendance_date,
          deployment_id,
          approved_at,

          candidates!fk_attendance_candidate (
            id,
            full_name,
            designation
          ),

          clients!fk_attendance_client (
            id,
            company_name
          )
        `)
        .eq(
          "client_id",
          clientId
        )
        .order(
          "id",
          {
            ascending: true,
          }
        );

      if (error) {
        throw error;
      }

      // -------------------------------------------------
      // FORMAT
      // -------------------------------------------------

      const formattedData =
        (data || []).map(
          (record) => ({
            id:
              record.id,

            billing_month:
              record.billing_month,

            total_days:
              record.total_days,

            present_days:
              record.present_days,

            lop_days:
              record.lop_days,

            ot_hours:
              record.ot_hours,

            status:
              record.status,

            created_at:
              record.created_at,

            client_id:
              record.client_id,

            employee_ref_id:
              record.employee_ref_id,

            attendance_date:
              record.attendance_date,

            deployment_id:
              record.deployment_id,

            approved_at:
              record.approved_at,

            employee_id:
              record.candidates?.id ||
              record.employee_ref_id,

            employee_name:
              record.candidates?.full_name ||
              "Unknown Employee",

            role:
              record.candidates?.designation ||
              "-",

            client_name:
              record.clients?.company_name ||
              "Unknown Client",
          })
        );

      return res.json({
        success: true,
        data: formattedData,
      });

    } catch (error) {
      console.error(
        "Client attendance error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// =====================================================
// APPROVE ATTENDANCE
//
// PATCH /api/client-portal/attendance/:id
// =====================================================

router.patch(
  "/attendance/:id",
  async (req, res) => {
    try {
      const approvalId =
        Number(req.params.id);

      if (
        !isValidPositiveInteger(
          approvalId
        )
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Valid attendance ID is required",
        });
      }

      // -------------------------------------------------
      // AUTH
      // -------------------------------------------------

      const authHeader =
        req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Authorization token is required",
        });
      }

      const token =
        authHeader
          .replace("Bearer ", "")
          .trim();

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser(token);

      if (
        authError ||
        !authData?.user
      ) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired session",
        });
      }

      // -------------------------------------------------
      // CLIENT USER
      // -------------------------------------------------

      const {
        data: clientUser,
        error: clientUserError,
      } = await supabase
        .from("client_users")
        .select(`
          client_id,
          role,
          status
        `)
        .eq(
          "user_id",
          authData.user.id
        )
        .maybeSingle();

      if (clientUserError) {
        throw clientUserError;
      }

      if (!clientUser) {
        return res.status(403).json({
          success: false,
          error: "Client user not found",
        });
      }

      if (
        String(clientUser.role).toLowerCase() !==
        "client"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client access required",
        });
      }

      if (
        String(clientUser.status).toLowerCase() !==
        "active"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client account is disabled",
        });
      }

      const clientId =
        Number(clientUser.client_id);

      // -------------------------------------------------
      // VERIFY ATTENDANCE BELONGS TO CLIENT
      // -------------------------------------------------

      const {
        data: attendance,
        error: attendanceError,
      } = await supabase
        .from(
          "third_party_attendance_approval"
        )
        .select(`
          id,
          client_id,
          employee_ref_id,
          status
        `)
        .eq(
          "id",
          approvalId
        )
        .maybeSingle();

      if (attendanceError) {
        throw attendanceError;
      }

      if (!attendance) {
        return res.status(404).json({
          success: false,
          error:
            "Attendance approval record not found",
        });
      }

      if (
        Number(attendance.client_id) !==
        clientId
      ) {
        return res.status(403).json({
          success: false,
          error:
            "You cannot modify another client's attendance",
        });
      }

      // -------------------------------------------------
      // ONLY PENDING CAN BE APPROVED
      // -------------------------------------------------

      if (
        String(attendance.status)
          .toLowerCase() ===
        "approved"
      ) {
        return res.json({
          success: true,
          message:
            "Attendance is already approved",
          data: attendance,
        });
      }

      // -------------------------------------------------
      // UPDATE
      // -------------------------------------------------

      const {
        data: approvalData,
        error: approvalError,
      } = await supabase
        .from(
          "third_party_attendance_approval"
        )
        .update({
          status: "Approved",
          approved_at: new Date().toISOString(),
        })
        .eq(
          "id",
          approvalId
        )
        .eq(
          "client_id",
          clientId
        )
        .select()
        .maybeSingle();

      if (approvalError) {
        throw approvalError;
      }

      // -------------------------------------------------
      // SYNC DAILY ATTENDANCE
      // -------------------------------------------------

      const {
        data: dailyRecords,
        error: dailyError,
      } = await supabase
        .from(
          "third_party_emp_attendance"
        )
        .update({
          approval_status:
            "Approved",
        })
        .eq(
          "approval_record_id",
          approvalId
        )
        .select("id");

      if (dailyError) {
        console.warn(
          "Daily attendance sync warning:",
          dailyError.message
        );
      }

      return res.json({
        success: true,

        message:
          "Attendance approved successfully",

        data:
          approvalData,

        daily_records_updated:
          dailyRecords?.length || 0,
      });

    } catch (error) {
      console.error(
        "Client attendance approval error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// =====================================================
// CLIENT BILLING / INVOICES
//
// GET /api/client-portal/billing
// =====================================================

router.get(
  "/billing",
  async (req, res) => {
    try {
      const authHeader =
        req.headers.authorization || "";

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Authorization token is required",
        });
      }

      const token =
        authHeader
          .replace("Bearer ", "")
          .trim();

      // -------------------------------------------------
      // VERIFY SUPABASE AUTH
      // -------------------------------------------------

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser(token);

      if (
        authError ||
        !authData?.user
      ) {
        return res.status(401).json({
          success: false,
          error: "Invalid or expired session",
        });
      }

      // -------------------------------------------------
      // FIND CLIENT USER
      // -------------------------------------------------

      const {
        data: clientUser,
        error: clientUserError,
      } = await supabase
        .from("client_users")
        .select(`
          client_id,
          role,
          status
        `)
        .eq(
          "user_id",
          authData.user.id
        )
        .maybeSingle();

      if (clientUserError) {
        throw clientUserError;
      }

      if (!clientUser) {
        return res.status(403).json({
          success: false,
          error: "Client user not found",
        });
      }

      if (
        String(clientUser.role).toLowerCase() !==
        "client"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client access required",
        });
      }

      if (
        String(clientUser.status).toLowerCase() !==
        "active"
      ) {
        return res.status(403).json({
          success: false,
          error: "Client account is disabled",
        });
      }

      const clientId =
        Number(clientUser.client_id);

      if (
        !isValidPositiveInteger(clientId)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Client is not linked correctly",
        });
      }

      // -------------------------------------------------
      // INVOICES
      // -------------------------------------------------

      const {
        data: invoices,
        error: invoiceError,
      } = await supabase
        .from(
          "client_billing_invoices"
        )
        .select("*")
        .eq(
          "client_id",
          clientId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (invoiceError) {
        throw invoiceError;
      }

      if (
        !invoices ||
        invoices.length === 0
      ) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const invoiceIds =
        invoices.map(
          (invoice) => invoice.id
        );

      // -------------------------------------------------
      // PAYMENT LEDGER
      // -------------------------------------------------

      const {
        data: ledgerPayments,
        error: ledgerError,
      } = await supabase
        .from("payments_ledger")
        .select(`
          id,
          invoice_id,
          amount_received,
          tds_deducted,
          payment_date,
          payment_mode,
          reference_number,
          created_at
        `)
        .in(
          "invoice_id",
          invoiceIds
        )
        .order(
          "payment_date",
          {
            ascending: false,
          }
        );

      if (ledgerError) {
        throw ledgerError;
      }

      // -------------------------------------------------
      // PAYMENT CONFIRMATIONS
      // -------------------------------------------------

      const {
        data: confirmations,
        error: confirmationError,
      } = await supabase
        .from(
          "payment_confirmations"
        )
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
        .in(
          "invoice_id",
          invoiceIds
        )
        .eq(
          "client_id",
          clientId
        )
        .order(
          "submitted_at",
          {
            ascending: false,
          }
        );

      if (confirmationError) {
        throw confirmationError;
      }

      // -------------------------------------------------
      // DISPUTES
      // -------------------------------------------------

      const {
        data: disputes,
        error: disputeError,
      } = await supabase
        .from(
          "client_invoice_disputes"
        )
        .select(`
          id,
          invoice_id,
          client_id,
          dispute_type,
          reason,
          status,
          submitted_at,
          reviewed_by,
          reviewed_at,
          admin_response
        `)
        .in(
          "invoice_id",
          invoiceIds
        )
        .eq(
          "client_id",
          clientId
        )
        .order(
          "submitted_at",
          {
            ascending: false,
          }
        );

      if (disputeError) {
        throw disputeError;
      }

      // -------------------------------------------------
      // MAP CONFIRMATIONS
      // -------------------------------------------------

      const latestConfirmationByInvoice =
        new Map();

      (confirmations || []).forEach(
        (confirmation) => {
          if (
            !latestConfirmationByInvoice.has(
              confirmation.invoice_id
            )
          ) {
            latestConfirmationByInvoice.set(
              confirmation.invoice_id,
              confirmation
            );
          }
        }
      );

      // -------------------------------------------------
      // MAP DISPUTES
      // -------------------------------------------------

      const latestDisputeByInvoice =
        new Map();

      (disputes || []).forEach(
        (dispute) => {
          if (
            !latestDisputeByInvoice.has(
              dispute.invoice_id
            )
          ) {
            latestDisputeByInvoice.set(
              dispute.invoice_id,
              dispute
            );
          }
        }
      );

      // -------------------------------------------------
      // BUILD RESPONSE
      // -------------------------------------------------

      const result =
        invoices.map(
          (invoice) => {

            const latestConfirmation =
              latestConfirmationByInvoice.get(
                invoice.id
              ) || null;

            const latestDispute =
              latestDisputeByInvoice.get(
                invoice.id
              ) || null;

            const invoiceLedgerPayments =
              (
                ledgerPayments || []
              ).filter(
                (payment) =>
                  Number(
                    payment.invoice_id
                  ) ===
                  Number(invoice.id)
              );

            const amountPaid =
              invoiceLedgerPayments.reduce(
                (sum, payment) =>
                  sum +
                  Number(
                    payment.amount_received ||
                    0
                  ),
                0
              );

            const tdsDeducted =
              invoiceLedgerPayments.reduce(
                (sum, payment) =>
                  sum +
                  Number(
                    payment.tds_deducted ||
                    0
                  ),
                0
              );

            const totalAmount =
              Number(
                invoice.total_amount ||
                0
              );

            const amountSettled =
              amountPaid +
              tdsDeducted;

            const outstanding =
              Math.max(
                0,
                totalAmount -
                  amountSettled
              );

            let paymentStatus =
              "Pending";

            if (
              outstanding <= 0
            ) {
              paymentStatus =
                "Paid";
            } else if (
              amountSettled > 0
            ) {
              paymentStatus =
                "Partially Paid";
            } else if (
              invoice.due_date &&
              new Date() >
                new Date(
                  `${invoice.due_date}T23:59:59`
                )
            ) {
              paymentStatus =
                "Overdue";
            }

            const confirmationStatus =
              latestConfirmation?.status
                ? String(
                    latestConfirmation.status
                  ).trim()
                : null;

            const disputeStatus =
              latestDispute?.status
                ? String(
                    latestDispute.status
                  ).trim()
                : null;

            const normalizedDisputeStatus =
              disputeStatus
                ? disputeStatus.toLowerCase()
                : "";

            const hasActiveDispute =
              normalizedDisputeStatus ===
                "pending" ||
              normalizedDisputeStatus ===
                "pending review";

            const confirmationState =
              confirmationStatus
                ? confirmationStatus.toLowerCase()
                : "";

            const paymentAwaitingVerification =
              confirmationState ===
              "pending verification";

            const previousPaymentRejected =
              confirmationState ===
              "rejected";

            return {
              ...invoice,

              total_amount:
                totalAmount,

              amount_paid:
                amountPaid,

              tds_deducted:
                tdsDeducted,

              amount_settled:
                amountSettled,

              outstanding:
                outstanding,

              payment_status:
                paymentStatus,

              payment_blocked:
                hasActiveDispute,

              payment_available:
                !hasActiveDispute &&
                outstanding > 0 &&
                !paymentAwaitingVerification,

              payment_awaiting_verification:
                paymentAwaitingVerification,

              previous_payment_rejected:
                previousPaymentRejected,

              confirmation_id:
                latestConfirmation?.id ||
                null,

              confirmation_status:
                confirmationStatus,

              confirmation_amount:
                latestConfirmation
                  ? Number(
                      latestConfirmation.amount_reported ||
                      0
                    )
                  : null,

              confirmation_date:
                latestConfirmation?.payment_date ||
                null,

              confirmation_payment_mode:
                latestConfirmation?.payment_mode ||
                null,

              confirmation_reference:
                latestConfirmation?.reference_number ||
                null,

              confirmation_submitted_at:
                latestConfirmation?.submitted_at ||
                null,

              confirmation_payment_proof_url:
                latestConfirmation?.payment_proof_url ||
                null,

              confirmation_notes:
                latestConfirmation?.notes ||
                null,

              rejection_reason:
                latestConfirmation?.rejection_reason ||
                null,

              dispute_id:
                latestDispute?.id ||
                null,

              dispute_status:
                disputeStatus,

              dispute_active:
                hasActiveDispute,

              dispute_resolved:
                normalizedDisputeStatus ===
                "verified",

              dispute_type:
                latestDispute?.dispute_type ||
                null,

              dispute_reason:
                latestDispute?.reason ||
                null,

              dispute_submitted_at:
                latestDispute?.submitted_at ||
                null,

              dispute_reviewed_by:
                latestDispute?.reviewed_by ||
                null,

              dispute_reviewed_at:
                latestDispute?.reviewed_at ||
                null,

              admin_response:
                latestDispute?.admin_response ||
                null,
            };
          }
        );

      return res.json({
        success: true,
        data: result,
      });

    } catch (error) {
      console.error(
        "Client billing error:",
        error
      );

      return res.status(500).json({
        success: false,
        error:
          "Server error fetching client billing",
      });
    }
  }
);

module.exports = router;