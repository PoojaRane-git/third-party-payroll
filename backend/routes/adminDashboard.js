const express = require("express");
const router = express.Router();

const supabaseAdmin = require("../config/supabaseAdmin");

const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

// ============================================================
// ROUTER LOADED
// ============================================================

console.log("==========================================");
console.log("ADMIN DASHBOARD ROUTER LOADED");
console.log("==========================================");

// ============================================================
// ADMIN DASHBOARD
//
// GET /api/admin/dashboard
// ============================================================

router.get(
    "/dashboard",
    authenticate,
    authorize("admin","superadmin"),
    async (req, res) => {
        try {
            return res.status(200).json({
                success: true,

                message: "Welcome to Admin Dashboard",

                user: {
                    id:
                        req.profile?.id ||
                        null,

                    user_id:
                        req.profile?.user_id ||
                        req.profile?.auth_user_id ||
                        req.user?.id ||
                        null,

                    email:
                        req.profile?.email ||
                        req.user?.email ||
                        null,

                    name:
                        req.profile?.name ||
                        req.profile?.full_name ||
                        req.profile?.company_name ||
                        req.user?.email ||
                        "Admin",

                    company_name: "Talent Corner",

                    role:
                        req.userRole ||
                        "admin",

                    status:
                        req.profile?.status ||
                        "approved",

                    is_active:
                        req.profile?.is_active ??
                        true,
                },
            });
        } catch (error) {
            console.error(
                "Admin dashboard error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load admin dashboard.",
                error: error.message,
            });
        }
    }
);

// ============================================================
// ============================================================
// ADMIN APPROVALS
// ============================================================
// ============================================================
//
// IMPORTANT:
//
// ADMIN  -> third_party_users
// CLIENT -> client_users + clients
// EMPLOYEE -> employee_users
//
// EACH APPROVAL TYPE HAS ITS OWN ENDPOINT.
// THERE IS NO COMBINED approval-requests ENDPOINT.
// ============================================================


// ============================================================
// GET PENDING ADMINS
//
// GET /api/admin/pending-admins
// ============================================================

