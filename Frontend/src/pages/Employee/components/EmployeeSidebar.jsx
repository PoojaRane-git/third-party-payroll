
import React from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import { supabase } from "../../../lib/supabaseClient";

const EmployeeSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    {
      id: "dashboard",
      icon: "🏠",
      label: "Dashboard",
      path: "/employee-portal",
    },

    // =====================================================
    // ATTENDANCE
    // =====================================================
    {
      id: "attendance",
      icon: "🕐",
      label: "Attendance",
      path: "/employee-portal/attendance",
    },
    {
      id: "monthly",
      icon: "📅",
      label: "Monthly Attendance",
      path: "/employee-portal/monthly",
    },

    // =====================================================
    // NEW - LEAVE
    // =====================================================
    {
      id: "leave",
      icon: "📝",
      label: "Leave",
      path: "/employee-portal/leave",
    },

    // =====================================================
    // NEW - ATTENDANCE RECTIFICATION
    // =====================================================
    {
      id: "rectification",
      icon: "⚠️",
      label: "Rectification Requests",
      path: "/employee-portal/rectification",
    },

    // =====================================================
    // NEW - HOLIDAY CALENDAR
    // =====================================================
    {
      id: "holidays",
      icon: "🎉",
      label: "Holiday Calendar",
      path: "/employee-portal/holidays",
    },

    // =====================================================
    // NEW - MY ROSTER
    // =====================================================
    {
      id: "roster",
      icon: "🗓️",
      label: "My Roster",
      path: "/employee-portal/roster",
    },

    // =====================================================
    // PAYROLL
    // =====================================================
    {
      id: "payslip",
      icon: "💰",
      label: "Payslips",
      path: "/employee-portal/payslips",
    },

    // =====================================================
    // PROFILE
    // =====================================================
    {
      id: "profile",
      icon: "👤",
      label: "My Profile",
      path: "/employee-portal/profile",
    },
  ];

  const logout = async () => {
    try {
      // Logout from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Remove old sessionStorage values if they exist
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("employee_id");
      sessionStorage.removeItem("employee_name");
      sessionStorage.removeItem("employee_email");
      sessionStorage.removeItem("deployment_id");
      sessionStorage.removeItem("client_id");
      sessionStorage.removeItem("user_role");

      // Redirect to login
      navigate("/login", { replace: true });
    }
  };

  return (
    <aside className="employee-sidebar">

      {/* LOGO */}
      <div className="sidebar-logo">

        <div className="logo-box">
          TC
        </div>

        <div>
          <strong>Talent Corner</strong>
          <span>Employee Portal</span>
        </div>

      </div>

      {/* MENU */}
      <nav>

        {menu.map((item) => {

          const isActive =
            item.id === "dashboard"
              ? location.pathname === "/employee-portal"
              : location.pathname === item.path;

          return (
            <button
              key={item.id}
              type="button"
              className={
                isActive
                  ? "sidebar-item active"
                  : "sidebar-item"
              }
              onClick={() => navigate(item.path)}
            >
              <span>{item.icon}</span>

              <span>
                {item.label}
              </span>
            </button>
          );
        })}

      </nav>

      {/* LOGOUT */}
      <button
        type="button"
        className="logout-button"
        onClick={logout}
      >
        🚪 Logout
      </button>

    </aside>
  );
};

export default EmployeeSidebar;

