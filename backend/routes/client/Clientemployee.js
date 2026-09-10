const express = require("express");
const router = express.Router();

const supabase = require("../../supabaseClient");

// =====================================================
// GET EMPLOYEES BELONGING TO A CLIENT
// GET /api/employees?client_id=1
// =====================================================

router.get("/", async (req, res) => {
  try {
    const clientId = Number(req.query.client_id);

    console.log("=================================");
    console.log("GET CLIENT EMPLOYEES");
    console.log("client_id:", clientId);
    console.log("=================================");

    // -------------------------------------------------
    // Validate client ID
    // -------------------------------------------------

    if (
      !Number.isInteger(clientId) ||
      clientId <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid client ID",
      });
    }

    // -------------------------------------------------
    // 1. Get client
    // -------------------------------------------------

    const {
      data: client,
      error: clientError,
    } = await supabase
      .from("clients")
      .select(`
        id,
        company_name,
        billing_address,
        email,
        phone,
        contact_person,
        credit_terms,
        status
      `)
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) {
      console.error(
        "Client query error:",
        clientError
      );

      return res.status(500).json({
        success: false,
        error: clientError.message,
      });
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        error: `Client ${clientId} not found`,
      });
    }

    console.log(
      "Client found:",
      client.company_name
    );

    // -------------------------------------------------
    // 2. Get deployments for THIS client
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
      .order("id", {
        ascending: true,
      });

    if (deploymentError) {
      console.error(
        "Deployment query error:",
        deploymentError
      );

      return res.status(500).json({
        success: false,
        error: deploymentError.message,
      });
    }

    console.log(
      "Deployments found:",
      deployments?.length || 0
    );

    console.log(
      "Deployments:",
      deployments
    );

    // -------------------------------------------------
    // No deployments
    // -------------------------------------------------

    if (
      !deployments ||
      deployments.length === 0
    ) {
      return res.json({
        success: true,
        count: 0,
        client_id: clientId,
        company_name:
          client.company_name,
        data: [],
      });
    }

    // -------------------------------------------------
    // 3. Get candidate IDs
    // -------------------------------------------------

    const candidateIds =
      deployments
        .map(
          (deployment) =>
            deployment.candidate_id
        )
        .filter(
          (id) =>
            id !== null &&
            id !== undefined
        );

    console.log(
      "Candidate IDs:",
      candidateIds
    );

    if (candidateIds.length === 0) {
      return res.json({
        success: true,
        count: 0,
        client_id: clientId,
        company_name:
          client.company_name,
        data: [],
      });
    }

    // -------------------------------------------------
    // 4. Get employees/candidates
    //
    // IMPORTANT:
    // Only safe fields are returned.
    // No PAN
    // No bank account
    // No IFSC
    // No UAN
    // No ESIC
    // No password
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
      .in(
        "id",
        candidateIds
      );

    if (candidateError) {
      console.error(
        "Candidate query error:",
        candidateError
      );

      return res.status(500).json({
        success: false,
        error: candidateError.message,
      });
    }

    console.log(
      "Candidates found:",
      candidates?.length || 0
    );

    console.log(
      "Candidates:",
      candidates
    );

    // -------------------------------------------------
    // 5. Create lookup map
    // -------------------------------------------------

    const candidateMap =
      new Map(
        (candidates || []).map(
          (candidate) => [
            Number(candidate.id),
            candidate,
          ]
        )
      );

    // -------------------------------------------------
    // 6. Build final response
    // -------------------------------------------------

    const result =
      deployments
        .map((deployment) => {
          const employee =
            candidateMap.get(
              Number(
                deployment.candidate_id
              )
            );

          // If candidate doesn't exist,
          // don't display a broken employee record.
          if (!employee) {
            console.warn(
              `Candidate ${deployment.candidate_id} not found for deployment ${deployment.id}`
            );

            return null;
          }

          return {
            employee: {
              id: employee.id,
              full_name:
                employee.full_name,
              email:
                employee.email,
              phone:
                employee.phone,
              date_of_joining:
                employee.date_of_joining,
              employment_status:
                employee.employment_status,
              designation:
                employee.designation,
              deployment_id:
                employee.deployment_id,
              created_at:
                employee.created_at,
            },

            deployment: {
              id: deployment.id,
              candidate_id:
                deployment.candidate_id,
              client_id:
                deployment.client_id,
              contract_id:
                deployment.contract_id,
              project_name:
                deployment.project_name,
              bill_rate:
                deployment.bill_rate,
              billing_model:
                deployment.billing_model,
              start_date:
                deployment.start_date,
              end_date:
                deployment.end_date,
              status:
                deployment.status,
              created_at:
                deployment.created_at,
            },

            company: {
              id: client.id,
              company_name:
                client.company_name,
              billing_address:
                client.billing_address,
              email:
                client.email,
              phone:
                client.phone,
              contact_person:
                client.contact_person,
              credit_terms:
                client.credit_terms,
              status:
                client.status,
            },
          };
        })
        .filter(Boolean);

    console.log(
      "Final employee count:",
      result.length
    );

    console.log(
      "Final employee data:",
      result
    );

    // -------------------------------------------------
    // 7. Return response
    // -------------------------------------------------

    return res.json({
      success: true,
      count: result.length,
      client_id: clientId,
      company_name:
        client.company_name,
      data: result,
    });

  } catch (error) {
    console.error(
      "Unexpected client employee error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Internal server error",
    });
  }
});

module.exports = router;