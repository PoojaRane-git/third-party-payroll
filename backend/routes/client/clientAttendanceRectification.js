const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../../config/supabaseAdmin");
const authenticate = require("../../middleware/authenticate");
const authorize = require("../../middleware/authorize");

router.use(authenticate);
router.use(authorize("client"));

// =====================================================
// HELPERS
// =====================================================

async function getClientContext(req) {
    const userId = req.user?.id;

    if (!userId) {
        throw new Error("Authenticated user ID not found.");
    }

    const { data, error } = await supabaseAdmin
        .from("client_users")
        .select("id, client_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data || !data.client_id) {
        throw new Error("Client profile not found.");
    }

    return data;
}

function calculateAttendance(checkIn, checkOut) {
    if (!checkIn || !checkOut) {
        return {
            workingHours: 0,
            overtimeHours: 0,
            status: "In Progress",
        };
    }

    const start = new Date(checkIn);
    const end = new Date(checkOut);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        throw new Error(
            "Invalid check-in or check-out time."
        );
    }

    if (end < start) {
        throw new Error(
            "Check-out cannot be before check-in."
        );
    }

    const hours =
        (end.getTime() - start.getTime()) /
        (1000 * 60 * 60);

    const workingHours =
        Number(hours.toFixed(2));

    let status;

    if (workingHours >= 8) {
        status = "Present";
    } else if (workingHours >= 4) {
        status = "Half Day";
    } else {
        status = "Absent";
    }

    const overtimeHours =
        workingHours > 8
            ? Number(
                (workingHours - 8).toFixed(2)
            )
            : 0;

    return {
        workingHours,
        overtimeHours,
        status,
    };
}

// =====================================================
// GET RECTIFICATION REQUESTS
// GET /api/client/attendance/rectifications
// =====================================================

router.get("/", async (req, res) => {
    try {
        const client = await getClientContext(req);
        const clientId = client.client_id;

        const requestedStatus =
            req.query.status
                ? String(req.query.status).trim()
                : null;

        // -------------------------------------------------
        // GET CLIENT ATTENDANCE
        // -------------------------------------------------

        const {
            data: attendanceRows,
            error: attendanceError,
        } = await supabaseAdmin
            .from(
                "third_party_emp_daily_attendance"
            )
            .select(`
                id,
                candidates_id,
                deployment_id,
                client_id,
                attendance_date,
                check_in,
                check_out,
                working_hours,
                overtime_hours,
                status,
                work_mode,
                remarks
            `)
            .eq("client_id", clientId);

        if (attendanceError) {
            throw attendanceError;
        }

        // No attendance = no rectification requests
        if (
            !attendanceRows ||
            attendanceRows.length === 0
        ) {
            return res.json({
                success: true,
                data: [],
                count: 0,
            });
        }

        const attendanceIds =
            attendanceRows
                .map((row) => row.id)
                .filter(Boolean);

        if (attendanceIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                count: 0,
            });
        }

        // -------------------------------------------------
        // GET RECTIFICATION REQUESTS
        // -------------------------------------------------

        let query = supabaseAdmin
            .from(
                "attendance_rectification_requests"
            )
            .select("*")
            .in(
                "attendance_id",
                attendanceIds
            )
            .order(
                "created_at",
                {
                    ascending: false,
                }
            );

        if (requestedStatus) {
            query = query.eq(
                "status",
                requestedStatus
            );
        }

        const {
            data: rectifications,
            error: rectificationError,
        } = await query;

        if (rectificationError) {
            throw rectificationError;
        }

        // IMPORTANT:
        // Always return the same response structure.
        if (
            !rectifications ||
            rectifications.length === 0
        ) {
            return res.json({
                success: true,
                data: [],
                count: 0,
            });
        }

        // -------------------------------------------------
        // GET CANDIDATES
        // -------------------------------------------------

        const candidateIds = [
            ...new Set(
                attendanceRows
                    .map(
                        (row) =>
                            row.candidates_id
                    )
                    .filter(Boolean)
            ),
        ];

        let candidates = [];

        if (candidateIds.length > 0) {
            const {
                data,
                error,
            } = await supabaseAdmin
                .from("candidates")
                .select(
                    "id, full_name, email"
                )
                .in(
                    "id",
                    candidateIds
                );

            if (error) {
                throw error;
            }

            candidates = data || [];
        }

        // -------------------------------------------------
        // MAP DATA
        // -------------------------------------------------

        const attendanceMap =
            new Map(
                attendanceRows.map(
                    (row) => [
                        row.id,
                        row,
                    ]
                )
            );

        const candidateMap =
            new Map(
                candidates.map(
                    (candidate) => [
                        candidate.id,
                        candidate,
                    ]
                )
            );

        const result =
            rectifications.map(
                (request) => {

                    const attendance =
                        attendanceMap.get(
                            request.attendance_id
                        ) || null;

                    const candidate =
                        attendance
                            ? candidateMap.get(
                                attendance.candidates_id
                            )
                            : null;

                    return {
                        ...request,

                        employee_id:
                            request.employee_id ||
                            attendance?.candidates_id ||
                            null,

                        employee_name:
                            candidate?.full_name ||
                            "Unknown Employee",

                        employee:
                            candidate || null,

                        attendance:
                            attendance || null,
                    };
                }
            );

        return res.json({
            success: true,
            data: result,
            count: result.length,
        });

    } catch (error) {

        console.error(
            "GET CLIENT RECTIFICATIONS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            error:
                "Failed to fetch attendance rectification requests.",
            details:
                error.message,
        });
    }
});

