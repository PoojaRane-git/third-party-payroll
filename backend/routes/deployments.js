const express = require("express");
const router = express.Router();

const supabase = require("../supabaseClient");

// =========================================================
// HELPER
// =========================================================

const getId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};


// =========================================================
// BILL RATE CALCULATION
// =========================================================

const calculateBillRate = (payRate, contract) => {

    const billingModel =
        String(contract.billing_model || "").trim();

    if (billingModel === "Percentage Markup") {

        const markupPercentage =
            Number(contract.markup_percentage || 0);

        if (
            !Number.isFinite(markupPercentage) ||
            markupPercentage < 0
        ) {
            throw new Error(
                "Invalid markup percentage in contract"
            );
        }

        return Number(
            (
                payRate +
                (payRate * markupPercentage) / 100
            ).toFixed(2)
        );
    }

    if (billingModel === "Fixed Per-Head Fee") {

        const perHeadFee =
            Number(contract.per_head_fee || 0);

        if (
            !Number.isFinite(perHeadFee) ||
            perHeadFee < 0
        ) {
            throw new Error(
                "Invalid per-head fee in contract"
            );
        }

        return Number(
            (payRate + perHeadFee).toFixed(2)
        );
    }

    throw new Error(
        `Unsupported billing model: ${billingModel}`
    );
};


// =========================================================
// FORMAT DEPLOYMENT RESPONSE
// =========================================================

const formatDeployment = (deployment) => {

    const payRate =
        Number(deployment.pay_rate || 0);

    const billRate =
        Number(deployment.bill_rate || 0);

    const serviceCharge =
        billRate - payRate;

    const serviceChargePercentage =
        billRate > 0
            ? Number(
                (
                    (serviceCharge / billRate) *
                    100
                ).toFixed(2)
            )
            : 0;

    return {

        ...deployment,

        employee_name:
            deployment.candidates?.full_name ||
            "N/A",

        employee_email:
            deployment.candidates?.email ||
            "N/A",

        employee_phone:
            deployment.candidates?.phone ||
            "N/A",

        designation:
            deployment.candidates?.designation ||
            deployment.designation ||
            "N/A",

        client_name:
            deployment.clients?.company_name ||
            "N/A",

        company_name:
            deployment.clients?.company_name ||
            "N/A",

        contract_number:
            deployment.client_contracts?.contract_number ||
            "N/A",

        contract_title:
            deployment.client_contracts?.contract_title ||
            "N/A",

        contract_billing_model:
            deployment.client_contracts?.billing_model ||
            deployment.billing_model ||
            "N/A",

        contract_markup_percentage:
            Number(
                deployment.client_contracts
                    ?.markup_percentage || 0
            ),

        contract_per_head_fee:
            Number(
                deployment.client_contracts
                    ?.per_head_fee || 0
            ),

        contract_credit_terms:
            deployment.client_contracts
                ?.credit_terms ||
            "N/A",

        contract_gst_type:
            deployment.client_contracts?.gst_type ||
            "N/A",

        contract_start_date:
            deployment.client_contracts?.start_date ||
            null,

        contract_end_date:
            deployment.client_contracts?.end_date ||
            null,

        pay_rate:
            payRate,

        bill_rate:
            billRate,

        service_charge:
            serviceCharge,

        service_charge_percentage:
            serviceChargePercentage,
    };
};

// =========================================================
// GET ACTIVE CONTRACTS FOR CLIENT
//
// GET /api/deployments/contracts/client/:clientId
// =========================================================
router.get(
    "/contracts/client/:clientId",
    async (req, res) => {

        try {

            const clientId =
                getId(req.params.clientId);

            if (!clientId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Valid client ID is required",
                });
            }

            const {
                data,
                error,
            } = await supabase
                .from("client_contracts")
                .select(`
                    id,
                    client_id,
                    contract_number,
                    contract_title,
                    billing_model,
                    markup_percentage,
                    per_head_fee,
                    credit_terms,
                    start_date,
                    end_date,
                    gst_type,
                    contract_status
                `)
                .eq("client_id", clientId)
                .eq("contract_status", "Active")
                .order("id", { ascending: false });

            if (error) {
                throw error;
            }

            return res.json({
                success: true,
                data: data || [],
            });

        } catch (err) {

            console.error(
                "GET /api/deployments/contracts/client/:clientId:",
                err
            );

            return res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);

