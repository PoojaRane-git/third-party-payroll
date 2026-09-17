import React, { useState, useEffect, useRef, memo } from 'react';
import { generatePayslipPDF } from "../../../../backend/utils/Payslippdf"; // adjust this relative path to match your project structure

// Utility function to get month name
const getMonthName = (monthIndex) => {
    const months = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
    return months[monthIndex];
};

// Utility function to format date range
const formatDateRange = (monthIndex, financialYear) => {
    const [startYear] = financialYear.split("-").map(Number);
    const actualYear = monthIndex < 9 ? startYear : startYear + 1;
    const month = (monthIndex + 3) % 12;
    const startDate = new Date(actualYear, month, 1);
    const endDate = new Date(actualYear, month + 1, 0);
    const formatDate = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
};

// Utility function to build the human-readable period label shown on the payslip
const buildPeriodLabel = (period) => {
    const monthNames = { "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July", "Aug": "August", "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December" };

    // Check if the period string starts with a number (DD Mon YYYY format for a single month)
    if (/^\d/.test(period)) {
        const parts = period.split(' '); // e.g., ["1", "Apr", "2024", "to", ...]
        if (parts.length > 2) {
            const monthName = monthNames[parts[1]] || parts[1];
            const year = parts[2];
            return `for the month of ${monthName} ${year}`;
        }
        return `for ${period}`;
    }

    // Full financial year format, e.g., "Apr 2023 to Mar 2024"
    return `for ${period}`;
};

