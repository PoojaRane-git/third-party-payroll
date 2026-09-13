import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";

import {
  Home,
  Users,
  Wallet,
  CreditCard,
  DollarSign,
  FileText,
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
  X,
  Menu,
} from "lucide-react";

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  // =========================================================
  // STATE
  // =========================================================

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] =
    useState(false);

  const [showOptionsDropdown, setShowOptionsDropdown] =
    useState(false);

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
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  // =========================================================
  // CLOSE MOBILE SIDEBAR WHEN ROUTE CHANGES
  // =========================================================

  useEffect(() => {
    setMobileSidebarOpen(false);
    setShowOptionsDropdown(false);
  }, [currentPath]);

  // =========================================================
  // PREVENT BODY SCROLL WHEN MOBILE SIDEBAR IS OPEN
  // =========================================================

  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileSidebarOpen]);

  // =========================================================
  // RECRUITMENT & STAFF
  // =========================================================

  const mainNavigation = [
    {
      id: "admindashboard",
      name: "Home",
      icon: Home,
      path: "/admindashboard",
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
      path: "/admin-job-requirements",
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
    },
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
  // NAVIGATION
  // =========================================================

  const handleNavigation = (path) => {
    navigate(path);

    setMobileSidebarOpen(false);
    setShowOptionsDropdown(false);
  };

  // =========================================================
// LOGOUT
// =========================================================

const handleLogout = async () => {
  try {
    console.log("Logging out...");

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Supabase logout error:", error);
      throw error;
    }

    // Clear old locally stored authentication data
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");

    // Close sidebar/dropdown
    setMobileSidebarOpen(false);
    setShowOptionsDropdown(false);

    console.log("Logout successful");

    // SUCCESS ALERT
    alert("You have been logged out successfully.");

    // Redirect to login
    navigate("/login", {
      replace: true,
    });

  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    alert(
      `Unable to logout. ${
        error?.message || "Please try again."
      }`
    );
  }
};
  // =========================================================
  // CLOSE MOBILE SIDEBAR
  // =========================================================

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
    setShowOptionsDropdown(false);
  };

  // =========================================================
  // TOGGLE DESKTOP SIDEBAR
  // =========================================================

  const toggleDesktopSidebar = () => {
    setDesktopSidebarCollapsed((prev) => !prev);

    setShowOptionsDropdown(false);
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
        onClick={() => handleNavigation(item.path)}
        title={
          desktopSidebarCollapsed
            ? item.name
            : undefined
        }
        className={`
          w-full
          flex
          items-center
          rounded-xl
          text-xs
          font-semibold
          transition

          ${
            desktopSidebarCollapsed
              ? "justify-center px-2 py-3"
              : "space-x-3 px-3 py-2.5"
          }

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

        {!desktopSidebarCollapsed && (
          <span className="truncate">
            {item.name}
          </span>
        )}
      </button>
    );
  };

  // =========================================================
  // SIDEBAR
  // =========================================================

  return (
    <>
      {/* =====================================================
          MOBILE OPEN BUTTON
          ===================================================== */}

      {!mobileSidebarOpen && (
        <button
          type="button"
          onClick={() =>
            setMobileSidebarOpen(true)
          }
          aria-label="Open sidebar"
          title="Open sidebar"
          className="
            fixed
            top-4
            left-4
            z-[70]

            md:hidden

            w-10
            h-10

            flex
            items-center
            justify-center

            rounded-xl

            bg-[#141a2e]
            border
            border-slate-700

            text-slate-200

            shadow-xl

            hover:bg-slate-800

            transition
          "
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* =====================================================
          MOBILE OVERLAY
          ===================================================== */}

      {mobileSidebarOpen && (
        <div
          className="
            fixed
            inset-0
            z-[50]

            bg-black/60
            backdrop-blur-[1px]

            md:hidden
          "
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* =====================================================
          SIDEBAR
          ===================================================== */}

      <aside
        className={`
          fixed
          md:sticky

          top-0
          left-0

          z-[60]

          ${
            desktopSidebarCollapsed
              ? "md:w-20"
              : "md:w-72"
          }

          w-72
          max-w-[85vw]

          bg-[#0e1322]

          border-r
          border-slate-800/60

          p-4

          flex
          flex-col
          justify-between

          h-screen

          overflow-y-auto

          select-none
          shrink-0

          transition-all
          duration-300
          ease-in-out

          ${
            mobileSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }

          md:translate-x-0
        `}
      >
        <div>
          {/* =================================================
              HEADER
              ================================================= */}

          <div
            className={`
              flex
              items-center

              ${
                desktopSidebarCollapsed
                  ? "justify-center"
                  : "justify-between"
              }

              px-1
              mb-5
              relative
            `}
            ref={dropdownRef}
          >
            {/* BRAND */}

            <div
              className={`
                flex
                items-center

                ${
                  desktopSidebarCollapsed
                    ? "justify-center"
                    : "space-x-2.5"
                }

                min-w-0
              `}
            >
              <div
                className="
                  bg-indigo-600
                  text-white

                  font-black

                  px-2.5
                  py-1.5

                  rounded-xl

                  text-xs

                  tracking-wider

                  shadow-lg
                  shadow-indigo-500/20

                  shrink-0
                "
              >
                TP
              </div>

              {!desktopSidebarCollapsed && (
                <span
                  className="
                    hidden
                    md:block

                    font-bold
                    text-slate-100

                    text-base

                    tracking-tight

                    truncate
                  "
                >
                  Third Party Payroll
                </span>
              )}

              {mobileSidebarOpen && (
                <span
                  className="
                    md:hidden

                    font-bold
                    text-slate-100

                    text-base

                    tracking-tight

                    truncate
                  "
                >
                  Third Party Payroll
                </span>
              )}
            </div>

            {/* =================================================
                DESKTOP SIDEBAR TOGGLE
                ================================================= */}

            <button
              type="button"
              onClick={toggleDesktopSidebar}
              aria-label={
                desktopSidebarCollapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              title={
                desktopSidebarCollapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              className={`
                hidden
                md:flex

                items-center
                justify-center

                w-8
                h-8

                rounded-xl

                text-slate-400

                hover:text-white
                hover:bg-slate-800

                transition

                ${
                  desktopSidebarCollapsed
                    ? "absolute -right-1 top-0"
                    : ""
                }
              `}
            >
              {desktopSidebarCollapsed ? (
                <Menu className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </button>

            {/* =================================================
                MOBILE CLOSE BUTTON
                ================================================= */}

            <button
              type="button"
              onClick={closeMobileSidebar}
              aria-label="Close sidebar"
              title="Close sidebar"
              className="
                md:hidden

                flex
                items-center
                justify-center

                w-9
                h-9

                rounded-xl

                text-slate-400

                hover:text-white
                hover:bg-slate-800

                transition

                shrink-0
              "
            >
              <X className="h-5 w-5" />
            </button>

            {/* =================================================
                OPTIONS DROPDOWN
                ================================================= */}

            {showOptionsDropdown && (
              <div
                className="
                  absolute

                  left-0
                  top-10

                  w-48

                  bg-[#141a2e]

                  border
                  border-slate-800

                  rounded-xl

                  shadow-xl

                  py-1.5

                  z-50
                "
              >
                <button
                  type="button"
                  onClick={() =>
                    setShowOptionsDropdown(false)
                  }
                  className="
                    w-full

                    flex
                    items-center

                    space-x-2.5

                    px-3.5
                    py-2

                    text-xs
                    font-medium

                    text-slate-300

                    hover:bg-slate-800/60

                    transition
                  "
                >
                  <Settings className="h-4 w-4 text-slate-400" />

                  <span>
                    Preferences
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowOptionsDropdown(false)
                  }
                  className="
                    w-full

                    flex
                    items-center

                    space-x-2.5

                    px-3.5
                    py-2

                    text-xs
                    font-medium

                    text-slate-300

                    hover:bg-slate-800/60

                    transition
                  "
                >
                  <ShieldAlert className="h-4 w-4 text-slate-400" />

                  <span>
                    Audit Logs
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowOptionsDropdown(false)
                  }
                  className="
                    w-full

                    flex
                    items-center

                    space-x-2.5

                    px-3.5
                    py-2

                    text-xs
                    font-medium

                    text-slate-300

                    hover:bg-slate-800/60

                    transition
                  "
                >
                  <HelpCircle className="h-4 w-4 text-slate-400" />

                  <span>
                    Help & Support
                  </span>
                </button>

                <div className="my-1 border-t border-slate-800" />

                {/* DROPDOWN LOGOUT */}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="
                    w-full

                    flex
                    items-center

                    space-x-2.5

                    px-3.5
                    py-2

                    text-xs
                    font-medium

                    text-rose-400

                    hover:bg-rose-950/40

                    transition
                  "
                >
                  <LogOut className="h-4 w-4 text-rose-400" />

                  <span>
                    Log out
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* =================================================
              COMPANY
              ================================================= */}

          <div
            className={`
              bg-[#141a2e]

              border
              border-slate-800/80

              rounded-xl

              p-2.5
              mb-3

              shadow-sm

              ${
                desktopSidebarCollapsed
                  ? "md:flex md:justify-center"
                  : ""
              }
            `}
          >
            <div
              className={`
                flex
                items-center

                ${
                  desktopSidebarCollapsed
                    ? "md:justify-center"
                    : "justify-between"
                }

                text-xs
                font-semibold
                text-slate-200
              `}
            >
              <div
                className={`
                  flex
                  items-center

                  ${
                    desktopSidebarCollapsed
                      ? "md:justify-center"
                      : "space-x-2"
                  }

                  truncate
                `}
              >
                <span
                  className="
                    w-5
                    h-5

                    bg-indigo-500/10
                    text-indigo-400

                    border
                    border-indigo-500/20

                    rounded

                    flex
                    items-center
                    justify-center

                    text-xs

                    shrink-0
                  "
                >
                  🏢
                </span>

                {!desktopSidebarCollapsed && (
                  <span className="truncate">
                    Talent Corner HR
                  </span>
                )}
              </div>

              {!desktopSidebarCollapsed && (
                <ChevronDown
                  className="
                    h-4
                    w-4

                    text-slate-400

                    flex-shrink-0
                  "
                />
              )}
            </div>
          </div>

          {/* =================================================
              ADD COMPANY
              ================================================= */}

          <button
            type="button"
            title={
              desktopSidebarCollapsed
                ? "Add New Company"
                : undefined
            }
            className={`
              w-full

              mb-6

              py-2
              px-3

              bg-[#141a2e]

              border
              border-slate-800/80

              hover:bg-slate-800

              text-slate-300

              rounded-xl

              text-xs

              font-semibold

              flex
              items-center
              justify-center

              shadow-sm

              transition

              ${
                desktopSidebarCollapsed
                  ? "md:px-0"
                  : "space-x-1.5"
              }
            `}
          >
            <Plus className="h-3.5 w-3.5 text-slate-400" />

            {!desktopSidebarCollapsed && (
              <span>
                Add New Company
              </span>
            )}
          </button>

          {/* =================================================
              RECRUITMENT & STAFF
              ================================================= */}

          {!desktopSidebarCollapsed && (
            <div
              className="
                mb-2
                px-3

                flex
                items-center
                justify-between

                text-[10px]

                font-bold

                uppercase

                tracking-wider

                text-slate-400
              "
            >
              <span>
                Recruitment & Staff
              </span>
            </div>
          )}

          {desktopSidebarCollapsed && (
            <div
              className="
                hidden
                md:block

                border-t
                border-slate-800/60

                mb-2
              "
            />
          )}

          <nav className="space-y-1 mb-6">
            {mainNavigation.map(
              renderNavigationItem
            )}
          </nav>

          {/* =================================================
              OPERATIONS & FINANCE
              ================================================= */}

          {!desktopSidebarCollapsed && (
            <div
              className="
                mb-2
                px-3

                flex
                items-center
                justify-between

                text-[10px]

                font-bold

                uppercase

                tracking-wider

                text-slate-400
              "
            >
              <span>
                Operations & Finance
              </span>
            </div>
          )}

          {desktopSidebarCollapsed && (
            <div
              className="
                hidden
                md:block

                border-t
                border-slate-800/60

                mb-2
              "
            />
          )}

          <nav className="space-y-1 mb-6">
            {operationalNavigation.map(
              renderNavigationItem
            )}
          </nav>
        </div>

        {/* ===================================================
            ADMIN PROFILE
            =================================================== */}

        <div
          className="
            pt-4

            border-t
            border-slate-800/60

            mt-auto
          "
        >
          {/* ADMIN INFO */}

          <div
            className={`
              flex
              items-center

              ${
                desktopSidebarCollapsed
                  ? "md:justify-center"
                  : "justify-between"
              }

              px-2
              py-2
            `}
          >
            <div
              className={`
                flex
                items-center

                ${
                  desktopSidebarCollapsed
                    ? "md:justify-center"
                    : "space-x-2.5"
                }

                min-w-0
              `}
            >
              {/* AVATAR */}

              <div
                className="
                  w-8
                  h-8

                  bg-indigo-600/20

                  border
                  border-indigo-500/30

                  rounded-full

                  flex
                  items-center
                  justify-center

                  font-bold
                  text-indigo-400
                  text-xs

                  shrink-0
                "
              >
                JA
              </div>

              {/* ADMIN NAME */}

              {!desktopSidebarCollapsed && (
                <div className="min-w-0">
                  <p
                    className="
                      text-xs
                      font-bold
                      text-slate-100
                      leading-none
                      truncate
                    "
                  >
                    John Abraham
                  </p>

                  <p
                    className="
                      text-[10px]
                      text-slate-400
                      mt-1
                      truncate
                    "
                  >
                    Admin Account
                  </p>
                </div>
              )}
            </div>

            {/* ARROW */}

            {!desktopSidebarCollapsed && (
              <ChevronDown
                className="
                  h-3.5
                  w-3.5

                  text-slate-400

                  shrink-0
                "
              />
            )}
          </div>

          {/* =================================================
              LOGOUT
              ================================================= */}

          {!desktopSidebarCollapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="
                w-full

                mt-1

                flex
                items-center
                space-x-2.5

                px-3
                py-2.5

                rounded-xl

                text-xs
                font-semibold

                text-rose-400

                hover:bg-rose-950/40
                hover:text-rose-300

                transition
              "
            >
              <LogOut
                className="
                  h-4
                  w-4
                  shrink-0
                "
              />

              <span>
                Logout
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;