// =========================================================
// CREATE NEW CONTRACT
//
// POST /api/deployments/contracts
// =========================================================

router.post(
    "/contracts",
    async (req, res) => {

        try {

            const {
                client_id,
                contract_number,
                contract_title,
                billing_model,
                markup_percentage,
                per_head_fee,
                credit_terms,
                gst_type,
            } = req.body;

            const clientId =
                getId(client_id);

            if (!clientId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Valid client_id is required",
                });
            }

            if (
                !contract_number ||
                !String(contract_number).trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Contract number is required",
                });
            }

            const allowedBillingModels = [
                "Percentage Markup",
                "Fixed Per-Head Fee",
            ];

            if (
                !allowedBillingModels.includes(
                    billing_model
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid billing model",
                });
            }

            const markup =
                Number(markup_percentage || 0);

            const perHeadFee =
                Number(per_head_fee || 0);

            if (
                !Number.isFinite(markup) ||
                markup < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid markup percentage",
                });
            }

            if (
                !Number.isFinite(perHeadFee) ||
                perHeadFee < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid per-head fee",
                });
            }

            const {
                data: client,
                error: clientError,
            } = await supabase
                .from("clients")
                .select(`id, company_name`)
                .eq("id", clientId)
                .maybeSingle();

            if (clientError) {
                throw clientError;
            }

            if (!client) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Client not found",
                });
            }

            const {
                data: contract,
                error,
            } = await supabase
                .from("client_contracts")
                .insert([
                    {
                        client_id: clientId,

                        contract_number:
                            String(contract_number).trim(),

                        contract_title:
                            contract_title
                                ? String(contract_title).trim()
                                : null,

                        billing_model: billing_model,

                        markup_percentage:
                            billing_model === "Percentage Markup"
                                ? markup
                                : 0,

                        per_head_fee:
                            billing_model === "Fixed Per-Head Fee"
                                ? perHeadFee
                                : 0,

                        credit_terms: credit_terms || "Net 30",

                        gst_type:
                            gst_type || "Inter-State (IGST)",

                        contract_status: "Active",
                    },
                ])
                .select()
                .single();

            if (error) {

                console.error("Create contract error:", error);

                if (error.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        message:
                            "Contract number already exists",
                    });
                }

                throw error;
            }

            return res.status(201).json({
                success: true,
                message: "Contract created successfully",
                data: contract,
            });

        } catch (err) {

            console.error(
                "POST /api/deployments/contracts:",
                err
            );

            return res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);


// =========================================================
// GET ALL DEPLOYMENTS
//
// GET /api/deployments
// GET /api/deployments?client_id=1
// =========================================================

