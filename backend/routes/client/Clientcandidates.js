// =====================================================
// CLIENT COMPANY EMPLOYEES ROUTER
// =====================================================

const express = require("express");
const router = express.Router();

const supabase = require("../../supabaseClient");

// =====================================================
// HELPER
// =====================================================

function isValidPositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0;
}

// =====================================================
// GET COMPANY EMPLOYEES
//
// GET /api/client-candidates?client_id=1
//
// ONLY employees actually deployed to this client
// are returned.
//
// Relationship:
//
// deployments.client_id
//        ↓
// deployments.candidate_id
//        ↓
// candidates.id
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { client_id } = req.query;

    // -------------------------------------------------
    // VALIDATE CLIENT ID
    // -------------------------------------------------

    if (!isValidPositiveInteger(client_id)) {
      return res.status(400).json({
        success: false,
        error: "Valid client_id is required",
      });
    }

    const clientId = Number(client_id);

    console.log(
      "Loading client employees for client:",
      clientId
    );

    // -------------------------------------------------
    // GET CLIENT COMPANY
    // -------------------------------------------------

    const {
      data: client,
      error: clientError,
    } = await supabase
      .from("clients")
      .select(`
        id,
        company_name,
        gstin,
        billing_address,
        state_code,
        credit_terms,
        contact_person,
        email,
        phone,
        service_fee,
        status
      `)
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      console.error(
        "Client fetch error:",
        clientError
      );

      return res.status(500).json({
        success: false,
        error: clientError.message,
      });
    }

    // -------------------------------------------------
    // CLIENT NOT FOUND
    // -------------------------------------------------

    if (!client) {
      return res.status(404).json({
        success: false,
        error: "Client company not found",
      });
    }

    // -------------------------------------------------
    // GET DEPLOYMENTS
    //
    // IMPORTANT:
    // This determines which employees actually work
    // for this client.
    // -------------------------------------------------

    const {
      data: deployments,
      error: deploymentError,
    } = await supabase
      .from("deployments")
      .select(`
        id,
        candidate_id,
        client_id,
        contract_id,
        project_name,
        bill_rate,
        billing_model,
        start_date,
        end_date,
        status,
        created_at
      `)
      .eq("client_id", clientId)
      .order("created_at", {
        ascending: false,
      });

    if (deploymentError) {
      console.error(
        "Deployment fetch error:",
        deploymentError
      );

      return res.status(500).json({
        success: false,
        error: deploymentError.message,
      });
    }

    // -------------------------------------------------
    // NO DEPLOYED EMPLOYEES
    // -------------------------------------------------

    if (
      !deployments ||
      deployments.length === 0
    ) {
      return res.json({
        success: true,
        count: 0,
        client_id: clientId,
        company_name: client.company_name,
        data: [],
      });
    }

    // -------------------------------------------------
    // GET CANDIDATE IDS
    // -------------------------------------------------

    const candidateIds = [
      ...new Set(
        deployments
          .map(
            (deployment) =>
              deployment.candidate_id
          )
          .filter(
            (id) =>
              id !== null &&
              id !== undefined
          )
      ),
    ];

    if (candidateIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        client_id: clientId,
        company_name: client.company_name,
        data: [],
      });
    }

    console.log(
      "Candidate IDs:",
      candidateIds
    );

    // -------------------------------------------------
    // GET EMPLOYEE DETAILS
    //
    // SAFE CLIENT-SIDE FIELDS ONLY
    //
    // DO NOT RETURN:
    // password
    // PAN
    // bank account
    // IFSC
    // UAN
    // ESIC
    // -------------------------------------------------

    const {
      data: candidates,
      error: candidateError,
    } = await supabase
      .from("candidates")
      .select(`
        id,
        full_name,
        email,
        phone,
        date_of_joining,
        employment_status,
        designation,
        deployment_id,
        created_at
      `)
      .in("id", candidateIds);

    if (candidateError) {
      console.error(
        "Candidate fetch error:",
        candidateError
      );

      return res.status(500).json({
        success: false,
        error: candidateError.message,
      });
    }

    // -------------------------------------------------
    // CREATE FRONTEND-FRIENDLY RESPONSE
    // -------------------------------------------------

    const employees = deployments.map(
      (deployment) => {
        const employee =
          candidates?.find(
            (candidate) =>
              Number(candidate.id) ===
              Number(
                deployment.candidate_id
              )
          );

        return {
          // -------------------------------------------
          // EMPLOYEE
          // -------------------------------------------

          employee: {
            id:
              employee?.id ??
              deployment.candidate_id,

            full_name:
              employee?.full_name ??
              "Unknown Employee",

            email:
              employee?.email ??
              null,

            phone:
              employee?.phone ??
              null,

            designation:
              employee?.designation ??
              null,

            date_of_joining:
              employee?.date_of_joining ??
              null,

            employment_status:
              employee?.employment_status ??
              null,

            deployment_id:
              employee?.deployment_id ??
              deployment.id,

            created_at:
              employee?.created_at ??
              null,
          },

          // -------------------------------------------
          // DEPLOYMENT
          // -------------------------------------------

          deployment: {
            id:
              deployment.id,

            candidate_id:
              deployment.candidate_id,

            client_id:
              deployment.client_id,

            contract_id:
              deployment.contract_id,

            project_name:
              deployment.project_name ??
              "Not Assigned",

            bill_rate:
              deployment.bill_rate ??
              null,

            billing_model:
              deployment.billing_model ??
              null,

            start_date:
              deployment.start_date ??
              null,

            end_date:
              deployment.end_date ??
              null,

            status:
              deployment.status ??
              "Unknown",

            created_at:
              deployment.created_at ??
              null,
          },

          // -------------------------------------------
          // COMPANY
          // -------------------------------------------

          company: {
            id:
              client.id,

            company_name:
              client.company_name,

            gstin:
              client.gstin,

            billing_address:
              client.billing_address,

            state_code:
              client.state_code,

            credit_terms:
              client.credit_terms,

            contact_person:
              client.contact_person,

            email:
              client.email,

            phone:
              client.phone,

            service_fee:
              client.service_fee,

            status:
              client.status,
          },
        };
      }
    );

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    console.log(
      `Found ${employees.length} employees for client ${clientId}`
    );

    return res.json({
      success: true,

      count:
        employees.length,

      client_id:
        clientId,

      company_name:
        client.company_name,

      data:
        employees,
    });

  } catch (error) {
    console.error(
      "GET /api/client-candidates error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to load company employees",
    });
  }
});

