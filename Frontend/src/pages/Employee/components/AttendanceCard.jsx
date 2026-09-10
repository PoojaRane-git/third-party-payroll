
import React, { useState } from "react";

function AttendanceCard({
  attendance,
  onCheckIn,
  onCheckOut,
  loading,
}) {
  const [workMode, setWorkMode] = useState("Office");

  // =====================================================
  // FORMAT TIME
  // =====================================================

  const checkIn = attendance?.check_in
    ? new Date(attendance.check_in).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";

  const checkOut = attendance?.check_out
    ? new Date(attendance.check_out).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";

  // =====================================================
  // FORMAT WORKING HOURS
  // Example:
  // 0.17 -> 10 mins
  // 8.5  -> 8 hrs 30 mins
  // =====================================================

  const formatWorkingHours = (hours) => {
    const decimalHours = Number(hours || 0);

    if (decimalHours <= 0) {
      return "0 mins";
    }

    const totalMinutes = Math.round(decimalHours * 60);

    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (wholeHours === 0) {
      return `${minutes} mins`;
    }

    if (minutes === 0) {
      return `${wholeHours} hrs`;
    }

    return `${wholeHours} hrs ${minutes} mins`;
  };

  // =====================================================
  // CHECK IN
  // =====================================================

  const handleCheckIn = () => {
    onCheckIn(workMode);
  };

  // =====================================================
  // STATUS CLASS
  // =====================================================

  const statusClass =
    attendance?.status
      ?.toLowerCase()
      .replace(/\s+/g, "-") || "pending";

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="attendance-card">

      {/* ================================================
          HEADER
      ================================================= */}

      <div className="attendance-card-header">
        <div>
          <h3>Today's Attendance</h3>

          <p>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <span className={`status-badge ${statusClass}`}>
          {attendance?.status || "Not Marked"}
        </span>
      </div>

      {/* ================================================
          WORK MODE
      ================================================= */}

      {!attendance?.check_in && (
        <div className="work-mode-section">

          <label className="work-mode-label">
            Work Mode
          </label>

          <div className="work-mode-options">

            {/* OFFICE */}

            <button
              type="button"
              className={`work-mode-option ${
                workMode === "Office"
                  ? "selected"
                  : ""
              }`}
              onClick={() => setWorkMode("Office")}
              disabled={loading}
            >
              <span className="work-mode-icon">
                🏢
              </span>

              <span>
                <strong>Office</strong>
                <small>Working from office</small>
              </span>
            </button>

            {/* WORK FROM HOME */}

            <button
              type="button"
              className={`work-mode-option ${
                workMode === "Work From Home"
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                setWorkMode("Work From Home")
              }
              disabled={loading}
            >
              <span className="work-mode-icon">
                🏠
              </span>

              <span>
                <strong>Work From Home</strong>
                <small>Working remotely</small>
              </span>
            </button>

          </div>

        </div>
      )}

      {/* ================================================
          IF ALREADY CHECKED IN
          SHOW SELECTED WORK MODE
      ================================================= */}

      {attendance?.check_in && (
        <div className="current-work-mode">

          <span>Work Mode</span>

          <strong>
            {attendance?.work_mode ||
              attendance?.work_type ||
              "Office"}
          </strong>

        </div>
      )}

      {/* ================================================
          ATTENDANCE TIMES
      ================================================= */}

      <div className="attendance-times">

        {/* CHECK IN */}

        <div className="time-box">
          <span>Check In</span>
          <strong>{checkIn}</strong>
        </div>

        {/* CHECK OUT */}

        <div className="time-box">
          <span>Check Out</span>
          <strong>{checkOut}</strong>
        </div>

        {/* WORKING HOURS */}

        <div className="time-box">
          <span>Working Hours</span>

          <strong>
            {formatWorkingHours(
              attendance?.working_hours
            )}
          </strong>
        </div>

        {/* OVERTIME */}

        <div className="time-box">
          <span>Overtime</span>

          <strong>
            {attendance?.overtime_hours || 0} hrs
          </strong>
        </div>

      </div>

      {/* ================================================
          ACTIONS
      ================================================= */}

      <div className="attendance-actions">

        {/* CHECK IN */}

        {!attendance?.check_in && (
          <button
            className="btn-success"
            onClick={handleCheckIn}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : `✓ Check In - ${workMode}`}
          </button>
        )}

        {/* CHECK OUT */}

        {attendance?.check_in &&
          !attendance?.check_out && (
            <button
              className="btn-primary"
              onClick={onCheckOut}
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : "✓ Check Out"}
            </button>
          )}

        {/* COMPLETED */}

        {attendance?.check_out && (
          <div className="completed-message">
            ✓ Attendance completed for today
          </div>
        )}

      </div>

    </div>
  );
}

export default AttendanceCard;