// =====================================================
// APPROVE RECTIFICATION
// PATCH /api/client/attendance/rectifications/:id/approve
// =====================================================

router.patch(
    "/:id/approve",
    async (req, res) => {

        try {

            const requestId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    requestId
                ) ||
                requestId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid rectification request ID.",
                });
            }

            const client =
                await getClientContext(req);

            const clientId =
                client.client_id;

            // -------------------------------------------------
            // GET REQUEST
            // -------------------------------------------------

            const {
                data: request,
                error: requestError,
            } = await supabaseAdmin
                .from(
                    "attendance_rectification_requests"
                )
                .select("*")
                .eq(
                    "id",
                    requestId
                )
                .maybeSingle();

            if (requestError) {
                throw requestError;
            }

            if (!request) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Rectification request not found.",
                });
            }

            if (
                request.status !==
                "Pending"
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        `Request is already ${request.status}.`,
                });
            }

            // -------------------------------------------------
            // VERIFY ATTENDANCE BELONGS TO CLIENT
            // -------------------------------------------------

            const {
                data: attendance,
                error: attendanceError,
            } = await supabaseAdmin
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select("*")
                .eq(
                    "id",
                    request.attendance_id
                )
                .eq(
                    "client_id",
                    clientId
                )
                .maybeSingle();

            if (attendanceError) {
                throw attendanceError;
            }

            if (!attendance) {
                return res.status(403).json({
                    success: false,
                    error:
                        "Attendance record does not belong to this client.",
                });
            }

            // -------------------------------------------------
            // FINAL TIMES
            // -------------------------------------------------

            const finalCheckIn =
                request.requested_check_in ||
                attendance.check_in;

            const finalCheckOut =
                request.requested_check_out ||
                attendance.check_out;

            let calculated;

            try {

                calculated =
                    calculateAttendance(
                        finalCheckIn,
                        finalCheckOut
                    );

            } catch (error) {

                return res.status(400).json({
                    success: false,
                    error:
                        error.message,
                });
            }

            // -------------------------------------------------
            // UPDATE ATTENDANCE
            // -------------------------------------------------

            const {
                data: updatedAttendance,
                error:
                    updateAttendanceError,
            } = await supabaseAdmin
                .from(
                    "third_party_emp_daily_attendance"
                )
                .update({
                    check_in:
                        finalCheckIn,

                    check_out:
                        finalCheckOut,

                    working_hours:
                        calculated.workingHours,

                    overtime_hours:
                        calculated.overtimeHours,

                    status:
                        calculated.status,

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    attendance.id
                )
                .select()
                .single();

            if (
                updateAttendanceError
            ) {
                throw updateAttendanceError;
            }

            // -------------------------------------------------
            // CLIENT USER
            // -------------------------------------------------

            const {
                data: clientUser,
            } = await supabaseAdmin
                .from("client_users")
                .select("id")
                .eq(
                    "user_id",
                    req.user.id
                )
                .maybeSingle();

            // -------------------------------------------------
            // UPDATE REQUEST
            // -------------------------------------------------

            const {
                data: updatedRequest,
                error:
                    updateRequestError,
            } = await supabaseAdmin
                .from(
                    "attendance_rectification_requests"
                )
                .update({
                    status:
                        "Approved",

                    reviewed_by:
                        clientUser?.id ||
                        null,

                    reviewed_at:
                        new Date().toISOString(),

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    requestId
                )
                .select()
                .single();

            if (
                updateRequestError
            ) {
                throw updateRequestError;
            }

            return res.json({
                success: true,
                message:
                    "Attendance rectification approved successfully.",
                request:
                    updatedRequest,
                attendance:
                    updatedAttendance,
            });

        } catch (error) {

            console.error(
                "APPROVE RECTIFICATION ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Failed to approve attendance rectification.",
                details:
                    error.message,
            });
        }
    }
);

