import React from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  LayoutDashboard,
  Clock3,
  CalendarDays,
  FileText,
  AlertTriangle,
  CalendarCheck,
  ClipboardList,
  WalletCards,
  UserRound,
  LogOut,
} from "lucide-react";

import { supabase } from "../../../lib/supabaseClient";
import logo from "../../../assets/Logo.jpeg";

const EmployeeSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menu = [
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/employee-portal",
    },

    // =====================================================
    // ATTENDANCE
    // =====================================================
    {
      id: "attendance",
      icon: Clock3,
      label: "Attendance",
      path: "/employee-portal/attendance",
    },
    {
      id: "monthly",
      icon: CalendarDays,
      label: "Monthly Attendance",
      path: "/employee-portal/monthly",
    },

    // =====================================================
    // LEAVE
    // =====================================================
    {
      id: "leave",
      icon: FileText,
      label: "Leave",
      path: "/employee-portal/leave",
    },

    // =====================================================
    // ATTENDANCE RECTIFICATION
    // =====================================================
    {
      id: "rectification",
      icon: AlertTriangle,
      label: "Rectification Requests",
      path: "/employee-portal/rectification",
    },

    // =====================================================
    // HOLIDAY CALENDAR
    // =====================================================
    {
      id: "holidays",
      icon: CalendarCheck,
      label: "Holiday Calendar",
      path: "/employee-portal/holidays",
    },

    // =====================================================
    // MY ROSTER
    // =====================================================
    {
      id: "roster",
      icon: ClipboardList,
      label: "My Roster",
      path: "/employee-portal/roster",
    },

    // =====================================================
    // PAYROLL
    // =====================================================
    {
      id: "payslip",
      icon: WalletCards,
      label: "Payslips",
      path: "/employee-portal/payslips",
    },

    // =====================================================
    // PROFILE
    // =====================================================
    {
      id: "profile",
      icon: UserRound,
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

      {/* =====================================================
          LOGO
      ===================================================== */}
      <div className="sidebar-logo">

        <div className="logo-box">
          <img
            src={logo}
            alt="Talent Corner"
            className="employee-sidebar-logo"
          />
        </div>

        <div className="logo-text">
          <strong>Talent Corner</strong>
          <span>Employee Portal</span>
        </div>

      </div>

      {/* =====================================================
          MENU
      ===================================================== */}
      <nav className="sidebar-nav">

        {menu.map((item) => {
          const Icon = item.icon;

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
              <Icon
                size={19}
                strokeWidth={2}
                className="sidebar-icon"
              />

              <span className="sidebar-label">
                {item.label}
              </span>
            </button>
          );
        })}

      </nav>

      {/* =====================================================
          LOGOUT
      ===================================================== */}
      <button
        type="button"
        className="logout-button"
        onClick={logout}
      >
        <LogOut
          size={19}
          strokeWidth={2}
        />

        <span>Logout</span>
      </button>

    </aside>
  );
};

export default EmployeeSidebar;