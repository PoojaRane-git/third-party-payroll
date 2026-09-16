
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
  Settings2,
  HandCoins,
  Wallet,
  LogOut,
} from "lucide-react";

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

      {/* Header */}
      <div className="p-6 border-b border-slate-800/60 flex items-center justify-between bg-[#0b0f19]">
        <div className="flex items-center gap-3">

          <div className="bg-indigo-600 text-white font-black px-2.5 py-1.5 rounded-xl text-xs tracking-wider shadow-lg shadow-indigo-500/20">
            TC
          </div>

          <div>
            <span className="font-bold text-white text-xs tracking-tight block">
              Talent Corner
            </span>

            <span className="text-[11px] text-indigo-400 font-medium block truncate max-w-[130px]">
              {clientName || "Client"}
            </span>
          </div>

        </div>

        <button
          onClick={onLogout}
          title="Sign Out"
          className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">

        {navigationGroups.map((group) => (
          <div key={group.groupLabel} className="space-y-1">

            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3.5 block pb-1">
              {group.groupLabel}
            </span>

            {group.items.map((item) => {
              const Icon = item.icon;

              /*
               * Exact match for Dashboard.
               * For child pages, keep Attendance highlighted
               * when the user is inside the Attendance section.
               */
              const isActive =
                location.pathname === item.path ||
                (item.id === "attendance" &&
                  location.pathname.startsWith("/client-dashboard/attendance") &&
                  location.pathname !==
                  "/client-dashboard/attendance/rectifications");

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                      ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-inner"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                    }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isActive
                        ? "text-indigo-400"
                        : "text-slate-400"
                      }`}
                  />

                  {item.label}
                </button>
              );
            })}
          </div>
        ))}

      </nav>

      {/* Security Footer */}
      <div className="p-4 m-3 rounded-2xl bg-[#141a2e] border border-slate-800/80 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          SECURED CLIENT GATEWAY
        </p>

        <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">
          Active Workspace
        </p>
      </div>

    </aside>
  );
}

export default Sidebar;
