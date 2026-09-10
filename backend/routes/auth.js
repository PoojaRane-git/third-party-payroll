const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const supabaseAdmin = require("../config/supabaseAdmin");

const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");

const nodemailer = require("nodemailer");

// ... (constants, email transporter — unchanged, skip down to the function)

// ============================================================
// HELPER
// FIND APPLICATION USER PROFILE
// ============================================================

async function findUserProfile(authUserId) {

    // ========================================================
    // 1. THIRD PARTY USERS
    // superadmin / admin
    // ========================================================

    const {
        data: thirdPartyUser,
        error: thirdPartyError,
    } = await supabaseAdmin
        .from("third_party_users")
        .select(`
            id,
            email,
            company_name,
            role,
            status,
            is_active,
            client_id,
            auth_user_id
        `)
        .eq("auth_user_id", authUserId)
        .maybeSingle();

    // TEMPORARY DEBUG — remove after diagnosing
    console.log("DEBUG findUserProfile authUserId:", authUserId);
    console.log("DEBUG thirdPartyUser result:", thirdPartyUser);
    console.log("DEBUG thirdPartyError:", thirdPartyError);

    if (thirdPartyError) {
        throw thirdPartyError;
    }

    if (thirdPartyUser) {
        return {
            profile: thirdPartyUser,

            role: String(
                thirdPartyUser.role || ""
            )
                .trim()
                .toLowerCase(),
        };
    }

    // ========================================================
    // 2. CLIENT USERS
    // ========================================================

    const {
        data: clientUser,
        error: clientError,
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
        .eq("user_id", authUserId)
        .maybeSingle();

    if (clientError) {
        throw clientError;
    }

    if (clientUser) {
        return {
            profile: clientUser,
            role: "client",
        };
    }

    // ========================================================
    // 3. EMPLOYEE USERS
    // ========================================================

    const {
        data: employeeUser,
        error: employeeError,
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
        .eq("user_id", authUserId)
        .maybeSingle();

    if (employeeError) {
        throw employeeError;
    }

    if (employeeUser) {
        return {
            profile: employeeUser,
            role: "employee",
        };
    }

    return null;
}
// ============================================================
// GET CURRENT USER
//
// GET /api/auth/me
//
// Password login identifies the account.
// OTP is required to complete login.
// NO ADMIN APPROVAL IS REQUIRED.
// ============================================================

router.get(
    "/me",
    authenticate,
    async (req, res) => {

        try {

            const authUserId =
                req.user?.id;

            const authEmail =
                String(
                    req.user?.email || ""
                )
                    .trim()
                    .toLowerCase();

            if (!authUserId) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Authentication required.",
                });
            }

            const result =
                await findUserProfile(
                    authUserId
                );

            if (!result) {

                return res.status(403).json({
                    success: false,
                    message:
                        "User profile was not found.",
                });
            }

            const profile =
                result.profile;

            const role =
                result.role;

            const profileEmail =
                String(
                    profile.email ||
                    authEmail
                )
                    .trim()
                    .toLowerCase();

            // ==================================================
            // SUPER ADMIN
            // ==================================================

            if (
                role === "superadmin"
            ) {

                if (
                    profileEmail !==
                    SUPER_ADMIN_EMAIL
                ) {

                    return res.status(403).json({
                        success: false,
                        message:
                            "Access denied. Only the authorized Super Admin can login.",
                    });
                }

                if (
                    profile.is_active === false
                ) {

                    return res.status(403).json({
                        success: false,
                        message:
                            "Super Admin account is inactive.",
                    });
                }

                return res.status(200).json({

                    success: true,

                    user: {

                        supabase_user_id:
                            authUserId,

                        email:
                            profile.email ||
                            authEmail,

                        profile_id:
                            profile.id,

                        role:
                            "superadmin",

                        status:
                            profile.status,

                        is_active:
                            profile.is_active,

                        name:
                            profile.company_name ||
                            "Super Admin",

                        company_name:
                            profile.company_name ||
                            "Talent Corner",

                        admin_id:
                            profile.id,
                    },
                });
            }

            // ==================================================
            // NORMAL ADMIN
            //
            // OTP ONLY
            // NO APPROVAL CHECK
            // ==================================================

            if (role === "admin") {

    return res.status(200).json({

        success: true,

        user: {

            supabase_user_id:
                authUserId,

            email:
                profile.email ||
                authEmail,

            profile_id:
                profile.id,

            role:
                "admin",

            status:
                profile.status,

            is_active:
                profile.is_active,

            name:
                profile.company_name ||
                "Admin",

            company_name:
                profile.company_name ||
                "Talent Corner",

            admin_id:
                profile.id,
        },
    });
}

            // ==================================================
            // CLIENT
            //
            // OTP ONLY
            // NO APPROVAL CHECK
            // ==================================================

            if (
                role === "client"
            ) {

                return res.status(200).json({

                    success: true,

                    user: {

                        supabase_user_id:
                            authUserId,

                        email:
                            profile.email ||
                            authEmail,

                        profile_id:
                            profile.id,

                        role:
                            "client",

                        status:
                            profile.status,

                        is_active:
                            true,

                        name:
                            profile.name ||
                            "Client",

                        client_id:
                            profile.client_id ||
                            null,
                    },
                });
            }

            // ==================================================
            // EMPLOYEE
            //
            // OTP ONLY
            // NO APPROVAL CHECK
            // ==================================================

            if (
                role === "employee"
            ) {

                return res.status(200).json({

                    success: true,

                    user: {

                        supabase_user_id:
                            authUserId,

                        email:
                            profile.email ||
                            authEmail,

                        profile_id:
                            profile.id,

                        role:
                            "employee",

                        status:
                            profile.status,

                        is_active:
                            true,

                        name:
                            profile.name ||
                            "Employee",

                        employee_id:
                            profile.employee_id ||
                            null,
                    },
                });
            }

            // ==================================================
            // UNKNOWN ROLE
            // ==================================================

            return res.status(403).json({

                success: false,

                message:
                    "Access denied. You are not allowed to login.",
            });

        } catch (error) {

            console.error(
                "GET /api/auth/me error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to fetch user profile.",

                error:
                    error.message,
            });
        }
    }
);
// ============================================================
// SEND LOGIN OTP
//
// POST /api/auth/send-login-otp
//
// PASSWORD + OTP
// NO APPROVAL REQUIRED
// ============================================================

