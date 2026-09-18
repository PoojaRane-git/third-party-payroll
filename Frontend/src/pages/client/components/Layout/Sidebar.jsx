import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  SendHorizontal,
  UserPlus,
  ClipboardCheck,
  FileWarning,
  CalendarDays,
  Users,
  Wallet,
  LogOut,
} from "lucide-react";

import logo from "../../../../assets/Logo.jpeg";

function Sidebar({ clientName, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navigationGroups = [
    {
      groupLabel: "Dashboard",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          path: "/client-dashboard",
          icon: LayoutDashboard,
        },
      ],
    },

    {
      groupLabel: "Recruitment",
      items: [
        {
          id: "requirements",
          label: "Requirements",
          path: "/client-dashboard/requirements",
          icon: SendHorizontal,
        },
        {
          id: "candidates",
          label: "Candidates",
          path: "/client-dashboard/candidates",
          icon: UserPlus,
        },
      ],
    },

    {
      groupLabel: "Workforce",
      items: [
        {
          id: "attendance",
          label: "Attendance",
          path: "/client-dashboard/attendance",
          icon: ClipboardCheck,
        },
        {
          id: "attendance-rectifications",
          label: "Rectification Requests",
          path: "/client/attendance-rectifications",
          icon: FileWarning,
        },
        {
          id: "leave",
          label: "Leave Requests",
          path: "/client/leave",
          icon: CalendarDays,
        },
        {
          id: "holiday-calendar",
          label: "Holiday Calendar",
          path: "/client/holiday-calendar",
          icon: CalendarDays,
        },
        {
          id: "roster",
          label: "Roster",
          path: "/client/roster",
          icon: Users,
        },
      ],
    },

    {
      groupLabel: "Finance",
      items: [
        {
          id: "invoices",
          label: "Invoices",
          path: "/client-dashboard/invoices",
          icon: Wallet,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#0e1322] text-slate-300 flex flex-col min-h-screen border-r border-slate-800/60 shadow-xl select-none shrink-0">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="p-6 border-b border-slate-800/60 flex items-center justify-between bg-[#0b0f19]">

        <div className="flex items-center gap-3 min-w-0">

          {/* LOGO */}

          <img
            src={logo}
            alt="Talent Corner"
            className="
              w-10
              h-10
              object-contain
              shrink-0
            "
          />

          {/* BRAND + CLIENT */}

          <div className="min-w-0">

            <span className="font-bold text-white text-xs tracking-tight block">
              Talent Corner
            </span>

            <span className="text-[11px] text-indigo-400 font-medium block truncate max-w-[130px]">
              {clientName || "Client"}
            </span>

          </div>

        </div>

        {/* LOGOUT */}

        <button
          type="button"
          onClick={onLogout}
          title="Sign Out"
          className="
            text-slate-400
            hover:text-red-400
            p-1.5
            rounded-lg
            hover:bg-slate-800
            transition
            shrink-0
          "
        >
          <LogOut className="h-4 w-4" />
        </button>

      </div>

      {/* =====================================================
          NAVIGATION
          ===================================================== */}

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">

        {navigationGroups.map((group) => (
          <div
            key={group.groupLabel}
            className="space-y-1"
          >

            {/* GROUP LABEL */}

            <span
              className="
                text-[10px]
                font-extrabold
                text-slate-400
                uppercase
                tracking-wider
                px-3.5
                block
                pb-1
              "
            >
              {group.groupLabel}
            </span>

            {/* GROUP ITEMS */}

            {group.items.map((item) => {
              const Icon = item.icon;

              /*
               * Exact match for Dashboard.
               * Attendance remains highlighted inside
               * the Attendance section.
               */

              const isActive =
                location.pathname === item.path ||
                (
                  item.id === "attendance" &&
                  location.pathname.startsWith(
                    "/client-dashboard/attendance"
                  ) &&
                  location.pathname !==
                    "/client-dashboard/attendance/rectifications"
                );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`
                    w-full
                    flex
                    items-center
                    gap-3
                    px-3.5
                    py-2.5
                    rounded-xl
                    text-xs
                    font-semibold
                    transition-all

                    ${
                      isActive
                        ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-inner"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }
                  `}
                >

                  <Icon
                    className={`
                      h-4
                      w-4
                      shrink-0

                      ${
                        isActive
                          ? "text-indigo-400"
                          : "text-slate-400"
                      }
                    `}
                  />

                  <span className="truncate">
                    {item.label}
                  </span>

                </button>
              );
            })}

          </div>
        ))}

      </nav>

      {/* =====================================================
          SECURITY FOOTER
          ===================================================== */}

      <div
        className="
          p-4
          m-3
          rounded-2xl
          bg-[#141a2e]
          border
          border-slate-800/80
          text-center
        "
      >

        <p
          className="
            text-[10px]
            font-bold
            text-slate-400
            uppercase
            tracking-wider
          "
        >
          SECURED CLIENT GATEWAY
        </p>

        <p
          className="
            text-[10px]
            text-indigo-400
            font-semibold
            mt-0.5
          "
        >
          Active Workspace
        </p>

      </div>

    </aside>
  );
}

export default Sidebar;