// =========================================================
// routes/billing.js
// CLIENT BILLING ROUTES
//
// CLIENT BILLING SOURCE:
// third_party_emp_attendance
//
// BILLING FLOW:
//
// third_party_emp_attendance
//          ↓
// deployments
//          ↓
// deployments.bill_rate
//          ↓
// employee billing
//          ↓
// subtotal
//          ↓
// GST
//          ↓
// invoice total
//
// IMPORTANT
// ---------------------------------------------------------
// pay_rate  = INTERNAL PAYROLL ONLY
// bill_rate = CLIENT BILLING ONLY
//
// NO attendance approval.
// NO third_party_attendance_approval.
// =========================================================

const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");
const nodemailer = require("nodemailer");

// =========================================================
// TABLES
// =========================================================

const INVOICE_TABLE = "client_billing_invoices";
const PAYMENT_TABLE = "payments_ledger";
const DEPLOYMENT_TABLE = "deployments";
const CONTRACT_TABLE = "client_contracts";
const CLIENT_TABLE = "clients";
const ATTENDANCE_TABLE = "third_party_emp_attendance";

// =========================================================
// HELPERS
// =========================================================

const getId = (value) => {
    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }

    return id;
};

const roundMoney = (value) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Number(number.toFixed(2));
};

const sendError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        error: message,
    });
};

// =========================================================
// NORMALIZE BILLING MONTH
//
// Accepts:
// 2026-09
// 2026-09-01
// =========================================================

const getBillingMonth = (value) => {
    const match = String(value || "").match(
        /^(\d{4})-(\d{2})(?:-\d{2})?$/
    );

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    ) {
        return null;
    }

    return `${year}-${String(month).padStart(2, "0")}`;
};

// =========================================================
// GET MONTH START
// =========================================================

const getMonthStart = (billingMonth) => {
    return `${billingMonth}-01`;
};

// =========================================================
// GET NUMBER OF DAYS IN BILLING MONTH
// =========================================================

const getDaysInBillingMonth = (billingMonth) => {
    const [year, month] = billingMonth
        .split("-")
        .map(Number);

    return new Date(year, month, 0).getDate();
};

// =========================================================
// GET CLIENT
// =========================================================