router.post(
    "/send-login-otp",
    authenticate,
    async (req, res) => {

        try {

            const authUserId =
                req.user?.id;

            const email =
                String(
                    req.user?.email || ""
                )
                    .trim()
                    .toLowerCase();

            if (
                !authUserId ||
                !email
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Unable to identify your account.",
                });
            }

            const result =
                await findUserProfile(
                    authUserId
                );

            if (!result) {

                return res.status(403).json({
                    success: false,
                    message:
                        "User profile was not found.",
                });
            }

            const role =
                result.role;

            // ==================================================
            // ALLOWED ROLES
            // ==================================================

            if (
                role !== "superadmin" &&
                role !== "admin" &&
                role !== "client" &&
                role !== "employee"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "You are not allowed to login.",
                });
            }

            // ==================================================
            // SUPER ADMIN EMAIL CHECK
            // ==================================================

            if (
                role === "superadmin" &&
                email !== SUPER_ADMIN_EMAIL
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Only the authorized Super Admin can login.",
                });
            }

            // ==================================================
            // GENERATE OTP
            // ==================================================

            const otp =
                String(
                    Math.floor(
                        100000 +
                        Math.random() * 900000
                    )
                );

            // ==================================================
            // OTP EXPIRY
            // 5 MINUTES
            // ==================================================

            const expiresAt =
                new Date(
                    Date.now() +
                    5 * 60 * 1000
                ).toISOString();

            // ==================================================
            // DELETE PREVIOUS OTP
            // ==================================================

            const {
                error: deleteOtpError,
            } = await supabaseAdmin
                .from("login_otps")
                .delete()
                .eq(
                    "user_id",
                    authUserId
                )
                .eq(
                    "verified",
                    false
                );

            if (deleteOtpError) {

                console.error(
                    "Previous OTP delete error:",
                    deleteOtpError
                );
            }

            // ==================================================
            // INSERT NEW OTP
            // ==================================================

            const {
                error: insertError,
            } = await supabaseAdmin
                .from("login_otps")
                .insert({

                    user_id:
                        authUserId,

                    email:
                        email,

                    otp:
                        otp,

                    expires_at:
                        expiresAt,

                    verified:
                        false,
                });

            if (insertError) {

                console.error(
                    "OTP insert error:",
                    insertError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to generate OTP.",

                    error:
                        insertError.message,
                });
            }

            // ==================================================
            // SEND OTP EMAIL
            // ==================================================

            try {

                await transporter.sendMail({

                    from:
                        `"Talent Corner" <${EMAIL_USER}>`,

                    to:
                        email,

                    subject:
                        "Talent Corner Login OTP",

                    html: `
                        <div style="
                            font-family: Arial, sans-serif;
                            max-width: 500px;
                            margin: 30px auto;
                            padding: 30px;
                            border: 1px solid #e5e7eb;
                            border-radius: 12px;
                            background: #ffffff;
                        ">

                            <h2 style="
                                color: #111827;
                            ">
                                Talent Corner
                            </h2>

                            <p style="
                                color: #4b5563;
                            ">
                                Use the following OTP
                                to complete your login:
                            </p>

                            <div style="
                                margin: 25px 0;
                                padding: 20px;
                                background: #f3f4f6;
                                border-radius: 10px;
                                text-align: center;
                            ">

                                <span style="
                                    font-size: 32px;
                                    font-weight: bold;
                                    letter-spacing: 8px;
                                    color: #111827;
                                ">
                                    ${otp}
                                </span>

                            </div>

                            <p style="
                                color: #4b5563;
                            ">
                                This OTP is valid for
                                <strong>5 minutes</strong>.
                            </p>

                            <p style="
                                color: #9ca3af;
                                font-size: 13px;
                            ">
                                If you did not attempt
                                to login, safely ignore
                                this email.
                            </p>

                        </div>
                    `,
                });

            } catch (emailError) {

                console.error(
                    "OTP email error:",
                    emailError
                );

                await supabaseAdmin
                    .from("login_otps")
                    .delete()
                    .eq(
                        "user_id",
                        authUserId
                    )
                    .eq(
                        "otp",
                        otp
                    );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to send OTP email.",

                    error:
                        emailError.message,
                });
            }

            return res.status(200).json({

                success: true,

                message:
                    "OTP has been sent to your registered email.",

                email:
                    email,

                expires_in:
                    300,
            });

        } catch (error) {

            console.error(
                "send-login-otp error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to send login OTP.",

                error:
                    error.message,
            });
        }
    }
);
// ============================================================
// VERIFY LOGIN OTP
//
// POST /api/auth/verify-login-otp
//
// LOGIN FLOW:
//
// Password
//    ↓
// Supabase Auth
//    ↓
// OTP
//    ↓
// Verify OTP
//    ↓
// Dashboard
//
// NO ADMIN APPROVAL
// ============================================================

