// =====================================================
// PAYROLL CALCULATOR
// Talent Corner Third-Party Payroll
// =====================================================

const MONTHS = [
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    "January",
    "February",
    "March",
];

// =====================================================
// HELPERS
// =====================================================

const round = (value) => Math.round(Number(value || 0));

const getMonthIndexFromSalaryMonth = (salaryMonth) => {
    if (!salaryMonth) return -1;

    const [year, month] = String(salaryMonth)
        .split("-")
        .map(Number);

    if (!year || !month) return -1;

    // Calendar month:
    // Jan = 1 ... Dec = 12
    //
    // Financial-year index:
    // Apr = 0 ... Mar = 11

    return month >= 4 ? month - 4 : month + 8;
};

const getDaysInMonth = (salaryMonth) => {
    if (!salaryMonth) return 0;

    const [year, month] = String(salaryMonth)
        .split("-")
        .map(Number);

    if (!year || !month) return 0;

    return new Date(year, month, 0).getDate();
};

// =====================================================
// MAIN CALCULATOR
// =====================================================

const calculatePayroll = ({
    candidate,
    deployment,
    attendance,
    salaryMonth,
}) => {
    if (!candidate) {
        throw new Error("Employee data is required.");
    }

    if (!deployment) {
        throw new Error("Deployment data is required.");
    }

    if (!attendance) {
        throw new Error("Attendance data is required.");
    }

    if (!salaryMonth) {
        throw new Error("Salary month is required.");
    }

    // =================================================
    // BASIC EMPLOYEE INFORMATION
    // =================================================

    const employeeId = Number(candidate.id);

    const employeeName =
        candidate.full_name ||
        candidate.name ||
        "Unknown Employee";

    const department =
        String(candidate.department || "").trim().toLowerCase();

    const gender =
        String(candidate.gender || "").trim();

    // =================================================
    // MONTH
    // =================================================

    const monthIndex =
        getMonthIndexFromSalaryMonth(salaryMonth);

    const daysInMonth =
        getDaysInMonth(salaryMonth);

    if (monthIndex < 0 || daysInMonth <= 0) {
        throw new Error(
            `Invalid salary month: ${salaryMonth}`
        );
    }

    // =================================================
    // MONTHLY PAY RATE
    // =================================================

    const monthlySalary = round(
        deployment.pay_rate ??
        candidate.pay_rate ??
        0
    );

    if (monthlySalary <= 0) {
        throw new Error(
            `Pay rate is not configured for ${employeeName}.`
        );
    }

    // =================================================
    // ATTENDANCE
    // =================================================

    const presentDays = Number(
        attendance.present_days || 0
    );

    const absentDays = Number(
        attendance.absent_days || 0
    );

    const leaveDays = Number(
        attendance.leave_days || 0
    );

    const halfDays = Number(
        attendance.half_days || 0
    );

    const lopDays = Number(
        attendance.lop_days || 0
    );

    const overtimeHours = Number(
        attendance.overtime_hours || 0
    );

    // -------------------------------------------------
    // PAYABLE DAYS
    //
    // Use the attendance system's payable_days when
    // available because that is the final attendance
    // value used by the existing payroll system.
    // -------------------------------------------------

    let payableDays;

    if (
        attendance.payable_days !== null &&
        attendance.payable_days !== undefined
    ) {
        payableDays = Number(attendance.payable_days);
    } else {
        payableDays =
            presentDays +
            leaveDays +
            halfDays * 0.5;
    }

    payableDays = Math.max(
        0,
        Math.min(payableDays, daysInMonth)
    );

    // =================================================
    // OLD PAYSLIP FORMULA
    //
    // Basic = 50% of fixed gross
    // =================================================

    const fixedGrossSalary = monthlySalary;

    const basicSalary = round(
        fixedGrossSalary * 0.5
    );

    // =================================================
    // MONTHLY COMPONENTS
    // =================================================

    const hra = round(
        basicSalary * 0.5
    );

    const conveyance = 1200;

    const medicalAllowance = 1000;

    const otherAllowance = Math.max(
        0,
        round(
            fixedGrossSalary -
            basicSalary -
            hra -
            conveyance -
            medicalAllowance
        )
    );

    // =================================================
    // EARNED COMPONENTS
    //
    // Same formula as supplied PaySlip.jsx
    // =================================================

    const earnBasicSalary = round(
        (basicSalary / daysInMonth) *
        payableDays
    );

    const earnHRA = round(
        (hra / daysInMonth) *
        payableDays
    );

    const earnConveyance = round(
        (conveyance / daysInMonth) *
        payableDays
    );

    const earnMedicalAllowance = round(
        (medicalAllowance / daysInMonth) *
        payableDays
    );

    const earnOtherAllowance = round(
        (otherAllowance / daysInMonth) *
        payableDays
    );

    // =================================================
    // EARNED GROSS BEFORE OT / BONUS
    // =================================================

    const earnedFixedGross = round(
        earnBasicSalary +
        earnHRA +
        earnConveyance +
        earnMedicalAllowance +
        earnOtherAllowance
    );

    // =================================================
    // OVERTIME
    //
    // Basic / 26 / 8 * 1.5 * overtime hours
    // =================================================

    const overtimeAmount = round(
        (basicSalary / 26 / 8) *
        1.5 *
        overtimeHours
    );

    // =================================================
    // BONUS
    //
    // Original formula:
    // Admin / Accounts = 8.33% of earned gross
    // =================================================

    const bonus =
        ["admin", "accounts"].includes(department)
            ? round(earnedFixedGross * 0.0833)
            : 0;

    // =================================================
    // GROSS SALARY
    // =================================================

    const grossSalary = round(
        earnedFixedGross +
        overtimeAmount +
        bonus
    );

    // =================================================
    // HRA
    //
    // PF wages = Gross - earned HRA
    // =================================================

    const pfWages = round(
        grossSalary - earnHRA
    );

    // =================================================
    // EMPLOYEE PF
    //
    // 12% of PF wages
    // Maximum PF wage considered = ₹15,000
    // =================================================

    const pfApplicableWages = Math.min(
        pfWages,
        15000
    );

    const pf = round(
        pfApplicableWages * 0.12
    );

    // =================================================
    // ESIC
    //
    // Requires ESIC registration number
    // Gross <= ₹21,000
    // Employee contribution = 0.75%
    // =================================================

    const esicApplicable =
        !!candidate.esic_number;

    const esic =
        esicApplicable &&
        grossSalary <= 21000
            ? round(grossSalary * 0.0075)
            : 0;

    // =================================================
    // PROFESSIONAL TAX
    //
    // Original formula:
    // Female > 25k => 200
    // Male > 25k => 200
    // =================================================

    const professionalTax =
        grossSalary > 25000 &&
        ["male", "female"].includes(
            gender.toLowerCase()
        )
            ? 200
            : 0;

    // =================================================
    // LWF
    //
    // Admin / Accounts
    // June / December
    // Employee = ₹25
    // =================================================

    const isJuneOrDecember =
        [2, 8].includes(monthIndex);

    const lwf =
        ["admin", "accounts"].includes(department) &&
        isJuneOrDecember
            ? 25
            : 0;

    // =================================================
    // INCENTIVE
    //
    // Current Talent Corner attendance/payroll model
    // does not have revenueGenerated or incentive
    // configuration, therefore 0.
    // =================================================

    const incentive = 0;

    // =================================================
    // ADVANCE
    // =================================================

    const advanceDeduction = round(
        attendance.advance || 0
    );

    // =================================================
    // TDS
    //
    // Current system does not calculate TDS.
    // =================================================

    const tax = 0;

    // =================================================
    // LOP
    //
    // Salary is already prorated using payable_days.
    // Therefore do NOT deduct LOP again.
    // =================================================

    const lop = 0;

    // =================================================
    // TOTAL DEDUCTIONS
    // =================================================

    const totalDeductions = round(
        pf +
        esic +
        professionalTax +
        lwf +
        advanceDeduction +
        tax +
        lop
    );

    // =================================================
    // NET PAYABLE
    // =================================================

    const netSalary = round(
        grossSalary -
        totalDeductions
    );

    // =================================================
    // GRATUITY
    //
    // 4.81% of earned Basic
    // =================================================

    const gratuity = round(
        earnBasicSalary * 0.0481
    );

    // =================================================
    // EMPLOYER PF
    // =================================================

    const employerPf = pf;

    // =================================================
    // EMPLOYER ESIC
    //
    // 3.25%
    // =================================================

    const employerEsic =
        esicApplicable &&
        grossSalary <= 21000
            ? round(grossSalary * 0.0325)
            : 0;

    // =================================================
    // EMPLOYER LWF
    //
    // June / December = ₹75
    // =================================================

    const employerLwf =
        isJuneOrDecember
            ? 75
            : 0;

    // =================================================
    // TOTAL EMPLOYER CONTRIBUTION
    // =================================================

    const totalEmployerContribution =
        round(
            employerPf +
            employerEsic +
            employerLwf
        );

    // =================================================
    // EMPLOYER COST / CTC
    // =================================================

    const totalEmployerCost = round(
        grossSalary +
        totalEmployerContribution +
        gratuity
    );

    // =================================================
    // RETURN COMPLETE PAYROLL
    // =================================================

    return {
        employee_ref_id: employeeId,

        employee_name: employeeName,

        salary_month: salaryMonth,

        days_in_month: daysInMonth,

        present_days: presentDays,

        absent_days: absentDays,

        leave_days: leaveDays,

        half_days: halfDays,

        lop_days: lopDays,

        payable_days: payableDays,

        overtime_hours: overtimeHours,

        // -----------------------------
        // SALARY
        // -----------------------------

        basic_salary: basicSalary,

        hra: hra,

        conveyance: conveyance,

        medical_allowance: medicalAllowance,

        other_allowance: otherAllowance,

        allowances: round(
            hra +
            conveyance +
            medicalAllowance +
            otherAllowance
        ),

        // -----------------------------
        // EARNED SALARY
        // -----------------------------

        earned_basic_salary: earnBasicSalary,

        earned_hra: earnHRA,

        earned_conveyance: earnConveyance,

        earned_medical_allowance:
            earnMedicalAllowance,

        earned_other_allowance:
            earnOtherAllowance,

        // -----------------------------
        // OVERTIME / BONUS
        // -----------------------------

        overtime: overtimeAmount,

        bonus: bonus,

        incentive: incentive,

        // -----------------------------
        // GROSS
        // -----------------------------

        gross_salary: grossSalary,

        // -----------------------------
        // PF
        // -----------------------------

        pf_wages: pfWages,

        pf: pf,

        employer_pf: employerPf,

        // -----------------------------
        // ESIC
        // -----------------------------

        esic: esic,

        employer_esic: employerEsic,

        // -----------------------------
        // TAX
        // -----------------------------

        tax: tax,

        professional_tax: professionalTax,

        // -----------------------------
        // LWF
        // -----------------------------

        lwf: lwf,

        employer_lwf: employerLwf,

        // -----------------------------
        // OTHER DEDUCTIONS
        // -----------------------------

        lop: lop,

        advance: advanceDeduction,

        total_deductions: totalDeductions,

        // -----------------------------
        // NET
        // -----------------------------

        net_salary: netSalary,

        // -----------------------------
        // GRATUITY
        // -----------------------------

        gratuity: gratuity,

        // -----------------------------
        // EMPLOYER COST
        // -----------------------------

        total_employer_contribution:
            totalEmployerContribution,

        total_employer_cost:
            totalEmployerCost,

        // -----------------------------
        // FIXED MONTHLY GROSS
        // -----------------------------

        fixed_gross_salary:
            fixedGrossSalary,

        // -----------------------------
        // BANK / STATUTORY
        // -----------------------------

        bank_name:
            candidate.bank_name || null,

        account_number:
            candidate.bank_account_number || null,

        ifsc_code:
            candidate.ifsc_code || null,

        joining_date:
            candidate.date_of_joining || null,

        pan_number:
            candidate.pan_number || null,

        uan_number:
            candidate.uan_number || null,

        esic_number:
            candidate.esic_number || null,

        // PRAN is NOT UAN.
        pran: null,

        deployment_id:
            Number(deployment.id),

        client_id:
            Number(deployment.client_id),

        attendance_id:
            Number(attendance.id),

        status: "Pending",
    };
};

module.exports = {
    calculatePayroll,
    getDaysInMonth,
    getMonthIndexFromSalaryMonth,
    MONTHS,
};