router.get("/", async (req, res) => {

    try {

        const clientId = req.query.client_id;

        let query =
            supabase
                .from("deployments")
                .select(`
                    *,

                    candidates!deployments_candidate_id_fkey (
                        id,
                        full_name,
                        email,
                        phone,
                        designation
                    ),

                    clients (
                        id,
                        company_name
                    ),

                    client_contracts (
                        id,
                        contract_number,
                        contract_title,
                        billing_model,
                        markup_percentage,
                        per_head_fee,
                        credit_terms,
                        gst_type,
                        contract_status
                    )
                `)
                .order("id", { ascending: false });

        if (clientId) {

            const id = getId(clientId);

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid client_id",
                });
            }

            query = query.eq("client_id", id);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        const formattedData =
            (data || []).map(formatDeployment);

        return res.json({
            success: true,
            data: formattedData,
        });

    } catch (err) {

        console.error("GET /api/deployments:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});


// =========================================================
// GET DEPLOYMENTS BY CLIENT
//
// GET /api/deployments/client/:clientId
// =========================================================

router.get(
    "/client/:clientId",
    async (req, res) => {

        try {

            const clientId =
                getId(req.params.clientId);

            if (!clientId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Valid client ID is required",
                });
            }

            const { data, error } =
                await supabase
                    .from("deployments")
                    .select(`
                        *,

                        candidates!deployments_candidate_id_fkey (
                            id,
                            full_name,
                            email,
                            phone,
                            designation
                        ),

                        clients (
                            id,
                            company_name
                        ),

                        client_contracts (
                            id,
                            contract_number,
                            contract_title,
                            billing_model,
                            markup_percentage,
                            per_head_fee,
                            credit_terms,
                            gst_type,
                            contract_status
                        )
                    `)
                    .eq("client_id", clientId)
                    .order("id", { ascending: false });

            if (error) {
                throw error;
            }

            const formattedData =
                (data || []).map(formatDeployment);

            return res.json({
                success: true,
                data: formattedData,
            });

        } catch (err) {

            console.error(
                "GET /api/deployments/client/:clientId:",
                err
            );

            return res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    }
);


// =========================================================
// CREATE DEPLOYMENT  —  FIXED (candidates.deployment_id removed)
//
// POST /api/deployments
//
// New deployment:
// - start_date = supplied date
// - end_date   = NULL
// - status     = Active
// - pay_rate   = candidates.pay_rate
// - bill_rate  = calculated from contract
//
// FIX: candidates.deployment_id is no longer selected, checked,
// or written. A raw SQL UPDATE against it returned Postgres
// 42703 ("column does not exist"), so it's not safe to rely on.
// "Is this candidate already deployed" is now answered ONLY by
// querying the deployments table directly (the "EXTRA ACTIVE
// DEPLOYMENT CHECK" below, which already existed as a second,
// more reliable guard). employment_status is still written —
// that column is confirmed to exist.
// =========================================================

router.post("/", async (req, res) => {

    try {

        const {
            candidate_id,
            client_id,
            contract_id,
            project_name,
            start_date,
            status,
        } = req.body;

        const candidateId = getId(candidate_id);
        const clientId = getId(client_id);
        const contractId = getId(contract_id);

        if (!candidateId) {
            return res.status(400).json({
                success: false,
                message: "Valid candidate_id is required",
            });
        }

        if (!clientId) {
            return res.status(400).json({
                success: false,
                message: "Valid client_id is required",
            });
        }

        if (!contractId) {
            return res.status(400).json({
                success: false,
                message: "Valid contract_id is required",
            });
        }

        if (!project_name || !String(project_name).trim()) {
            return res.status(400).json({
                success: false,
                message: "Project name is required",
            });
        }

        if (!start_date) {
            return res.status(400).json({
                success: false,
                message: "Deployment start date is required",
            });
        }


        // =====================================================
        // GET CANDIDATE
        //
        // deployment_id removed from this select — not trusted
        // or used anywhere in this route anymore.
        // =====================================================

        const {
            data: candidate,
            error: candidateError,
        } = await supabase
            .from("candidates")
            .select(`
                id,
                full_name,
                email,
                designation,
                pay_rate,
                employment_status,
                auth_user_id
            `)
            .eq("id", candidateId)
            .maybeSingle();

        if (candidateError) {
            throw candidateError;
        }

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }


        // =====================================================
        // EMPLOYEE MUST NOT ALREADY HAVE AN ACTIVE DEPLOYMENT
        //
        // This is now the ONLY check for "already deployed" — it
        // queries deployments directly instead of trusting a
        // denormalized flag on candidates, so it can't drift out
        // of sync the way candidates.deployment_id did.
        // =====================================================

        const {
            data: existingDeployments,
            error: existingDeploymentError,
        } = await supabase
            .from("deployments")
            .select("id, status")
            .eq("candidate_id", candidateId)
            .eq("status", "Active")
            .limit(1);

        if (existingDeploymentError) {
            throw existingDeploymentError;
        }

        if (existingDeployments && existingDeployments.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Employee already has an active deployment",
            });
        }


        // =====================================================
        // GET CLIENT
        // =====================================================

        const {
            data: client,
            error: clientError,
        } = await supabase
            .from("clients")
            .select(`id, company_name`)
            .eq("id", clientId)
            .maybeSingle();

        if (clientError) {
            throw clientError;
        }

        if (!client) {
            return res.status(404).json({
                success: false,
                message: "Client not found",
            });
        }


        // =====================================================
        // GET ACTIVE CONTRACT
        // =====================================================

        const {
            data: contract,
            error: contractError,
        } = await supabase
            .from("client_contracts")
            .select(`
                id,
                client_id,
                contract_number,
                contract_title,
                billing_model,
                markup_percentage,
                per_head_fee,
                credit_terms,
                gst_type,
                contract_status
            `)
            .eq("id", contractId)
            .eq("client_id", clientId)
            .eq("contract_status", "Active")
            .maybeSingle();

        if (contractError) {
            throw contractError;
        }

        if (!contract) {
            return res.status(404).json({
                success: false,
                message:
                    "Selected contract was not found, is inactive, or does not belong to this client",
            });
        }


        // =====================================================
        // EMPLOYEE PAY RATE
        // =====================================================

        const payRate = Number(candidate.pay_rate);

        if (!Number.isFinite(payRate) || payRate < 0) {
            return res.status(400).json({
                success: false,
                message: "Employee has an invalid pay rate",
            });
        }


        // =====================================================
        // CALCULATE BILL RATE
        // =====================================================

        let billRate;

        try {
            billRate = calculateBillRate(payRate, contract);
        } catch (calculationError) {
            return res.status(400).json({
                success: false,
                message: calculationError.message,
            });
        }

        if (!Number.isFinite(billRate) || billRate < payRate) {
            return res.status(400).json({
                success: false,
                message: "Calculated bill rate is invalid",
            });
        }


        // =====================================================
        // CREATE DEPLOYMENT
        // =====================================================

        const {
            data: deployment,
            error: deploymentError,
        } = await supabase
            .from("deployments")
            .insert([
                {
                    candidate_id: candidateId,
                    client_id: clientId,
                    contract_id: contractId,
                    project_name: String(project_name).trim(),
                    pay_rate: payRate,
                    bill_rate: billRate,
                    billing_model: contract.billing_model,
                    start_date: start_date,
                    end_date: null,
                    status: status || "Active",
                },
            ])
            .select()
            .single();

        if (deploymentError) {
            throw deploymentError;
        }


        // =====================================================
        // UPDATE CANDIDATE  —  employment_status ONLY
        //
        // deployment_id removed from this update. Writing it is
        // what produced the 42703 "column does not exist" error.
        // =====================================================

        const {
            data: updatedCandidate,
            error: candidateUpdateError,
        } = await supabase
            .from("candidates")
            .update({
                employment_status: "Active",
            })
            .eq("id", candidateId)
            .select(`
                id,
                full_name,
                email,
                designation,
                pay_rate,
                employment_status,
                auth_user_id
            `)
            .single();


        // =====================================================
        // ROLLBACK IF CANDIDATE UPDATE FAILS
        // =====================================================

        if (candidateUpdateError) {

            console.error(
                "Candidate update failed. Rolling back deployment:",
                candidateUpdateError
            );

            await supabase
                .from("deployments")
                .delete()
                .eq("id", deployment.id);

            throw candidateUpdateError;
        }


        // =====================================================
        // RESPONSE
        // =====================================================

        return res.status(201).json({

            success: true,

            message: "Employee deployed successfully",

            data: {

                deployment,

                candidate: updatedCandidate,

                client,

                contract,

                billing: {

                    pay_rate: payRate,

                    bill_rate: billRate,

                    service_charge:
                        Number((billRate - payRate).toFixed(2)),

                    billing_model: contract.billing_model,

                    markup_percentage:
                        Number(contract.markup_percentage || 0),

                    per_head_fee:
                        Number(contract.per_head_fee || 0),
                },
            },
        });

    } catch (err) {

        console.error("POST /api/deployments:", err);

        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});