router.post(
    "/verify-login-otp",
    authenticate,
    async (req, res) => {

        try {

            const authUserId =
                req.user?.id;

            const email =
                String(
                    req.user?.email || ""
                )
                    .trim()
                    .toLowerCase();

            const otp =
                String(
                    req.body?.otp || ""
                ).trim();

            if (
                !authUserId ||
                !email
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Authentication required.",
                });
            }

            // ==================================================
            // VALIDATE OTP FORMAT
            // ==================================================

            if (
                !/^\d{6}$/.test(otp)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please enter a valid 6-digit OTP.",
                });
            }

            // ==================================================
            // GET LATEST OTP
            // ==================================================

            const {
                data: otpRecords,
                error: otpError,
            } = await supabaseAdmin
                .from("login_otps")
                .select(`
                    id,
                    user_id,
                    email,
                    otp,
                    expires_at,
                    verified,
                    created_at
                `)
                .eq(
                    "user_id",
                    authUserId
                )
                .eq(
                    "email",
                    email
                )
                .eq(
                    "verified",
                    false
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                )
                .limit(1);

            if (otpError) {

                console.error(
                    "OTP lookup error:",
                    otpError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to verify OTP.",

                    error:
                        otpError.message,
                });
            }

            const otpRecord =
                otpRecords?.[0];

            if (!otpRecord) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid or expired OTP.",
                });
            }

            // ==================================================
            // CHECK OTP
            // ==================================================

            if (
                otpRecord.otp !== otp
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid OTP.",
                });
            }

            // ==================================================
            // CHECK EXPIRY
            // ==================================================

            if (
                new Date(
                    otpRecord.expires_at
                ).getTime() <
                Date.now()
            ) {

                await supabaseAdmin
                    .from("login_otps")
                    .delete()
                    .eq(
                        "id",
                        otpRecord.id
                    );

                return res.status(400).json({

                    success: false,

                    message:
                        "OTP has expired. Please request a new OTP.",
                });
            }

            // ==================================================
            // FIND USER PROFILE
            // ==================================================

            const result =
                await findUserProfile(
                    authUserId
                );

            if (!result) {

                return res.status(403).json({

                    success: false,

                    otp_verified: false,

                    message:
                        "User profile was not found.",
                });
            }

            const profile =
                result.profile;

            const role =
                result.role;

            // ==================================================
            // ALLOWED ROLES
            // ==================================================

            if (
                role !== "superadmin" &&
                role !== "admin" &&
                role !== "client" &&
                role !== "employee"
            ) {

                return res.status(403).json({

                    success: false,

                    otp_verified: false,

                    message:
                        "Invalid account role.",
                });
            }

            // ==================================================
            // SUPER ADMIN EMAIL CHECK
            // ==================================================

            if (
                role === "superadmin"
            ) {

                const profileEmail =
                    String(
                        profile.email || ""
                    )
                        .trim()
                        .toLowerCase();

                if (
                    profileEmail !==
                    SUPER_ADMIN_EMAIL
                ) {

                    return res.status(403).json({

                        success: false,

                        otp_verified: false,

                        message:
                            "Only the authorized Super Admin can login.",
                    });
                }

                if (
                    profile.is_active === false
                ) {

                    return res.status(403).json({

                        success: false,

                        otp_verified: false,

                        message:
                            "Super Admin account is inactive.",
                    });
                }
            }

            // ==================================================
            // MARK OTP VERIFIED
            // ==================================================

            const {
                error: verifyError,
            } = await supabaseAdmin
                .from("login_otps")
                .update({
                    verified: true,
                })
                .eq(
                    "id",
                    otpRecord.id
                );

            if (verifyError) {

                console.error(
                    "OTP update error:",
                    verifyError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Unable to complete OTP verification.",
                });
            }

            // ==================================================
            // AUTHORITATIVE USER
            // ==================================================

            const responseUser = {

                supabase_user_id:
                    authUserId,

                email:
                    profile.email ||
                    email,

                profile_id:
                    profile.id,

                role:
                    role,

                status:
                    profile.status,

                client_id:
                    profile.client_id ||
                    null,

                employee_id:
                    profile.employee_id ||
                    null,

                name:
                    profile.name ||
                    profile.company_name ||
                    null,

                company_name:
                    profile.company_name ||
                    null,
            };

            // ==================================================
            // SUCCESS
            // ==================================================

            return res.status(200).json({

                success: true,

                otp_verified: true,

                message:
                    "OTP verified successfully.",

                user:
                    responseUser,
            });

        } catch (error) {

            console.error(
                "verify-login-otp error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to verify OTP.",

                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// CLIENT SIGNUP
// ============================================================

router.post(
    "/signup-client",
    async (req, res) => {

        let authUserId = null;
        let clientId = null;
        let clientUserId = null;

        try {

            const {
                email,
                password,
                company_name,
                gstin,
                billing_address,
                state_code,
                credit_terms,
                contact_person,
                phone,
                service_fee,
            } = req.body;

            const clientEmail =
                String(email || "")
                    .trim()
                    .toLowerCase();

            const clientPassword =
                String(password || "");

            const companyName =
                String(
                    company_name || ""
                ).trim();

            const contactPerson =
                contact_person
                    ? String(
                        contact_person
                    ).trim()
                    : null;

            const clientPhone =
                phone
                    ? String(phone).trim()
                    : null;

            if (
                !clientEmail ||
                !clientPassword ||
                !companyName
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Company name, email and password are required.",
                });
            }

            if (
                clientPassword.length < 8
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Password must be at least 8 characters.",
                });
            }

            // ==================================================
            // EXISTING CLIENT USER
            // ==================================================

            const {
                data: existingClientUser,
                error: existingClientUserError,
            } = await supabaseAdmin
                .from("client_users")
                .select(`
                    id,
                    user_id,
                    client_id,
                    email,
                    status
                `)
                .ilike(
                    "email",
                    clientEmail
                )
                .maybeSingle();

            if (existingClientUserError) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check existing client login.",
                    error:
                        existingClientUserError.message,
                });
            }

            if (existingClientUser) {

                return res.status(409).json({
                    success: false,
                    message:
                        "A client login with this email already exists.",
                });
            }

            // ==================================================
            // EXISTING CLIENT
            // ==================================================

            const {
                data: existingClient,
                error: existingClientError,
            } = await supabaseAdmin
                .from("clients")
                .select(`
                    id,
                    company_name,
                    email
                `)
                .ilike(
                    "email",
                    clientEmail
                )
                .maybeSingle();

            if (existingClientError) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check existing client.",
                    error:
                        existingClientError.message,
                });
            }

            if (existingClient) {

                return res.status(409).json({
                    success: false,
                    message:
                        "A client with this email already exists.",
                });
            }

            // ==================================================
            // CREATE AUTH USER
            // ==================================================

            const {
                data: authData,
                error: authError,
            } =
                await supabaseAdmin
                    .auth
                    .admin
                    .createUser({

                        email:
                            clientEmail,

                        password:
                            clientPassword,

                        email_confirm:
                            true,
                    });

            if (
                authError ||
                !authData?.user
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        authError?.message ||
                        "Unable to create client authentication account.",
                });
            }

            authUserId =
                authData.user.id;

            // ==================================================
            // CREATE CLIENT
            // ==================================================

            const {
                data: clientRow,
                error: clientError,
            } =
                await supabaseAdmin
                    .from("clients")
                    .insert({

                        company_name:
                            companyName,

                        gstin:
                            gstin
                                ? String(
                                    gstin
                                )
                                    .trim()
                                    .toUpperCase()
                                : null,

                        billing_address:
                            billing_address
                                ? String(
                                    billing_address
                                ).trim()
                                : null,

                        state_code:
                            state_code
                                ? String(
                                    state_code
                                ).trim()
                                : null,

                        credit_terms:
                            credit_terms
                                ? String(
                                    credit_terms
                                ).trim()
                                : "Net 30",

                        contact_person:
                            contactPerson,

                        email:
                            clientEmail,

                        phone:
                            clientPhone,

                        service_fee:
                            service_fee === "" ||
                            service_fee === null ||
                            service_fee === undefined
                                ? null
                                : Number(
                                    service_fee
                                ),

                        status:
                            "Pending",

                        created_at:
                            new Date()
                                .toISOString(),
                    })
                    .select("id")
                    .single();

            if (
                clientError ||
                !clientRow
            ) {

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );

                authUserId = null;

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to create client record.",
                    error:
                        clientError?.message,
                });
            }

            clientId =
                clientRow.id;

            // ==================================================
            // CREATE CLIENT USER
            //
            // NOTE:
            // No updated_at because your schema was not confirmed
            // to contain it.
            // ==================================================

            const {
                data: clientUser,
                error: clientUserError,
            } =
                await supabaseAdmin
                    .from("client_users")
                    .insert({

                        user_id:
                            authUserId,

                        client_id:
                            clientId,

                        name:
                            contactPerson ||
                            companyName,

                        email:
                            clientEmail,

                        role:
                            "client",

                        status:
                            "pending",

                        created_at:
                            new Date()
                                .toISOString(),
                    })
                    .select(`
                        id,
                        user_id,
                        client_id,
                        name,
                        email,
                        role,
                        status,
                        created_at
                    `)
                    .single();

            if (
                clientUserError ||
                !clientUser
            ) {

                await supabaseAdmin
                    .from("clients")
                    .delete()
                    .eq(
                        "id",
                        clientId
                    );

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );

                authUserId = null;
                clientId = null;

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to create client login profile.",
                    error:
                        clientUserError?.message,
                });
            }

            clientUserId =
                clientUser.id;

            return res.status(201).json({

                success: true,

                message:
                    "Client registration submitted successfully. Please wait for Admin approval before logging in.",

                user: {

                    auth_user_id:
                        authUserId,

                    client_user_id:
                        clientUserId,

                    client_id:
                        clientId,

                    email:
                        clientEmail,

                    role:
                        "client",

                    status:
                        "pending",
                },
            });

        } catch (error) {

            console.error(
                "signup-client error:",
                error
            );

            if (clientUserId) {

                await supabaseAdmin
                    .from("client_users")
                    .delete()
                    .eq(
                        "id",
                        clientUserId
                    );
            }

            if (clientId) {

                await supabaseAdmin
                    .from("clients")
                    .delete()
                    .eq(
                        "id",
                        clientId
                    );
            }

            if (authUserId) {

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );
            }

            return res.status(500).json({
                success: false,
                message:
                    "Client signup service error.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// ADMIN SIGNUP
//
// Normal admins are NOT allowed to login.
// Only exact Super Admin can login.
// ============================================================

router.post(
    "/signup-admin",
    async (req, res) => {

        let authUserId = null;
        let profileId = null;

        try {

            const {
                email,
                password,
                company_name,
                name,
            } = req.body;

            const adminEmail =
                String(email || "")
                    .trim()
                    .toLowerCase();

            const adminPassword =
                String(password || "");

            const companyName =
                String(
                    company_name ||
                    name ||
                    "Talent Corner Admin"
                ).trim();

            if (
                !adminEmail ||
                !adminPassword
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email and password are required.",
                });
            }

            if (
                adminPassword.length < 8
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Password must be at least 8 characters.",
                });
            }

            // ==================================================
            // CHECK EXISTING ADMIN
            // ==================================================

            const {
                data: existingAdmin,
                error: existingAdminError,
            } = await supabaseAdmin
                .from("third_party_users")
                .select(
                    "id, email"
                )
                .ilike(
                    "email",
                    adminEmail
                )
                .maybeSingle();

            if (existingAdminError) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check existing admin.",
                    error:
                        existingAdminError.message,
                });
            }

            if (existingAdmin) {

                return res.status(409).json({
                    success: false,
                    message:
                        "An admin with this email already exists.",
                });
            }

            // ==================================================
            // CREATE AUTH USER
            // ==================================================

            const {
                data: authData,
                error: authError,
            } =
                await supabaseAdmin
                    .auth
                    .admin
                    .createUser({

                        email:
                            adminEmail,

                        password:
                            adminPassword,

                        email_confirm:
                            true,
                    });

            if (
                authError ||
                !authData?.user
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        authError?.message ||
                        "Unable to create admin account.",
                });
            }

            authUserId =
                authData.user.id;

            // ==================================================
            // CREATE ADMIN PROFILE
            // ==================================================

            const {
                data: adminProfile,
                error: profileError,
            } =
                await supabaseAdmin
                    .from("third_party_users")
                    .insert({

                        email:
                            adminEmail,

                        password:
                            null,

                        company_name:
                            companyName,

                        role:
                            "admin",

                        status:
                            "pending",

                        auth_user_id:
                            authUserId,

                        is_active:
                            false,

                        client_id:
                            null,

                        created_at:
                            new Date()
                                .toISOString(),
                    })
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

            if (
                profileError ||
                !adminProfile
            ) {

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );

                authUserId = null;

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to create admin profile.",
                    error:
                        profileError?.message,
                });
            }

            profileId =
                adminProfile.id;

            return res.status(201).json({

                success: true,

                message:
                    "Admin registration submitted successfully.",

                user: {

                    id:
                        profileId,

                    auth_user_id:
                        authUserId,

                    email:
                        adminEmail,

                    role:
                        "admin",

                    status:
                        "pending",

                    is_active:
                        false,
                },
            });

        } catch (error) {

            console.error(
                "signup-admin error:",
                error
            );

            if (profileId) {

                await supabaseAdmin
                    .from("third_party_users")
                    .delete()
                    .eq(
                        "id",
                        profileId
                    );
            }

            if (authUserId) {

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );
            }

            return res.status(500).json({
                success: false,
                message:
                    "Admin signup service error.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// ADMIN STATUS
//
// GET /api/auth/admin-status?email=...
//
// Used by AdminSignup.jsx
// ============================================================

router.get(
    "/admin-status",
    async (req, res) => {

        try {

            const email =
                String(
                    req.query.email || ""
                )
                    .trim()
                    .toLowerCase();

            if (!email) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email is required.",
                });
            }

            const {
                data,
                error,
            } = await supabaseAdmin
                .from("third_party_users")
                .select(`
                    id,
                    email,
                    role,
                    status,
                    is_active
                `)
                .ilike(
                    "email",
                    email
                )
                .eq(
                    "role",
                    "admin"
                )
                .maybeSingle();

            if (error) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check admin status.",
                    error:
                        error.message,
                });
            }

            if (!data) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Admin registration not found.",
                });
            }

            return res.status(200).json({

                success: true,

                status:
                    data.status,

                is_active:
                    data.is_active,

                email:
                    data.email,

                role:
                    data.role,
            });

        } catch (error) {

            console.error(
                "admin-status error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to check admin status.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// EMPLOYEE SIGNUP
//
// SELF REGISTRATION ONLY
//
// Creates:
// 1. Supabase Auth user
// 2. Candidate
// 3. employee_users
//
// employee_users.employee_id = candidate.id
// ============================================================

router.post(
    "/signup-employee",
    async (req, res) => {

        let authUserId = null;
        let candidateId = null;
        let employeeUserId = null;

        try {

            const {
                email,
                password,
                name,
                phone,
            } = req.body;

            const employeeEmail =
                String(email || "")
                    .trim()
                    .toLowerCase();

            const employeePassword =
                String(password || "");

            const employeeName =
                String(name || "")
                    .trim();

            if (
                !employeeEmail ||
                !employeePassword ||
                !employeeName
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Name, email and password are required.",
                });
            }

            if (
                employeePassword.length < 8
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Password must be at least 8 characters.",
                });
            }

            // ==================================================
            // CHECK EXISTING EMPLOYEE LOGIN
            // ==================================================

            const {
                data: existingEmployee,
                error: existingEmployeeError,
            } = await supabaseAdmin
                .from("employee_users")
                .select(`
                    id,
                    email,
                    user_id,
                    employee_id,
                    status
                `)
                .ilike(
                    "email",
                    employeeEmail
                )
                .maybeSingle();

            if (existingEmployeeError) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check employee account.",
                    error:
                        existingEmployeeError.message,
                });
            }

            if (existingEmployee) {

                return res.status(409).json({
                    success: false,
                    message:
                        "An employee with this email already exists.",
                });
            }

            // ==================================================
            // CREATE AUTH USER
            // ==================================================

            const {
                data: authData,
                error: authError,
            } =
                await supabaseAdmin
                    .auth
                    .admin
                    .createUser({

                        email:
                            employeeEmail,

                        password:
                            employeePassword,

                        email_confirm:
                            true,
                    });

            if (
                authError ||
                !authData?.user
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        authError?.message ||
                        "Unable to create employee account.",
                });
            }

            authUserId =
                authData.user.id;

            // ==================================================
            // CREATE CANDIDATE
            // ==================================================

            const {
                data: candidate,
                error: candidateError,
            } =
                await supabaseAdmin
                    .from("candidates")
                    .insert({

                        full_name:
                            employeeName,

                        email:
                            employeeEmail,

                        phone:
                            phone
                                ? String(
                                    phone
                                ).trim()
                                : null,

                        employment_status:
                            "Available",

                        auth_user_id:
                            authUserId,

                        created_at:
                            new Date()
                                .toISOString(),
                    })
                    .select("id")
                    .single();

            if (
                candidateError ||
                !candidate
            ) {

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );

                authUserId = null;

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to create employee candidate.",
                    error:
                        candidateError?.message,
                });
            }

            candidateId =
                candidate.id;

            // ==================================================
            // CREATE EMPLOYEE USER
            // ==================================================

            const {
                data: employeeUser,
                error: employeeUserError,
            } =
                await supabaseAdmin
                    .from("employee_users")
                    .insert({

                        user_id:
                            authUserId,

                        employee_id:
                            candidateId,

                        name:
                            employeeName,

                        email:
                            employeeEmail,

                        role:
                            "employee",

                        status:
                            "pending",

                        created_at:
                            new Date()
                                .toISOString(),
                    })
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
                    .single();

            if (
                employeeUserError ||
                !employeeUser
            ) {

                await supabaseAdmin
                    .from("candidates")
                    .delete()
                    .eq(
                        "id",
                        candidateId
                    );

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );

                authUserId = null;
                candidateId = null;

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to create employee login profile.",
                    error:
                        employeeUserError?.message,
                });
            }

            employeeUserId =
                employeeUser.id;

            return res.status(201).json({

                success: true,

                message:
                    "Employee registration submitted successfully. Please wait for Admin approval before logging in.",

                user: {

                    auth_user_id:
                        authUserId,

                    employee_user_id:
                        employeeUserId,

                    candidate_id:
                        candidateId,

                    employee_id:
                        candidateId,

                    email:
                        employeeEmail,

                    role:
                        "employee",

                    status:
                        "pending",
                },
            });

        } catch (error) {

            console.error(
                "signup-employee error:",
                error
            );

            if (employeeUserId) {

                await supabaseAdmin
                    .from("employee_users")
                    .delete()
                    .eq(
                        "id",
                        employeeUserId
                    );
            }

            if (candidateId) {

                await supabaseAdmin
                    .from("candidates")
                    .delete()
                    .eq(
                        "id",
                        candidateId
                    );
            }

            if (authUserId) {

                await supabaseAdmin
                    .auth
                    .admin
                    .deleteUser(
                        authUserId
                    );
            }

            return res.status(500).json({
                success: false,
                message:
                    "Employee signup service error.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// CLIENT STATUS
// ============================================================

router.get(
    "/client-status",
    async (req, res) => {

        try {

            const email =
                String(
                    req.query.email || ""
                )
                    .trim()
                    .toLowerCase();

            if (!email) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email is required.",
                });
            }

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
                    status
                `)
                .eq(
                    "email",
                    email
                )
                .eq(
                    "role",
                    "client"
                )
                .maybeSingle();

            if (error) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to check client status.",
                    error:
                        error.message,
                });
            }

            if (!data) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Client registration not found.",
                });
            }

            return res.status(200).json({

                success: true,

                status:
                    data.status,

                client_id:
                    data.client_id,
            });

        } catch (error) {

            console.error(
                "client-status error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to check client status.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// PENDING ADMINS
// ============================================================

router.get(
    "/pending-admins",
    authenticate,
    authorize("admin"),
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
                .eq(
                    "role",
                    "admin"
                )
                .eq(
                    "status",
                    "pending"
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (error) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to fetch pending admins.",
                    error:
                        error.message,
                });
            }

            return res.json({

                success: true,

                admins:
                    data || [],
            });

        } catch (error) {

            console.error(
                "pending-admins error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to fetch pending admins.",
            });
        }
    }
);

// ============================================================
// APPROVE ADMIN
// ============================================================

router.patch(
    "/admin/:id/approve",
    authenticate,
    authorize("admin"),
    async (req, res) => {

        try {

            const adminId =
                Number(req.params.id);

            if (
                !Number.isInteger(adminId)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid admin ID.",
                });
            }

            const {
                data,
                error,
            } = await supabaseAdmin
                .from("third_party_users")
                .update({

                    status:
                        "active",

                    is_active:
                        true,
                })
                .eq(
                    "id",
                    adminId
                )
                .eq(
                    "role",
                    "admin"
                )
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

            if (error) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to approve admin.",
                    error:
                        error.message,
                });
            }

            return res.json({

                success: true,

                message:
                    "Admin approved successfully.",

                admin:
                    data,
            });

        } catch (error) {

            console.error(
                "approve-admin error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve admin.",
            });
        }
    }
);

// ============================================================
// REJECT ADMIN
// ============================================================

router.patch(
    "/admin/:id/reject",
    authenticate,
    authorize("admin"),
    async (req, res) => {

        try {

            const adminId =
                Number(req.params.id);

            if (
                !Number.isInteger(adminId)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid admin ID.",
                });
            }

            const {
                data,
                error,
            } = await supabaseAdmin
                .from("third_party_users")
                .update({

                    status:
                        "rejected",

                    is_active:
                        false,
                })
                .eq(
                    "id",
                    adminId
                )
                .eq(
                    "role",
                    "admin"
                )
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

            if (error) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to reject admin.",
                    error:
                        error.message,
                });
            }

            return res.json({

                success: true,

                message:
                    "Admin rejected successfully.",

                admin:
                    data,
            });

        } catch (error) {

            console.error(
                "reject-admin error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject admin.",
            });
        }
    }
);

// ============================================================
// PENDING EMPLOYEES
// ============================================================

router.get(
    "/pending-employees",
    authenticate,
    authorize("admin"),
    async (req, res) => {

        try {

            const {
                data: employees,
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
                .eq(
                    "role",
                    "employee"
                )
                .eq(
                    "status",
                    "pending"
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (error) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to fetch pending employees.",
                    error:
                        error.message,
                });
            }

            return res.status(200).json({

                success: true,

                employees:
                    employees || [],
            });

        } catch (error) {

            console.error(
                "pending-employees error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to fetch pending employees.",
            });
        }
    }
);

// ============================================================
// APPROVE EMPLOYEE
// ============================================================

router.patch(
    "/approve-employee/:id",
    authenticate,
    authorize("admin"),
    async (req, res) => {

        try {

            const employeeUserId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    employeeUserId
                ) ||
                employeeUserId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid employee approval ID.",
                });
            }

            const {
                data: employeeUser,
                error: employeeUserError,
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
                .eq(
                    "id",
                    employeeUserId
                )
                .eq(
                    "role",
                    "employee"
                )
                .maybeSingle();

            if (employeeUserError) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find employee.",
                    error:
                        employeeUserError.message,
                });
            }

            if (!employeeUser) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Employee approval request not found.",
                });
            }

            const {
                data: updatedEmployee,
                error: updateError,
            } =
                await supabaseAdmin
                    .from("employee_users")
                    .update({

                        status:
                            "active",
                    })
                    .eq(
                        "id",
                        employeeUserId
                    )
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

            if (
                employeeUser.employee_id
            ) {

                await supabaseAdmin
                    .from("candidates")
                    .update({

                        employment_status:
                            "Available",
                    })
                    .eq(
                        "id",
                        employeeUser.employee_id
                    );
            }

            return res.status(200).json({

                success: true,

                message:
                    "Employee approved successfully.",

                employee:
                    updatedEmployee,
            });

        } catch (error) {

            console.error(
                "approve-employee error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to approve employee.",
            });
        }
    }
);

// ============================================================
// REJECT EMPLOYEE
// ============================================================

router.patch(
    "/reject-employee/:id",
    authenticate,
    authorize("admin"),
    async (req, res) => {

        try {

            const employeeUserId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    employeeUserId
                ) ||
                employeeUserId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid employee rejection ID.",
                });
            }

            const {
                data: employeeUser,
                error: employeeUserError,
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
                .eq(
                    "id",
                    employeeUserId
                )
                .eq(
                    "role",
                    "employee"
                )
                .maybeSingle();

            if (employeeUserError) {

                return res.status(500).json({
                    success: false,
                    message:
                        "Unable to find employee.",
                    error:
                        employeeUserError.message,
                });
            }

            if (!employeeUser) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Employee approval request not found.",
                });
            }

            const {
                data: updatedEmployee,
                error: updateError,
            } =
                await supabaseAdmin
                    .from("employee_users")
                    .update({

                        status:
                            "rejected",
                    })
                    .eq(
                        "id",
                        employeeUserId
                    )
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

            if (
                employeeUser.employee_id
            ) {

                await supabaseAdmin
                    .from("candidates")
                    .update({

                        employment_status:
                            "Rejected",
                    })
                    .eq(
                        "id",
                        employeeUser.employee_id
                    );
            }

            return res.status(200).json({

                success: true,

                message:
                    "Employee rejected successfully.",

                employee:
                    updatedEmployee,
            });

        } catch (error) {

            console.error(
                "reject-employee error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Unable to reject employee.",
            });
        }
    }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;