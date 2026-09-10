// ==================== PAYROLL CALCULATION ENGINE ====================

function calculateThirdPartyPayrollAndBilling(employeeProfile, attendanceApproval, contractTerms) {
  // Use the real days in that attendance record, not a hardcoded 30
  const totalDaysInMonth = Number(attendanceApproval.total_days) || 30;
  const lopDays = Number(attendanceApproval.lop_days || 0);

  const profileBasic = Number(employeeProfile.basic_salary) || 0;
  const profileAllowances = Number(employeeProfile.allowances) || 0;
  const overtime = Number(employeeProfile.overtime || 0);
  const bonus = Number(employeeProfile.bonus || 0);
  const taxTds = Number(employeeProfile.tax_tds || 0);
  const professionalTax = 200; // Flat standard PT (Consider a state slab lookup here later)
  const markupPercent = Number(contractTerms?.service_charge_percentage) || 0;

  // 1. Correct LOP Proration on Fixed Components Only
  const dailyBasicRate = profileBasic / totalDaysInMonth;
  const dailyAllowanceRate = profileAllowances / totalDaysInMonth;

  const lopBasicDeduction = Math.round(dailyBasicRate * lopDays);
  const lopAllowanceDeduction = Math.round(dailyAllowanceRate * lopDays);
  const totalLopDeductionAmount = lopBasicDeduction + lopAllowanceDeduction;

  const earnedBasic = profileBasic - lopBasicDeduction;
  const earnedAllowances = profileAllowances - lopAllowanceDeduction;

  // Gross Salary includes fixed earned salary + variable earnings
  const grossSalary = earnedBasic + earnedAllowances + overtime + bonus;

  // 2. PF Calculation based on Earned Basic capped at statutory 15,000
  const pfBase = Math.min(earnedBasic, 15000);
  const employeePF = Math.round(pfBase * 0.12);
  const employerPF = Math.round(pfBase * 0.12);

  // 3. ESIC Calculation: Gross excluding overtime determines eligibility
  const esicGrossForEligibility = earnedBasic + earnedAllowances + bonus; 
  
  let employeeESIC = 0;
  let employerESIC = 0;

  if (esicGrossForEligibility <= 21000) {
    // ESIC is calculated on the absolute gross (which includes overtime)
    employeeESIC = Math.round(grossSalary * 0.0075);
    employerESIC = Math.round(grossSalary * 0.0325);
  }

  // Net Salary Calculation
  const netSalary = grossSalary - (employeePF + employeeESIC + taxTds + professionalTax);

  // Total Cost to Company (CTC)
  const totalEmployeeCostCTC = grossSalary + employerPF + employerESIC;

  // Billing and Markup Calculations
  const serviceCharge = Math.round(totalEmployeeCostCTC * (markupPercent / 100));
  const gstAmount = Math.round((totalEmployeeCostCTC + serviceCharge) * 0.18);
  const totalInvoiceBilledAmount = totalEmployeeCostCTC + serviceCharge + gstAmount;

  return {
    employeeFacing: {
      lop_deduction: totalLopDeductionAmount,
      gross_salary: grossSalary,
      employee_pf: employeePF,
      employee_esic: employeeESIC,
      tax: taxTds,
      professional_tax: professionalTax,
      net_salary: netSalary
    },
    clientFacing: {
      employer_pf: employerPF,
      employer_esic: employerESIC,
      total_workforce_cost: totalEmployeeCostCTC,
      agency_service_charge: serviceCharge,
      gst_18_percent: gstAmount,
      grand_total_invoice: totalInvoiceBilledAmount
    }
  };
}
