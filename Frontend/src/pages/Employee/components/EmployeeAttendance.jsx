import React, { useCallback, useEffect, useState } from "react";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

const EmployeeAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Current month, format YYYY-MM (used by the native month/calendar input)
  const [month, setMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/emp-attendance", {
        params: { month },
      });

      const rows = response.data?.attendance ?? [];
      setAttendance(Array.isArray(rows) ? rows : []);
    } catch (err) {
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

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const formatDate = (value) => {
    if (!value) return "--";
    try {
      return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "--";
    }
  };

  const formatTime = (value) => {
    if (!value) return "--";
    try {
      return new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "--";
    }
  };

  const formatNumber = (value) => {
    const number = Number(value);
    return Number.isNaN(number) ? "0.00" : number.toFixed(2);
  };

  const getStatusClass = (status) => {
    if (!status) return "pending";
    return String(status).toLowerCase().trim().replace(/\s+/g, "-");
  };

  const getStatusText = (status) => {
    if (!status) return "Not Marked";
    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <EmployeeLayout>
      <div>
        <div className="page-header">
          <div>
            <h1>Attendance</h1>
            <p>View your daily attendance records.</p>
          </div>

          {/* Calendar (month picker) to browse a specific month's attendance */}
          <div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="month-input"
            />
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="table-card">
          {loading ? (
            <div className="empty-state">
              <h3>Loading attendance...</h3>
              <p>Please wait while we load your attendance records.</p>
            </div>
          ) : attendance.length === 0 ? (
            <div className="empty-state">
              <h3>No attendance records found</h3>
              <p>No attendance has been recorded for {month}.</p>
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
                      <td>{formatDate(row.attendance_date)}</td>
                      <td>{formatTime(row.check_in)}</td>
                      <td>{formatTime(row.check_out)}</td>
                      <td>{formatNumber(row.working_hours)} hrs</td>
                      <td>{formatNumber(row.overtime_hours)} hrs</td>
                      <td>
                        <span className={`status-badge ${getStatusClass(row.status)}`}>
                          {getStatusText(row.status)}
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