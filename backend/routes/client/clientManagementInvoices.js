// ============================================================
// CLIENT MANAGEMENT INVOICES
//
// CLIENT PORTAL - READ ONLY INVOICES
//
// GET /api/client-management/invoices
// GET /api/client-management/invoices/:id
// GET /api/client-management/invoices/:id/payments
//
// IMPORTANT:
// - Client ID comes from authenticated user profile.
// - client_id query parameter is NEVER trusted.
// - Clients can only access their own invoices.
// - Payment amount/status is calculated from VERIFIED
//   payment_confirmations.
// ============================================================

const express = require("express");

const router = express.Router();

const supabase = require("../../supabaseClient");

const authenticate = require("../../middleware/authenticate");

const authorize = require("../../middleware/authorize");

// ============================================================
// CLIENT AUTH MIDDLEWARE
// ============================================================

const clientOnly = [
    authenticate,
    authorize("client"),
];

// ============================================================
// GET AUTHENTICATED CLIENT ID
// ============================================================

function getAuthenticatedClientId(req) {
    const values = [
        req.profile?.client_id,
        req.user?.client_id,
        req.client?.client_id,
        req.client?.id,
    ];

    for (const value of values) {
        const id = Number(value);

        if (
            Number.isInteger(id) &&
            id > 0
        ) {
            return id;
        }
    }

    return null;
}

// ============================================================
// ROUND MONEY
// ============================================================

function money(value) {
    const number = Number(value || 0);

    return Number(
        number.toFixed(2)
    );
}

// ============================================================
// CALCULATE PAYMENT STATUS
//
// IMPORTANT:
// Never trust client_billing_invoices.payment_status
// for the client portal.
//
// Status is calculated from verified payments.
// ============================================================

function calculatePaymentStatus(
    invoiceTotal,
    amountPaid
) {
    const total = Number(invoiceTotal || 0);
    const paid = Number(amountPaid || 0);

    if (total <= 0) {
        return "Pending";
    }

    if (paid >= total) {
        return "Paid";
    }

    if (paid > 0) {
        return "Partially Paid";
    }

    return "Unpaid";
}

// ============================================================
// CALCULATE OVERDUE
//
// Overdue is separate from payment status.
//
// Example:
//
// Partially Paid + due date passed
// = Partially Paid / Overdue
// ============================================================

function isOverdue(
    dueDate,
    outstandingAmount
) {
    if (!dueDate) {
        return false;
    }

    if (
        Number(outstandingAmount || 0) <= 0
    ) {
        return false;
    }

    const due = new Date(
        `${dueDate}T23:59:59`
    );

    if (
        Number.isNaN(
            due.getTime()
        )
    ) {
        return false;
    }

    return new Date() > due;
}

// ============================================================
// GET VERIFIED PAYMENTS FOR INVOICE IDS
// ============================================================

async function getVerifiedPayments(
    clientId,
    invoiceIds
) {
    if (
        !Array.isArray(invoiceIds) ||
        invoiceIds.length === 0
    ) {
        return [];
    }

    const {
        data,
        error,
    } = await supabase
        .from("payment_confirmations")
        .select(`
            id,
            invoice_id,
            client_id,
            amount_reported,
            payment_date,
            payment_mode,
            reference_number,
            payment_proof_url,
            notes,
            status,
            submitted_at,
            verified_by,
            verified_at,
            rejection_reason
        `)
        .eq(
            "client_id",
            clientId
        )
        .eq(
            "status",
            "Verified"
        )
        .in(
            "invoice_id",
            invoiceIds
        )
        .order(
            "payment_date",
            {
                ascending: false,
            }
        );

    if (error) {
        throw error;
    }

    return Array.isArray(data)
        ? data
        : [];
}

// ============================================================
// CALCULATE INVOICE PAYMENT INFORMATION
// ============================================================

function calculateInvoicePayment(
    invoice,
    verifiedPayments
) {
    const invoiceTotal =
        Number(
            invoice.total_amount || 0
        );

    const payments =
        Array.isArray(
            verifiedPayments
        )
            ? verifiedPayments
            : [];

    const amountPaid =
        payments.reduce(
            (sum, payment) => {
                return (
                    sum +
                    Number(
                        payment.amount_reported || 0
                    )
                );
            },
            0
        );

    const outstanding =
        Math.max(
            invoiceTotal -
                amountPaid,
            0
        );

    const paymentStatus =
        calculatePaymentStatus(
            invoiceTotal,
            amountPaid
        );

    const overdue =
        isOverdue(
            invoice.due_date,
            outstanding
        );

    return {
        amount_paid: money(
            amountPaid
        ),

        outstanding_amount: money(
            outstanding
        ),

        payment_status:
            paymentStatus,

        overdue,

        verified_payment_count:
            payments.length,

        verified_payments:
            payments,
    };
}

