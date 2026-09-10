
require("dotenv").config();

const express = require("express");
const router = express.Router();

const supabase = require("../supabaseClient");
const nodemailer = require("nodemailer");


// ============================================================
// EMAIL CONFIGURATION
// ============================================================

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_PASS;

const EMPLOYEE_LOGIN_URL =
    process.env.EMPLOYEE_LOGIN_URL ||
    "http://localhost:5173/employee-login";


// ============================================================
// EMAIL TRANSPORTER
// ============================================================

const mailTransporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD,
    },
});


// ============================================================
// VERIFY EMAIL CONFIGURATION
// ============================================================

if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {

    console.error(
        "❌ EMAIL CONFIGURATION MISSING"
    );

    console.error(
        "EMAIL_USER:",
        EMAIL_USER ? "Loaded" : "Missing"
    );

    console.error(
        "EMAIL_APP_PASSWORD:",
        EMAIL_APP_PASSWORD ? "Loaded" : "Missing"
    );

} else {

    mailTransporter.verify((error) => {

        if (error) {

            console.error(
                "❌ Gmail transporter error:",
                error.message
            );

        } else {

            console.log(
                "✅ Gmail transporter is ready."
            );
        }
    });
}


// ============================================================
// GET ID
// ============================================================

const getId = (value) => {

    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};


// ============================================================
// GET ALL EMPLOYEE ACCOUNTS
//
// GET /api/employee-users
// ============================================================

router.get("/", async (req, res) => {

    try {

        const {
            data,
            error,
        } = await supabase
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
            .order("id", {
                ascending: false,
            });


        if (error) {

            console.error(
                "Error fetching employee accounts:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message,
            });
        }


        return res.status(200).json({

            success: true,

            data:
                data || [],
        });


    } catch (error) {

        console.error(
            "GET /api/employee-users error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                error?.message ||
                "Failed to fetch employee accounts.",
        });
    }
});


// ============================================================
// CREATE EMPLOYEE ACCOUNT
//
// POST /api/employee-users/create-account
//
// Body:
//
// {
//     "employee_id": 123,
//     "password": "Employee@123"
// }
//
// ONE EMPLOYEE = ONE LOGIN ACCOUNT
// ============================================================

