const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// HELPERS
// =====================================================

const getId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const sendError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message,
    });
};

// =====================================================
// GET ALL CONTRACTS
// GET /api/contracts
// GET /api/contracts?client_id=1
// =====================================================

router.get("/", async (req, res) => {
    try {
        const clientId = req.query.client_id;

        let query = supabase
            .from("client_contracts")
            .select("*")
            .order("id", { ascending: false });

        if (clientId) {
            const id = getId(clientId);

            if (!id) {
                return sendError(
                    res,
                    400,
                    "Invalid client_id"
                );
            }

            query = query.eq("client_id", id);
        }

        const {
            data,
            error
        } = await query;

        if (error) {
            console.error(
                "GET /api/contracts SUPABASE ERROR:",
                error
            );

            return sendError(
                res,
                500,
                error.message
            );
        }

        return res.status(200).json({
            success: true,
            data: data || [],
        });

    } catch (err) {
        console.error(
            "GET /api/contracts ERROR:",
            err
        );

        return sendError(
            res,
            500,
            err.message
        );
    }
});
// =====================================================
// GET SINGLE CONTRACT
// GET /api/contracts/:id
// =====================================================

router.get("/:id", async (req, res) => {
    try {
        const id = getId(req.params.id);

        if (!id) {
            return sendError(res, 400, "Invalid contract ID");
        }

        const { data, error } = await supabase
            .from("client_contracts")
            .select(`
                *,
                clients (
                    id,
                    company_name
                )
            `)
            .eq("id", id)
            .single();

        if (error) {
            return sendError(res, 404, "Contract not found");
        }

        return res.status(200).json({
            success: true,
            data,
        });

    } catch (err) {
        console.error("GET /api/contracts/:id:", err.message);

        return sendError(res, 500, "Failed to load contract");
    }
});

// =====================================================
// CREATE CONTRACT
// POST /api/contracts
// =====================================================

router.post("/", async (req, res) => {
    try {
        const {
            client_id,
            contract_number,
            contract_title,
            billing_model,
            markup_percentage,
            per_head_fee,
            credit_terms,
            start_date,
            end_date,
            contract_status,
        } = req.body;

        // -----------------------------------------------
        // VALIDATION
        // -----------------------------------------------

        if (
            !client_id ||
            !contract_number ||
            !contract_title ||
            !start_date ||
            !end_date
        ) {
            return sendError(
                res,
                400,
                "client_id, contract_number, contract_title, start_date and end_date are required"
            );
        }

        const clientId = getId(client_id);

        if (!clientId) {
            return sendError(res, 400, "Invalid client_id");
        }

        // -----------------------------------------------
        // PREPARE DATA
        // -----------------------------------------------

        const contractData = {
            client_id: clientId,

            contract_number: String(contract_number).trim(),

            contract_title: String(contract_title).trim(),

            billing_model:
                billing_model || "Percentage Markup",

            markup_percentage:
                markup_percentage !== undefined &&
                markup_percentage !== null
                    ? Number(markup_percentage)
                    : 10,

            per_head_fee:
                per_head_fee !== undefined &&
                per_head_fee !== null
                    ? Number(per_head_fee)
                    : 0,

            credit_terms:
                credit_terms || "Net 30",

            start_date,

            end_date,

            contract_status:
                contract_status || "Active",
        };

        // -----------------------------------------------
        // INSERT
        // -----------------------------------------------

        const { data, error } = await supabase
            .from("client_contracts")
            .insert(contractData)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return res.status(201).json({
            success: true,
            message: "Contract created successfully",
            data,
        });

    } catch (err) {
        console.error("POST /api/contracts:", err.message);

        return sendError(res, 500, err.message);
    }
});

// =====================================================
// UPDATE CONTRACT
// PUT /api/contracts/:id
// =====================================================

router.put("/:id", async (req, res) => {
    try {
        const id = getId(req.params.id);

        if (!id) {
            return sendError(res, 400, "Invalid contract ID");
        }

        const allowedFields = [
            "client_id",
            "contract_number",
            "contract_title",
            "billing_model",
            "markup_percentage",
            "per_head_fee",
            "credit_terms",
            "start_date",
            "end_date",
            "contract_status",
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {

                if (field === "client_id") {
                    const value = getId(req.body[field]);

                    if (!value) {
                        return sendError(
                            res,
                            400,
                            "Invalid client_id"
                        );
                    }

                    updates[field] = value;

                } else if (
                    field === "markup_percentage" ||
                    field === "per_head_fee"
                ) {
                    const value = Number(req.body[field]);

                    if (Number.isNaN(value)) {
                        return sendError(
                            res,
                            400,
                            `${field} must be a valid number`
                        );
                    }

                    updates[field] = value;

                } else {
                    updates[field] = req.body[field];
                }
            }
        }

        if (Object.keys(updates).length === 0) {
            return sendError(
                res,
                400,
                "No valid fields provided"
            );
        }

        const { data, error } = await supabase
            .from("client_contracts")
            .update(updates)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw error;
        }

        return res.status(200).json({
            success: true,
            message: "Contract updated successfully",
            data,
        });

    } catch (err) {
        console.error(
            "PUT /api/contracts/:id:",
            err.message
        );

        return sendError(res, 500, err.message);
    }
});

module.exports = router;