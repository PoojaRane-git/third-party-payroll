const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../../config/supabaseAdmin");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

router.use(authenticate);
router.use(authorize("client"));

// =====================================================
// HELPER
// =====================================================

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
// GET HOLIDAYS
// GET /api/client/holidays
// =====================================================

router.get("/", async (req, res) => {
    try {
        const client = await getClientContext(req);

        let query = supabaseAdmin
            .from("holiday_calendar")
            .select("*")
            .eq("client_id", client.client_id)
            .order("holiday_date", {
                ascending: true,
            });

        if (req.query.from) {
            query = query.gte(
                "holiday_date",
                req.query.from
            );
        }

        if (req.query.to) {
            query = query.lte(
                "holiday_date",
                req.query.to
            );
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json(data || []);
    } catch (error) {
        console.error("GET CLIENT HOLIDAYS ERROR:", error);

        return res.status(500).json({
            error: "Failed to fetch holidays.",
            details: error.message,
        });
    }
});

// =====================================================
// ADD HOLIDAY
// POST /api/client/holidays
// =====================================================

router.post("/", async (req, res) => {
    try {
        const client = await getClientContext(req);

        const {
            holiday_date,
            name,
            holiday_type = "Full Day",
            is_paid = true,
        } = req.body;

        if (!holiday_date || !name) {
            return res.status(400).json({
                error: "holiday_date and name are required.",
            });
        }

        if (
            !["Full Day", "Half Day"].includes(
                holiday_type
            )
        ) {
            return res.status(400).json({
                error: "Invalid holiday type.",
            });
        }

        const { data, error } = await supabaseAdmin
            .from("holiday_calendar")
            .insert({
                client_id: client.client_id,
                holiday_date,
                name: String(name).trim(),
                holiday_type,
                is_paid: Boolean(is_paid),
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            message: "Holiday added successfully.",
            holiday: data,
        });
    } catch (error) {
        console.error("ADD HOLIDAY ERROR:", error);

        return res.status(500).json({
            error: "Failed to add holiday.",
            details: error.message,
        });
    }
});

// =====================================================
// UPDATE HOLIDAY
// PUT /api/client/holidays/:id
// =====================================================

router.put("/:id", async (req, res) => {
    try {
        const holidayId = Number(req.params.id);

        if (!Number.isInteger(holidayId) || holidayId <= 0) {
            return res.status(400).json({
                error: "Invalid holiday ID.",
            });
        }

        const client = await getClientContext(req);

        const {
            holiday_date,
            name,
            holiday_type,
            is_paid,
        } = req.body;

        const updateData = {
            updated_at: new Date().toISOString(),
        };

        if (holiday_date !== undefined) {
            updateData.holiday_date =
                holiday_date;
        }

        if (name !== undefined) {
            updateData.name = String(name).trim();
        }

        if (holiday_type !== undefined) {
            if (
                !["Full Day", "Half Day"].includes(
                    holiday_type
                )
            ) {
                return res.status(400).json({
                    error: "Invalid holiday type.",
                });
            }

            updateData.holiday_type =
                holiday_type;
        }

        if (is_paid !== undefined) {
            updateData.is_paid = Boolean(is_paid);
        }

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("holiday_calendar")
            .update(updateData)
            .eq("id", holidayId)
            .eq("client_id", client.client_id)
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                error: "Holiday not found.",
            });
        }

        return res.json({
            message: "Holiday updated successfully.",
            holiday: data,
        });
    } catch (error) {
        console.error("UPDATE HOLIDAY ERROR:", error);

        return res.status(500).json({
            error: "Failed to update holiday.",
            details: error.message,
        });
    }
});

// =====================================================
// DELETE HOLIDAY
// DELETE /api/client/holidays/:id
// =====================================================

router.delete("/:id", async (req, res) => {
    try {
        const holidayId = Number(req.params.id);

        if (!Number.isInteger(holidayId) || holidayId <= 0) {
            return res.status(400).json({
                error: "Invalid holiday ID.",
            });
        }

        const client = await getClientContext(req);

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("holiday_calendar")
            .delete()
            .eq("id", holidayId)
            .eq("client_id", client.client_id)
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                error: "Holiday not found.",
            });
        }

        return res.json({
            message: "Holiday deleted successfully.",
        });
    } catch (error) {
        console.error("DELETE HOLIDAY ERROR:", error);

        return res.status(500).json({
            error: "Failed to delete holiday.",
            details: error.message,
        });
    }
});

module.exports = router;