router.post(
    "/create-account",
    async (req, res) => {

        let createdAuthUserId = null;

        try {

            // ====================================================
            // 1. EMPLOYEE ID
            // ====================================================

            const employeeId = getId(
                req.body?.employee_id
            );


            if (!employeeId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Valid employee_id is required.",
                });
            }


            // ====================================================
            // 2. PASSWORD
            // ====================================================

            const initialPassword = String(
                req.body?.password || ""
            ).trim();


            if (!initialPassword) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Initial password is required.",
                });
            }


            if (initialPassword.length < 8) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must be at least 8 characters long.",
                });
            }


            // ====================================================
            // 3. GET EMPLOYEE
            // ====================================================

            const {
                data: candidate,
                error: candidateError,
            } = await supabase
                .from("candidates")
                .select(`
                    id,
                    full_name,
                    email,
                    phone,
                    designation,
                    deployment_id,
                    employment_status,
                    auth_user_id,
                    employee_code
                `)
                .eq(
                    "id",
                    employeeId
                )
                .maybeSingle();


            if (candidateError) {

                console.error(
                    "Error fetching employee:",
                    candidateError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        candidateError.message,
                });
            }


            // ====================================================
            // 4. EMPLOYEE NOT FOUND
            // ====================================================

            if (!candidate) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Employee not found.",
                });
            }


            // ====================================================
            // 5. MUST BE DEPLOYED
            // ====================================================

            if (
                candidate.deployment_id === null ||
                candidate.deployment_id === undefined
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Employee must be deployed before creating an account.",
                });
            }


            // ====================================================
            // 6. EMPLOYEE EMAIL
            // ====================================================

            const employeeEmail = String(
                candidate.email || ""
            )
                .trim()
                .toLowerCase();


            if (!employeeEmail) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Employee email is required before creating an account.",
                });
            }


            // ====================================================
            // 7. CHECK employee_users
            //
            // ONE EMPLOYEE = ONE ACCOUNT
            // ====================================================

            const {
                data: existingEmployeeAccount,
                error: existingEmployeeAccountError,
            } = await supabase
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
                    "employee_id",
                    employeeId
                )
                .maybeSingle();


            if (existingEmployeeAccountError) {

                console.error(
                    "Error checking employee account:",
                    existingEmployeeAccountError
                );

                return res.status(500).json({

                    success: false,

                    message:
                        existingEmployeeAccountError.message,
                });
            }


            // ====================================================
            // 8. ACCOUNT ALREADY EXISTS
            // ====================================================

            if (existingEmployeeAccount) {

                return res.status(409).json({

                    success: false,

                    already_exists: true,

                    message:
                        "Employee account already exists.",

                    data:
                        existingEmployeeAccount,
                });
            }


            // ====================================================
            // 9. EXISTING AUTH USER
            // ====================================================

            if (candidate.auth_user_id) {

                console.log(
                    "Existing candidates.auth_user_id found:",
                    candidate.auth_user_id
                );


                const {
                    data: authUserData,
                    error: authUserError,
                } =
                    await supabase.auth.admin.getUserById(
                        candidate.auth_user_id
                    );


                if (authUserError) {

                    console.error(
                        "Existing Auth user lookup error:",
                        authUserError
                    );

                    return res.status(409).json({

                        success: false,

                        message:
                            "Employee already has an auth_user_id, but the Supabase Auth user could not be found.",
                    });
                }


                if (authUserData?.user) {

                    const {
                        data: linkedEmployeeAccount,
                        error: linkedAccountError,
                    } = await supabase
                        .from("employee_users")
                        .insert([
                            {
                                user_id:
                                    authUserData.user.id,

                                employee_id:
                                    employeeId,

                                name:
                                    candidate.full_name,

                                email:
                                    employeeEmail,

                                role:
                                    "employee",

                                status:
                                    "active",
                            },
                        ])
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


                    if (linkedAccountError) {

                        console.error(
                            "Error linking existing Auth user:",
                            linkedAccountError
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                linkedAccountError.message,
                        });
                    }


                    return res.status(200).json({

                        success: true,

                        already_exists: true,

                        linked_existing_auth: true,

                        message:
                            "Existing employee Auth account was linked successfully.",

                        data:
                            linkedEmployeeAccount,
                    });
                }
            }


            // ====================================================
            // 10. CREATE SUPABASE AUTH ACCOUNT
            // ====================================================

            console.log(
                "======================================"
            );

            console.log(
                "Creating employee Auth account"
            );

            console.log(
                "Employee ID:",
                employeeId
            );

            console.log(
                "Employee Email:",
                employeeEmail
            );

            console.log(
                "======================================"
            );


            const {
                data: authData,
                error: authError,
            } =
                await supabase.auth.admin.createUser({

                    email:
                        employeeEmail,

                    password:
                        initialPassword,

                    email_confirm:
                        true,

                    user_metadata: {

                        full_name:
                            candidate.full_name,

                        employee_id:
                            employeeId,

                        role:
                            "employee",
                    },
                });


            if (authError) {

                console.error(
                    "Supabase Auth account creation error:",
                    authError
                );


                const authErrorMessage =
                    String(
                        authError.message || ""
                    ).toLowerCase();


                if (
                    authErrorMessage.includes("already") ||
                    authErrorMessage.includes("exists") ||
                    authErrorMessage.includes("duplicate")
                ) {

                    return res.status(409).json({

                        success: false,

                        already_exists: true,

                        message:
                            "An Auth account already exists for this employee email.",
                    });
                }


                return res.status(500).json({

                    success: false,

                    message:
                        authError.message ||
                        "Failed to create Supabase Auth account.",
                });
            }


            // ====================================================
            // 11. VERIFY AUTH USER
            // ====================================================

            if (
                !authData ||
                !authData.user
            ) {

                return res.status(500).json({

                    success: false,

                    message:
                        "Supabase Auth account was not created.",
                });
            }


            createdAuthUserId =
                authData.user.id;


            console.log(
                "✅ Supabase Auth user created:",
                createdAuthUserId
            );


            // ====================================================
            // 12. INSERT employee_users
            // ====================================================

            const {
                data: employeeAccount,
                error: employeeAccountError,
            } = await supabase
                .from("employee_users")
                .insert([
                    {
                        user_id:
                            createdAuthUserId,

                        employee_id:
                            employeeId,

                        name:
                            candidate.full_name,

                        email:
                            employeeEmail,

                        role:
                            "employee",

                        status:
                            "active",
                    },
                ])
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


            if (employeeAccountError) {

                console.error(
                    "employee_users insert error:",
                    employeeAccountError
                );


                try {

                    await supabase.auth.admin.deleteUser(
                        createdAuthUserId
                    );

                } catch (deleteError) {

                    console.error(
                        "Auth rollback failed:",
                        deleteError
                    );
                }


                createdAuthUserId = null;


                return res.status(500).json({

                    success: false,

                    message:
                        employeeAccountError.message,
                });
            }


            // ====================================================
            // 13. UPDATE CANDIDATE
            // ====================================================

            const {
                data: updatedCandidate,
                error: candidateUpdateError,
            } = await supabase
                .from("candidates")
                .update({
                    auth_user_id:
                        createdAuthUserId,
                })
                .eq(
                    "id",
                    employeeId
                )
                .select(`
                    id,
                    full_name,
                    email,
                    designation,
                    deployment_id,
                    employment_status,
                    auth_user_id,
                    employee_code
                `)
                .single();


            if (candidateUpdateError) {

                console.error(
                    "Candidate auth_user_id update error:",
                    candidateUpdateError
                );


                await supabase
                    .from("employee_users")
                    .delete()
                    .eq(
                        "id",
                        employeeAccount.id
                    );


                try {

                    await supabase.auth.admin.deleteUser(
                        createdAuthUserId
                    );

                } catch (deleteError) {

                    console.error(
                        "Auth rollback failed:",
                        deleteError
                    );
                }


                createdAuthUserId = null;


                return res.status(500).json({

                    success: false,

                    message:
                        candidateUpdateError.message,
                });
            }


            // ====================================================
            // 14. SEND LOGIN EMAIL
            // ====================================================

            let emailSent = false;
            let emailErrorMessage = null;


            try {

                // ------------------------------------------------
                // CHECK EMAIL CONFIG
                // ------------------------------------------------

                if (
                    !EMAIL_USER ||
                    !EMAIL_APP_PASSWORD
                ) {

                    throw new Error(
                        "EMAIL_USER or EMAIL_APP_PASSWORD is missing in .env."
                    );
                }


                // ------------------------------------------------
                // DEBUG
                // ------------------------------------------------

                console.log(
                    "======================================"
                );

                console.log(
                    "📧 EMPLOYEE EMAIL"
                );

                console.log(
                    "From:",
                    EMAIL_USER
                );

                console.log(
                    "To:",
                    employeeEmail
                );

                console.log(
                    "App Password Loaded:",
                    !!EMAIL_APP_PASSWORD
                );

                console.log(
                    "Login URL:",
                    EMPLOYEE_LOGIN_URL
                );

                console.log(
                    "======================================"
                );


                // ------------------------------------------------
                // SEND
                // ------------------------------------------------

                const mailResult =
                    await mailTransporter.sendMail({

                        from:
                            `"Talent Corner HR Services" <${EMAIL_USER}>`,

                        to:
                            employeeEmail,

                        subject:
                            "Your Talent Corner Employee Portal Account",

                        text:
`Hello ${candidate.full_name},

Your Talent Corner employee portal account has been created successfully.

LOGIN DETAILS
================================

Employee ID:
${candidate.employee_code || employeeId}

Email:
${employeeEmail}

Password:
${initialPassword}

Login URL:
${EMPLOYEE_LOGIN_URL}

================================

Please keep your login credentials confidential.

Regards,
Talent Corner HR Services`,

                        html:
`
<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
Talent Corner Employee Account
</title>

</head>

<body style="
margin:0;
padding:0;
background:#f1f5f9;
font-family:Arial,Helvetica,sans-serif;
">

<div style="
max-width:600px;
margin:30px auto;
background:#ffffff;
padding:30px;
border-radius:12px;
">

<h2 style="
margin:0 0 20px 0;
color:#2563eb;
">

Talent Corner HR Services

</h2>


<p>
Hello
<strong>
${candidate.full_name}
</strong>,
</p>


<p>
Your employee portal account has been created successfully.
</p>


<div style="
background:#f8fafc;
border:1px solid #e2e8f0;
border-radius:10px;
padding:20px;
margin:20px 0;
">

<h3 style="
margin-top:0;
color:#111827;
">

Login Details

</h3>


<p>

<strong>
Employee ID:
</strong>

${candidate.employee_code || employeeId}

</p>


<p>

<strong>
Email:
</strong>

${employeeEmail}

</p>


<p>

<strong>
Password:
</strong>

${initialPassword}

</p>

</div>


<a
href="${EMPLOYEE_LOGIN_URL}"
style="
display:inline-block;
background:#2563eb;
color:#ffffff;
text-decoration:none;
padding:12px 20px;
border-radius:8px;
font-weight:bold;
"
>

Login to Employee Portal

</a>


<p style="
margin-top:25px;
font-size:13px;
color:#64748b;
line-height:1.6;
">

Please keep your login credentials confidential.
Do not share your password with anyone.

</p>


<p style="
margin-top:25px;
">

Regards,<br>

<strong>
Talent Corner HR Services
</strong>

</p>

</div>

</body>

</html>
`,
                    });


                // ------------------------------------------------
                // SUCCESS
                // ------------------------------------------------

                emailSent = true;


                console.log(
                    "======================================"
                );

                console.log(
                    "✅ EMAIL SENT SUCCESSFULLY"
                );

                console.log(
                    "To:",
                    employeeEmail
                );

                console.log(
                    "Message ID:",
                    mailResult.messageId
                );

                console.log(
                    "SMTP Response:",
                    mailResult.response
                );

                console.log(
                    "======================================"
                );


            } catch (mailError) {

                emailErrorMessage =
                    mailError?.message ||
                    "Failed to send employee login email.";


                console.error(
                    "======================================"
                );

                console.error(
                    "❌ EMAIL SENDING FAILED"
                );

                console.error(
                    "To:",
                    employeeEmail
                );

                console.error(
                    "Error:",
                    mailError
                );

                console.error(
                    "======================================"
                );
            }


            // ====================================================
            // 15. FINAL RESPONSE
            // ====================================================

            return res.status(201).json({

                success: true,

                message:

                    emailSent

                        ? "Employee account created successfully and login details were sent to the employee's email."

                        : "Employee account created successfully, but the login email could not be sent.",


                email_sent:
                    emailSent,


                email_error:
                    emailErrorMessage,


                data: {

                    employee:
                        updatedCandidate,

                    account:
                        employeeAccount,

                    login: {

                        email:
                            employeeEmail,

                        account_created:
                            true,

                        email_sent:
                            emailSent,
                    },
                },
            });


        } catch (error) {

            console.error(
                "POST /api/employee-users/create-account error:",
                error
            );


            // ====================================================
            // FINAL AUTH ROLLBACK
            // ====================================================

            if (createdAuthUserId) {

                try {

                    await supabase.auth.admin.deleteUser(
                        createdAuthUserId
                    );

                } catch (rollbackError) {

                    console.error(
                        "Final Auth rollback failed:",
                        rollbackError
                    );
                }
            }


            return res.status(500).json({

                success: false,

                message:
                    error?.message ||
                    "Failed to create employee account.",
            });
        }
    }
);


module.exports = router;