// =====================================================
// UPDATE EMPLOYEE STATUS
//
// PATCH /api/client-candidates/:id/status
// =====================================================
//
// NOTE:
// This is for recruitment/candidate status.
// Actual employment status should normally be managed
// through deployment/HR workflow.
// =====================================================

router.patch("/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const {
      status,
      client_id,
    } = req.body || {};

    // -------------------------------------------------
    // VALIDATE CANDIDATE ID
    // -------------------------------------------------

    if (!isValidPositiveInteger(id)) {
      return res.status(400).json({
        success: false,
        error:
          "Valid candidate ID is required",
      });
    }

    // -------------------------------------------------
    // VALIDATE CLIENT ID
    // -------------------------------------------------

    if (!isValidPositiveInteger(client_id)) {
      return res.status(400).json({
        success: false,
        error:
          "Valid client_id is required",
      });
    }

    const clientId = Number(client_id);

    // -------------------------------------------------
    // ALLOWED STATUSES
    // -------------------------------------------------

    const allowedStatuses = [
      "Applied",
      "Screening",
      "Interview",
      "Selected",
      "Offer Sent",
      "Joined",
      "Rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid employee status",
      });
    }

    // -------------------------------------------------
    // VERIFY EMPLOYEE BELONGS TO CLIENT
    //
    // IMPORTANT:
    // Use deployments, NOT job_requirements.
    // -------------------------------------------------

    const {
      data: deployment,
      error: deploymentError,
    } = await supabase
      .from("deployments")
      .select(`
        id,
        candidate_id,
        client_id
      `)
      .eq("candidate_id", id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (deploymentError) {
      console.error(
        "Deployment verification error:",
        deploymentError
      );

      return res.status(500).json({
        success: false,
        error:
          deploymentError.message,
      });
    }

    if (!deployment) {
      return res.status(404).json({
        success: false,
        error:
          "Employee does not belong to this company",
      });
    }

    // -------------------------------------------------
    // UPDATE CANDIDATE STATUS
    // -------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from("candidates")
      .update({
        status,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(
        "Employee status update error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    // -------------------------------------------------
    // SUCCESS
    // -------------------------------------------------

    return res.json({
      success: true,
      message:
        "Employee status updated successfully",
      data,
    });

  } catch (error) {
    console.error(
      "Employee status PATCH error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Unable to update employee status",
    });
  }
});

// =====================================================
// EXPORT
// =====================================================

module.exports = router;