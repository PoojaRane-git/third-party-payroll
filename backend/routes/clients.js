const express = require("express");
const router = express.Router();

const  supabase  = require("../supabaseClient");

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
router.get("/", async (req, res) => {
    try {
        console.log("GET ALL CLIENTS");

        const { data, error } = await supabase
            .from("clients")
            .select("*")
            .order("id", { ascending: true });

        if (error) {
            console.error("Supabase GET clients error:", error);

            return res.status(500).json({
                success: false,
                message: error.message
            });
        }

        return res.status(200).json({
            success: true,
            data: data || []
        });

    } catch (err) {
        console.error("GET /api/clients error:", err);

        return res.status(500).json({
            success: false,
            message: "Failed to load clients"
        });
    }
});

// =====================================================
// GET SINGLE CLIENT
// GET /api/clients/:id
// =====================================================
router.get("/:id", async (req, res) => {
    try {
        const id = getId(req.params.id);

        console.log("GET single client, ID:", req.params.id);

        if (!id) {
            return sendError(res, 400, "Invalid client ID");
        }

        const { data, error } = await supabase
            .from("clients")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            return sendError(res, 404, "Client not found");
        }

        return res.json({
            success: true,
            data
        });

    } catch (err) {
        console.error("GET single client error:", err);

        return sendError(
            res,
            500,
            "Failed to load client"
        );
    }
});
// =====================================================
// CREATE CLIENT
// POST /api/clients
// =====================================================

router.post("/", async (req, res) => {
    try {
        const {
            company_name,
            gstin,
            billing_address,
            state_code,
            credit_terms,
        } = req.body;

        // -----------------------------------------------
        // VALIDATION
        // -----------------------------------------------

        if (
            !company_name ||
            !String(company_name).trim()
        ) {
            return sendError(
                res,
                400,
                "company_name is required"
            );
        }

        // -----------------------------------------------
        // PREPARE DATA
        // -----------------------------------------------

        const clientData = {
            company_name: String(company_name).trim(),

            gstin:
                gstin !== undefined &&
                gstin !== null &&
                String(gstin).trim() !== ""
                    ? String(gstin).trim()
                    : null,

            billing_address:
                billing_address !== undefined &&
                billing_address !== null &&
                String(billing_address).trim() !== ""
                    ? String(billing_address).trim()
                    : null,

            state_code:
                state_code !== undefined &&
                state_code !== null &&
                String(state_code).trim() !== ""
                    ? String(state_code).trim()
                    : null,

            credit_terms:
                credit_terms !== undefined &&
                credit_terms !== null &&
                String(credit_terms).trim() !== ""
                    ? String(credit_terms).trim()
                    : "Net 30",
        };

        console.log("Creating client:", clientData);

        // -----------------------------------------------
        // INSERT INTO SUPABASE
        // -----------------------------------------------

        const { data, error } = await supabase
            .from("clients")
            .insert(clientData)
            .select("*")
            .single();

        if (error) {
            console.error(
                "Supabase CREATE client error:",
                error
            );

            return sendError(
                res,
                500,
                error.message
            );
        }

        // -----------------------------------------------
        // SUCCESS
        // -----------------------------------------------

        return res.status(201).json({
            success: true,
            message: "Client created successfully",
            data,
        });

    } catch (err) {
        console.error(
            "POST /api/clients error:",
            err
        );

        return sendError(
            res,
            500,
            "Failed to create client"
        );
    }
});

// =====================================================
// UPDATE CLIENT
// PUT /api/clients/:id
// =====================================================

router.put("/:id", async (req, res) => {
    try {
        // -----------------------------------------------
        // VALIDATE ID
        // -----------------------------------------------

        const id = getId(req.params.id);

        console.log(
            "Updating client ID:",
            req.params.id
        );

        if (!id) {
            return sendError(
                res,
                400,
                "Invalid client ID"
            );
        }

        // -----------------------------------------------
        // ALLOWED FIELDS
        // -----------------------------------------------

        const allowedFields = [
            "company_name",
            "gstin",
            "billing_address",
            "state_code",
            "credit_terms",
        ];

        const updates = {};

        // -----------------------------------------------
        // COPY ONLY ALLOWED FIELDS
        // -----------------------------------------------

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        // -----------------------------------------------
        // VALIDATE COMPANY NAME
        // -----------------------------------------------

        if (updates.company_name !== undefined) {
            const companyName = String(
                updates.company_name
            ).trim();

            if (!companyName) {
                return sendError(
                    res,
                    400,
                    "company_name cannot be empty"
                );
            }

            updates.company_name = companyName;
        }

        // -----------------------------------------------
        // CLEAN OPTIONAL FIELDS
        // -----------------------------------------------

        [
            "gstin",
            "billing_address",
            "state_code",
            "credit_terms",
        ].forEach((field) => {
            if (updates[field] !== undefined) {
                if (
                    updates[field] === null ||
                    String(updates[field]).trim() === ""
                ) {
                    updates[field] = null;
                } else {
                    updates[field] = String(
                        updates[field]
                    ).trim();
                }
            }
        });

        // -----------------------------------------------
        // CHECK UPDATES
        // -----------------------------------------------

        if (Object.keys(updates).length === 0) {
            return sendError(
                res,
                400,
                "No valid fields provided"
            );
        }

        console.log(
            "Updating client:",
            id,
            updates
        );

        // -----------------------------------------------
        // UPDATE SUPABASE
        // -----------------------------------------------

        const { data, error } = await supabase
            .from("clients")
            .update(updates)
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            console.error(
                "Supabase UPDATE client error:",
                error
            );

            return sendError(
                res,
                500,
                error.message
            );
        }

        // -----------------------------------------------
        // SUCCESS
        // -----------------------------------------------

        return res.status(200).json({
            success: true,
            message: "Client updated successfully",
            data,
        });

    } catch (err) {
        console.error(
            "PUT /api/clients/:id error:",
            err
        );

        return sendError(
            res,
            500,
            "Failed to update client"
        );
    }
});

// =====================================================
// DEACTIVATE CLIENT
// PATCH /api/clients/:id/deactivate
// =====================================================

router.patch("/:id/deactivate", async (req, res) => {
    try {
        const id = getId(req.params.id);

        console.log("Deactivating client ID:", req.params.id);

        if (!id) {
            return sendError(res, 400, "Invalid client ID");
        }

        const { data, error } = await supabase
            .from("clients")
            .update({
                status: "Inactive"
            })
            .eq("id", id)
            .select("*")
            .single();

        if (error) {
            console.error("Supabase DEACTIVATE client error:", error);

            return sendError(res, 500, error.message);
        }

        return res.status(200).json({
            success: true,
            message: "Client deactivated successfully",
            data
        });

    } catch (err) {
        console.error(
            "PATCH /api/clients/:id/deactivate error:",
            err
        );

        return sendError(
            res,
            500,
            "Failed to deactivate client"
        );
    }
});



module.exports = router;