// =========================================================
// UPDATE DEPLOYMENT  —  FIXED (candidates.deployment_id removed,
// termination now verifies the candidate row actually updated)
//
// PATCH /api/deployments/:id
//
// Used for:
// 1. Transfer      (status -> "Transferred")
// 2. Termination    (status -> "Terminated")
// 3. Generic field updates (project_name, etc.)
// =========================================================

router.patch("/:id", async (req, res) => {

    try {

        // =====================================================
        // VALIDATE DEPLOYMENT ID
        // =====================================================

        const id = getId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid deployment ID.",
            });
        }


        // =====================================================
        // REQUEST DATA
        // =====================================================

        const {
            end_date,
            status,
            project_name,
        } = req.body;

        const normalizedStatus =
            status !== undefined ? String(status).trim() : undefined;

        const normalizedStatusLower =
            normalizedStatus ? normalizedStatus.toLowerCase() : "";


        // =====================================================
        // VALIDATE STATUS
        // =====================================================

        const allowedStatuses = [
            "Active",
            "Ongoing",
            "Transferred",
            "Terminated",
            "Completed",
        ];

        if (
            normalizedStatus !== undefined &&
            !allowedStatuses.some(
                (allowed) => allowed.toLowerCase() === normalizedStatusLower
            )
        ) {
            return res.status(400).json({
                success: false,
                message: `Invalid deployment status: ${normalizedStatus}`,
            });
        }


        // =====================================================
        // TERMINATION REQUIRES END DATE
        // =====================================================

        if (normalizedStatusLower === "terminated" && !end_date) {
            return res.status(400).json({
                success: false,
                message: "Termination date is required.",
            });
        }


        // =====================================================
        // BUILD UPDATE DATA
        // =====================================================

        const updateData = {};

        if (end_date !== undefined) {
            updateData.end_date = end_date;
        }

        if (normalizedStatus !== undefined) {
            updateData.status =
                allowedStatuses.find(
                    (allowed) => allowed.toLowerCase() === normalizedStatusLower
                ) || normalizedStatus;
        }

        if (project_name !== undefined) {

            const project =
                project_name === null ? null : String(project_name).trim();

            updateData.project_name = project;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No fields provided for update.",
            });
        }


        // =====================================================
        // GET CURRENT DEPLOYMENT
        // =====================================================

        const {
            data: deployment,
            error: deploymentError,
        } = await supabase
            .from("deployments")
            .select(`
                id,
                candidate_id,
                client_id,
                contract_id,
                project_name,
                pay_rate,
                bill_rate,
                billing_model,
                start_date,
                end_date,
                status
            `)
            .eq("id", id)
            .maybeSingle();

        if (deploymentError) {

            console.error("Error fetching deployment:", deploymentError);

            return res.status(500).json({
                success: false,
                message: deploymentError.message,
            });
        }

        if (!deployment) {
            return res.status(404).json({
                success: false,
                message: "Deployment not found.",
            });
        }


        // =====================================================
        // VALIDATE END DATE
        // =====================================================

        if (end_date) {

            const endDate = new Date(end_date);

            if (Number.isNaN(endDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid end date.",
                });
            }

            if (deployment.start_date) {

                const startDate = new Date(deployment.start_date);

                if (endDate < startDate) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "End date cannot be before deployment start date.",
                    });
                }
            }
        }


        // =====================================================
        // PREVENT TERMINATING ALREADY TERMINATED DEPLOYMENT
        // =====================================================

        if (
            normalizedStatusLower === "terminated" &&
            String(deployment.status || "").trim().toLowerCase() ===
                "terminated"
        ) {
            return res.status(409).json({
                success: false,
                message: "Deployment is already terminated.",
            });
        }


        // =====================================================
        // UPDATE DEPLOYMENT
        // =====================================================

        const {
            data: updatedDeployment,
            error: updateError,
        } = await supabase
            .from("deployments")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (updateError) {

            console.error("Error updating deployment:", updateError);

            return res.status(500).json({
                success: false,
                message: "Failed to update deployment.",
                error: updateError.message,
            });
        }


        // =====================================================
        // TERMINATION  —  FIXED
        //
        // When terminated:
        //
        // deployments:
        //     status   = Terminated
        //     end_date = supplied termination date
        //
        // candidates:
        //     employment_status = Available
        //
        // deployment_id is NOT written here — that column is not
        // trusted anywhere in this codebase anymore.
        //
        // The candidate update below now chains .select() and
        // checks the row count. Supabase returns error: null when
        // an UPDATE matches zero rows (RLS block, bad candidate_id,
        // etc.) — checking only the error object misses that, which
        // is exactly what let a candidate's employment_status stay
        // stale while the deployment said "Terminated".
        // =====================================================

        if (normalizedStatusLower === "terminated") {

            const {
                data: candidateUpdateResult,
                error: candidateUpdateError,
            } = await supabase
                .from("candidates")
                .update({
                    employment_status: "Available",
                })
                .eq("id", deployment.candidate_id)
                .select("id, employment_status"); // <-- REQUIRED: lets us see how many rows actually changed

            const candidateUpdateFailed =
                Boolean(candidateUpdateError) ||
                !candidateUpdateResult ||
                candidateUpdateResult.length === 0;


            // =================================================
            // ROLLBACK IF CANDIDATE UPDATE FAILS OR AFFECTED 0 ROWS
            // =================================================

            if (candidateUpdateFailed) {

                console.error(
                    "Error updating candidate after termination:",
                    candidateUpdateError ||
                        `No candidate row matched id=${deployment.candidate_id} — check RLS policy on "candidates" UPDATE, or candidate_id validity.`
                );

                await supabase
                    .from("deployments")
                    .update({
                        end_date: deployment.end_date,
                        status: deployment.status,
                    })
                    .eq("id", deployment.id);

                return res.status(500).json({
                    success: false,

                    message:
                        "Deployment was not terminated because employee status could not be updated. " +
                        "This usually means a database permission (RLS) policy blocked the candidate update, " +
                        "or the candidate record could not be found.",

                    error:
                        candidateUpdateError?.message ||
                        "No candidate rows were updated.",
                });
            }


            // =================================================
            // SUCCESS — verified at least one row actually changed
            // =================================================

            return res.status(200).json({
                success: true,

                message:
                    "Employee terminated successfully and moved to Unassigned.",

                data: updatedDeployment,

                candidate: candidateUpdateResult[0],
            });
        }


        // =====================================================
        // TRANSFER
        //
        // This PATCH call closes the OLD deployment by setting its
        // status to "Transferred". The frontend then creates the
        // NEW deployment via POST /deployments. No candidates.*
        // write happens here — employment_status stays "Active"
        // throughout a transfer, which is correct since the
        // employee never leaves active employment during the
        // switch.
        // =====================================================

        if (normalizedStatusLower === "transferred") {

            return res.status(200).json({
                success: true,
                message: "Deployment transferred successfully.",
                data: updatedDeployment,
            });
        }


        // =====================================================
        // NORMAL UPDATE
        // =====================================================

        return res.status(200).json({
            success: true,
            message: "Deployment updated successfully.",
            data: updatedDeployment,
        });

    } catch (error) {

        console.error("PATCH /api/deployments/:id error:", error);

        return res.status(500).json({
            success: false,
            message:
                error?.message ||
                "Internal server error while updating deployment.",
        });
    }
});


// =========================================================
// GET ALL EMPLOYEE ACCOUNTS
//
// GET /api/employee-users
//
// Used by EmployeeDeployment.jsx to check whether an employee
// already has an account.
//
// IMPORTANT:
// One employee = one account.
// employee_users.employee_id is the main link.
// =========================================================

router.get(
    "/employee-users",
    async (req, res) => {

        try {

            const { data, error } = await supabase
                .from("employee_users")
                .select(`
                    id,
                    user_id,
                    employee_id,
                    name,
                    email,
                    role,
                    status
                `)
                .order("id", { ascending: false });

            if (error) {
                console.error(
                    "GET /api/employee-users error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: error.message,
                });
            }

            return res.status(200).json({
                success: true,
                data: data || [],
            });

        } catch (error) {

            console.error(
                "GET /api/employee-users exception:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    error?.message ||
                    "Failed to fetch employee accounts.",
            });
        }
    }
);


// =========================================================
// EXPORT
// =========================================================

module.exports = router;