const PaySlip = () => {
    const [financialYears, setFinancialYears] = useState([]);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [payrollData, setPayrollData] = useState({});
    const [loading, setLoading] = useState(true);
    const [showMonthOptions, setShowMonthOptions] = useState(false);
    const monthDropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target)) {
                setShowMonthOptions(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, []);

    // Get days in a month for a given financial year
    const getDaysInMonth = (monthIndex, financialYear) => {
        const [startYear] = financialYear.split("-").map(Number);
        const actualYear = monthIndex < 9 ? startYear : startYear + 1;
        const monthInYear = (monthIndex + 3) % 12;
        const date = new Date(actualYear, monthInYear + 1, 0);
        return date.getDate();
    };

    // Calculate salary details for an employee for a specific month
    const calculateSalary = (employee, monthIndex, payrollData) => {
        const data = payrollData[employee.id]?.[monthIndex];
        if (!data) return null;

        const fixedGrossSalary = data.fixedGrossSalary || 0;
        const leavesTaken = data.leavesTaken || 0;
        const paidLeaves = data.paidLeaves || 0;
        const revenueGenerated = data.revenueGenerated || 0;
        const daysInMonth = getDaysInMonth(monthIndex, selectedYear);
        const paidDays = daysInMonth - (leavesTaken - paidLeaves > 0 ? leavesTaken - paidLeaves : 0);

        const basicSalary = data.basicDA || Math.round(fixedGrossSalary * 0.5);
        const earnBasicSalary = Math.round((basicSalary / daysInMonth) * paidDays);

        const hra = employee.hra ? Math.round(basicSalary * 0.5) : 0;
        const earnHRA = Math.round((hra / daysInMonth) * paidDays);

        const conveyance = employee.conveyanceAllowance ? 1200 : 0;
        const earnConveyance = Math.round((conveyance / daysInMonth) * paidDays);

        const medicalAllowance = employee.medicalAllowance ? 1000 : 0;
        const earnMedicalAllowance = Math.round((medicalAllowance / daysInMonth) * paidDays);

        const otherAllowance = employee.otherExpenses ? Math.round(fixedGrossSalary - basicSalary - hra - conveyance - medicalAllowance) : 0;
        const earnOtherAllowance = Math.round((otherAllowance / daysInMonth) * paidDays);

        const gross = Math.round(basicSalary + hra + conveyance + medicalAllowance + otherAllowance);
        const earnGross = Math.round(earnBasicSalary + earnHRA + earnConveyance + earnMedicalAllowance + earnOtherAllowance);

        const pfWages = Math.round(earnGross - earnHRA);
        const pf = (employee.epfEmployee && employee.epfEmployer && pfWages < 15000) ? Math.round(pfWages * 0.12) : (employee.epfEmployee && employee.epfEmployer ? 1800 : 0);

        const esicApplicable = !!employee.esiRegistrationNumber;
        const esic = (esicApplicable && earnGross < 21000) ? Math.round(earnGross * 0.0075) : 0;

        const pt = employee.professionalTax ? ((employee.gender === "Female" && earnGross > 25000) ? 200 : (employee.gender === "Male" && earnGross > 25000 ? 200 : 0)) : 0;
        const isJuneOrDec = [2, 8].includes(monthIndex);
        const lwf = (["admin", "accounts"].includes(employee.department.toLowerCase()) && isJuneOrDec) ? 25 : 0;

        const defaultIncentivePercentage = (employee.incentivePercentage / 100);
        const incentive = (employee.eligibleForIncentive && ["marketing team", "team leader"].includes(employee.department?.trim().toLowerCase())) ? Math.round(revenueGenerated * defaultIncentivePercentage) : 0;

        const advanceDeduction = Math.round(data.advance || 0);

        const totalDeduction = Math.round(pf + esic + pt + lwf + advanceDeduction);

        const netPayable = Math.round(earnGross - totalDeduction);

        const gratuity = employee.gratuityProvision ? Math.round(earnBasicSalary * 0.0481) : 0;

        const employerPf = (employee.epfEmployee && employee.epfEmployer) ? pf : 0;
        const employerEsic = (esicApplicable && earnGross < 21000) ? Math.round(earnGross * 0.0325) : 0;
        const employerLwf = isJuneOrDec ? 75 : 0;

        const bonus = (["admin", "accounts"].includes(employee.department.toLowerCase())) ? Math.round(earnGross * 0.0833) : 0;

        const ctc = Math.round(earnGross + employerPf + employerEsic + gratuity + employerLwf);

        return {
            fixedGrossSalary: Math.round(fixedGrossSalary),
            basicSalary,
            earnBasicSalary,
            hra,
            earnHRA,
            conveyance,
            earnConveyance,
            medicalAllowance,
            earnMedicalAllowance,
            otherAllowance,
            earnOtherAllowance,
            gross,
            earnGross,
            pfWages,
            pf,
            esic,
            pt,
            lwf,
            incentive,
            advance: advanceDeduction,
            totalDeduction,
            netPayable,
            gratuity,
            employerPf,
            employerEsic,
            employerLwf,
            bonus,
            ctc,
        };
    };

    // Fetch initial data
    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetch('https://api.sarthi360.in/api/payroll/financial-years', {
                headers: { 'Cache-Control': 'max-age=3600' } // Cache for 1 hour
            }),
            fetch('https://api.sarthi360.in/employees', {
                headers: { 'Cache-Control': 'max-age=300' } // Cache for 5 minutes
            }),
            selectedYear ? fetch(`https://api.sarthi360.in/api/payroll/all?financialYear=${encodeURIComponent(selectedYear)}`, {
                headers: { 'Cache-Control': 'max-age=300' }
            }) : Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
        ])
            .then(async ([yearsResponse, employeesResponse, payrollResponse]) => {
                if (!yearsResponse.ok) throw new Error('Failed to fetch financial years');
                if (!employeesResponse.ok) throw new Error('Failed to fetch employees');
                if (!payrollResponse.ok) throw new Error('Failed to fetch payroll records');

                const years = await yearsResponse.json();
                const employees = await employeesResponse.json();
                const records = await payrollResponse.json();

                return { years, employees, records };
            })
            .then(({ years, employees, records }) => {
                setFinancialYears(years);
                setEmployees(employees);
                if (years.length > 0 && !selectedYear) {
                    setSelectedYear(years[0]);
                }

                const payrollData = {};
                records.forEach(record => {
                    if (!payrollData[record.EmployeeID]) {
                        payrollData[record.EmployeeID] = {};
                    }
                    payrollData[record.EmployeeID][record.Month] = {
                        fixedGrossSalary: record.FixedGrossSalary || 0,
                        leavesTaken: record.LeavesTaken || 0,
                        paidLeaves: record.PaidLeaves || 0,
                        basicDA: record.BasicDA || 0,
                        advance: record.Advance || 0,
                        revenueGenerated: record.RevenueGenerated || 0,
                    };
                });
                setPayrollData(payrollData);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                alert("Failed to load data. Please check your connection and try again.");
            })
            .finally(() => setLoading(false));
    }, [selectedYear]);

    // Handle month selection
    const handleMonthChange = (e) => {
        const value = parseInt(e.target.value);
        setSelectedMonths(prev =>
            e.target.checked
                ? [...prev, value].sort((a, b) => a - b)
                : prev.filter(month => month !== value)
        );
    };

    // Build the employee/earnings/deductions payload and hand it to the shared PDF template
    const buildAndSavePayslip = (employee, salary, period, filename) => {
        const epsContribution = salary.employerPf > 0 ? Math.min(Math.round(salary.pfWages * 0.0833), 1250) : 0;
        const epfContribution = salary.employerPf > 0 ? salary.employerPf - epsContribution : 0;
        const displayGratuity = salary.gratuity > 0 ? -Math.abs(salary.gratuity) : 0;

        const earnings = [
            { label: 'Basic Salary', value: salary.earnBasicSalary },
            { label: 'HRA', value: salary.earnHRA },
            { label: 'Convenyance Expenses', value: salary.earnConveyance },
            { label: 'Medical Allowance', value: salary.earnMedicalAllowance },
            { label: 'Other Expenses', value: salary.earnOtherAllowance },
            { label: 'EPS@8.33%', value: epsContribution },
            { label: 'EPF@3.67%', value: epfContribution },
            { label: 'Gratuity', value: displayGratuity },
        ].filter((item) => item.value);

        const deductions = [
            { label: 'Provident Fund Employee@12%', value: salary.pf },
            { label: 'Professional Tax', value: salary.pt },
        ].filter((item) => item.label === 'Professional Tax' || item.value);

        const totalEarnings = earnings.reduce((sum, item) => sum + (item.value || 0), 0);
        const totalDeductions = deductions.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0);
        const netPayable = totalEarnings - totalDeductions;

        generatePayslipPDF({
            employee: {
                name: employee.name,
                id: employee.id,
                department: employee.department,
                designation: employee.designation,
                branchOfficeName: employee.branchOfficeName,
                bankACNumber: employee.bankACNumber,
                bankName: employee.bankName,
                joiningDate: employee.joiningDate,
                panCard: employee.panCard,
                uanNumber: employee.uanNumber,
                pfACNumber: employee.pfACNumber,
                esiRegistrationNumber: employee.esiRegistrationNumber,
                pran: employee.pran,
            },
            periodLabel: buildPeriodLabel(period),
            earnings,
            deductions,
            netPayable,
            filename,
        });
    };

    // Download payslip(s) as PDF
    const downloadPayslip = async (employee, months, isFullYear) => {
        const [startYear] = selectedYear.split("-").map(Number);
        const yearText = `${startYear}-${startYear + 1}`;

        if (isFullYear) {
            let totalSalary = {
                earnBasicSalary: 0, earnHRA: 0, earnConveyance: 0, earnMedicalAllowance: 0, earnOtherAllowance: 0,
                pf: 0, pt: 0, pfWages: 0, employerPf: 0, gratuity: 0,
            };

            for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
                const salary = calculateSalary(employee, monthIndex, payrollData);
                if (salary) {
                    Object.keys(totalSalary).forEach(key => totalSalary[key] += salary[key]);
                }
            }

            const period = `Apr ${startYear} to Mar ${startYear + 1}`;
            buildAndSavePayslip(employee, totalSalary, period, `Payslip_${employee.name}_${selectedYear}.pdf`);
        } else {
            for (const monthIndex of months) {
                const salary = calculateSalary(employee, monthIndex, payrollData);
                if (salary) {
                    const period = formatDateRange(monthIndex, selectedYear);
                    buildAndSavePayslip(employee, salary, period, `Payslip_${employee.name}_${getMonthName(monthIndex)}_${selectedYear}.pdf`);
                }
            }
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4">
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-purple-800 text-center mb-6">
                    Pay Slip Generator
                </h1>

                {/* Financial Year and Month Selection */}
                <div className="flex flex-wrap gap-5 mb-5">
                    <div className="flex-1 min-w-[250px] flex flex-col">
                        <label className="mb-2 text-gray-600 text-sm">Select Financial Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full p-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {financialYears.length > 0 ? (
                                financialYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))
                            ) : (
                                <option value="">No financial years available</option>
                            )}
                        </select>
                    </div>
                    <div className="flex-1 min-w-[250px] flex flex-col">
                        <label className="mb-2 text-gray-600 text-sm">Select Months</label>
                        <div className="relative" ref={monthDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShowMonthOptions(!showMonthOptions)}
                                className="w-full p-2.5 border border-gray-300 rounded-md text-sm text-left flex justify-between items-center"
                            >
                                {selectedMonths.length > 0 ? selectedMonths.map(i => getMonthName(i)).join(", ") : "Select"}
                                <span>▼</span>
                            </button>
                            {showMonthOptions && (
                                <div
                                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                                    tabIndex={-1}
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <label key={i} className="flex items-center gap-2 p-2 hover:bg-gray-100">
                                            <input
                                                type="checkbox"
                                                value={i}
                                                checked={selectedMonths.includes(i)}
                                                onChange={handleMonthChange}
                                                className='accent-purple-800'
                                            />
                                            {getMonthName(i)}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Employee Table */}
                {employees.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="border border-gray-200 p-3 text-left text-sm font-medium text-gray-600">Employee ID</th>
                                    <th className="border border-gray-200 p-3 text-left text-sm font-medium text-gray-600">Employee Name</th>
                                    <th className="border border-gray-200 p-3 text-left text-sm font-medium text-gray-600">Download Full Year</th>
                                    <th className="border border-gray-200 p-3 text-left text-sm font-medium text-gray-600">Download Selected Months</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees
                                    .filter(employee => {
                                        if (!employee.workEndDate || !selectedYear) return true;

                                        const [startYear] = selectedYear.split("-").map(Number);
                                        const exitDate = new Date(employee.workEndDate);

                                        // Define target months: user selection OR all 12 months if selection is empty
                                        const targetMonths = selectedMonths.length > 0
                                            ? selectedMonths
                                            : Array.from({ length: 12 }, (_, i) => i);

                                        // Check if employee was active (worked at least 1 day) in any of the target months
                                        return targetMonths.some(mIdx => {
                                            const actualYear = mIdx < 9 ? startYear : startYear + 1;
                                            const monthNum = (mIdx + 3) % 12;
                                            const monthStartDate = new Date(actualYear, monthNum, 1);
                                            return exitDate >= monthStartDate;
                                        });
                                    })
                                    .map((employee, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="border border-gray-200 p-3 text-gray-800">{employee.id}</td>
                                        <td className="border border-gray-200 p-3 text-gray-800">{employee.name || 'Unknown'}</td>
                                        <td className="border border-gray-200 p-3 text-gray-800">
                                            <button
                                                onClick={() => downloadPayslip(employee, [], true)}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                            >
                                                Download Full Year
                                            </button>
                                        </td>
                                        <td className="border border-gray-200 p-3 text-gray-800">
                                            <button
                                                onClick={() => downloadPayslip(employee, selectedMonths, false)}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                                                disabled={selectedMonths.length === 0}
                                            >
                                                Download Selected Months
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

const PaySlipComponent = PaySlip;

export default memo(PaySlipComponent);