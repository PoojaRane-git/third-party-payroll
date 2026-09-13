import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Layout/Sidebar";

import {
    Search,
    ArrowUpRight,
    ChevronDown,
    Loader2,
    Users,
    Building2,
    CheckCircle2,
    Bell,
    XCircle,
    ShieldCheck,
    Clock3,
    RefreshCw,
    UserCheck,
} from "lucide-react";

import api, { API_BASE } from "../services/api";

console.log("API_BASE:", API_BASE);
console.log(
    "Attendance URL:",
    `${API_BASE}/third-party-attendance`
);

export default function AdminDashboard() {
    const navigate = useNavigate();

    // ============================================================
    // BASIC STATE
    // ============================================================

    const activeTab = "clients";

    const [selectedTenant, setSelectedTenant] =
        useState("");

    const [searchQuery, setSearchQuery] =
        useState("");

    const [loading, setLoading] =
        useState(true);

    const [tenants, setTenants] =
        useState([]);

    const [clientsList, setClientsList] =
        useState([]);

    const [error, setError] =
        useState("");

    // ============================================================
    // APPROVAL NOTIFICATIONS
    // ============================================================

    const [approvalRequests, setApprovalRequests] =
        useState([]);

    const [approvalLoading, setApprovalLoading] =
        useState(false);

    const [approvalActionId, setApprovalActionId] =
        useState(null);

    const [approvalError, setApprovalError] =
        useState("");

    const [showNotifications, setShowNotifications] =
        useState(false);

    // ============================================================
    // INITIAL LOAD
    // ============================================================

    useEffect(() => {
        fetchInitialData();
        fetchActiveClientTenants();
        fetchApprovalRequests();
    }, []);

    // ============================================================
    // FETCH CLIENT REGISTRY
    // GET /clients
    // ============================================================

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            setError("");

            const response =
                await api.get("/clients");

            const result =
                response.data;

            console.log(
                "Client registry response:",
                result
            );

            if (
                result?.success === false
            ) {
                throw new Error(
                    result.message ||
                        "Failed to load clients."
                );
            }

            let clientsArray = [];

            if (
                Array.isArray(result)
            ) {
                clientsArray = result;

            } else if (
                Array.isArray(result?.data)
            ) {
                clientsArray = result.data;

            } else if (
                Array.isArray(result?.clients)
            ) {
                clientsArray = result.clients;
            }

            setClientsList(
                clientsArray
            );

        } catch (err) {
            console.error(
                "Error loading clients:",
                err
            );

            setError(
                err.response?.data?.message ||
                    err.message ||
                    "Unable to load clients."
            );

            setClientsList([]);

        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // FETCH ACTIVE CLIENT TENANTS
    // GET /admin/active-tenants
    // ============================================================

    const fetchActiveClientTenants =
        async () => {
            try {
                const response =
                    await api.get(
                        "/admin/active-tenants"
                    );

                const result =
                    response.data;

                console.log(
                    "Active client tenants response:",
                    result
                );

                if (
                    result?.success === false
                ) {
                    throw new Error(
                        result.message ||
                            "Unable to load active client tenants."
                    );
                }

                let tenantArray = [];

                if (
                    Array.isArray(result)
                ) {
                    tenantArray = result;

                } else if (
                    Array.isArray(
                        result?.data
                    )
                ) {
                    tenantArray =
                        result.data;

                } else if (
                    Array.isArray(
                        result?.clients
                    )
                ) {
                    tenantArray =
                        result.clients;
                }

                setTenants(
                    tenantArray
                );

                // Keep selected tenant if it still exists
                const selectedStillExists =
                    tenantArray.some(
                        (tenant) =>
                            tenant.company_name ===
                            selectedTenant
                    );

                if (
                    selectedStillExists
                ) {
                    return;
                }

                // Select first approved client
                if (
                    tenantArray.length >
                        0 &&
                    tenantArray[0]
                        ?.company_name
                ) {
                    setSelectedTenant(
                        tenantArray[0]
                            .company_name
                    );
                } else {
                    setSelectedTenant(
                        ""
                    );
                }

            } catch (err) {
                console.error(
                    "Error loading active client tenants:",
                    err
                );

                setTenants([]);
                setSelectedTenant("");
            }
        };

    // ============================================================
    // FETCH ALL APPROVAL REQUESTS
    //
    // ADMIN    -> /pending-admins
    // CLIENT   -> /pending-clients
    // EMPLOYEE -> /pending-employees
    // ============================================================

    const fetchApprovalRequests =
        async () => {
            try {
                setApprovalLoading(
                    true
                );

                setApprovalError("");

                // =================================================
                // FETCH SEPARATELY
                // =================================================

                const [
                    adminResponse,
                    clientResponse,
                    employeeResponse,
                ] = await Promise.all([
                    api.get(
                        "/admin/pending-admins"
                    ),

                    api.get(
                        "/admin/pending-clients"
                    ),

                    api.get(
                        "/admin/pending-employees"
                    ),
                ]);

                // =================================================
                // READ RESPONSES
                // =================================================

                const adminResult =
                    adminResponse.data;

                const clientResult =
                    clientResponse.data;

                const employeeResult =
                    employeeResponse.data;

                console.log(
                    "Pending admins:",
                    adminResult
                );

                console.log(
                    "Pending clients:",
                    clientResult
                );

                console.log(
                    "Pending employees:",
                    employeeResult
                );

                // =================================================
                // ADMIN
                // =================================================

                const adminRequests =
                    adminResult?.success &&
                    Array.isArray(
                        adminResult.admins
                    )
                        ? adminResult.admins
                        : [];

                // =================================================
                // CLIENT
                // =================================================

                const clientRequests =
                    clientResult?.success &&
                    Array.isArray(
                        clientResult.clients
                    )
                        ? clientResult.clients
                        : [];

                // =================================================
                // EMPLOYEE
                // =================================================

                const employeeRequests =
                    employeeResult?.success &&
                    Array.isArray(
                        employeeResult.employees
                    )
                        ? employeeResult.employees
                        : [];

                // =================================================
                // COMBINE
                // =================================================

                const requests = [
                    ...adminRequests,
                    ...clientRequests,
                    ...employeeRequests,
                ].sort(
                    (a, b) =>
                        new Date(
                            b.created_at || 0
                        ) -
                        new Date(
                            a.created_at || 0
                        )
                );

                setApprovalRequests(
                    requests
                );

                // =================================================
                // CLIENT ERROR
                // =================================================

                if (
                    !clientResult?.success
                ) {
                    setApprovalError(
                        clientResult?.message ||
                            "Unable to fetch pending client requests."
                    );
                }

                // =================================================
                // NON-BLOCKING WARNINGS
                // =================================================

                if (
                    !adminResult?.success
                ) {
                    console.warn(
                        "Admin approval endpoint failed:",
                        adminResult?.message
                    );
                }

                if (
                    !employeeResult?.success
                ) {
                    console.warn(
                        "Employee approval endpoint failed:",
                        employeeResult?.message
                    );
                }

            } catch (err) {
                console.error(
                    "Approval request error:",
                    err
                );

                setApprovalError(
                    err.response?.data?.message ||
                        err.message ||
                        "Unable to load approval requests."
                );

                setApprovalRequests([]);

            } finally {
                setApprovalLoading(
                    false
                );
            }
        };

    // ============================================================
    // APPROVE REQUEST
    // ============================================================

    const handleApprove =
        async (request) => {
            try {
                const requestId =
                    request.id;

                const role =
                    String(
                        request.role || ""
                    ).toLowerCase();

                const actionId =
                    `${role}-${requestId}`;

                setApprovalActionId(
                    actionId
                );

                setApprovalError("");

                let endpoint = "";

                // ------------------------------------------------
                // ADMIN
                // ------------------------------------------------

                if (
                    role === "admin"
                ) {
                    endpoint =
                        `/admin/approve-admin/${requestId}`;
                }

                // ------------------------------------------------
                // CLIENT
                // ------------------------------------------------

                else if (
                    role === "client"
                ) {
                    endpoint =
                        `/admin/approve-client/${requestId}`;
                }

                // ------------------------------------------------
                // EMPLOYEE
                // ------------------------------------------------

                else if (
                    role === "employee"
                ) {
                    endpoint =
                        `/admin/approve-employee/${requestId}`;
                }

                else {
                    throw new Error(
                        `Unsupported approval role: ${role}`
                    );
                }

                // =================================================
                // API REQUEST
                // api.js automatically adds Supabase token
                // =================================================

                const response =
                    await api.patch(
                        endpoint
                    );

                const result =
                    response.data;

                if (
                    result?.success === false
                ) {
                    throw new Error(
                        result.message ||
                            `Unable to approve ${role}.`
                    );
                }

                // =================================================
                // REMOVE FROM NOTIFICATION LIST
                // =================================================

                setApprovalRequests(
                    (previous) =>
                        previous.filter(
                            (item) =>
                                !(
                                    String(
                                        item.id
                                    ) ===
                                        String(
                                            requestId
                                        ) &&
                                    String(
                                        item.role ||
                                            ""
                                    ).toLowerCase() ===
                                        role
                                )
                        )
                );

                // =================================================
                // REFRESH CLIENT DATA
                // =================================================

                if (
                    role === "client"
                ) {
                    await fetchActiveClientTenants();
                    await fetchInitialData();
                }

            } catch (err) {
                console.error(
                    "Approve request error:",
                    err
                );

                setApprovalError(
                    err.response?.data?.message ||
                        err.message ||
                        "Unable to approve request."
                );

            } finally {
                setApprovalActionId(
                    null
                );
            }
        };

    // ============================================================
    // REJECT REQUEST
    // ============================================================

    const handleReject =
        async (request) => {
            try {
                const requestId =
                    request.id;

                const role =
                    String(
                        request.role || ""
                    ).toLowerCase();

                const actionId =
                    `${role}-${requestId}`;

                setApprovalActionId(
                    actionId
                );

                setApprovalError("");

                let endpoint = "";

                // ------------------------------------------------
                // ADMIN
                // ------------------------------------------------

                if (
                    role === "admin"
                ) {
                    endpoint =
                        `/admin/reject-admin/${requestId}`;
                }

                // ------------------------------------------------
                // CLIENT
                // ------------------------------------------------

                else if (
                    role === "client"
                ) {
                    endpoint =
                        `/admin/reject-client/${requestId}`;
                }

                // ------------------------------------------------
                // EMPLOYEE
                // ------------------------------------------------

                else if (
                    role === "employee"
                ) {
                    endpoint =
                        `/admin/reject-employee/${requestId}`;
                }

                else {
                    throw new Error(
                        `Unsupported rejection role: ${role}`
                    );
                }

                // =================================================
                // API REQUEST
                // =================================================

                const response =
                    await api.patch(
                        endpoint
                    );

                const result =
                    response.data;

                if (
                    result?.success === false
                ) {
                    throw new Error(
                        result.message ||
                            `Unable to reject ${role}.`
                    );
                }

                // =================================================
                // REMOVE REQUEST
                // =================================================

                setApprovalRequests(
                    (previous) =>
                        previous.filter(
                            (item) =>
                                !(
                                    String(
                                        item.id
                                    ) ===
                                        String(
                                            requestId
                                        ) &&
                                    String(
                                        item.role ||
                                            ""
                                    ).toLowerCase() ===
                                        role
                                )
                        )
                );

            } catch (err) {
                console.error(
                    "Reject request error:",
                    err
                );

                setApprovalError(
                    err.response?.data?.message ||
                        err.message ||
                        "Unable to reject request."
                );

            } finally {
                setApprovalActionId(
                    null
                );
            }
        };

    // ============================================================
    // SEARCH
    // ============================================================

    const filteredClients =
        clientsList.filter(
            (client) => {
                const query =
                    searchQuery
                        .toLowerCase()
                        .trim();

                if (!query) {
                    return true;
                }

                return (
                    String(
                        client.id || ""
                    )
                        .toLowerCase()
                        .includes(query) ||

                    String(
                        client.company_name ||
                            ""
                    )
                        .toLowerCase()
                        .includes(query) ||

                    String(
                        client.email || ""
                    )
                        .toLowerCase()
                        .includes(query) ||

                    String(
                        client.contact_person ||
                            ""
                    )
                        .toLowerCase()
                        .includes(query) ||

                    String(
                        client.phone || ""
                    )
                        .toLowerCase()
                        .includes(query)
                );
            }
        );

    // ============================================================
    // INITIALS
    // ============================================================

    const getInitials = (
        companyName
    ) => {
        if (!companyName) {
            return "CL";
        }

        return companyName
            .split(" ")
            .filter(Boolean)
            .map(
                (word) =>
                    word[0]
            )
            .join("")
            .slice(0, 2)
            .toUpperCase();
    };

    // ============================================================
    // ACTIVE CLIENT COUNT
    // ============================================================

    const activeClients =
        clientsList.filter(
            (client) =>
                String(
                    client.status ||
                        "active"
                ).toLowerCase() ===
                "active"
        ).length;

    // ============================================================
    // APPROVAL COUNTS
    // ============================================================

    const pendingAdminCount =
        approvalRequests.filter(
            (request) =>
                String(
                    request.role || ""
                ).toLowerCase() ===
                "admin"
        ).length;

    const pendingClientCount =
        approvalRequests.filter(
            (request) =>
                String(
                    request.role || ""
                ).toLowerCase() ===
                "client"
        ).length;

    const pendingEmployeeCount =
        approvalRequests.filter(
            (request) =>
                String(
                    request.role || ""
                ).toLowerCase() ===
                "employee"
        ).length;

    // ============================================================
    // ROLE LABEL
    // ============================================================

    const getRoleLabel = (
        role
    ) => {
        const normalizedRole =
            String(
                role || ""
            ).toLowerCase();

        if (
            normalizedRole ===
            "admin"
        ) {
            return "Admin";
        }

        if (
            normalizedRole ===
            "client"
        ) {
            return "Client";
        }

        if (
            normalizedRole ===
            "employee"
        ) {
            return "Employee";
        }

        return "User";
    };

    // ============================================================
    // ROLE ICON
    // ============================================================

    const getRoleIcon = (
        role
    ) => {
        const normalizedRole =
            String(
                role || ""
            ).toLowerCase();

        if (
            normalizedRole ===
            "admin"
        ) {
            return (
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
            );
        }

        if (
            normalizedRole ===
            "employee"
        ) {
            return (
                <UserCheck className="h-4 w-4 text-cyan-400" />
            );
        }

        return (
            <Building2 className="h-4 w-4 text-emerald-400" />
        );
    };

    // ============================================================
    // ROLE ICON BACKGROUND
    // ============================================================

    const getRoleIconClass = (
        role
    ) => {
        const normalizedRole =
            String(
                role || ""
            ).toLowerCase();

        if (
            normalizedRole ===
            "admin"
        ) {
            return "bg-indigo-600/10 border-indigo-500/20";
        }

        if (
            normalizedRole ===
            "employee"
        ) {
            return "bg-cyan-600/10 border-cyan-500/20";
        }

        return "bg-emerald-600/10 border-emerald-500/20";
    };

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="flex min-h-screen bg-[#0b0f19] text-slate-100 font-sans antialiased">

            <Sidebar />

            <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">

                {/* ==================================================
                    HEADER
                ================================================== */}

                <header className="h-16 px-8 border-b border-slate-800/60 bg-[#0b0f19]/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">

                    <div>
                        <h2 className="text-base font-extrabold text-slate-100 tracking-tight capitalize">
                            {activeTab}
                        </h2>

                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            Third-party client management
                            {selectedTenant
                                ? ` · ${selectedTenant}`
                                : ""}
                        </p>
                    </div>

                    <div className="flex items-center gap-4">

                        {/* ==================================================
                            NOTIFICATIONS
                        ================================================== */}

                        <div className="relative">

                            <button
                                type="button"
                                onClick={() => {
                                    const next =
                                        !showNotifications;

                                    setShowNotifications(
                                        next
                                    );

                                    if (
                                        next
                                    ) {
                                        fetchApprovalRequests();
                                    }
                                }}
                                className="relative w-10 h-10 rounded-xl bg-[#141a2e] border border-slate-700/60 flex items-center justify-center hover:bg-slate-800 transition"
                                title="Approval notifications"
                            >
                                <Bell className="h-4 w-4 text-indigo-400" />

                                {approvalRequests.length >
                                    0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                                        {approvalRequests.length >
                                        99
                                            ? "99+"
                                            : approvalRequests.length}
                                    </span>
                                )}
                            </button>

                            {/* ==================================================
                                DROPDOWN
                            ================================================== */}

                            {showNotifications && (
                                <div className="absolute right-0 top-12 w-[400px] bg-[#111627] border border-slate-700/70 rounded-2xl shadow-2xl overflow-hidden z-50">

                                    <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">

                                        <div className="flex items-center gap-3">

                                            <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                                                <Bell className="h-4 w-4 text-indigo-400" />
                                            </div>

                                            <div>
                                                <h3 className="text-sm font-bold text-slate-100">
                                                    Notifications
                                                </h3>

                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    Pending approval requests
                                                </p>
                                            </div>

                                        </div>

                                        <button
                                            type="button"
                                            onClick={
                                                fetchApprovalRequests
                                            }
                                            disabled={
                                                approvalLoading
                                            }
                                            className="w-8 h-8 rounded-lg bg-[#141a2e] border border-slate-700 flex items-center justify-center hover:bg-slate-800 disabled:opacity-50"
                                            title="Refresh"
                                        >
                                            <RefreshCw
                                                className={`h-3.5 w-3.5 text-slate-400 ${
                                                    approvalLoading
                                                        ? "animate-spin"
                                                        : ""
                                                }`}
                                            />
                                        </button>

                                    </div>

                                    {!approvalLoading &&
                                        approvalRequests.length >
                                            0 && (
                                            <div className="px-4 py-3 border-b border-slate-800 bg-[#0d1220]">

                                                <div className="grid grid-cols-3 gap-2">

                                                    <div className="rounded-lg bg-indigo-600/10 border border-indigo-500/20 px-2 py-2 text-center">
                                                        <p className="text-[9px] text-indigo-300">
                                                            Admin
                                                        </p>

                                                        <p className="text-sm font-extrabold text-indigo-400">
                                                            {
                                                                pendingAdminCount
                                                            }
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg bg-emerald-600/10 border border-emerald-500/20 px-2 py-2 text-center">
                                                        <p className="text-[9px] text-emerald-300">
                                                            Client
                                                        </p>

                                                        <p className="text-sm font-extrabold text-emerald-400">
                                                            {
                                                                pendingClientCount
                                                            }
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg bg-cyan-600/10 border border-cyan-500/20 px-2 py-2 text-center">
                                                        <p className="text-[9px] text-cyan-300">
                                                            Employee
                                                        </p>

                                                        <p className="text-sm font-extrabold text-cyan-400">
                                                            {
                                                                pendingEmployeeCount
                                                            }
                                                        </p>
                                                    </div>

                                                </div>

                                            </div>
                                        )}

                                    {approvalError && (
                                        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-[10px]">
                                            {approvalError}
                                        </div>
                                    )}

                                    {approvalLoading ? (
                                        <div className="py-10 flex flex-col items-center justify-center">

                                            <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />

                                            <p className="text-[10px] text-slate-500 mt-2">
                                                Loading approval requests...
                                            </p>

                                        </div>
                                    ) : approvalRequests.length ===
                                      0 ? (
                                        <div className="py-10 flex flex-col items-center justify-center px-6 text-center">

                                            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                            </div>

                                            <p className="text-xs font-bold text-slate-200 mt-3">
                                                No pending approvals
                                            </p>

                                            <p className="text-[10px] text-slate-500 mt-1">
                                                All registration requests have been processed.
                                            </p>

                                        </div>
                                    ) : (
                                        <div className="max-h-[460px] overflow-y-auto">

                                            {approvalRequests.map(
                                                (
                                                    request
                                                ) => {
                                                    const requestId =
                                                        request.id;

                                                    const role =
                                                        String(
                                                            request.role ||
                                                                ""
                                                        ).toLowerCase();

                                                    const actionId =
                                                        `${role}-${requestId}`;

                                                    const isProcessing =
                                                        String(
                                                            approvalActionId
                                                        ) ===
                                                        String(
                                                            actionId
                                                        );

                                                    const displayName =
                                                        request.company_name ||
                                                        request.name ||
                                                        request.full_name ||
                                                        request.employee_name ||
                                                        "New User";

                                                    return (
                                                        <div
                                                            key={`${role}-${requestId}`}
                                                            className="px-4 py-4 border-b border-slate-800/70 hover:bg-slate-800/30 transition"
                                                        >

                                                            <div className="flex items-start gap-3">

                                                                <div
                                                                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${getRoleIconClass(
                                                                        role
                                                                    )}`}
                                                                >
                                                                    {getRoleIcon(
                                                                        role
                                                                    )}
                                                                </div>

                                                                <div className="min-w-0 flex-1">

                                                                    <div className="flex items-center justify-between gap-2">

                                                                        <p className="text-xs font-bold text-slate-100 truncate">
                                                                            {
                                                                                displayName
                                                                            }
                                                                        </p>

                                                                        <span className="px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-800/40 text-amber-400 text-[8px] font-bold uppercase shrink-0">
                                                                            Pending
                                                                        </span>

                                                                    </div>

                                                                    <div className="flex items-center gap-2 mt-1">

                                                                        <span className="text-[9px] font-bold uppercase text-slate-400">
                                                                            {
                                                                                getRoleLabel(
                                                                                    role
                                                                                )
                                                                            }
                                                                        </span>

                                                                        <span className="text-slate-700">
                                                                            •
                                                                        </span>

                                                                        <span className="text-[10px] text-slate-400 truncate">
                                                                            {request.email ||
                                                                                "No email"}
                                                                        </span>

                                                                    </div>

                                                                    <div className="flex items-center gap-1.5 mt-1.5">

                                                                        <Clock3 className="h-3 w-3 text-slate-600" />

                                                                        <span className="text-[9px] text-slate-500">
                                                                            {request.created_at
                                                                                ? new Date(
                                                                                      request.created_at
                                                                                  ).toLocaleString()
                                                                                : "New request"}
                                                                        </span>

                                                                    </div>

                                                                </div>

                                                            </div>

                                                            <div className="flex gap-2 mt-3 ml-12">

                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        isProcessing
                                                                    }
                                                                    onClick={() =>
                                                                        handleReject(
                                                                            request
                                                                        )
                                                                    }
                                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-800/50 bg-red-950/30 text-red-400 text-[10px] font-bold hover:bg-red-950/60 disabled:opacity-50"
                                                                >

                                                                    {isProcessing ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <XCircle className="h-3.5 w-3.5" />
                                                                    )}

                                                                    Reject

                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        isProcessing
                                                                    }
                                                                    onClick={() =>
                                                                        handleApprove(
                                                                            request
                                                                        )
                                                                    }
                                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 disabled:opacity-50"
                                                                >

                                                                    {isProcessing ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <ShieldCheck className="h-3.5 w-3.5" />
                                                                    )}

                                                                    Approve

                                                                </button>

                                                            </div>

                                                        </div>
                                                    );
                                                }
                                            )}

                                        </div>
                                    )}

                                </div>
                            )}

                        </div>

                        {/* ==================================================
                            TENANT
                        ================================================== */}

                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            Active Client Tenant
                        </span>

                        <div className="relative">

                            <select
                                value={
                                    selectedTenant
                                }
                                onChange={(e) =>
                                    setSelectedTenant(
                                        e.target.value
                                    )
                                }
                                className="bg-[#141a2e] border border-slate-700/60 text-xs font-semibold text-slate-200 rounded-xl px-3.5 py-2 pr-9 appearance-none focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[220px]"
                            >

                                {tenants.length >
                                0 ? (
                                    tenants.map(
                                        (
                                            tenant
                                        ) => (
                                            <option
                                                key={
                                                    tenant.id
                                                }
                                                value={
                                                    tenant.company_name
                                                }
                                            >
                                                {
                                                    tenant.company_name
                                                }
                                            </option>
                                        )
                                    )
                                ) : (
                                    <option value="">
                                        No approved clients available
                                    </option>
                                )}

                            </select>

                            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />

                        </div>

                    </div>

                </header>

                {/* ==================================================
                    CONTENT
                ================================================== */}

                <div className="p-8 space-y-6 max-w-[1600px] mx-auto w-full">

                    {error && (
                        <div className="bg-red-950/40 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl text-xs">
                            {error}
                        </div>
                    )}

                    {/* ==================================================
                        SUMMARY
                    ================================================== */}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                        <div className="bg-[#111627] border border-slate-800/80 rounded-2xl p-5 shadow-sm">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        Total Clients
                                    </p>

                                    <p className="text-2xl font-extrabold text-slate-100 mt-2">
                                        {
                                            clientsList.length
                                        }
                                    </p>

                                </div>

                                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">

                                    <Building2 className="h-5 w-5 text-indigo-400" />

                                </div>

                            </div>

                        </div>

                        <div className="bg-[#111627] border border-slate-800/80 rounded-2xl p-5 shadow-sm">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        Active Clients
                                    </p>

                                    <p className="text-2xl font-extrabold text-emerald-400 mt-2">
                                        {
                                            activeClients
                                        }
                                    </p>

                                </div>

                                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">

                                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />

                                </div>

                            </div>

                        </div>

                        <div className="bg-[#111627] border border-slate-800/80 rounded-2xl p-5 shadow-sm">

                            <div className="flex items-center justify-between">

                                <div>

                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        Records Showing
                                    </p>

                                    <p className="text-2xl font-extrabold text-cyan-400 mt-2">
                                        {
                                            filteredClients.length
                                        }
                                    </p>

                                </div>

                                <div className="w-10 h-10 rounded-xl bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center">

                                    <Users className="h-5 w-5 text-cyan-400" />

                                </div>

                            </div>

                        </div>

                    </div>

                    {/* ==================================================
                        CLIENT REGISTRY
                    ================================================== */}

                    <div className="bg-[#111627] border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-sm">

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                            <div>

                                <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">
                                    Clients Registry
                                </h3>

                                <p className="text-[11px] text-slate-400 mt-1">
                                    {
                                        filteredClients.length
                                    }{" "}
                                    records loaded
                                </p>

                            </div>

                            <div className="relative w-full md:w-80">

                                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />

                                <input
                                    type="text"
                                    placeholder="Search client, email or person"
                                    value={
                                        searchQuery
                                    }
                                    onChange={(e) =>
                                        setSearchQuery(
                                            e.target.value
                                        )
                                    }
                                    className="w-full bg-[#0b0f19] border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                />

                            </div>

                        </div>

                        <div className="overflow-x-auto">

                            <table className="w-full text-left border-collapse">

                                <thead>

                                    <tr className="border-b border-slate-800/80 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">

                                        <th className="py-3 px-4">
                                            Client ID & Company
                                        </th>

                                        <th className="py-3 px-4">
                                            Contact Person
                                        </th>

                                        <th className="py-3 px-4">
                                            Email Address
                                        </th>

                                        <th className="py-3 px-4">
                                            Phone Number
                                        </th>

                                        <th className="py-3 px-4">
                                            Status
                                        </th>

                                        <th className="py-3 px-4 text-right">
                                            Action
                                        </th>

                                    </tr>

                                </thead>

                                <tbody className="divide-y divide-slate-800/50 text-xs">

                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="text-center py-12 text-indigo-400"
                                            >

                                                <div className="flex items-center justify-center gap-2">

                                                    <Loader2 className="h-5 w-5 animate-spin" />

                                                    <span className="font-bold text-xs">
                                                        Syncing clients registry...
                                                    </span>

                                                </div>

                                            </td>
                                        </tr>

                                    ) : filteredClients.length ===
                                      0 ? (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="text-center py-12 text-slate-400"
                                            >

                                                <div className="flex flex-col items-center gap-2">

                                                    <Building2 className="h-8 w-8 text-slate-600" />

                                                    <p className="font-semibold">
                                                        No clients found
                                                    </p>

                                                    <p className="text-[11px] text-slate-500">
                                                        Try changing your search.
                                                    </p>

                                                </div>

                                            </td>
                                        </tr>

                                    ) : (
                                        filteredClients.map(
                                            (
                                                client
                                            ) => (
                                                <tr
                                                    key={
                                                        client.id
                                                    }
                                                    className="hover:bg-slate-800/35 transition-colors"
                                                >

                                                    <td className="py-4 px-4">

                                                        <div className="flex items-center gap-3">

                                                            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">

                                                                {getInitials(
                                                                    client.company_name
                                                                )}

                                                            </div>

                                                            <div>

                                                                <p className="font-bold text-slate-100">
                                                                    {client.company_name ||
                                                                        "N/A"}
                                                                </p>

                                                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                                    ID: #
                                                                    {
                                                                        client.id
                                                                    }
                                                                </p>

                                                            </div>

                                                        </div>

                                                    </td>

                                                    <td className="py-4 px-4 font-semibold text-slate-200">
                                                        {client.contact_person ||
                                                            "N/A"}
                                                    </td>

                                                    <td className="py-4 px-4 text-slate-300 font-mono text-[11px]">
                                                        {client.email ||
                                                            "N/A"}
                                                    </td>

                                                    <td className="py-4 px-4 text-slate-300 font-mono text-[11px]">
                                                        {client.phone ||
                                                            "N/A"}
                                                    </td>

                                                    <td className="py-4 px-4">

                                                        <span
                                                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-block ${
                                                                String(
                                                                    client.status ||
                                                                        "active"
                                                                ).toLowerCase() ===
                                                                "active"
                                                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                                                                    : "bg-slate-800 text-slate-400 border border-slate-700"
                                                            }`}
                                                        >
                                                            {client.status ||
                                                                "Active"}
                                                        </span>

                                                    </td>

                                                    <td className="py-4 px-4 text-right">

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                navigate(
                                                                    `/clients/${client.id}`
                                                                )
                                                            }
                                                            className="bg-[#141a2e] hover:bg-slate-800 text-slate-300 border border-slate-700/60 px-3 py-1.5 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                                                        >

                                                            <ArrowUpRight className="h-3.5 w-3.5 text-indigo-400" />

                                                            Details

                                                        </button>

                                                    </td>

                                                </tr>
                                            )
                                        )
                                    )}

                                </tbody>

                            </table>

                        </div>

                    </div>

                </div>

            </main>

        </div>
    );
}