// =====================================================
// REJECT RECTIFICATION
// PATCH /api/client/attendance/rectifications/:id/reject
// =====================================================

router.patch(
    "/:id/reject",
    async (req, res) => {

        try {

            const requestId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    requestId
                ) ||
                requestId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Invalid rectification request ID.",
                });
            }

            const client =
                await getClientContext(req);

            const clientId =
                client.client_id;

            // -------------------------------------------------
            // GET REQUEST
            // -------------------------------------------------

            const {
                data: request,
                error: requestError,
            } = await supabaseAdmin
                .from(
                    "attendance_rectification_requests"
                )
                .select("*")
                .eq(
                    "id",
                    requestId
                )
                .maybeSingle();

            if (requestError) {
                throw requestError;
            }

            if (!request) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Rectification request not found.",
                });
            }

            if (
                request.status !==
                "Pending"
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        `Request is already ${request.status}.`,
                });
            }

            // -------------------------------------------------
            // VERIFY ATTENDANCE
            // -------------------------------------------------

            const {
                data: attendance,
                error: attendanceError,
            } = await supabaseAdmin
                .from(
                    "third_party_emp_daily_attendance"
                )
                .select("id")
                .eq(
                    "id",
                    request.attendance_id
                )
                .eq(
                    "client_id",
                    clientId
                )
                .maybeSingle();

            if (attendanceError) {
                throw attendanceError;
            }

            if (!attendance) {
                return res.status(403).json({
                    success: false,
                    error:
                        "This request does not belong to your client.",
                });
            }

            // -------------------------------------------------
            // CLIENT USER
            // -------------------------------------------------

            const {
                data: clientUser,
            } = await supabaseAdmin
                .from("client_users")
                .select("id")
                .eq(
                    "user_id",
                    req.user.id
                )
                .maybeSingle();

            // -------------------------------------------------
            // UPDATE REQUEST
            // -------------------------------------------------

            const {
                data: updatedRequest,
                error: updateError,
            } = await supabaseAdmin
                .from(
                    "attendance_rectification_requests"
                )
                .update({
                    status:
                        "Rejected",

                    reviewed_by:
                        clientUser?.id ||
                        null,

                    reviewed_at:
                        new Date().toISOString(),

                    updated_at:
                        new Date().toISOString(),
                })
                .eq(
                    "id",
                    requestId
                )
                .select()
                .single();

            if (updateError) {
                throw updateError;
            }

            return res.json({
                success: true,
                message:
                    "Attendance rectification rejected.",
                request:
                    updatedRequest,
            });

        } catch (error) {

            console.error(
                "REJECT RECTIFICATION ERROR:",
                error
            );

            return res.status(500).json({
                success: false,
                error:
                    "Failed to reject attendance rectification.",
                details:
                    error.message,
            });
        }
    }
);

module.exports = router;