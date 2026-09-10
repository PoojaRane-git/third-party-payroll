import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

const EmployeeMonthlyAttendance = () => {
  // =================================================
  // GET CURRENT MONTH - INDIA TIME
  // =================================================

  const getCurrentMonth = () => {
    return new Date()
      .toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      })
      .slice(0, 7);
  };

  // =================================================
  // CURRENT MONTH
  // =================================================

  const [month, setMonth] = useState(getCurrentMonth());

  // =================================================
  // STATE
  // =================================================

  const [summary, setSummary] = useState(null);

  const [dailyAttendance, setDailyAttendance] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // =================================================
  // EMPTY SUMMARY
  // =================================================

  const emptySummary = {
    total_days: 0,
    working_days: 0,
    present_days: 0,
    absent_days: 0,
    leave_days: 0,
    half_days: 0,
    lop_days: 0,
    payable_days: 0,
    overtime_hours: 0,
  };

  // =================================================
  // FETCH MONTHLY ATTENDANCE
  // =================================================

  const fetchMonthly = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Fetching monthly attendance...");
      console.log("Selected month:", month);

      const response = await api.get("/employee/monthly", {
        params: {
          billing_month: month,
        },
      });

      console.log(
        "Monthly attendance response:",
        response.data
      );

      // =================================================
      // SUMMARY
      // =================================================

      const data = response.data?.summary;

      if (data) {
        setSummary({
          total_days: Number(data.total_days || 0),

          working_days: Number(data.working_days || 0),

          present_days: Number(data.present_days || 0),

          absent_days: Number(data.absent_days || 0),

          leave_days: Number(data.leave_days || 0),

          half_days: Number(data.half_days || 0),

          lop_days: Number(data.lop_days || 0),

          payable_days: Number(data.payable_days || 0),

          overtime_hours: Number(
            data.overtime_hours || 0
          ),
        });
      } else {
        setSummary(emptySummary);
      }

      // =================================================
      // DAILY ATTENDANCE
      // =================================================

      setDailyAttendance(
        response.data?.data || []
      );
    } catch (err) {
      console.error(
        "Monthly attendance error:",
        err
      );

      console.error(
        "Server response:",
        err.response?.data
      );

      setSummary(null);

      setDailyAttendance([]);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to load monthly attendance."
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  // =================================================
  // LOAD DATA
  // =================================================

  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  // =================================================
  // NUMBER FORMAT
  // =================================================

  const number = (value) => {
    const result = Number(value);

    return Number.isNaN(result) ? 0 : result;
  };

  // =================================================
  // FORMAT DATE
  // =================================================

  const formatDate = (date) => {
    if (!date) {
      return "--";
    }

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // =================================================
  // FORMAT TIME
  // =================================================

  const formatTime = (value) => {
    if (!value) {
      return "--";
    }

    return new Date(value).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // =================================================
  // FORMAT WORKING HOURS
  // =================================================

  const formatHours = (value) => {
    const hours = Number(value || 0);

    if (hours <= 0) {
      return "0 mins";
    }

    const totalMinutes = Math.round(hours * 60);

    const wholeHours = Math.floor(
      totalMinutes / 60
    );

    const minutes = totalMinutes % 60;

    if (wholeHours === 0) {
      return `${minutes} mins`;
    }

    if (minutes === 0) {
      return `${wholeHours} hrs`;
    }

    return `${wholeHours} hrs ${minutes} mins`;
  };

  // =================================================
  // STATUS CLASS
  // =================================================

  const getStatusClass = (status) => {
    return String(status || "Pending")
      .toLowerCase()
      .replace(/\s+/g, "-");
  };

  // =================================================
  // UI
  // =================================================

  return (
    <EmployeeLayout>
      <div>

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="page-header">
          <div>
            <h1>Monthly Attendance</h1>

            <p>
              Your monthly attendance summary.
            </p>
          </div>

          <input
            type="month"
            value={month}
            onChange={(e) =>
              setMonth(e.target.value)
            }
            className="month-input"
          />
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="empty-state">
            <h3>
              Loading monthly attendance...
            </h3>

            <p>
              Please wait while we load your
              attendance.
            </p>
          </div>
        ) : !summary ? (
          <div className="empty-state">
            <h3>No attendance found</h3>

            <p>
              No attendance summary is
              available for {month}.
            </p>
          </div>
        ) : (
          <>
            {/* =================================================
                SUMMARY CARDS
            ================================================= */}

            <div className="stats-grid">

              {/* TOTAL DAYS */}

              <div className="stat-card">
                <span>Total Days</span>

                <strong>
                  {number(
                    summary.total_days
                  )}
                </strong>
              </div>

              {/* WORKING DAYS */}

              <div className="stat-card">
                <span>Working Days</span>

                <strong>
                  {number(
                    summary.working_days
                  )}
                </strong>
              </div>

              {/* PRESENT */}

              <div className="stat-card">
                <span>Present</span>

                <strong>
                  {number(
                    summary.present_days
                  )}
                </strong>
              </div>

              {/* ABSENT */}

              <div className="stat-card">
                <span>Absent</span>

                <strong>
                  {number(
                    summary.absent_days
                  )}
                </strong>
              </div>

              {/* LEAVE */}

              <div className="stat-card">
                <span>Leave</span>

                <strong>
                  {number(
                    summary.leave_days
                  )}
                </strong>
              </div>

              {/* HALF DAY */}

              <div className="stat-card">
                <span>Half Day</span>

                <strong>
                  {number(
                    summary.half_days
                  )}
                </strong>
              </div>

              {/* LOP */}

              <div className="stat-card">
                <span>LOP</span>

                <strong>
                  {number(
                    summary.lop_days
                  )}
                </strong>
              </div>

              {/* PAYABLE DAYS */}

              <div className="stat-card">
                <span>Payable Days</span>

                <strong>
                  {number(
                    summary.payable_days
                  )}
                </strong>
              </div>

              {/* OVERTIME */}

              <div className="stat-card">
                <span>Overtime</span>

                <strong>
                  {number(
                    summary.overtime_hours
                  ).toFixed(2)}{" "}
                  hrs
                </strong>
              </div>

            </div>

            {/* =================================================
                DAILY ATTENDANCE
            ================================================= */}

            <div className="monthly-attendance-section">

              <h2 className="section-title">
                Daily Attendance
              </h2>

              {dailyAttendance.length === 0 ? (
                <div className="empty-state">

                  <h3>
                    No daily attendance records
                  </h3>

                  <p>
                    There are no attendance
                    records for {month}.
                  </p>

                </div>
              ) : (
                <div className="attendance-table-wrapper">

                  <table className="attendance-table">

                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Working Hours</th>
                        <th>Overtime</th>
                        <th>Work Mode</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {dailyAttendance.map(
                        (record) => (
                          <tr
                            key={record.id}
                          >

                            {/* DATE */}

                            <td>
                              {formatDate(
                                record.attendance_date
                              )}
                            </td>

                            {/* CHECK IN */}

                            <td>
                              {formatTime(
                                record.check_in
                              )}
                            </td>

                            {/* CHECK OUT */}

                            <td>
                              {formatTime(
                                record.check_out
                              )}
                            </td>

                            {/* WORKING HOURS */}

                            <td>
                              {formatHours(
                                record.working_hours
                              )}
                            </td>

                            {/* OVERTIME */}

                            <td>
                              {number(
                                record.overtime_hours
                              ).toFixed(2)}{" "}
                              hrs
                            </td>

                            {/* WORK MODE */}

                            <td>
                              {record.work_mode ===
                              "WFH"
                                ? "🏠 WFH"
                                : "🏢 Office"}
                            </td>

                            {/* STATUS */}

                            <td>
                              <span
                                className={`status-badge ${getStatusClass(
                                  record.status
                                )}`}
                              >
                                {record.status ||
                                  "Pending"}
                              </span>
                            </td>

                          </tr>
                        )
                      )}
                    </tbody>

                  </table>

                </div>
              )}

            </div>
          </>
        )}

      </div>
    </EmployeeLayout>
  );
};

export default EmployeeMonthlyAttendance;