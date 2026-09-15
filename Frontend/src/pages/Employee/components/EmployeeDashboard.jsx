import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import api from "../../services/api";
import AttendanceCard from "./AttendanceCard";
import EmployeeSidebar from "./EmployeeSidebar";
import EmployeeNavbar from "./EmployeeNavbar";

const EmployeeDashboard = () => {
  const [employeeName, setEmployeeName] =
    useState("Employee");

  const [employeeId, setEmployeeId] =
    useState(null);

  const [attendance, setAttendance] =
    useState(null);

  const [summary, setSummary] =
    useState({
      present_days: 0,
      absent_days: 0,
      leave_days: 0,
      half_days: 0,
      lop_days: 0,
      overtime_hours: 0,
    });

  const [loading, setLoading] =
    useState(false);

  const [pageLoading, setPageLoading] =
    useState(true);

  const [error, setError] =
    useState("");
  const [activePage, setActivePage] = useState("dashboard");
  // =================================================
  // LOAD LOGGED-IN EMPLOYEE
  // =================================================

  const loadEmployeeProfile = useCallback(async () => {
    try {
      setError("");

      console.log("Loading employee profile...");

      const response = await api.get("/auth/me");

      console.log(
        "Employee /auth/me response:",
        response.data
      );

      const user = response.data?.user;

      if (!user) {
        throw new Error(
          "Unable to load logged-in employee."
        );
      }

      if (user.role !== "employee") {
        throw new Error(
          "This account is not an employee account."
        );
      }

      console.log(
        "Authenticated employee:",
        user
      );

      setEmployeeName(
        user.name || "Employee"
      );

      setEmployeeId(
        user.employee_id
      );

    } catch (err) {
      console.error(
        "Employee profile loading error:",
        err
      );

      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Unable to load employee profile."
      );
    } finally {
      setPageLoading(false);
    }
  }, []);

  // =================================================
  // TODAY
  // =================================================

  const getToday = () => {
    return new Date().toLocaleDateString(
      "en-CA",
      {
        timeZone: "Asia/Kolkata",
      }
    );
  };

  // =================================================
  // MONTH
  // =================================================

  const getMonth = () => {
    const today =
      new Date().toLocaleDateString(
        "en-CA",
        {
          timeZone: "Asia/Kolkata",
        }
      );

    return today.slice(0, 7);
  };

  // =================================================
  // LOAD TODAY ATTENDANCE
  // =================================================

  const loadAttendance =
    useCallback(async () => {
      try {
        setError("");

        const response =
          await api.get(
            "/employee/attendance/today"
          );

        console.log(
          "Today's attendance:",
          response.data
        );

        setAttendance(
          response.data?.attendance ||
          null
        );

      } catch (err) {
        console.error(
          "Attendance loading error:",
          err
        );

        setError(
          err.response?.data?.error ||
          err.response?.data?.message ||
          "Unable to load today's attendance."
        );
      }
    }, []);

  // =================================================
  // LOAD MONTHLY SUMMARY
  // =================================================

  const loadMonthlySummary =
    useCallback(async () => {
      try {
        const billingMonth =
          getMonth();

        const response =
          await api.get(
            "/employee/attendance/monthly",
            {
              params: {
                billing_month: billingMonth,
              },
            }
          );

        console.log(
          "Monthly summary:",
          response.data
        );

        const data =
          response.data?.summary ||
          {};

        setSummary({
          present_days: Number(
            data.present_days || 0
          ),

          absent_days: Number(
            data.absent_days || 0
          ),

          leave_days: Number(
            data.leave_days || 0
          ),

          half_days: Number(
            data.half_days || 0
          ),

          lop_days: Number(
            data.lop_days || 0
          ),

          overtime_hours: Number(
            data.overtime_hours || 0
          ),
        });

      } catch (err) {
        console.error(
          "Monthly summary error:",
          err
        );
      }
    }, []);

  // =================================================
  // FIRST LOAD
  // =================================================

  useEffect(() => {
    loadEmployeeProfile();
  }, [loadEmployeeProfile]);

  // =================================================
  // LOAD EMPLOYEE DATA
  // =================================================

  useEffect(() => {
    if (!employeeId) {
      return;
    }

    console.log(
      "Loading dashboard for employee ID:",
      employeeId
    );

    loadAttendance();
    loadMonthlySummary();

  }, [
    employeeId,
    loadAttendance,
    loadMonthlySummary,
  ]);

  // =================================================
  // CHECK IN
  // =================================================

  const handleCheckIn = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.post(
          "/employee/attendance/check-in",
          {
            work_mode: "Office",
            remarks: "",
          }
        );

      console.log(
        "Check-in response:",
        response.data
      );

      if (response.data?.success) {
        await loadAttendance();
        await loadMonthlySummary();
      }

    } catch (err) {
       console.error("========== CHECK-IN ERROR ==========");
  console.error("Status:", err.response?.status);
  console.error("Backend response:", err.response?.data);
  console.error("Full error:", err);
  console.error("====================================")

      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Unable to check in."
      );

    } finally {
      setLoading(false);
    }
  };

  // =================================================
  // CHECK OUT
  // =================================================

  const handleCheckOut = async () => {
    if (!attendance?.id) {
      setError(
        "Today's attendance record was not found."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response =
        await api.patch(
          `/employee/attendance/${attendance.id}/check-out`
        );

      console.log(
        "Check-out response:",
        response.data
      );

      if (
        response.data?.success
      ) {
        await loadAttendance();
        await loadMonthlySummary();
      }

    } catch (err) {
      console.error(
        "Check-out error:",
        err
      );

      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Unable to check out."
      );

    } finally {
      setLoading(false);
    }
  };

  // =================================================
  // PAGE LOADING
  // =================================================

  if (pageLoading) {
    return (
      <div className="page-header">
        <div>
          <h1>Loading...</h1>
          <p>
            Loading your employee dashboard.
          </p>
        </div>
      </div>
    );
  }

  // =================================================
  // UI
  // =================================================

  return (
    <div className="employee-layout">

      {/* SIDEBAR */}
      <EmployeeSidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      {/* MAIN AREA */}
      <div className="employee-main">

        {/* NAVBAR */}
        <EmployeeNavbar
          employeeName={employeeName}
        />

        {/* DASHBOARD CONTENT */}
        <main className="employee-content">

          {activePage === "dashboard" && (
            <div>

              {/* HEADER */}
              <div className="page-header">
                <div>
                  <h1>
                    Welcome, {employeeName}
                  </h1>

                  <p>
                    Here's your attendance overview.
                  </p>
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {/* ATTENDANCE */}
              <AttendanceCard
                attendance={attendance}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                loading={loading}
              />

              {/* MONTHLY SUMMARY */}
              <h2 className="section-title">
                This Month
              </h2>

              <div className="stats-grid">

                <div className="stat-card">
                  <span>Present</span>
                  <strong>
                    {summary.present_days}
                  </strong>
                </div>

                <div className="stat-card">
                  <span>Absent</span>
                  <strong>
                    {summary.absent_days}
                  </strong>
                </div>

                <div className="stat-card">
                  <span>Leave</span>
                  <strong>
                    {summary.leave_days}
                  </strong>
                </div>

                <div className="stat-card">
                  <span>Half Days</span>
                  <strong>
                    {summary.half_days}
                  </strong>
                </div>

                <div className="stat-card">
                  <span>LOP</span>
                  <strong>
                    {summary.lop_days}
                  </strong>
                </div>

                <div className="stat-card">
                  <span>Overtime</span>
                  <strong>
                    {summary.overtime_hours} hrs
                  </strong>
                </div>

              </div>

            </div>
          )}

          {/* ATTENDANCE PAGE */}
          {activePage === "attendance" && (
            <div>
              <h1>Attendance</h1>

              <AttendanceCard
                attendance={attendance}
                onCheckIn={handleCheckIn}
                onCheckOut={handleCheckOut}
                loading={loading}
              />
            </div>
          )}

          {/* MONTHLY ATTENDANCE PAGE */}
          {activePage === "monthly" && (
            <div>
              <h1>Monthly Attendance</h1>

              <h2 className="section-title">
                This Month
              </h2>

              <div className="stats-grid">

                <div className="stat-card">
                  <span>Present</span>
                  <strong>{summary.present_days}</strong>
                </div>

                <div className="stat-card">
                  <span>Absent</span>
                  <strong>{summary.absent_days}</strong>
                </div>

                <div className="stat-card">
                  <span>Leave</span>
                  <strong>{summary.leave_days}</strong>
                </div>

                <div className="stat-card">
                  <span>Half Days</span>
                  <strong>{summary.half_days}</strong>
                </div>

                <div className="stat-card">
                  <span>LOP</span>
                  <strong>{summary.lop_days}</strong>
                </div>

                <div className="stat-card">
                  <span>Overtime</span>
                  <strong>
                    {summary.overtime_hours} hrs
                  </strong>
                </div>

              </div>
            </div>
          )}

          {/* PAYSLIP PAGE */}
          {activePage === "payslip" && (
            <div>
              <h1>Payslips</h1>

              <p>
                View your salary and payslip records.
              </p>

              {/* Put your existing Payslip component here */}
            </div>
          )}

          {/* PROFILE PAGE */}
          {activePage === "profile" && (
            <div>
              <h1>My Profile</h1>

              <div className="profile-card">
                <p>
                  <strong>Name:</strong> {employeeName}
                </p>

                <p>
                  <strong>Employee ID:</strong> {employeeId}
                </p>
              </div>
            </div>
          )}

        </main>

      </div>

    </div>
  );
}
export default EmployeeDashboard;