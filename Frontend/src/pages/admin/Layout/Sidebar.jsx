import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import {
  Home,
  Users,
  Wallet,
  CreditCard,
  DollarSign,
  FileText,
  Briefcase,
  ClipboardList,
  Settings,
  LogOut,
  HelpCircle,
  ShieldAlert,
  UserPlus,
  ChevronDown,
  Plus,
  FolderKanban,
  UserCheck,
  UserX,
} from "lucide-react";

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);

  const dropdownRef = useRef(null);

  // =========================================================
  // CLOSE DROPDOWN WHEN CLICKING OUTSIDE
  // =========================================================

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowOptionsDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // =========================================================
  // RECRUITMENT & STAFF
  // =========================================================

  const mainNavigation = [
    {
      id: "admindashboard",
      name: "Home",
      icon: Home,
      path: "/",
    },

    {
      id: "clients",
      name: "People & Clients",
      icon: Users,
      path: "/clients",
    },

    {
      id: "requisitions",
      name: "Job Requisitions",
      icon: ClipboardList,
      path: "/job-requirements",
    },

    {
      id: "ats",
      name: "ATS Pipeline",
      icon: UserPlus,
      path: "/candidates",
    },

    {
      id: "employees",
      name: "Employees",
      icon: FolderKanban,
      path: "/employees",
    },

    // =======================================================
    // UNASSIGNED EMPLOYEES
    // =======================================================

    {
      id: "unassigned-employees",
      name: "Unassigned Employees",
      icon: UserX,
      path: "/unassigned",
    },

    {
      id: "add-employees",
      name: "Add New Employees",
      icon: UserPlus,
      path: "/addEmployee",
    }, ,



    {
      id: "billing",
      name: "Client Billing",
      icon: DollarSign,
      path: "/client-billing",
    },
  ];

  // =========================================================
  // OPERATIONS & FINANCE
  // =========================================================

  const operationalNavigation = [
    {
      id: "attendance",
      name: "Attendance & Approvals",
      icon: UserCheck,
      path: "/attendance",
    },

    {
      id: "payroll",
      name: "Payroll",
      icon: CreditCard,
      path: "/payroll",
    },

    {
      id: "reports",
      name: "Reports",
      icon: FileText,
      path: "/reports",
    },

    {
      id: "payment-confirmations",
      name: "Payment Confirmation",
      icon: Wallet,
      path: "/payment-confirmations",
    },

    // {
    //   id: "employee-deployments",
    //   name: "Employee Deployments",
    //   icon: Briefcase,
    //   path: "/employee-deployments",
    // },
  ];

  // =========================================================
  // ACTIVE ROUTE
  // =========================================================

  const isRouteActive = (path) => {
    if (path === "/") {
      return currentPath === "/";
    }

    return (
      currentPath === path ||
      currentPath.startsWith(`${path}/`)
    );
  };

  // =========================================================
  // NAVIGATION ITEM
  // =========================================================

  const renderNavigationItem = (item) => {
    const Icon = item.icon;

    const isActive = isRouteActive(item.path);

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.path)}
        className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${isActive
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

        <span className="truncate">
          {item.name}
        </span>
      </button>
    );
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <aside className="w-72 bg-[#0e1322] border-r border-slate-800/60 p-4 flex flex-col justify-between h-screen sticky top-0 overflow-y-auto select-none shrink-0">

      <div>

        {/* ===================================================
            HEADER
        =================================================== */}

        <div
          className="flex items-center justify-between px-2 mb-5 relative"
          ref={dropdownRef}
        >
          <div className="flex items-center space-x-2.5">
            <div className="bg-indigo-600 text-white font-black px-2.5 py-1.5 rounded-xl text-xs tracking-wider shadow-lg shadow-indigo-500/20">
              TP
            </div>

            <span className="font-bold text-slate-100 text-base tracking-tight">
              Third Party Payroll
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowOptionsDropdown((prev) => !prev)
            }
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 p-1.5 rounded-xl transition"
            title="Options Menu"
          >
            •••
          </button>

          {/* =================================================
              OPTIONS DROPDOWN
          ================================================= */}

          {showOptionsDropdown && (
            <div className="absolute left-0 top-10 w-48 bg-[#141a2e] border border-slate-800 rounded-xl shadow-xl py-1.5 z-50">

              <button
                type="button"
                onClick={() => setShowOptionsDropdown(false)}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60 transition"
              >
                <Settings className="h-4 w-4 text-slate-400" />
                <span>Preferences</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOptionsDropdown(false)}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60 transition"
              >
                <ShieldAlert className="h-4 w-4 text-slate-400" />
                <span>Audit Logs</span>
              </button>

              <button
                type="button"
                onClick={() => setShowOptionsDropdown(false)}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800/60 transition"
              >
                <HelpCircle className="h-4 w-4 text-slate-400" />
                <span>Help & Support</span>
              </button>

              <div className="my-1 border-t border-slate-800" />

              <button
                type="button"
                onClick={() => setShowOptionsDropdown(false)}
                className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 transition"
              >
                <LogOut className="h-4 w-4 text-rose-400" />
                <span>Log out</span>
              </button>

            </div>
          )}
        </div>

        {/* ===================================================
            COMPANY
        =================================================== */}

        <div className="bg-[#141a2e] border border-slate-800/80 rounded-xl p-2.5 mb-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-200">

            <div className="flex items-center space-x-2 truncate">

              <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded flex items-center justify-center text-xs">
                🏢
              </span>

              <span className="truncate">
                Talent Corner HR
              </span>

            </div>

            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />

          </div>
        </div>

        {/* ===================================================
            ADD COMPANY
        =================================================== */}

        <button
          type="button"
          className="w-full mb-6 py-2 px-3 bg-[#141a2e] border border-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-sm transition"
        >
          <Plus className="h-3.5 w-3.5 text-slate-400" />
          <span>Add New Company</span>
        </button>

        {/* ===================================================
            RECRUITMENT & STAFF
        =================================================== */}

        <div className="mb-2 px-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Recruitment & Staff</span>
        </div>

        <nav className="space-y-1 mb-6">
          {mainNavigation.map(renderNavigationItem)}
        </nav>

        {/* ===================================================
            OPERATIONS & FINANCE
        =================================================== */}

        <div className="mb-2 px-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Operations & Finance</span>
        </div>

        <nav className="space-y-1 mb-6">
          {operationalNavigation.map(renderNavigationItem)}
        </nav>

      </div>

      {/* =====================================================
          ADMIN PROFILE
      ===================================================== */}

      <div className="pt-4 border-t border-slate-800/60 mt-auto">

        <div className="flex items-center justify-between px-2 py-1">

          <div className="flex items-center space-x-2.5">

            <div className="w-7 h-7 bg-indigo-600/20 border border-indigo-500/30 rounded-full overflow-hidden flex items-center justify-center font-bold text-indigo-400 text-xs">
              JA
            </div>

            <div>

              <p className="text-xs font-bold text-slate-100 leading-none">
                John Abraham
              </p>

              <p className="text-[10px] text-slate-400 mt-0.5">
                Admin Account
              </p>

            </div>

          </div>

          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />

        </div>

      </div>

    </aside>
  );
}

export default Sidebar;