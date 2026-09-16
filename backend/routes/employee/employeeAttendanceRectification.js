const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../../config/supabaseAdmin");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

router.use(authenticate);
router.use(authorize("employee"));

// =====================================================
// HELPER
// =====================================================

async function getEmployeeContext(req) {
    const { data, error } = await supabaseAdmin
        .from("employee_users")
        .select("id, employee_id")
        .eq("user_id", req.user.id)
        .maybeSingle();

    if (error) throw error;

    if (!data?.employee_id) {
        throw new Error("Employee profile not found.");
    }

    return data;
}

function validDateTime(value) {
    if (!value) return true;

    return !Number.isNaN(
        new Date(value).getTime()
    );
}

// =====================================================
// SUBMIT RECTIFICATION
// POST /api/employee/attendance/:id/rectify
// =====================================================

router.post("/:id/rectify", async (req, res) => {
    try {
        const attendanceId = Number(req.params.id);

        if (
            !Number.isInteger(attendanceId) ||
            attendanceId <= 0
        ) {
            return res.status(400).json({
                error: "Invalid attendance ID.",
            });
        }

        const employee =
            await getEmployeeContext(req);

        const {
            requested_check_in,
            requested_check_out,
            reason,
        } = req.body;

        if (!reason || !String(reason).trim()) {
            return res.status(400).json({
                error: "Rectification reason is required.",
            });
        }

        if (
            !requested_check_in &&
            !requested_check_out
        ) {
            return res.status(400).json({
                error:
                    "At least one corrected check-in or check-out time is required.",
            });
        }

        if (
            !validDateTime(requested_check_in) ||
            !validDateTime(requested_check_out)
        ) {
            return res.status(400).json({
                error:
                    "Invalid check-in or check-out time.",
            });
        }

        // Verify attendance belongs to employee
        const {
            data: attendance,
            error: attendanceError,
        } = await supabaseAdmin
            .from("third_party_emp_daily_attendance")
            .select("*")
            .eq("id", attendanceId)
            .eq(
                "candidates_id",
                employee.employee_id
            )
            .maybeSingle();

        if (attendanceError) throw attendanceError;

        if (!attendance) {
            return res.status(404).json({
                error:
                    "Attendance record not found.",
            });
        }

        // Do not allow duplicate pending request
        const {
            data: existingRequest,
            error: existingError,
        } = await supabaseAdmin
            .from("attendance_rectification_requests")
            .select("id, status")
            .eq("attendance_id", attendanceId)
            .eq("employee_id", employee.employee_id)
            .eq("status", "Pending")
            .maybeSingle();

        if (existingError) throw existingError;

        if (existingRequest) {
            return res.status(409).json({
                error:
                    "A rectification request is already pending for this attendance.",
                request_id: existingRequest.id,
            });
        }

        const {
            data,
            error,
        } = await supabaseAdmin
            .from("attendance_rectification_requests")
            .insert({
                attendance_id: attendanceId,
                employee_id: employee.employee_id,
                requested_check_in:
                    requested_check_in || null,
                requested_check_out:
                    requested_check_out || null,
                reason: String(reason).trim(),
                status: "Pending",
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({
            message:
                "Attendance rectification submitted successfully.",
            request: data,
        });
    } catch (error) {
        console.error(
            "SUBMIT RECTIFICATION ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to submit attendance rectification.",
            details: error.message,
        });
    }
});

// =====================================================
// GET MY RECTIFICATIONS
// GET /api/employee/attendance/rectifications
// =====================================================

router.get("/rectifications", async (req, res) => {
    try {
        const employee =
            await getEmployeeContext(req);

        let query = supabaseAdmin
            .from("attendance_rectification_requests")
            .select("*")
            .eq(
                "employee_id",
                employee.employee_id
            )
            .order("created_at", {
                ascending: false,
            });

        if (req.query.status) {
            query = query.eq(
                "status",
                req.query.status
            );
        }

        const {
            data: requests,
            error,
        } = await query;

        if (error) throw error;

        if (!requests || requests.length === 0) {
            return res.json([]);
        }

        const attendanceIds = requests.map(
            (request) => request.attendance_id
        );

        const {
            data: attendanceRows,
            error: attendanceError,
        } = await supabaseAdmin
            .from("third_party_emp_daily_attendance")
            .select(`
                id,
                attendance_date,
                check_in,
                check_out,
                working_hours,
                overtime_hours,
                status,
                remarks
            `)
            .in("id", attendanceIds);

        if (attendanceError) throw attendanceError;

        const attendanceMap = new Map(
            (attendanceRows || []).map((row) => [
                row.id,
                row,
            ])
        );

        return res.json(
            requests.map((request) => ({
                ...request,
                attendance:
                    attendanceMap.get(
                        request.attendance_id
                    ) || null,
            }))
        );
    } catch (error) {
        console.error(
            "GET EMPLOYEE RECTIFICATIONS ERROR:",
            error
        );

        return res.status(500).json({
            error:
                "Failed to fetch rectification requests.",
            details: error.message,
        });
    }
});

module.exports = router;