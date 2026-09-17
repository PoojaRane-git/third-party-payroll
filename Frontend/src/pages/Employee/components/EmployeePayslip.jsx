import React, { useEffect, useState } from "react";
import EmployeeLayout from "./EmployeeLayout";
import PaySlip from "../../admin/PaySlip";
import api from "../../services/api";

const EmployeeSlip = () => {
    const [loading, setLoading] = useState(true);
    const [payslips, setPayslips] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadPayslips = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await api.get("/employee/payroll/me");

                const data = response?.data?.payslips || [];

                setPayslips(data);
            } catch (err) {
                console.error("Employee payslip fetch error:", err);

                setError(
                    err?.response?.data?.message ||
                    "Unable to load payslips."
                );
            } finally {
                setLoading(false);
            }
        };

        loadPayslips();
    }, []);

    /*
     * Convert your API response into the structure
     * that the existing PaySlip component understands.
     */
    const employees = payslips.map((payslip) => ({
        id: payslip.employee_ref_id,
        name: payslip.employee_name,

        department: payslip.department || "",
        designation: payslip.designation || "",
        branchOfficeName: payslip.branch_office_name || "",

        bankName: payslip.bank_name || "",
        bankACNumber: payslip.account_number || "",

        joiningDate: payslip.joining_date || "",
        panCard: payslip.pan_card || "",
        uanNumber: payslip.uan_number || "",
        pfACNumber: payslip.pf_ac_number || "",
        esiRegistrationNumber: payslip.esi_number || "",
        pran: payslip.pran || "",

        // Existing PaySlip calculations expect these flags
        hra: Number(payslip.hra || 0) > 0,
        conveyanceAllowance:
            Number(payslip.conveyance || 0) > 0,
        medicalAllowance:
            Number(payslip.medical_allowance || 0) > 0,
        otherExpenses:
            Number(
                payslip.other_allowance ??
                payslip.allowances ??
                0
            ) > 0,

        epfEmployee: Number(payslip.pf || 0) > 0,
        epfEmployer: Number(payslip.employer_pf || 0) > 0,

        professionalTax:
            Number(payslip.professional_tax || 0) > 0,

        gratuityProvision:
            Number(payslip.gratuity || 0) > 0,

        gender: payslip.gender || "",

        incentivePercentage:
            Number(payslip.incentive_percentage || 0),

        eligibleForIncentive:
            Boolean(payslip.eligible_for_incentive),
    }));

    /*
     * Existing PaySlip expects:
     *
     * payrollData[employee.id][monthIndex]
     *
     * We build that structure from third_party_payroll.
     */
    const payrollData = {};

    payslips.forEach((payslip) => {
        const employeeId = payslip.employee_ref_id;

        if (!employeeId) return;

        if (!payrollData[employeeId]) {
            payrollData[employeeId] = {};
        }

        const salaryMonth = String(
            payslip.salary_month || ""
        );

        if (!salaryMonth) return;

        const [year, month] = salaryMonth
            .split("-")
            .map(Number);

        /*
         * PaySlip uses financial-year month indexes:
         *
         * 0 = April
         * 1 = May
         * ...
         * 8 = December
         * 9 = January
         * ...
         * 11 = March
         */
        const monthNumber = month;

        let monthIndex;

        if (monthNumber >= 4) {
            monthIndex = monthNumber - 4;
        } else {
            monthIndex = monthNumber + 8;
        }

        payrollData[employeeId][monthIndex] = {
            fixedGrossSalary: Number(
                payslip.fixed_gross_salary ??
                payslip.gross_salary ??
                0
            ),

            leavesTaken: Number(
                payslip.lop || 0
            ),

            paidLeaves: 0,

            basicDA: Number(
                payslip.basic_salary || 0
            ),

            advance: 0,

            revenueGenerated: 0,
        };
    });

    /*
     * Build financial years from salary_month.
     */
    const financialYears = [
        ...new Set(
            payslips
                .map((payslip) => {
                    if (!payslip.salary_month) {
                        return null;
                    }

                    const [year, month] = String(
                        payslip.salary_month
                    )
                        .split("-")
                        .map(Number);

                    if (!year || !month) {
                        return null;
                    }

                    const startYear =
                        month >= 4
                            ? year
                            : year - 1;

                    return `${startYear}-${startYear + 1}`;
                })
                .filter(Boolean)
        ),
    ].sort().reverse();

    if (loading) {
        return (
            <EmployeeLayout>
                <div className="flex justify-center items-center h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
                </div>
            </EmployeeLayout>
        );
    }

    if (error) {
        return (
            <EmployeeLayout>
                <div className="flex justify-center items-center min-h-screen">
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
                        {error}
                    </div>
                </div>
            </EmployeeLayout>
        );
    }

    return (
        <EmployeeLayout>
            <PaySlip
                employees={employees}
                payrollData={payrollData}
                financialYears={financialYears}
            />
        </EmployeeLayout>
    );
};

export default EmployeeSlip;