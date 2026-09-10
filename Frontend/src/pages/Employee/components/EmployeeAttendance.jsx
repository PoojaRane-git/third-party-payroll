import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

const EmployeeAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =================================================
  // CURRENT MONTH
  // =================================================

  const [month, setMonth] = useState(() => {
    const date = new Date();

    return `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  // =================================================
  // FETCH ATTENDANCE
  // =================================================

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      console.log("Fetching employee attendance...");
      console.log("Month:", month);

      const response = await api.get(
        "/employee/attendance",
        {
          params: {
            month,
          },
        }
      );

      console.log(
        "Attendance API response:",
        response.data
      );

      const rows =
        response.data?.attendance ??
        response.data?.data ??
        [];

      if (Array.isArray(rows)) {
        setAttendance(rows);
      } else {
        setAttendance([]);
      }
    } catch (err) {
      console.error(
        "Attendance error:",
        err
      );

      console.error(
        "Server response:",
        err.response?.data
      );

      setAttendance([]);

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to load attendance."
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  // =================================================
  // LOAD ATTENDANCE
  // =================================================

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // =================================================
  // FORMAT DATE
  // =================================================

  const formatDate = (value) => {
    if (!value) {
      return "--";
    }

    try {
      return new Date(
        `${value}T00:00:00`
      ).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "--";
    }
  };

  // =================================================
  // FORMAT TIME
  // =================================================

  const formatTime = (value) => {
    if (!value) {
      return "--";
    }

    try {
      return new Date(value).toLocaleTimeString(
        "en-IN",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      );
    } catch {
      return "--";
    }
  };

  // =================================================
  // FORMAT HOURS
  // =================================================

  const formatNumber = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "0.00";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      return "0.00";
    }

    return number.toFixed(2);
  };

  // =================================================
  // STATUS CLASS
  // =================================================

  const getStatusClass = (status) => {
    if (!status) {
      return "pending";
    }

    return String(status)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");
  };

  // =================================================
  // DISPLAY STATUS
  // =================================================

  const getStatusText = (status) => {
    if (!status) {
      return "Not Marked";
    }

    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  };

  // =================================================
  // UI
  // =================================================

  return (
    <EmployeeLayout>

      {/* =================================================
          ATTENDANCE PAGE
      ================================================= */}

      <div>

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="page-header">

          <div>
            <h1>Attendance</h1>

            <p>
              View your daily attendance records.
            </p>
          </div>

          <div>
            <input
              type="month"
              value={month}
              onChange={(e) =>
                setMonth(e.target.value)
              }
              className="month-input"
            />
          </div>

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
            ATTENDANCE TABLE
        ================================================= */}

        <div className="table-card">

          {loading ? (

            <div className="empty-state">

              <h3>
                Loading attendance...
              </h3>

              <p>
                Please wait while we load your
                attendance records.
              </p>

            </div>

          ) : attendance.length === 0 ? (

            <div className="empty-state">

              <h3>
                No attendance records found
              </h3>

              <p>
                No attendance has been recorded
                for {month}.
              </p>

            </div>

          ) : (

            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>
                    <th>Date</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Working Hours</th>
                    <th>Overtime</th>
                    <th>Status</th>
                  </tr>

                </thead>

                <tbody>

                  {attendance.map((row) => (

                    <tr key={row.id}>

                      {/* DATE */}

                      <td>
                        {formatDate(
                          row.attendance_date
                        )}
                      </td>

                      {/* CHECK IN */}

                      <td>
                        {formatTime(
                          row.check_in
                        )}
                      </td>

                      {/* CHECK OUT */}

                      <td>
                        {formatTime(
                          row.check_out
                        )}
                      </td>

                      {/* WORKING HOURS */}

                      <td>
                        {formatNumber(
                          row.working_hours
                        )}{" "}
                        hrs
                      </td>

                      {/* OVERTIME */}

                      <td>
                        {formatNumber(
                          row.overtime_hours
                        )}{" "}
                        hrs
                      </td>

                      {/* STATUS */}

                      <td>
                        <span
                          className={`status-badge ${getStatusClass(
                            row.status
                          )}`}
                        >
                          {getStatusText(
                            row.status
                          )}
                        </span>
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </EmployeeLayout>
  );
};

export default EmployeeAttendance;
