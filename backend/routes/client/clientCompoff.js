const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../../config/supabaseAdmin");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

router.use(authenticate);
router.use(authorize("client"));

async function getClientContext(req) {
    const { data, error } = await supabaseAdmin
        .from("client_users")
        .select("id, client_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

    if (error) throw error;

    if (!data?.client_id) {
        throw new Error("Client profile not found.");
    }

    return data;
}

// =====================================================
// GET CLIENT COMP-OFF
// GET /api/client/compoff
// =====================================================

router.get("/", async (req, res) => {
    try {
        const client = await getClientContext(req);

        let query = supabaseAdmin
            .from("employee_compoff_ledger")
            .select("*")
            .eq("client_id", client.client_id)
            .order("earned_date", {
                ascending: false,
            });

        if (req.query.status) {
            query = query.eq(
                "status",
                req.query.status
            );
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error("GET CLIENT COMPOFF ERROR:", error);

        return res.status(500).json({
            error: "Failed to fetch comp-off records.",
            details: error.message,
        });
    }
});

module.exports = router;