const getClient = async (clientId) => {
    const { data, error } = await supabase
        .from(CLIENT_TABLE)
        .select(`
            id,
            company_name,
            email,
            gstin,
            billing_address,
            state_code,
            credit_terms,
            service_fee
        `)
        .eq("id", clientId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
};

// =========================================================
// GET LATEST CLIENT CONTRACT
// =========================================================

const getClientContract = async (clientId) => {
    const { data, error } = await supabase
        .from(CONTRACT_TABLE)
        .select(`
            id,
            client_id,
            contract_number,
            contract_title,
            billing_model,
            markup_percentage,
            per_head_fee,
            credit_terms,
            gst_type
        `)
        .eq("client_id", clientId)
        .order("id", {
            ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
};

// =========================================================
// GET CONTRACTS
// =========================================================

const getContracts = async (contractIds = []) => {
    if (!contractIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from(CONTRACT_TABLE)
        .select(`
            id,
            client_id,
            contract_number,
            contract_title,
            billing_model,
            markup_percentage,
            per_head_fee,
            credit_terms,
            gst_type
        `)
        .in("id", contractIds);

    if (error) {
        throw error;
    }

    return data || [];
};

// =========================================================
// CALCULATE INTERNAL PAYROLL
//
// pay_rate is used ONLY internally.
//
// It is NEVER used as client billing rate.
// =========================================================

const calculateThirdPartyPayrollAndBilling = (
    employeeProfile,
    attendanceData,
    contractTerms
) => {
    const totalDaysInMonth =
        Number(attendanceData?.total_days) || 30;

    const lopDays =
        Math.max(
            Number(attendanceData?.lop_days) || 0,
            0
        );

    const profileBasic =
        Number(employeeProfile?.basic_salary) || 0;

    const profileAllowances =
        Number(employeeProfile?.allowances) || 0;

    const overtime =
        Number(employeeProfile?.overtime) || 0;

    const bonus =
        Number(employeeProfile?.bonus) || 0;

    const taxTds =
        Number(
            employeeProfile?.tax_tds ??
            employeeProfile?.tax ??
            0
        ) || 0;

    const professionalTax = 200;

    const markupPercent =
        Number(
            contractTerms?.markup_percentage || 0
        ) || 0;

    // =====================================================
    // LOP
    // =====================================================

    const dailyBasicRate =
        profileBasic / totalDaysInMonth;

    const dailyAllowanceRate =
        profileAllowances / totalDaysInMonth;

    const lopBasicDeduction =
        Math.round(
            dailyBasicRate * lopDays
        );

    const lopAllowanceDeduction =
        Math.round(
            dailyAllowanceRate * lopDays
        );

    const totalLopDeductionAmount =
        lopBasicDeduction +
        lopAllowanceDeduction;

    const earnedBasic =
        Math.max(
            profileBasic -
            lopBasicDeduction,
            0
        );

    const earnedAllowances =
        Math.max(
            profileAllowances -
            lopAllowanceDeduction,
            0
        );

    // =====================================================
    // GROSS SALARY
    // =====================================================

    const grossSalary =
        earnedBasic +
        earnedAllowances +
        overtime +
        bonus;

    // =====================================================
    // PF
    // =====================================================

    const pfBase =
        Math.min(
            Math.max(earnedBasic, 0),
            15000
        );

    const employeePF =
        Math.round(
            pfBase * 0.12
        );

    const employerPF =
        Math.round(
            pfBase * 0.12
        );

    // =====================================================
    // ESIC
    // =====================================================

    const esicGrossForEligibility =
        earnedBasic +
        earnedAllowances +
        bonus;

    let employeeESIC = 0;
    let employerESIC = 0;

    if (
        esicGrossForEligibility <= 21000 &&
        grossSalary > 0
    ) {
        employeeESIC =
            Math.round(
                grossSalary * 0.0075
            );

        employerESIC =
            Math.round(
                grossSalary * 0.0325
            );
    }

    // =====================================================
    // NET SALARY
    // =====================================================

    const netSalary =
        grossSalary -
        (
            employeePF +
            employeeESIC +
            taxTds +
            professionalTax
        );

    // =====================================================
    // EMPLOYEE COST / CTC
    //
    // INTERNAL ONLY
    // =====================================================

    const totalEmployeeCostCTC =
        grossSalary +
        employerPF +
        employerESIC;

    // =====================================================
    // INTERNAL MARKUP
    // =====================================================

    const internalServiceCharge =
        Math.round(
            totalEmployeeCostCTC *
            (markupPercent / 100)
        );

    return {
        clientFacing: {
            employer_pf:
                roundMoney(employerPF),

            employer_esic:
                roundMoney(employerESIC),

            employer_statutory:
                roundMoney(
                    employerPF +
                    employerESIC
                ),

            total_workforce_cost:
                roundMoney(
                    totalEmployeeCostCTC
                ),

            agency_service_charge:
                roundMoney(
                    internalServiceCharge
                ),
        },

        internal: {
            basic_salary:
                roundMoney(profileBasic),

            allowances:
                roundMoney(profileAllowances),

            overtime:
                roundMoney(overtime),

            bonus:
                roundMoney(bonus),

            total_lop_deduction:
                roundMoney(
                    totalLopDeductionAmount
                ),

            gross_salary:
                roundMoney(grossSalary),

            employee_pf:
                roundMoney(employeePF),

            employer_pf:
                roundMoney(employerPF),

            employee_esic:
                roundMoney(employeeESIC),

            employer_esic:
                roundMoney(employerESIC),

            total_employee_cost_ctc:
                roundMoney(
                    totalEmployeeCostCTC
                ),

            service_charge:
                roundMoney(
                    internalServiceCharge
                ),

            tax:
                roundMoney(taxTds),

            professional_tax:
                roundMoney(professionalTax),

            net_salary:
                roundMoney(netSalary),
        },
    };
};

// =========================================================
// CALCULATE CLIENT BILLING
//
// IMPORTANT
// ---------------------------------------------------------
// bill_rate = deployments.bill_rate
// pay_rate  = NEVER used here
//
// Fixed Billing Rate:
//      bill_amount = bill_rate + client service fee
//
// Per Head:
//      bill_amount = per_head_fee + client service fee
//
// Percentage Markup:
//      bill_amount = workforce cost + markup
//
// =========================================================

const calculateClientBilling = ({
    deployment,
    contract,
    client,
    payrollCalculation,
}) => {
    // =====================================================
    // CLIENT BILL RATE
    //
    // THIS IS THE IMPORTANT VALUE.
    //
    // deployments row:
    // pay_rate  = 40000
    // bill_rate = 80000
    //
    // We use ONLY bill_rate.
    // =====================================================

    const billRate =
        Number(
            deployment?.bill_rate
        ) || 0;

    // =====================================================
    // INTERNAL WORKFORCE COST
    //
    // Used only for:
    // - percentage markup
    // - gross margin
    // - internal reporting
    //
    // NOT added to Fixed Billing Rate.
    // =====================================================

    const workforceCost =
        Number(
            payrollCalculation
                ?.clientFacing
                ?.total_workforce_cost
        ) || 0;

    // =====================================================
    // BILLING MODEL
    // =====================================================

    const billingModel =
        deployment?.billing_model ||
        contract?.billing_model ||
        "Fixed Billing Rate";

    const clientServiceFee =
        Number(
            client?.service_fee
        ) || 0;

    const markupPercentage =
        Number(
            contract?.markup_percentage
        ) || 0;

    let serviceCharge = 0;
    let billAmount = 0;

    // =====================================================
    // FIXED BILLING RATE
    //
    // bill_rate is already the CLIENT CHARGE.
    //
    // Example:
    //
    // pay_rate  = 40,000
    // bill_rate = 80,000
    //
    // Client billing = 80,000
    //
    // NOT:
    // 80,000 + 40,000
    // =====================================================

    if (
        billingModel === "Fixed Billing Rate"
    ) {
        serviceCharge =
            clientServiceFee;

        billAmount =
            billRate +
            serviceCharge;
    }

    // =====================================================
    // PER HEAD
    // =====================================================

    else if (
        billingModel === "Per Head"
    ) {
        const perHeadFee =
            Number(
                contract?.per_head_fee
            ) ||
            billRate ||
            0;

        serviceCharge =
            clientServiceFee;

        billAmount =
            perHeadFee +
            serviceCharge;
    }

    // =====================================================
    // PERCENTAGE MARKUP
    //
    // Here bill rate is not used as the final amount.
    // Workforce cost + markup is used.
    // =====================================================

    else if (
        billingModel === "Percentage Markup"
    ) {
        if (
            markupPercentage > 0
        ) {
            serviceCharge =
                workforceCost *
                (
                    markupPercentage /
                    100
                );
        } else {
            serviceCharge =
                clientServiceFee;
        }

        billAmount =
            workforceCost +
            serviceCharge;
    }

    // =====================================================
    // FALLBACK
    // =====================================================

    else {
        serviceCharge =
            clientServiceFee;

        billAmount =
            billRate +
            serviceCharge;
    }

    return {
        billing_model:
            billingModel,

        bill_rate:
            roundMoney(
                billRate
            ),

        bill_amount:
            roundMoney(
                billAmount
            ),

        service_charge:
            roundMoney(
                serviceCharge
            ),

        gross_margin:
            roundMoney(
                billAmount -
                workforceCost
            ),
    };
};

// =========================================================
// BUILD ATTENDANCE BILLING
//
// SOURCE:
// third_party_emp_attendance
//
// MATCH:
//
// attendance.deployment_id
//             ↓
// deployments.id
//
// FALLBACK:
//
// attendance.employee_id
//             ↓
// deployments.candidate_id
//
// BILL RATE:
//
// deployments.bill_rate
//
// PAY RATE:
//
// deployments.pay_rate
// INTERNAL ONLY
//
// NOTE ON WARNINGS:
// ---------------------------------------------------------
// The attendance query below is pre-filtered to only rows
// that could plausibly belong to this client (by deployment_id
// or employee_id/candidate_id). This means an employee deployed
// to a DIFFERENT client will simply never enter the loop below -
// that is expected behavior, not an error, so it produces no
// warning. Any warning that DOES fire inside the loop represents
// a genuine data integrity issue and is logged as console.error.
// =========================================================

const buildAttendanceBilling = async ({
    clientId,
    billingMonth,
}) => {
    // =====================================================
    // GET CLIENT
    // =====================================================

    const client =
        await getClient(
            clientId
        );

    if (!client) {
        throw new Error(
            "Client not found"
        );
    }

    // =====================================================
    // 1. GET CLIENT DEPLOYMENTS
    //
    // Fetched BEFORE attendance so we can pre-scope the
    // attendance query to only rows that could belong to
    // this client.
    // =====================================================

    const {
        data: clientDeployments,
        error: deploymentError,
    } = await supabase
        .from(
            DEPLOYMENT_TABLE
        )
        .select(`
            id,
            client_id,
            candidate_id,
            contract_id,
            project_name,
            pay_rate,
            bill_rate,
            billing_model,
            start_date,
            end_date,
            status
        `)
        .eq(
            "client_id",
            clientId
        );

    if (deploymentError) {
        throw deploymentError;
    }

    const deployments =
        clientDeployments || [];

    // =====================================================
    // 2. DEPLOYMENT MAP + RELEVANT ID SETS
    //
    // deploymentIds / candidateIds scope the attendance
    // query below to ONLY rows that could belong to this
    // client. Attendance for employees deployed elsewhere
    // is excluded before the loop runs, so it can never
    // produce a false "no deployment found" warning.
    // =====================================================

    const deploymentMap =
        new Map();

    const deploymentIds =
        new Set();

    const candidateIds =
        new Set();

    deployments.forEach(
        (deployment) => {
            const deploymentId =
                Number(deployment.id);

            deploymentMap.set(
                deploymentId,
                deployment
            );

            deploymentIds.add(
                deploymentId
            );

            if (deployment.candidate_id) {
                candidateIds.add(
                    Number(deployment.candidate_id)
                );
            }
        }
    );

    // =====================================================
    // 3. GET ATTENDANCE (month + client scoped)
    //
    // IMPORTANT:
    // We fetch the requested month, then filter in JS so
    // both:
    // 2026-09
    // and
    // 2026-09-01
    // are supported. We ALSO filter to attendance rows that
    // plausibly belong to this client (matching deployment_id
    // or employee_id against this client's deployments) so
    // rows for employees deployed to a different client never
    // reach the per-row matching loop below.
    // =====================================================

    const {
        data: allAttendanceRows,
        error: attendanceError,
    } = await supabase
        .from(
            ATTENDANCE_TABLE
        )
        .select(`
            id,
            employee_name,
            billing_month,
            status,
            present_days,
            absent_days,
            leave_days,
            overtime_hours,
            deployment_id,
            employee_id,
            half_days,
            lop_days,
            payable_days
        `)
        .order("id", {
            ascending: true,
        });

    if (attendanceError) {
        throw attendanceError;
    }

    const attendanceRows =
        (allAttendanceRows || [])
            .filter((row) => {
                const rowMonth =
                    getBillingMonth(
                        row.billing_month
                    );

                if (
                    rowMonth !==
                    billingMonth
                ) {
                    return false;
                }

                const deploymentMatches =
                    row.deployment_id &&
                    deploymentIds.has(
                        Number(row.deployment_id)
                    );

                const employeeMatches =
                    row.employee_id &&
                    candidateIds.has(
                        Number(row.employee_id)
                    );

                return (
                    deploymentMatches ||
                    employeeMatches
                );
            });

    if (
        attendanceRows.length === 0
    ) {
        return {
            employees: [],

            totals: {
                employee_count: 0,
                total_bill_rate: 0,
                subtotal: 0,
                employer_statutory: 0,
                ot_amount: 0,
                lop_deduction: 0,
                employee_cost: 0,
                service_charge: 0,
                gross_margin: 0,
            },
        };
    }

    // =====================================================
    // 4. CONTRACTS
    // =====================================================

    const contractIds = [
        ...new Set(
            deployments
                .map(
                    (deployment) =>
                        deployment.contract_id
                )
                .filter(Boolean)
        ),
    ];

    const contracts =
        await getContracts(
            contractIds
        );

    const contractMap =
        new Map(
            contracts.map(
                (contract) => [
                    Number(
                        contract.id
                    ),
                    contract,
                ]
            )
        );

    // =====================================================
    // 5. LATEST CLIENT CONTRACT FALLBACK
    // =====================================================

    const latestContract =
        await getClientContract(
            clientId
        );

    // =====================================================
    // 6. DAYS IN MONTH
    // =====================================================

    const totalDaysInMonth =
        getDaysInBillingMonth(
            billingMonth
        );

    // =====================================================
    // 7. BUILD BILLING ROWS
    // =====================================================

    const employeeBilling = [];

    for (
        const attendance of attendanceRows
    ) {

        // =================================================
        // MATCH ATTENDANCE TO DEPLOYMENT
        //
        // 1. PRIMARY: attendance.deployment_id -> deployments.id
        // 2. FALLBACK: attendance.employee_id -> deployments.candidate_id
        //
        // attendanceRows is already scoped to this client
        // (see filter above), so this should always resolve.
        // If it doesn't, that's a genuine data integrity
        // issue worth flagging loudly rather than a routine
        // "employee deployed elsewhere" case.
        // =================================================

        let deployment = null;

        if (attendance.deployment_id) {
            deployment =
                deploymentMap.get(
                    Number(attendance.deployment_id)
                ) || null;
        }

        if (!deployment && attendance.employee_id) {
            deployment =
                deployments.find(
                    (d) =>
                        Number(d.candidate_id) ===
                        Number(attendance.employee_id)
                ) || null;

            if (deployment) {
                console.warn(
                    `Billing: attendance ${attendance.id} matched via employee_id fallback ` +
                    `(deployment_id=${attendance.deployment_id} was invalid/stale). ` +
                    `Resolved to deployment ${deployment.id}.`
                );
            }
        }

        if (!deployment) {
            // Should be unreachable given the pre-filter above.
            // If this fires, deploymentIds/candidateIds and the
            // per-row match logic have gone out of sync - treat
            // as a real bug, not routine noise.
            console.error(
                `Billing DATA INTEGRITY ISSUE: attendance ${attendance.id} passed ` +
                `client-scope filtering but resolved to no deployment. ` +
                `deployment_id=${attendance.deployment_id}, employee_id=${attendance.employee_id}, ` +
                `employee=${attendance.employee_name}, client=${clientId}`
            );

            continue;
        }

        // =================================================
        // DEPLOYMENT BILL RATE
        //
        // IMPORTANT DEBUG
        // =================================================

        const deploymentBillRate =
            Number(
                deployment.bill_rate
            ) || 0;

        console.log(
            "CLIENT BILLING:",
            {
                attendance_id:
                    attendance.id,

                employee_id:
                    attendance.employee_id,

                deployment_id:
                    deployment.id,

                pay_rate:
                    deployment.pay_rate,

                bill_rate:
                    deployment.bill_rate,

                numeric_bill_rate:
                    deploymentBillRate,

                billing_model:
                    deployment.billing_model,
            }
        );

        // =================================================
        // CONTRACT
        // =================================================

        const contract =
            contractMap.get(
                Number(
                    deployment.contract_id
                )
            ) ||
            latestContract;

        if (!contract) {
            console.warn(
                `Billing: no contract found for deployment ${deployment.id}`
            );

            continue;
        }

        // =================================================
        // INTERNAL PAY RATE
        //
        // ONLY payroll.
        // =================================================

        const payRate =
            Number(
                deployment.pay_rate
            ) || 0;

        // =================================================
        // ATTENDANCE VALUES
        // =================================================

        const presentDays =
            Number(
                attendance.present_days
            ) || 0;

        const absentDays =
            Number(
                attendance.absent_days
            ) || 0;

        const leaveDays =
            Number(
                attendance.leave_days
            ) || 0;

        const halfDays =
            Number(
                attendance.half_days
            ) || 0;

        const payableDays =
            Number(
                attendance.payable_days
            ) || 0;

        const lopDays =
            Number(
                attendance.lop_days
            ) || 0;

        const otHours =
            Number(
                attendance.overtime_hours
            ) || 0;

        // =================================================
        // INTERNAL PAYROLL PROFILE
        // =================================================

        const payrollProfile = {
            basic_salary:
                payRate,

            allowances: 0,

            overtime: 0,

            bonus: 0,

            tax_tds: 0,
        };

        // =================================================
        // INTERNAL PAYROLL CALCULATION
        // =================================================

        const payrollCalculation =
            calculateThirdPartyPayrollAndBilling(
                payrollProfile,
                {
                    total_days:
                        totalDaysInMonth,

                    lop_days:
                        lopDays,
                },
                contract
            );

        // =================================================
        // CLIENT BILLING
        //
        // IMPORTANT:
        // Only deployments.bill_rate is used for
        // Fixed Billing Rate.
        // =================================================

        const clientBilling =
            calculateClientBilling({
                deployment,
                contract,
                client,
                payrollCalculation,
            });

        // =================================================
        // BILL RATE VALIDATION
        // =================================================

        if (
            clientBilling.bill_rate <= 0
        ) {
            console.warn(
                `Billing: deployment ${deployment.id} has bill_rate=${deployment.bill_rate}. Employee ${attendance.employee_id} skipped.`
            );

            continue;
        }

        // =================================================
        // EMPLOYER STATUTORY
        // =================================================

        const employerPF =
            Number(
                payrollCalculation
                    .internal
                    .employer_pf
            ) || 0;

        const employerESIC =
            Number(
                payrollCalculation
                    .internal
                    .employer_esic
            ) || 0;

        const employerStatutory =
            employerPF +
            employerESIC;

        // =================================================
        // OT
        // =================================================

        const otAmount =
            Number(
                payrollCalculation
                    .internal
                    .overtime
            ) || 0;

        // =================================================
        // LOP
        // =================================================

        const lopDeduction =
            Number(
                payrollCalculation
                    .internal
                    .total_lop_deduction
            ) || 0;

        // =================================================
        // INTERNAL EMPLOYEE COST
        // =================================================

        const employeeCost =
            Number(
                payrollCalculation
                    .internal
                    .total_employee_cost_ctc
            ) || 0;

        // =================================================
        // SERVICE CHARGE
        // =================================================

        const serviceCharge =
            Number(
                clientBilling.service_charge
            ) || 0;

        // =================================================
        // FINAL CLIENT BILLING ROW
        //
        // pay_rate is intentionally NOT returned.
        // =================================================

        employeeBilling.push({
            attendance_id:
                attendance.id,

            employee_id:
                attendance.employee_id,

            employee_name:
                attendance.employee_name ||
                `Employee #${attendance.employee_id}`,

            deployment_id:
                deployment.id,

            contract_id:
                contract.id,

            project_name:
                deployment.project_name ||
                null,

            billing_month:
                billingMonth,

            attendance_status:
                attendance.status,

            present_days:
                presentDays,

            absent_days:
                absentDays,

            leave_days:
                leaveDays,

            half_days:
                halfDays,

            payable_days:
                payableDays,

            overtime_hours:
                otHours,

            lop_days:
                lopDays,

            // =================================================
            // CLIENT BILLING
            // =================================================

            bill_rate:
                roundMoney(
                    clientBilling.bill_rate
                ),

            bill_amount:
                roundMoney(
                    clientBilling.bill_amount
                ),

            billing_model:
                clientBilling.billing_model,

            // =================================================
            // INTERNAL/COST INFORMATION
            // =================================================

            employer_statutory:
                roundMoney(
                    employerStatutory
                ),

            ot_amount:
                roundMoney(
                    otAmount
                ),

            lop_deduction:
                roundMoney(
                    lopDeduction
                ),

            service_charge:
                roundMoney(
                    serviceCharge
                ),

            employee_cost:
                roundMoney(
                    employeeCost
                ),

            gross_margin:
                roundMoney(
                    clientBilling.gross_margin
                ),
        });
    }

    // =====================================================
    // 8. TOTALS
    // =====================================================

    const totals =
        employeeBilling.reduce(
            (acc, employee) => {
                acc.employee_count += 1;

                acc.total_bill_rate +=
                    Number(
                        employee.bill_rate
                    ) || 0;

                acc.subtotal +=
                    Number(
                        employee.bill_amount
                    ) || 0;

                acc.employer_statutory +=
                    Number(
                        employee.employer_statutory
                    ) || 0;

                acc.ot_amount +=
                    Number(
                        employee.ot_amount
                    ) || 0;

                acc.lop_deduction +=
                    Number(
                        employee.lop_deduction
                    ) || 0;

                acc.employee_cost +=
                    Number(
                        employee.employee_cost
                    ) || 0;

                acc.service_charge +=
                    Number(
                        employee.service_charge
                    ) || 0;

                acc.gross_margin +=
                    Number(
                        employee.gross_margin
                    ) || 0;

                return acc;
            },
            {
                employee_count: 0,
                total_bill_rate: 0,
                subtotal: 0,
                employer_statutory: 0,
                ot_amount: 0,
                lop_deduction: 0,
                employee_cost: 0,
                service_charge: 0,
                gross_margin: 0,
            }
        );

    Object.keys(totals).forEach(
        (key) => {
            if (
                key !==
                "employee_count"
            ) {
                totals[key] =
                    roundMoney(
                        totals[key]
                    );
            }
        }
    );

    return {
        employees:
            employeeBilling,

        totals,
    };
};

// =========================================================
// 1. GET ALL CLIENT BILLING INVOICES
// =========================================================

router.get(
    "/client-billing/invoices",
    async (req, res) => {
        try {
            const {
                data: invoices,
                error: invoiceError,
            } = await supabase
                .from(INVOICE_TABLE)
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
                    invoice_date,

                    clients (
                        id,
                        company_name,
                        gstin,
                        billing_address,
                        state_code,
                        credit_terms,
                        email
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
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

            if (invoiceError) {
                throw invoiceError;
            }

            const invoiceList =
                invoices || [];

            const invoiceIds =
                invoiceList.map(
                    (invoice) =>
                        invoice.id
                );

            let payments = [];

            if (
                invoiceIds.length
            ) {
                const {
                    data,
                    error,
                } = await supabase
                    .from(PAYMENT_TABLE)
                    .select(`
                        invoice_id,
                        amount_received,
                        tds_deducted
                    `)
                    .in(
                        "invoice_id",
                        invoiceIds
                    );

                if (error) {
                    throw error;
                }

                payments = data || [];
            }

            const paymentTotals = {};

            payments.forEach(
                (payment) => {
                    const invoiceId =
                        payment.invoice_id;

                    if (
                        !paymentTotals[
                        invoiceId
                        ]
                    ) {
                        paymentTotals[
                            invoiceId
                        ] = {
                            total_received: 0,
                            total_tds: 0,
                        };
                    }

                    paymentTotals[
                        invoiceId
                    ].total_received +=
                        Number(
                            payment.amount_received
                        ) || 0;

                    paymentTotals[
                        invoiceId
                    ].total_tds +=
                        Number(
                            payment.tds_deducted
                        ) || 0;
                }
            );

            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];

            const enrichedInvoices =
                invoiceList.map(
                    (invoice) => {
                        const totals =
                            paymentTotals[
                            invoice.id
                            ] || {
                                total_received: 0,
                                total_tds: 0,
                            };

                        const invoiceTotal =
                            Number(
                                invoice.total_amount
                            ) || 0;

                        const totalReceived =
                            Number(
                                totals.total_received
                            ) || 0;

                        const totalTDS =
                            Number(
                                totals.total_tds
                            ) || 0;

                        const totalSettled =
                            totalReceived +
                            totalTDS;

                        const balanceRemaining =
                            Math.max(
                                invoiceTotal -
                                totalSettled,
                                0
                            );

                        let paymentStatus =
                            "Pending";

                        if (
                            totalSettled > 0 &&
                            balanceRemaining <= 0
                        ) {
                            paymentStatus =
                                "Paid";
                        } else if (
                            totalSettled > 0
                        ) {
                            paymentStatus =
                                invoice.due_date &&
                                    invoice.due_date <
                                    today
                                    ? "Partially Paid - Overdue"
                                    : "Partially Paid";
                        } else if (
                            invoice.due_date &&
                            invoice.due_date <
                            today
                        ) {
                            paymentStatus =
                                "Overdue";
                        }

                        return {
                            ...invoice,

                            total_bill_rate:
                                roundMoney(
                                    invoice.subtotal
                                ),

                            total_received:
                                roundMoney(
                                    totalReceived
                                ),

                            total_tds:
                                roundMoney(
                                    totalTDS
                                ),

                            total_settled:
                                roundMoney(
                                    totalSettled
                                ),

                            balance_remaining:
                                roundMoney(
                                    balanceRemaining
                                ),

                            payment_status:
                                paymentStatus,
                        };
                    }
                );

            return res.json({
                success: true,
                data:
                    enrichedInvoices,
            });
        } catch (error) {
            console.error(
                "GET /api/client-billing/invoices:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to fetch invoices"
            );
        }
    }
);

// =========================================================
// 2. CLIENT BILLING PREVIEW
// =========================================================

router.get(
    "/client-billing/preview",
    async (req, res) => {
        try {
            const clientId =
                getId(
                    req.query.client_id
                );

            const billingMonth =
                getBillingMonth(
                    req.query.billing_month
                );

            if (!clientId) {
                return sendError(
                    res,
                    400,
                    "Invalid client_id"
                );
            }

            if (!billingMonth) {
                return sendError(
                    res,
                    400,
                    "Invalid billing_month. Use YYYY-MM"
                );
            }

            const client =
                await getClient(
                    clientId
                );

            if (!client) {
                return sendError(
                    res,
                    404,
                    "Client not found"
                );
            }

            const contract =
                await getClientContract(
                    clientId
                );

            if (!contract) {
                return sendError(
                    res,
                    400,
                    "No client contract found"
                );
            }

            const billing =
                await buildAttendanceBilling({
                    clientId,
                    billingMonth,
                });

            return res.json({
                success: true,

                data: {
                    client,

                    client_id:
                        clientId,

                    billing_month:
                        getMonthStart(
                            billingMonth
                        ),

                    contract,

                    employees:
                        billing.employees,

                    totals:
                        billing.totals,
                },
            });
        } catch (error) {
            console.error(
                "GET /api/client-billing/preview:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to prepare client billing"
            );
        }
    }
);

// =========================================================
// 3. GENERATE CLIENT BILLING INVOICE
// =========================================================

router.post(
    "/client-billing",
    async (req, res) => {
        try {
            const clientId =
                getId(
                    req.body.client_id
                );

            const billingMonth =
                getBillingMonth(
                    req.body.billing_month
                );

            if (!clientId) {
                return sendError(
                    res,
                    400,
                    "Invalid client_id"
                );
            }

            if (!billingMonth) {
                return sendError(
                    res,
                    400,
                    "Invalid billing_month. Use YYYY-MM"
                );
            }

            const normalizedMonth =
                getMonthStart(
                    billingMonth
                );

            const client =
                await getClient(
                    clientId
                );

            if (!client) {
                return sendError(
                    res,
                    404,
                    "Client not found"
                );
            }

            const contract =
                await getClientContract(
                    clientId
                );

            if (!contract) {
                return sendError(
                    res,
                    400,
                    "No client contract found"
                );
            }

            // =================================================
            // BUILD BILLING
            // =================================================

            const billing =
                await buildAttendanceBilling({
                    clientId,
                    billingMonth,
                });

            if (
                !billing.employees.length
            ) {
                return sendError(
                    res,
                    400,
                    `No billing employees found for ${billingMonth}`
                );
            }

            const totals =
                billing.totals;

            // =================================================
            // GST
            // =================================================

            const gstType =
                req.body.gst_type ||
                contract.gst_type ||
                "CGST+SGST";

            let cgst = 0;
            let sgst = 0;
            let igst = 0;

            if (
                gstType ===
                "Intra-State (CGST+SGST)" ||
                gstType ===
                "CGST+SGST"
            ) {
                cgst =
                    totals.subtotal *
                    0.09;

                sgst =
                    totals.subtotal *
                    0.09;
            } else if (
                gstType ===
                "Inter-State (IGST)" ||
                gstType ===
                "IGST"
            ) {
                igst =
                    totals.subtotal *
                    0.18;
            }

            cgst =
                roundMoney(cgst);

            sgst =
                roundMoney(sgst);

            igst =
                roundMoney(igst);

            const totalAmount =
                roundMoney(
                    totals.subtotal +
                    cgst +
                    sgst +
                    igst
                );

            // =================================================
            // CREDIT TERMS
            // =================================================

            let creditDays = 30;

            if (
                contract.credit_terms
            ) {
                const match =
                    String(
                        contract.credit_terms
                    ).match(/\d+/);

                if (match) {
                    creditDays =
                        Number(
                            match[0]
                        );
                }
            }

            const dueDate =
                new Date(
                    `${normalizedMonth}T00:00:00`
                );

            dueDate.setDate(
                dueDate.getDate() +
                creditDays
            );

            // =================================================
            // DUPLICATE INVOICE
            // =================================================

            const {
                data: existingInvoices,
                error: existingError,
            } = await supabase
                .from(INVOICE_TABLE)
                .select(`
                    id,
                    invoice_number
                `)
                .eq(
                    "client_id",
                    clientId
                )
                .eq(
                    "billing_month",
                    normalizedMonth
                )
                .eq(
                    "contract_id",
                    contract.id
                )
                .limit(1);

            if (existingError) {
                throw existingError;
            }

            if (
                existingInvoices &&
                existingInvoices.length
            ) {
                return sendError(
                    res,
                    409,
                    `Invoice already exists: ${existingInvoices[0].invoice_number}`
                );
            }

            // =================================================
            // INVOICE NUMBER
            // =================================================

            const {
                count: invoiceCount,
                error: countError,
            } = await supabase
                .from(INVOICE_TABLE)
                .select(
                    "id",
                    {
                        count: "exact",
                        head: true,
                    }
                );

            if (countError) {
                throw countError;
            }

            const nextNumber =
                Number(
                    invoiceCount || 0
                ) + 1;

            const invoiceNumber =
                `INV-${billingMonth.slice(
                    0,
                    4
                )}-${String(
                    nextNumber
                ).padStart(
                    6,
                    "0"
                )}`;

            // =================================================
            // INSERT INVOICE
            // =================================================

            const {
                data: invoice,
                error: insertError,
            } = await supabase
                .from(INVOICE_TABLE)
                .insert({
                    invoice_number:
                        invoiceNumber,

                    client_id:
                        clientId,

                    billing_month:
                        normalizedMonth,

                    employee_count:
                        totals.employee_count,

                    // Legacy field.
                    // Client billing DOES NOT use pay_rate.
                    total_pay_rate:
                        0,

                    employer_statutory:
                        roundMoney(
                            totals.employer_statutory
                        ),

                    service_charge:
                        roundMoney(
                            totals.service_charge
                        ),

                    gross_margin:
                        roundMoney(
                            totals.gross_margin
                        ),

                    subtotal:
                        roundMoney(
                            totals.subtotal
                        ),

                    gst_type:
                        gstType,

                    cgst,

                    sgst,

                    igst,

                    total_amount:
                        totalAmount,

                    payment_status:
                        "Pending",

                    due_date:
                        dueDate
                            .toISOString()
                            .split("T")[0],

                    lifecycle_state:
                        "Draft",

                    contract_id:
                        contract.id,

                    invoice_date:
                        new Date()
                            .toISOString()
                            .split("T")[0],
                })
                .select(`
                    *,
                    clients (
                        id,
                        company_name,
                        email,
                        gstin,
                        billing_address,
                        state_code,
                        credit_terms
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
                .single();

            if (insertError) {
                throw insertError;
            }

            return res.status(201).json({
                success: true,

                message:
                    "Client billing invoice generated successfully.",

                data: {
                    invoice,

                    employee_billing:
                        billing.employees,

                    totals: {
                        employee_count:
                            totals.employee_count,

                        total_bill_rate:
                            totals.total_bill_rate,

                        employer_statutory:
                            totals.employer_statutory,

                        ot_amount:
                            totals.ot_amount,

                        lop_deduction:
                            totals.lop_deduction,

                        employee_cost:
                            totals.employee_cost,

                        service_charge:
                            totals.service_charge,

                        gross_margin:
                            totals.gross_margin,

                        subtotal:
                            totals.subtotal,

                        cgst,

                        sgst,

                        igst,

                        total_amount:
                            totalAmount,
                    },
                },
            });
        } catch (error) {
            console.error(
                "POST /api/client-billing:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to generate client billing invoice"
            );
        }
    }
);

// =========================================================
// 4. UPDATE BILLING LIFECYCLE
// =========================================================

router.patch(
    "/client-billing/:id/status",
    async (req, res) => {
        try {
            const invoiceId =
                getId(
                    req.params.id
                );

            if (!invoiceId) {
                return sendError(
                    res,
                    400,
                    "Invalid invoice ID"
                );
            }

            const {
                lifecycle_state,
            } = req.body;

            const allowedStates = [
                "Draft",
                "Pro-Forma Sent",
                "Tax Invoice Dispatched",
            ];

            if (
                !allowedStates.includes(
                    lifecycle_state
                )
            ) {
                return sendError(
                    res,
                    400,
                    "Invalid lifecycle_state"
                );
            }

            const {
                data: invoice,
                error,
            } = await supabase
                .from(INVOICE_TABLE)
                .update({
                    lifecycle_state,
                })
                .eq(
                    "id",
                    invoiceId
                )
                .select(`
                    *,
                    clients (
                        id,
                        company_name,
                        email,
                        gstin,
                        billing_address,
                        state_code,
                        credit_terms
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
                .single();

            if (error) {
                throw error;
            }

            return res.json({
                success: true,

                message:
                    "Invoice lifecycle status updated successfully.",

                data: invoice,
            });
        } catch (error) {
            console.error(
                "PATCH /api/client-billing/:id/status:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to update invoice status"
            );
        }
    }
);

// =========================================================
// 5. GET PAYMENT HISTORY
// =========================================================

router.get(
    "/invoices/:id/payments",
    async (req, res) => {
        try {
            const invoiceId =
                getId(
                    req.params.id
                );

            if (!invoiceId) {
                return sendError(
                    res,
                    400,
                    "Invalid invoice ID."
                );
            }

            const {
                data: invoice,
                error: invoiceError,
            } = await supabase
                .from(INVOICE_TABLE)
                .select(`
                    id,
                    total_amount,
                    payment_status,
                    lifecycle_state,
                    due_date
                `)
                .eq(
                    "id",
                    invoiceId
                )
                .maybeSingle();

            if (invoiceError) {
                throw invoiceError;
            }

            if (!invoice) {
                return sendError(
                    res,
                    404,
                    "Invoice not found."
                );
            }

            const {
                data: payments,
                error: paymentsError,
            } = await supabase
                .from(PAYMENT_TABLE)
                .select("*")
                .eq(
                    "invoice_id",
                    invoiceId
                )
                .order(
                    "payment_date",
                    {
                        ascending: true,
                    }
                );

            if (paymentsError) {
                throw paymentsError;
            }

            const paymentList =
                payments || [];

            const totalReceived =
                paymentList.reduce(
                    (sum, payment) =>
                        sum +
                        (
                            Number(
                                payment.amount_received
                            ) || 0
                        ),
                    0
                );

            const totalTDS =
                paymentList.reduce(
                    (sum, payment) =>
                        sum +
                        (
                            Number(
                                payment.tds_deducted
                            ) || 0
                        ),
                    0
                );

            const totalSettled =
                totalReceived +
                totalTDS;

            const invoiceTotal =
                Number(
                    invoice.total_amount
                ) || 0;

            const balanceRemaining =
                Math.max(
                    invoiceTotal -
                    totalSettled,
                    0
                );

            return res.json({
                success: true,

                invoice_id:
                    invoiceId,

                invoice_total:
                    roundMoney(
                        invoiceTotal
                    ),

                total_received:
                    roundMoney(
                        totalReceived
                    ),

                total_tds:
                    roundMoney(
                        totalTDS
                    ),

                total_settled:
                    roundMoney(
                        totalSettled
                    ),

                balance_remaining:
                    roundMoney(
                        balanceRemaining
                    ),

                payment_status:
                    invoice.payment_status,

                lifecycle_state:
                    invoice.lifecycle_state,

                due_date:
                    invoice.due_date,

                payments:
                    paymentList,
            });
        } catch (error) {
            console.error(
                "GET /api/invoices/:id/payments:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to fetch payment history"
            );
        }
    }
);

// =========================================================
// 6. RECORD PAYMENT
// =========================================================

router.post(
    "/invoices/:id/payments",
    async (req, res) => {
        try {
            const invoiceId =
                getId(
                    req.params.id
                );

            if (!invoiceId) {
                return sendError(
                    res,
                    400,
                    "Invalid invoice ID."
                );
            }

            const {
                amount_received,
                tds_deducted,
                payment_date,
                payment_mode,
                reference_number,
            } = req.body;

            const receivedAmount =
                Number(
                    amount_received
                );

            const tdsAmount =
                Number(
                    tds_deducted || 0
                );

            if (
                !Number.isFinite(
                    receivedAmount
                ) ||
                receivedAmount <= 0
            ) {
                return sendError(
                    res,
                    400,
                    "amount_received must be a positive number."
                );
            }

            if (!payment_date) {
                return sendError(
                    res,
                    400,
                    "payment_date is required."
                );
            }

            if (
                !Number.isFinite(
                    tdsAmount
                ) ||
                tdsAmount < 0
            ) {
                return sendError(
                    res,
                    400,
                    "tds_deducted cannot be negative."
                );
            }

            const {
                data: invoice,
                error: invoiceError,
            } = await supabase
                .from(INVOICE_TABLE)
                .select(`
                    id,
                    total_amount,
                    due_date,
                    payment_status,
                    lifecycle_state
                `)
                .eq(
                    "id",
                    invoiceId
                )
                .maybeSingle();

            if (invoiceError) {
                throw invoiceError;
            }

            if (!invoice) {
                return sendError(
                    res,
                    404,
                    "Invoice not found."
                );
            }

            const {
                data: payment,
                error: insertError,
            } = await supabase
                .from(PAYMENT_TABLE)
                .insert({
                    invoice_id:
                        invoiceId,

                    amount_received:
                        receivedAmount,

                    tds_deducted:
                        tdsAmount,

                    payment_date,

                    payment_mode:
                        payment_mode ||
                        "NEFT/RTGS",

                    reference_number:
                        reference_number ||
                        null,
                })
                .select()
                .single();

            if (insertError) {
                throw insertError;
            }

            const {
                data: allPayments,
                error: paymentsError,
            } = await supabase
                .from(PAYMENT_TABLE)
                .select(`
                    amount_received,
                    tds_deducted
                `)
                .eq(
                    "invoice_id",
                    invoiceId
                );

            if (paymentsError) {
                throw paymentsError;
            }

            const paymentList =
                allPayments || [];

            const totalReceived =
                paymentList.reduce(
                    (sum, row) =>
                        sum +
                        (
                            Number(
                                row.amount_received
                            ) || 0
                        ),
                    0
                );

            const totalTDS =
                paymentList.reduce(
                    (sum, row) =>
                        sum +
                        (
                            Number(
                                row.tds_deducted
                            ) || 0
                        ),
                    0
                );

            const totalSettled =
                totalReceived +
                totalTDS;

            const invoiceTotal =
                Number(
                    invoice.total_amount
                ) || 0;

            const balanceRemaining =
                Math.max(
                    invoiceTotal -
                    totalSettled,
                    0
                );

            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];

            let paymentStatus =
                "Pending";

            if (
                totalSettled > 0 &&
                balanceRemaining <= 0
            ) {
                paymentStatus =
                    "Paid";
            } else if (
                totalSettled > 0
            ) {
                paymentStatus =
                    invoice.due_date &&
                        invoice.due_date <
                        today
                        ? "Partially Paid - Overdue"
                        : "Partially Paid";
            } else if (
                invoice.due_date &&
                invoice.due_date <
                today
            ) {
                paymentStatus =
                    "Overdue";
            }

            const {
                data: updatedInvoice,
                error: updateError,
            } = await supabase
                .from(INVOICE_TABLE)
                .update({
                    payment_status:
                        paymentStatus,
                })
                .eq(
                    "id",
                    invoiceId
                )
                .select(`
                    id,
                    payment_status,
                    lifecycle_state,
                    due_date
                `)
                .single();

            if (updateError) {
                throw updateError;
            }

            return res.json({
                success: true,

                message:
                    "Payment recorded successfully.",

                payment,

                invoice_id:
                    invoiceId,

                invoice_total:
                    roundMoney(
                        invoiceTotal
                    ),

                total_received:
                    roundMoney(
                        totalReceived
                    ),

                total_tds:
                    roundMoney(
                        totalTDS
                    ),

                total_settled:
                    roundMoney(
                        totalSettled
                    ),

                balance_remaining:
                    roundMoney(
                        balanceRemaining
                    ),

                payment_status:
                    updatedInvoice.payment_status,

                lifecycle_state:
                    updatedInvoice.lifecycle_state,

                due_date:
                    updatedInvoice.due_date,
            });
        } catch (error) {
            console.error(
                "POST /api/invoices/:id/payments:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to record payment"
            );
        }
    }
);

// =========================================================
// 7. SEND PAYMENT ALERT
// =========================================================

router.post(
    "/client-billing/:invoiceId/payment-alert",
    async (req, res) => {
        try {
            const invoiceId =
                getId(
                    req.params.invoiceId
                );

            if (!invoiceId) {
                return sendError(
                    res,
                    400,
                    "Invalid invoice ID"
                );
            }

            const {
                data: invoice,
                error: invoiceError,
            } = await supabase
                .from(INVOICE_TABLE)
                .select(`
                    id,
                    invoice_number,
                    client_id,
                    billing_month,
                    total_amount,
                    due_date
                `)
                .eq(
                    "id",
                    invoiceId
                )
                .maybeSingle();

            if (invoiceError) {
                throw invoiceError;
            }

            if (!invoice) {
                return sendError(
                    res,
                    404,
                    "Invoice not found"
                );
            }

            const {
                data: client,
                error: clientError,
            } = await supabase
                .from(CLIENT_TABLE)
                .select(`
                    id,
                    company_name,
                    email
                `)
                .eq(
                    "id",
                    invoice.client_id
                )
                .maybeSingle();

            if (clientError) {
                throw clientError;
            }

            if (!client) {
                return sendError(
                    res,
                    404,
                    "Client not found"
                );
            }

            if (!client.email) {
                return sendError(
                    res,
                    400,
                    "Client email address not found"
                );
            }

            const {
                data: payments,
                error: paymentsError,
            } = await supabase
                .from(PAYMENT_TABLE)
                .select(`
                    amount_received,
                    tds_deducted
                `)
                .eq(
                    "invoice_id",
                    invoiceId
                );

            if (paymentsError) {
                throw paymentsError;
            }

            const paymentList =
                payments || [];

            const totalInvoiceAmount =
                Number(
                    invoice.total_amount
                ) || 0;

            const amountReceived =
                paymentList.reduce(
                    (sum, payment) =>
                        sum +
                        (
                            Number(
                                payment.amount_received
                            ) || 0
                        ),
                    0
                );

            const tdsDeducted =
                paymentList.reduce(
                    (sum, payment) =>
                        sum +
                        (
                            Number(
                                payment.tds_deducted
                            ) || 0
                        ),
                    0
                );

            const totalSettled =
                amountReceived +
                tdsDeducted;

            const amountPending =
                Math.max(
                    totalInvoiceAmount -
                    totalSettled,
                    0
                );

            const today =
                new Date()
                    .toISOString()
                    .split("T")[0];

            const overdue =
                Boolean(
                    invoice.due_date &&
                    invoice.due_date <
                    today &&
                    amountPending > 0
                );

            let paymentStatus =
                "Pending";

            if (
                totalSettled > 0 &&
                amountPending <= 0
            ) {
                paymentStatus =
                    "Paid";
            } else if (
                totalSettled > 0 &&
                overdue
            ) {
                paymentStatus =
                    "Partially Paid - Overdue";
            } else if (
                totalSettled > 0
            ) {
                paymentStatus =
                    "Partially Paid";
            } else if (
                overdue
            ) {
                paymentStatus =
                    "Overdue";
            }

            const EMAIL_USER =
                process.env.EMAIL_USER;

            const EMAIL_PASS =
                process.env.EMAIL_PASS;

            if (
                !EMAIL_USER ||
                !EMAIL_PASS
            ) {
                return sendError(
                    res,
                    500,
                    "Email configuration is missing."
                );
            }

            const transporter =
                nodemailer.createTransport({
                    service: "gmail",

                    auth: {
                        user:
                            EMAIL_USER,

                        pass:
                            EMAIL_PASS,
                    },
                });

            await transporter.verify();

            const formatCurrency =
                (amount) =>
                    new Intl.NumberFormat(
                        "en-IN",
                        {
                            style:
                                "currency",
                            currency:
                                "INR",
                            minimumFractionDigits:
                                2,
                        }
                    ).format(
                        amount
                    );

            const billingMonth =
                invoice.billing_month
                    ? new Date(
                        invoice.billing_month
                    ).toLocaleDateString(
                        "en-IN",
                        {
                            month:
                                "long",
                            year:
                                "numeric",
                        }
                    )
                    : "N/A";

            const dueDate =
                invoice.due_date
                    ? new Date(
                        invoice.due_date
                    ).toLocaleDateString(
                        "en-IN",
                        {
                            day:
                                "2-digit",
                            month:
                                "long",
                            year:
                                "numeric",
                        }
                    )
                    : "N/A";

            const emailSubject =
                overdue
                    ? `Payment Overdue - Invoice ${invoice.invoice_number}`
                    : `Payment Reminder - Invoice ${invoice.invoice_number}`;

            const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body {
    font-family: Arial, sans-serif;
    background: #f5f7fa;
    margin: 0;
    padding: 30px;
    color: #333;
}
.container {
    max-width: 700px;
    margin: auto;
    background: white;
    border-radius: 10px;
    overflow: hidden;
}
.header {
    background: #1e293b;
    color: white;
    padding: 25px 30px;
}
.header h1 {
    margin: 0;
    font-size: 22px;
}
.content {
    padding: 30px;
}
.summary {
    background: #f8fafc;
    border-radius: 8px;
    padding: 20px;
    margin: 25px 0;
}
.row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #e5e7eb;
}
.label {
    color: #64748b;
}
.value {
    font-weight: 600;
}
.pending {
    color: #dc2626;
    font-size: 18px;
}
.notice {
    background: #fff7ed;
    border-left: 4px solid #f97316;
    padding: 15px;
    margin: 20px 0;
}
.footer {
    background: #f8fafc;
    padding: 20px 30px;
    color: #64748b;
    font-size: 13px;
}
</style>
</head>

<body>

<div class="container">

<div class="header">
<h1>Talent Corner HR Services</h1>
<p>
${overdue ? "Payment Overdue" : "Payment Reminder"}
</p>
</div>

<div class="content">

<p>
Dear <strong>${client.company_name}</strong>,
</p>

<p>
This is a reminder regarding the payment
for your client billing invoice.
</p>

<div class="summary">

<div class="row">
<span class="label">Invoice Number</span>
<span class="value">
${invoice.invoice_number || "N/A"}
</span>
</div>

<div class="row">
<span class="label">Billing Month</span>
<span class="value">
${billingMonth}
</span>
</div>

<div class="row">
<span class="label">Invoice Amount</span>
<span class="value">
${formatCurrency(totalInvoiceAmount)}
</span>
</div>

<div class="row">
<span class="label">Amount Received</span>
<span class="value">
${formatCurrency(amountReceived)}
</span>
</div>

<div class="row">
<span class="label">TDS Deducted</span>
<span class="value">
${formatCurrency(tdsDeducted)}
</span>
</div>

<div class="row">
<span class="label">Due Date</span>
<span class="value">
${dueDate}
</span>
</div>

<div class="row">
<span class="label">Payment Status</span>
<span class="value">
${paymentStatus}
</span>
</div>

<div class="row">
<span class="label">Amount Pending</span>
<span class="value pending">
${formatCurrency(amountPending)}
</span>
</div>

</div>

${amountPending > 0
                    ? `
<div class="notice">

<strong>Payment Due</strong>

<p>
Kindly arrange payment of
<strong>${formatCurrency(
                        amountPending
                    )}</strong>
at your earliest convenience.
</p>

</div>
`
                    : `
<p>
Our records indicate that this invoice
has been fully settled.
Thank you for your payment.
</p>
`
                }

<p>
If payment has already been processed,
please disregard this reminder or share
the payment reference with our accounts team.
</p>

<p>
Regards,<br>
<strong>Talent Corner HR Services</strong><br>
Accounts & Payroll Team
</p>

</div>

<div class="footer">
This is an automated payment notification
from Talent Corner HR Services.
</div>

</div>

</body>
</html>
`;

            const mailInfo =
                await transporter.sendMail({
                    from:
                        `"Talent Corner HR Services" <${EMAIL_USER}>`,

                    to:
                        client.email,

                    subject:
                        emailSubject,

                    html:
                        emailHtml,
                });

            return res.json({
                success: true,

                message:
                    "Payment alert sent successfully",

                recipient:
                    client.email,

                invoice_number:
                    invoice.invoice_number,

                invoice_amount:
                    totalInvoiceAmount,

                amount_received:
                    amountReceived,

                tds_deducted:
                    tdsDeducted,

                amount_pending:
                    amountPending,

                payment_status:
                    paymentStatus,

                overdue,

                messageId:
                    mailInfo.messageId,
            });
        } catch (error) {
            console.error(
                "PAYMENT ALERT ERROR:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to send payment alert"
            );
        }
    }
);

// =========================================================
// 8. GET EMPLOYEES FOR CLIENT BILLING
//
// GET:
// /api/clients/:client_id/billing-employees?month=2026-09
//
// SOURCE:
// third_party_emp_attendance
//
// NO APPROVAL TABLE.
// =========================================================

router.get(
    "/clients/:client_id/billing-employees",
    async (req, res) => {
        try {
            const clientId =
                getId(
                    req.params.client_id
                );

            const billingMonth =
                getBillingMonth(
                    req.query.month
                );

            if (!clientId) {
                return sendError(
                    res,
                    400,
                    "Invalid client_id"
                );
            }

            if (!billingMonth) {
                return sendError(
                    res,
                    400,
                    "Invalid month. Use YYYY-MM"
                );
            }

            const client =
                await getClient(
                    clientId
                );

            if (!client) {
                return sendError(
                    res,
                    404,
                    "Client not found"
                );
            }

            const contract =
                await getClientContract(
                    clientId
                );

            if (!contract) {
                return sendError(
                    res,
                    400,
                    "No client contract found"
                );
            }

            const billing =
                await buildAttendanceBilling({
                    clientId,
                    billingMonth,
                });

            return res.json({
                success: true,

                data:
                    billing.employees,

                employees:
                    billing.employees,

                client,

                client_id:
                    clientId,

                billing_month:
                    getMonthStart(
                        billingMonth
                    ),

                contract,

                totals:
                    billing.totals,
            });
        } catch (error) {
            console.error(
                "GET /api/clients/:client_id/billing-employees:",
                error
            );

            return sendError(
                res,
                500,
                error.message ||
                "Failed to fetch billing employees"
            );
        }
    }
);

// =========================================================
// EXPORT
// =========================================================

module.exports = router;