// ============================================================
// GET ALL CLIENT INVOICES
//
// GET /api/client-management/invoices
// ============================================================

router.get(
    "/invoices",
    ...clientOnly,
    async (req, res) => {
        try {
            const clientId =
                getAuthenticatedClientId(
                    req
                );

            if (!clientId) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Your client account is not linked to a client record.",
                });
            }

            const {
                billing_month,
                payment_status,
            } = req.query;

            // ------------------------------------------------
            // GET INVOICES
            // ------------------------------------------------

            let query = supabase
                .from(
                    "client_billing_invoices"
                )
                .select(`
                    id,
                    invoice_number,
                    client_id,
                    billing_month,
                    employee_count,
                    total_pay_rate,
                    employer_statutory,
                    service_charge,
                    gross_margin,
                    subtotal,
                    gst_type,
                    cgst,
                    sgst,
                    igst,
                    total_amount,
                    payment_status,
                    due_date,
                    lifecycle_state,
                    created_at,
                    contract_id,

                    clients (
                        id,
                        company_name,
                        gstin,
                        billing_address,
                        state_code,
                        credit_terms,
                        contact_person,
                        email,
                        phone
                    ),

                    client_contracts (
                        id,
                        contract_number,
                        contract_title,
                        billing_model,
                        markup_percentage,
                        per_head_fee,
                        credit_terms,
                        gst_type
                    )
                `)
                .eq(
                    "client_id",
                    clientId
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (
                billing_month &&
                String(
                    billing_month
                ).trim()
            ) {
                query = query.eq(
                    "billing_month",
                    String(
                        billing_month
                    ).trim()
                );
            }

            const {
                data: invoices,
                error: invoiceError,
            } = await query;

            if (invoiceError) {
                console.error(
                    "Client invoices error:",
                    invoiceError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to load client invoices.",
                    error:
                        invoiceError.message,
                });
            }

            const invoiceRows =
                Array.isArray(
                    invoices
                )
                    ? invoices
                    : [];

            // ------------------------------------------------
            // GET VERIFIED PAYMENTS
            // ------------------------------------------------

            const invoiceIds =
                invoiceRows.map(
                    (invoice) =>
                        invoice.id
                );

            let paymentConfirmations =
                [];

            if (
                invoiceIds.length > 0
            ) {
                try {
                    paymentConfirmations =
                        await getVerifiedPayments(
                            clientId,
                            invoiceIds
                        );
                } catch (paymentError) {
                    console.error(
                        "Payment confirmations error:",
                        paymentError
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Failed to load payment confirmations.",
                        error:
                            paymentError.message,
                    });
                }
            }

            // ------------------------------------------------
            // PROCESS INVOICES
            // ------------------------------------------------

            const processedInvoices =
                invoiceRows.map(
                    (invoice) => {
                        const verifiedPayments =
                            paymentConfirmations.filter(
                                (payment) =>
                                    Number(
                                        payment.invoice_id
                                    ) ===
                                    Number(
                                        invoice.id
                                    )
                            );

                        const paymentInfo =
                            calculateInvoicePayment(
                                invoice,
                                verifiedPayments
                            );

                        return {
                            ...invoice,

                            // --------------------------------
                            // REAL PAYMENT INFORMATION
                            // --------------------------------

                            payment_status:
                                paymentInfo.payment_status,

                            amount_paid:
                                paymentInfo.amount_paid,

                            outstanding_amount:
                                paymentInfo.outstanding_amount,

                            overdue:
                                paymentInfo.overdue,

                            verified_payment_count:
                                paymentInfo.verified_payment_count,

                            verified_payments:
                                paymentInfo.verified_payments,
                        };
                    }
                );

            // ------------------------------------------------
            // OPTIONAL PAYMENT STATUS FILTER
            // ------------------------------------------------

            const filteredInvoices =
                payment_status
                    ? processedInvoices.filter(
                          (invoice) =>
                              String(
                                  invoice.payment_status
                              ).toLowerCase() ===
                              String(
                                  payment_status
                              ).toLowerCase()
                      )
                    : processedInvoices;

            // ------------------------------------------------
            // CALCULATE SUMMARY
            // ------------------------------------------------

            const totalBilled =
                processedInvoices.reduce(
                    (sum, invoice) =>
                        sum +
                        Number(
                            invoice.total_amount || 0
                        ),
                    0
                );

            const totalPaid =
                processedInvoices.reduce(
                    (sum, invoice) =>
                        sum +
                        Number(
                            invoice.amount_paid || 0
                        ),
                    0
                );

            const totalOutstanding =
                processedInvoices.reduce(
                    (sum, invoice) =>
                        sum +
                        Number(
                            invoice.outstanding_amount ||
                                0
                        ),
                    0
                );

            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            return res.json({
                success: true,

                invoices:
                    filteredInvoices,

                data:
                    filteredInvoices,

                count:
                    filteredInvoices.length,

                summary: {
                    total_invoices:
                        processedInvoices.length,

                    total_billed:
                        money(
                            totalBilled
                        ),

                    total_paid:
                        money(
                            totalPaid
                        ),

                    total_outstanding:
                        money(
                            totalOutstanding
                        ),
                },
            });
        } catch (error) {
            console.error(
                "GET client invoices error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error while loading invoices.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// GET SINGLE CLIENT INVOICE
//
// GET /api/client-management/invoices/:id
// ============================================================

router.get(
    "/invoices/:id",
    ...clientOnly,
    async (req, res) => {
        try {
            const clientId =
                getAuthenticatedClientId(
                    req
                );

            const invoiceId =
                Number(
                    req.params.id
                );

            if (!clientId) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Your client account is not linked to a client record.",
                });
            }

            if (
                !Number.isInteger(
                    invoiceId
                ) ||
                invoiceId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid invoice ID.",
                });
            }

            // ------------------------------------------------
            // GET INVOICE
            // ------------------------------------------------

            const {
                data: invoice,
                error,
            } = await supabase
                .from(
                    "client_billing_invoices"
                )
                .select(`
                    id,
                    invoice_number,
                    client_id,
                    billing_month,
                    employee_count,
                    total_pay_rate,
                    employer_statutory,
                    service_charge,
                    gross_margin,
                    subtotal,
                    gst_type,
                    cgst,
                    sgst,
                    igst,
                    total_amount,
                    payment_status,
                    due_date,
                    lifecycle_state,
                    created_at,
                    contract_id,

                    clients (
                        id,
                        company_name,
                        gstin,
                        billing_address,
                        state_code,
                        credit_terms,
                        contact_person,
                        email,
                        phone
                    ),

                    client_contracts (
                        id,
                        contract_number,
                        contract_title,
                        billing_model,
                        markup_percentage,
                        per_head_fee,
                        credit_terms,
                        gst_type
                    )
                `)
                .eq(
                    "id",
                    invoiceId
                )
                .eq(
                    "client_id",
                    clientId
                )
                .single();

            if (
                error ||
                !invoice
            ) {
                console.error(
                    "Single client invoice error:",
                    error
                );

                return res.status(404).json({
                    success: false,
                    message:
                        "Invoice not found.",
                });
            }

            // ------------------------------------------------
            // GET VERIFIED PAYMENTS
            // ------------------------------------------------

            let verifiedPayments =
                [];

            try {
                verifiedPayments =
                    await getVerifiedPayments(
                        clientId,
                        [invoiceId]
                    );
            } catch (paymentError) {
                console.error(
                    "Single invoice payment error:",
                    paymentError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to load invoice payments.",
                    error:
                        paymentError.message,
                });
            }

            // ------------------------------------------------
            // CALCULATE REAL PAYMENT INFO
            // ------------------------------------------------

            const paymentInfo =
                calculateInvoicePayment(
                    invoice,
                    verifiedPayments
                );

            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            return res.json({
                success: true,

                invoice: {
                    ...invoice,

                    payment_status:
                        paymentInfo.payment_status,

                    amount_paid:
                        paymentInfo.amount_paid,

                    outstanding_amount:
                        paymentInfo.outstanding_amount,

                    overdue:
                        paymentInfo.overdue,

                    verified_payment_count:
                        paymentInfo.verified_payment_count,

                    verified_payments:
                        paymentInfo.verified_payments,
                },
            });
        } catch (error) {
            console.error(
                "GET client invoice error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error while loading invoice.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// GET PAYMENTS FOR CLIENT INVOICE
//
// GET /api/client-management/invoices/:id/payments
//
// IMPORTANT:
// This uses payment_confirmations.
//
// Only VERIFIED confirmations are treated as actual
// payments received.
// ============================================================

router.get(
    "/invoices/:id/payments",
    ...clientOnly,
    async (req, res) => {
        try {
            const clientId =
                getAuthenticatedClientId(
                    req
                );

            const invoiceId =
                Number(
                    req.params.id
                );

            if (!clientId) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Your client account is not linked to a client record.",
                });
            }

            if (
                !Number.isInteger(
                    invoiceId
                ) ||
                invoiceId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid invoice ID.",
                });
            }

            // ------------------------------------------------
            // VERIFY INVOICE BELONGS TO CLIENT
            // ------------------------------------------------

            const {
                data: invoice,
                error: invoiceError,
            } = await supabase
                .from(
                    "client_billing_invoices"
                )
                .select(`
                    id,
                    invoice_number,
                    client_id,
                    total_amount,
                    payment_status,
                    due_date,
                    lifecycle_state
                `)
                .eq(
                    "id",
                    invoiceId
                )
                .eq(
                    "client_id",
                    clientId
                )
                .single();

            if (
                invoiceError ||
                !invoice
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Invoice not found for this client.",
                });
            }

            // ------------------------------------------------
            // GET VERIFIED PAYMENT CONFIRMATIONS
            // ------------------------------------------------

            const {
                data: payments,
                error: paymentsError,
            } = await supabase
                .from(
                    "payment_confirmations"
                )
                .select(`
                    id,
                    invoice_id,
                    client_id,
                    amount_reported,
                    payment_date,
                    payment_mode,
                    reference_number,
                    payment_proof_url,
                    notes,
                    status,
                    submitted_at,
                    verified_by,
                    verified_at,
                    rejection_reason
                `)
                .eq(
                    "invoice_id",
                    invoiceId
                )
                .eq(
                    "client_id",
                    clientId
                )
                .eq(
                    "status",
                    "Verified"
                )
                .order(
                    "payment_date",
                    {
                        ascending: false,
                    }
                );

            if (paymentsError) {
                console.error(
                    "Client payment confirmation error:",
                    paymentsError
                );

                return res.status(500).json({
                    success: false,
                    message:
                        "Failed to load payment information.",
                    error:
                        paymentsError.message,
                });
            }

            const paymentRows =
                Array.isArray(
                    payments
                )
                    ? payments
                    : [];

            // ------------------------------------------------
            // CALCULATE TOTAL RECEIVED
            // ------------------------------------------------

            const totalReceived =
                paymentRows.reduce(
                    (sum, payment) =>
                        sum +
                        Number(
                            payment.amount_reported ||
                                0
                        ),
                    0
                );

            // ------------------------------------------------
            // INVOICE TOTAL
            // ------------------------------------------------

            const invoiceTotal =
                Number(
                    invoice.total_amount || 0
                );

            // ------------------------------------------------
            // BALANCE
            // ------------------------------------------------

            const balanceRemaining =
                Math.max(
                    invoiceTotal -
                        totalReceived,
                    0
                );

            // ------------------------------------------------
            // REAL PAYMENT STATUS
            // ------------------------------------------------

            const calculatedStatus =
                calculatePaymentStatus(
                    invoiceTotal,
                    totalReceived
                );

            // ------------------------------------------------
            // OVERDUE
            // ------------------------------------------------

            const overdue =
                isOverdue(
                    invoice.due_date,
                    balanceRemaining
                );

            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            return res.json({
                success: true,

                invoice: {
                    id:
                        invoice.id,

                    invoice_number:
                        invoice.invoice_number,

                    total_amount:
                        money(
                            invoiceTotal
                        ),

                    payment_status:
                        calculatedStatus,

                    amount_paid:
                        money(
                            totalReceived
                        ),

                    outstanding_amount:
                        money(
                            balanceRemaining
                        ),

                    due_date:
                        invoice.due_date,

                    lifecycle_state:
                        invoice.lifecycle_state,

                    overdue,
                },

                payments:
                    paymentRows,

                summary: {
                    total_received:
                        money(
                            totalReceived
                        ),

                    total_settled:
                        money(
                            totalReceived
                        ),

                    balance_remaining:
                        money(
                            balanceRemaining
                        ),

                    verified_payment_count:
                        paymentRows.length,

                    payment_status:
                        calculatedStatus,

                    overdue,
                },
            });
        } catch (error) {
            console.error(
                "GET client invoice payments error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Server error while loading payments.",
                error:
                    error.message,
            });
        }
    }
);

// ============================================================
// BLOCK DIRECT LEDGER PAYMENT
//
// Clients cannot directly modify payments_ledger.
//
// They must submit:
//
// POST /api/client/invoices/:invoiceId/payment-confirmation
// ============================================================

router.post(
    "/invoices/:id/payments",
    ...clientOnly,
    async (req, res) => {
        return res.status(403).json({
            success: false,
            message:
                "Clients cannot directly record ledger payments. Submit a payment confirmation instead.",
        });
    }
);

// ============================================================
// EXPORT
// ============================================================

module.exports = router;