router.get(
    "/pending-admins",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const {
                data,
                error,
            } = await supabaseAdmin
                .from("third_party_users")
                .select(`
                    id,
                    email,
                    company_name,
                    role,
                    status,
                    is_active,
                    auth_user_id,
                    created_at
                `)
                .eq("role", "admin")
                .eq("status", "pending")
                .eq("is_active", false)
                .order("created_at", {
                    ascending: false,
                });

            if (error) {
                console.error(
                    "Pending admins error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to fetch pending admin requests.",
                    error: error.message,
                });
            }

            const admins = (data || []).map(
                (admin) => ({
                    id: admin.id,

                    role: "admin",

                    name:
                        admin.company_name ||
                        "Admin",

                    email:
                        admin.email,

                    company_name:
                        admin.company_name ||
                        "Talent Corner Admin",

                    status:
                        admin.status,

                    is_active:
                        admin.is_active,

                    auth_user_id:
                        admin.auth_user_id,

                    created_at:
                        admin.created_at,
                })
            );

            return res.status(200).json({
                success: true,
                admins,
                count: admins.length,
            });

        } catch (error) {
            console.error(
                "Pending admins exception:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to fetch pending admin requests.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// GET PENDING CLIENTS
//
// GET /api/admin/pending-clients
//
// CLIENT DATA:
//
// client_users
//      ↓
// clients
//
// ============================================================

router.get(
    "/pending-clients",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            console.log(
                "CLIENT APPROVAL REQUESTS HIT"
            );

            const {
                data,
                error,
            } = await supabaseAdmin
                .from("client_users")
                .select(`
                    id,
                    user_id,
                    client_id,
                    name,
                    email,
                    role,
                    status,
                    created_at,
                    clients (
                        id,
                        company_name,
                        gstin,
                        billing_address,
                        state_code,
                        credit_terms,
                        contact_person,
                        email,
                        phone,
                        service_fee,
                        status
                    )
                `)
                .eq("role", "client")
                .eq("status", "pending")
                .order("created_at", {
                    ascending: false,
                });

            if (error) {
                console.error(
                    "Pending clients error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to fetch pending client requests.",
                    error: error.message,
                });
            }

            const clients = (data || []).map(
                (clientUser) => ({
                    id:
                        clientUser.client_id ||
                        clientUser.id,

                    client_user_id:
                        clientUser.id,

                    user_id:
                        clientUser.user_id,

                    role: "client",

                    name:
                        clientUser.name ||
                        clientUser.clients
                            ?.contact_person ||
                        clientUser.clients
                            ?.company_name ||
                        "Client",

                    email:
                        clientUser.email,

                    company_name:
                        clientUser.clients
                            ?.company_name ||
                        "Unknown Company",

                    contact_person:
                        clientUser.clients
                            ?.contact_person ||
                        clientUser.name ||
                        null,

                    phone:
                        clientUser.clients?.phone ||
                        null,

                    gstin:
                        clientUser.clients?.gstin ||
                        null,

                    billing_address:
                        clientUser.clients
                            ?.billing_address ||
                        null,

                    state_code:
                        clientUser.clients
                            ?.state_code ||
                        null,

                    credit_terms:
                        clientUser.clients
                            ?.credit_terms ||
                        null,

                    service_fee:
                        clientUser.clients
                            ?.service_fee ||
                        null,

                    status:
                        clientUser.status,

                    client_status:
                        clientUser.clients
                            ?.status ||
                        null,

                    created_at:
                        clientUser.created_at,
                })
            );

            return res.status(200).json({
                success: true,
                clients,
                count: clients.length,
            });

        } catch (error) {
            console.error(
                "Pending clients exception:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to fetch pending client requests.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// GET PENDING EMPLOYEES
//
// GET /api/admin/pending-employees
//
// ONLY employee_users
//
// ============================================================

router.get(
    "/pending-employees",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const {
                data,
                error,
            } = await supabaseAdmin
                .from("employee_users")
                .select(`
                    id,
                    user_id,
                    employee_id,
                    name,
                    email,
                    role,
                    status,
                    created_at
                `)
                .eq("role", "employee")
                .eq("status", "pending")
                .order("created_at", {
                    ascending: false,
                });

            if (error) {
                console.error(
                    "Pending employees error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to fetch pending employee requests.",
                    error: error.message,
                });
            }

            const employees =
                (data || []).map(
                    (employee) => ({
                        id: employee.id,

                        employee_user_id:
                            employee.id,

                        user_id:
                            employee.user_id,

                        employee_id:
                            employee.employee_id,

                        role: "employee",

                        name:
                            employee.name ||
                            "Employee",

                        email:
                            employee.email,

                        status:
                            employee.status,

                        created_at:
                            employee.created_at,
                    })
                );

            return res.status(200).json({
                success: true,
                employees,
                count: employees.length,
            });

        } catch (error) {
            console.error(
                "Pending employees exception:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to fetch pending employee requests.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// ============================================================
// APPROVE ADMIN
// ============================================================
// ============================================================
//
// PATCH /api/admin/approve-admin/:id
// ============================================================

router.patch(
    "/approve-admin/:id",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const id = Number(
                req.params.id
            );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid admin ID.",
                });
            }

            const {
                data: pendingAdmin,
                error: findError,
            } = await supabaseAdmin
                .from("third_party_users")
                .select(`
                    id,
                    email,
                    company_name,
                    role,
                    status,
                    is_active,
                    auth_user_id
                `)
                .eq("id", id)
                .eq("role", "admin")
                .eq("status", "pending")
                .eq("is_active", false)
                .maybeSingle();

            if (findError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find admin request.",
                    error:
                        findError.message,
                });
            }

            if (!pendingAdmin) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pending admin request not found.",
                });
            }

            const {
                data: updatedAdmin,
                error: updateError,
            } = await supabaseAdmin
                .from("third_party_users")
                .update({
                    status: "approved",
                    is_active: true,
                })
                .eq("id", id)
                .eq("role", "admin")
                .eq("status", "pending")
                .select(`
                    id,
                    email,
                    company_name,
                    role,
                    status,
                    is_active,
                    auth_user_id
                `)
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to approve admin.",
                    error:
                        updateError.message,
                });
            }

            return res.status(200).json({
                success: true,
                message:
                    "Admin account approved successfully.",
                admin: updatedAdmin,
            });

        } catch (error) {
            console.error(
                "Approve admin error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve admin.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// REJECT ADMIN
//
// PATCH /api/admin/reject-admin/:id
// ============================================================

router.patch(
    "/reject-admin/:id",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const id = Number(
                req.params.id
            );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid admin ID.",
                });
            }

            const {
                data: pendingAdmin,
                error: findError,
            } = await supabaseAdmin
                .from("third_party_users")
                .select("id")
                .eq("id", id)
                .eq("role", "admin")
                .eq("status", "pending")
                .eq("is_active", false)
                .maybeSingle();

            if (findError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find admin request.",
                    error:
                        findError.message,
                });
            }

            if (!pendingAdmin) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pending admin request not found.",
                });
            }

            const {
                data: updatedAdmin,
                error: updateError,
            } = await supabaseAdmin
                .from("third_party_users")
                .update({
                    status: "rejected",
                    is_active: false,
                })
                .eq("id", id)
                .eq("role", "admin")
                .eq("status", "pending")
                .select()
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to reject admin.",
                    error:
                        updateError.message,
                });
            }

            return res.status(200).json({
                success: true,
                message:
                    "Admin account rejected successfully.",
                admin: updatedAdmin,
            });

        } catch (error) {
            console.error(
                "Reject admin error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject admin.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// ============================================================
// APPROVE CLIENT
// ============================================================
// ============================================================
//
// PATCH /api/admin/approve-client/:id
//
// IMPORTANT:
// :id = CLIENT ID FROM clients TABLE
//
// Updates:
// clients.status      -> Active
// client_users.status -> active
//
// ============================================================

router.patch(
    "/approve-client/:id",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const clientId = Number(
                req.params.id
            );

            if (
                !Number.isInteger(clientId) ||
                clientId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid client ID.",
                });
            }

            // ====================================================
            // FIND PENDING CLIENT
            // ====================================================

            const {
                data: pendingClient,
                error: findError,
            } = await supabaseAdmin
                .from("client_users")
                .select(`
                    id,
                    user_id,
                    client_id,
                    name,
                    email,
                    role,
                    status
                `)
                .eq("client_id", clientId)
                .eq("role", "client")
                .eq("status", "pending")
                .maybeSingle();

            if (findError) {
                console.error(
                    "Find client approval error:",
                    findError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find client request.",
                    error:
                        findError.message,
                });
            }

            if (!pendingClient) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pending client request not found.",
                });
            }

            // ====================================================
            // UPDATE CLIENT USERS
            // ====================================================

            const {
                data: updatedClientUser,
                error: userUpdateError,
            } = await supabaseAdmin
                .from("client_users")
                .update({
                    status: "active",
                })
                .eq("id", pendingClient.id)
                .eq("status", "pending")
                .select(`
                    id,
                    user_id,
                    client_id,
                    name,
                    email,
                    role,
                    status
                `)
                .single();

            if (userUpdateError) {
                console.error(
                    "Client user approval error:",
                    userUpdateError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to activate client account.",
                    error:
                        userUpdateError.message,
                });
            }

            // ====================================================
            // UPDATE CLIENT COMPANY
            // ====================================================

            const {
                data: updatedClient,
                error: clientUpdateError,
            } = await supabaseAdmin
                .from("clients")
                .update({
                    status: "Active",
                })
                .eq("id", clientId)
                .select(`
                    id,
                    company_name,
                    gstin,
                    billing_address,
                    state_code,
                    credit_terms,
                    contact_person,
                    email,
                    phone,
                    service_fee,
                    status
                `)
                .single();

            if (clientUpdateError) {
                console.error(
                    "Client company approval error:",
                    clientUpdateError
                );

                // rollback client_users
                await supabaseAdmin
                    .from("client_users")
                    .update({
                        status: "pending",
                    })
                    .eq(
                        "id",
                        pendingClient.id
                    );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to activate client company.",
                    error:
                        clientUpdateError.message,
                });
            }

            return res.status(200).json({
                success: true,

                message:
                    "Client account approved successfully.",

                client: {
                    ...updatedClient,
                    user: updatedClientUser,
                },
            });

        } catch (error) {
            console.error(
                "Approve client error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve client.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// REJECT CLIENT
//
// PATCH /api/admin/reject-client/:id
//
// :id = clients.id
//
// ============================================================

router.patch(
    "/reject-client/:id",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const clientId = Number(
                req.params.id
            );

            if (
                !Number.isInteger(clientId) ||
                clientId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid client ID.",
                });
            }

            const {
                data: pendingClient,
                error: findError,
            } = await supabaseAdmin
                .from("client_users")
                .select(`
                    id,
                    user_id,
                    client_id,
                    name,
                    email,
                    role,
                    status
                `)
                .eq("client_id", clientId)
                .eq("role", "client")
                .eq("status", "pending")
                .maybeSingle();

            if (findError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find client request.",
                    error:
                        findError.message,
                });
            }

            if (!pendingClient) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pending client request not found.",
                });
            }

            // ====================================================
            // REJECT CLIENT USER
            // ====================================================

            const {
                data: updatedClientUser,
                error: userUpdateError,
            } = await supabaseAdmin
                .from("client_users")
                .update({
                    status: "rejected",
                })
                .eq("id", pendingClient.id)
                .eq("status", "pending")
                .select(`
                    id,
                    user_id,
                    client_id,
                    name,
                    email,
                    role,
                    status
                `)
                .single();

            if (userUpdateError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to reject client account.",
                    error:
                        userUpdateError.message,
                });
            }

            // ====================================================
            // REJECT CLIENT COMPANY
            // ====================================================

            const {
                data: updatedClient,
                error: clientUpdateError,
            } = await supabaseAdmin
                .from("clients")
                .update({
                    status: "Rejected",
                })
                .eq("id", clientId)
                .select(`
                    id,
                    company_name,
                    gstin,
                    billing_address,
                    state_code,
                    credit_terms,
                    contact_person,
                    email,
                    phone,
                    service_fee,
                    status
                `)
                .single();

            if (clientUpdateError) {
                console.error(
                    "Reject client company error:",
                    clientUpdateError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to reject client company.",
                    error:
                        clientUpdateError.message,
                });
            }

            return res.status(200).json({
                success: true,

                message:
                    "Client account rejected successfully.",

                client: {
                    ...updatedClient,
                    user: updatedClientUser,
                },
            });

        } catch (error) {
            console.error(
                "Reject client error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject client.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// ============================================================
// APPROVE EMPLOYEE
// ============================================================
// ============================================================
//
// PATCH /api/admin/approve-employee/:id
// ============================================================

router.patch(
    "/approve-employee/:id",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const id = Number(
                req.params.id
            );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid employee user ID.",
                });
            }

            const {
                data: pendingEmployee,
                error: findError,
            } = await supabaseAdmin
                .from("employee_users")
                .select(`
                    id,
                    user_id,
                    employee_id,
                    name,
                    email,
                    role,
                    status
                `)
                .eq("id", id)
                .eq("role", "employee")
                .eq("status", "pending")
                .maybeSingle();

            if (findError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find employee request.",
                    error:
                        findError.message,
                });
            }

            if (!pendingEmployee) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pending employee request not found.",
                });
            }

            const {
                data: updatedEmployee,
                error: updateError,
            } = await supabaseAdmin
                .from("employee_users")
                .update({
                    status: "active",
                })
                .eq("id", id)
                .eq("role", "employee")
                .eq("status", "pending")
                .select(`
                    id,
                    user_id,
                    employee_id,
                    name,
                    email,
                    role,
                    status
                `)
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to approve employee.",
                    error:
                        updateError.message,
                });
            }

            return res.status(200).json({
                success: true,

                message:
                    "Employee account approved successfully.",

                employee:
                    updatedEmployee,
            });

        } catch (error) {
            console.error(
                "Approve employee error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve employee.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// REJECT EMPLOYEE
//
// PATCH /api/admin/reject-employee/:id
// ============================================================

router.patch(
    "/reject-employee/:id",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const id = Number(
                req.params.id
            );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid employee user ID.",
                });
            }

            const {
                data: pendingEmployee,
                error: findError,
            } = await supabaseAdmin
                .from("employee_users")
                .select("id")
                .eq("id", id)
                .eq("role", "employee")
                .eq("status", "pending")
                .maybeSingle();

            if (findError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find employee request.",
                    error:
                        findError.message,
                });
            }

            if (!pendingEmployee) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Pending employee request not found.",
                });
            }

            const {
                data: updatedEmployee,
                error: updateError,
            } = await supabaseAdmin
                .from("employee_users")
                .update({
                    status: "rejected",
                })
                .eq("id", id)
                .eq("role", "employee")
                .eq("status", "pending")
                .select(`
                    id,
                    user_id,
                    employee_id,
                    name,
                    email,
                    role,
                    status
                `)
                .single();

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to reject employee.",
                    error:
                        updateError.message,
                });
            }

            return res.status(200).json({
                success: true,

                message:
                    "Employee account rejected successfully.",

                employee:
                    updatedEmployee,
            });

        } catch (error) {
            console.error(
                "Reject employee error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject employee.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// ACTIVE CLIENT TENANTS
//
// GET /api/admin/active-tenants
//
// CLIENT DATA COMES FROM:
//
// client_users
//      ↓
// clients
//
// ============================================================

router.get(
    "/active-tenants",
    authenticate,
    authorize("superadmin"),
    async (req, res) => {
        try {
            const {
                data,
                error,
            } = await supabaseAdmin
                .from("client_users")
                .select(`
                    id,
                    user_id,
                    client_id,
                    name,
                    email,
                    role,
                    status,
                    created_at,
                    clients (
                        id,
                        company_name,
                        gstin,
                        billing_address,
                        state_code,
                        credit_terms,
                        contact_person,
                        email,
                        phone,
                        service_fee,
                        status
                    )
                `)
                .eq("role", "client")
                .eq("status", "active")
                .order("created_at", {
                    ascending: false,
                });

            if (error) {
                console.error(
                    "Active tenants error:",
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to load active client tenants.",
                    error: error.message,
                });
            }

            const clients = (data || []).map(
                (clientUser) => ({
                    id:
                        clientUser.client_id ||
                        clientUser.id,

                    client_user_id:
                        clientUser.id,

                    user_id:
                        clientUser.user_id,

                    name:
                        clientUser.name,

                    email:
                        clientUser.email,

                    role: "client",

                    company_name:
                        clientUser.clients
                            ?.company_name ||
                        "Unknown Company",

                    contact_person:
                        clientUser.clients
                            ?.contact_person ||
                        clientUser.name ||
                        null,

                    phone:
                        clientUser.clients?.phone ||
                        null,

                    gstin:
                        clientUser.clients?.gstin ||
                        null,

                    billing_address:
                        clientUser.clients
                            ?.billing_address ||
                        null,

                    state_code:
                        clientUser.clients
                            ?.state_code ||
                        null,

                    credit_terms:
                        clientUser.clients
                            ?.credit_terms ||
                        null,

                    service_fee:
                        clientUser.clients
                            ?.service_fee ||
                        null,

                    status:
                        clientUser.status,

                    client_status:
                        clientUser.clients
                            ?.status ||
                        null,

                    created_at:
                        clientUser.created_at,
                })
            );

            return res.status(200).json({
                success: true,

                clients,

                count:
                    clients.length,
            });

        } catch (error) {
            console.error(
                "Active tenant route error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to load active client tenants.",
                error: error.message,
            });
        }
    }
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;