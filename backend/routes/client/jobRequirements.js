// =====================================================
// JOB REQUIREMENTS ROUTER
// =====================================================

const express = require("express");
const router = express.Router();

// Shared Supabase client
const supabase = require("../../supabaseClient");

// =====================================================
// HELPER
// =====================================================

function isValidPositiveInteger(value) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number > 0
  );
}

// =====================================================
// GET JOB REQUIREMENTS
// GET /api/job-requirements
// GET /api/job-requirements?client_id=1
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { client_id } = req.query;

    let query = supabase
      .from("job_requirements")
      .select("*");

    // Filter by client if client_id is provided
    if (client_id !== undefined && client_id !== "") {
      const clientId = Number(client_id);

      if (!isValidPositiveInteger(clientId)) {
        return res.status(400).json({
          success: false,
          error: "Valid client_id is required"
        });
      }

      query = query.eq(
        "client_id",
        clientId
      );
    }

    const {
      data,
      error
    } = await query.order(
      "created_at",
      {
        ascending: false
      }
    );

    if (error) {
      console.error(
        "Job requirements GET Supabase error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error(
      "Job requirements GET error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// CREATE JOB REQUIREMENT
// POST /api/job-requirements
// =====================================================

router.post("/", async (req, res) => {
  try {
    const {
      client_id,
      job_title,
      skills_required,
      positions_count,
      location,
      experience_min,
      experience_max,
      salary_lpa,
      status
    } = req.body || {};

    // -----------------------------------------------
    // VALIDATION
    // -----------------------------------------------

    if (!isValidPositiveInteger(client_id)) {
      return res.status(400).json({
        success: false,
        error: "Valid client_id is required"
      });
    }

    if (
      !job_title ||
      typeof job_title !== "string" ||
      !job_title.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Job title is required"
      });
    }

    const positionsCount =
      Number(positions_count);

    if (
      !Number.isInteger(positionsCount) ||
      positionsCount <= 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "positions_count must be a positive integer"
      });
    }

    const experienceMin =
      Number(experience_min ?? 0);

    const experienceMax =
      Number(experience_max ?? 0);

    if (
      Number.isNaN(experienceMin) ||
      experienceMin < 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "experience_min must be 0 or greater"
      });
    }

    if (
      Number.isNaN(experienceMax) ||
      experienceMax < 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "experience_max must be 0 or greater"
      });
    }

    if (experienceMax < experienceMin) {
      return res.status(400).json({
        success: false,
        error:
          "experience_max cannot be less than experience_min"
      });
    }

    // -----------------------------------------------
    // BUILD PAYLOAD
    // -----------------------------------------------

    const payload = {
      client_id: Number(client_id),

      job_title:
        job_title.trim(),

      skills_required:
        skills_required?.trim() || "",

      positions_count:
        positionsCount,

      location:
        location?.trim() || "",

      experience_min:
        experienceMin,

      experience_max:
        experienceMax,

      salary_lpa:
        salary_lpa === "" ||
        salary_lpa === null ||
        salary_lpa === undefined
          ? null
          : Number(salary_lpa),

      status:
        status || "Open"
    };

    // -----------------------------------------------
    // INSERT
    // -----------------------------------------------

    const {
      data,
      error
    } = await supabase
      .from("job_requirements")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error(
        "Job requirement POST Supabase error:",
        error
      );

      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Job requirement created successfully",
      data
    });

  } catch (error) {
    console.error(
      "Job requirement POST error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// DELETE JOB REQUIREMENT
// DELETE /api/job-requirements/:id
// =====================================================

router.delete("/:id", async (req, res) => {
  try {
    const id =
      Number(req.params.id);

    // -----------------------------------------------
    // VALIDATE ID
    // -----------------------------------------------

    if (!isValidPositiveInteger(id)) {
      return res.status(400).json({
        success: false,
        error:
          "Valid job requirement ID is required"
      });
    }

    // -----------------------------------------------
    // DELETE
    // -----------------------------------------------

    const {
      data,
      error
    } = await supabase
      .from("job_requirements")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {

      // Supabase may return an error when
      // no matching record exists.
      console.error(
        "Job requirement DELETE Supabase error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    // -----------------------------------------------
    // NOT FOUND
    // -----------------------------------------------

    if (!data) {
      return res.status(404).json({
        success: false,
        error:
          "Job requirement not found"
      });
    }

    // -----------------------------------------------
    // SUCCESS
    // -----------------------------------------------

    return res.json({
      success: true,
      message:
        "Job requirement removed successfully",
      data
    });

  } catch (error) {
    console.error(
      "Job requirement DELETE error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;