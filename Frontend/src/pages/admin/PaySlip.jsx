import React, { useState, useEffect, useRef, memo } from 'react';
import { jsPDF } from 'jspdf';

// Utility function to format numbers with commas
const formatNumberWithCommas = (number) => {
    if (number === "N/A" || number == null) return "N/A";
    const integerPart = number.toString();
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return formattedInteger;
};

// Utility function to convert numbers to Indian words
const numberToWordsIndian = (num) => {
    if (num === 0) return "Zero";
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const thousands = ["", "Thousand", "Lakh", "Crore"];

    const convertLessThanThousand = (n) => {
        if (n === 0) return "";
        if (n < 10) return units[n];
        if (n < 20) return teens[n - 10];
        if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
        return `${units[Math.floor(n / 100)]} Hundred ${convertLessThanThousand(n % 100)}`.trim();
    };

    let crore = Math.floor(num / 10000000);
    let lakh = Math.floor((num % 10000000) / 100000);
    let thousand = Math.floor((num % 100000) / 1000);
    let hundred = Math.floor((num % 1000));

    let result = [];
    if (crore > 0) result.push(`${convertLessThanThousand(crore)} Crore`);
    if (lakh > 0) result.push(`${convertLessThanThousand(lakh)} Lakh`);
    if (thousand > 0) result.push(`${convertLessThanThousand(thousand)} Thousand`);
    if (hundred > 0) result.push(convertLessThanThousand(hundred));

    return result.join(" ").trim() || "Zero";
};

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

// Utility function to load image and get dimensions
const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
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

    // Generate payslip PDF with selectable text
    const generatePayslipPDF = async (employee, salary, period, financialYear, filename) => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let y = 15;
    
        // Custom robust currency formatter for Indian locale
        const formatCurrency = (num) => {
            if (num == null) return '0.00';
            const str = Number(num).toFixed(2).toString();
            const parts = str.split('.');
            let integerPart = parts[0];
            const fractionPart = parts[1];
            const lastThree = integerPart.length > 3 ? integerPart.slice(integerPart.length - 3) : integerPart;
            const otherNumbers = integerPart.slice(0, integerPart.length - 3);
            const formattedOtherNumbers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
            const finalInteger = otherNumbers ? formattedOtherNumbers + ',' + lastThree : lastThree;
            return `${finalInteger}.${fractionPart}`;
        };
    
        // 1. Logo and Header
        const logoUrl = '/logo.png';
        try {
            const img = await loadImage(logoUrl);
            const logoWidth = 35;
            const aspectRatio = img.width / img.height;
            const logoHeight = logoWidth / aspectRatio;
            doc.addImage(img, 'PNG', margin, y, logoWidth, logoHeight);
        } catch (error) {
            console.warn('Logo not found at /logo.png, skipping...');
        }
        
        const headerTextX = pageWidth / 2 + 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Talent Corner HR Services Pvt. Ltd.', headerTextX, y + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('708/709, Bhaveshwar Arcade NX, Opp Shreyas Cinema, LBS Marg', headerTextX, y + 11, { align: 'center' });
        doc.text('Ghatkopar(W), Mumbai-400086', headerTextX, y + 16, { align: 'center' });
        doc.text('GSTIN : 27AACCT6635P1ZP', headerTextX, y + 21, { align: 'center' });
        doc.text('UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)', headerTextX, y + 26, { align: 'center' });
        doc.text('E-Mail : accounts@talentcorner.in', headerTextX, y + 31, { align: 'center' });
        y += 40;
    
        // 2. Title and Period
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Pay Slip', pageWidth / 2, y, { align: 'center' });
        y += 6;
    
        const monthNames = { "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July", "Aug": "August", "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December" };
        let monthYearStr;
    
        // Check if the period string starts with a number (indicating DD Mon YYYY format for a single month)
        if (/^\d/.test(period)) {
            const parts = period.split(' '); // e.g., ["1", "Apr", "2024", "to", ...]
            if (parts.length > 2) {
                const monthName = monthNames[parts[1]] || parts[1];
                const year = parts[2];
                monthYearStr = `for the month of ${monthName} ${year}`;
            } else {
                monthYearStr = `for ${period}`; // Fallback, should not be reached
            }
        } else {
            // It's the full year format, e.g., "Apr 2023 to Mar 2024"
            monthYearStr = `for ${period}`;
        }
    
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(monthYearStr, pageWidth / 2, y, { align: 'center' });
        y += 10;
        
        // 3. Employee Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text((employee.name || 'N/A').toUpperCase(), pageWidth / 2, y, { align: 'center' });
        y += 12;
    
        // 4. Details Section with Text Wrapping - FINAL ROBUST FIX
        const col1X = margin;
        const col2X = pageWidth / 2 + 10;
        const detailLineHeight = 5;
        doc.setFontSize(10);
    
        const detailsLeft = [
            { label: 'Employee Number', value: employee.id || 'N/A' },
            { label: 'Function', value: employee.department || 'N/A' },
            { label: 'Designation', value: employee.designation || 'N/A' },
            { label: 'Location', value: employee.branchOfficeName || 'N/A' },
            { label: 'Bank Details', value: `${employee.bankACNumber || ''}, ${employee.bankName || ''}`.replace(/^, /, '') || 'N/A' },
            { label: 'Date of joining', value: employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: '2-digit'}).replace(/ /g, '-') : 'N/A' },
        ];
        const detailsRight = [
            { label: 'Tax Regime', value: 'Regular Tax Regime' },
            { label: 'Income Tax Number (PAN)', value: employee.panCard || 'N/A' },
            { label: 'Universal Account Number (UAN)', value: employee.uanNumber || 'N/A' },
            { label: 'PF account number', value: employee.pfACNumber || 'N/A' },
            { label: 'ESI Number', value: employee.esiRegistrationNumber || 'N/A' },
            { label: 'PR Account Number (PRAN)', value: employee.pran || 'N/A' },
        ];

        const leftLabelMaxWidth = 45;
        const rightLabelMaxWidth = 45;
        const leftValueX = col1X + leftLabelMaxWidth;
        const rightValueX = col2X + rightLabelMaxWidth;
        const leftValueMaxWidth = col2X - leftValueX - 2;
        const rightValueMaxWidth = pageWidth - rightValueX - margin;

        for (let i = 0; i < Math.max(detailsLeft.length, detailsRight.length); i++) {
            const currentY = y;
            let leftLabelLines = [''], leftValueLines = [''], rightLabelLines = [''], rightValueLines = [''];
            
            // Calculate lines for all 4 components
            if (detailsLeft[i]) {
                leftLabelLines = doc.splitTextToSize(detailsLeft[i].label, leftLabelMaxWidth);
                leftValueLines = doc.splitTextToSize(String(detailsLeft[i].value), leftValueMaxWidth);
            }
            if (detailsRight[i]) {
                rightLabelLines = doc.splitTextToSize(detailsRight[i].label, rightLabelMaxWidth);
                rightValueLines = doc.splitTextToSize(String(detailsRight[i].value), rightValueMaxWidth);
            }
            
            // Determine max height for the row
            const maxLines = Math.max(leftLabelLines.length, leftValueLines.length, rightLabelLines.length, rightValueLines.length);

            // Draw left column
            if (detailsLeft[i]) {
                doc.setFont('helvetica', 'normal');
                doc.text(leftLabelLines, col1X, currentY);
                doc.text(':', leftValueX - 5, currentY);
                doc.setFont('helvetica', 'bold');
                doc.text(leftValueLines, leftValueX, currentY);
            }
            // Draw right column
            if (detailsRight[i]) {
                doc.setFont('helvetica', 'normal');
                doc.text(rightLabelLines, col2X, currentY);
                doc.text(':', rightValueX - 5, currentY);
                doc.setFont('helvetica', 'bold');
                doc.text(rightValueLines, rightValueX, currentY);
            }

            // Move y down by the calculated row height
            y += maxLines * detailLineHeight + 1; // +1 for a little gap
        }
        y += 5;

    
        // 5. Earnings & Deductions Table
        const epsContribution = salary.employerPf > 0 ? Math.min(Math.round(salary.pfWages * 0.0833), 1250) : 0;
        const epfContribution = salary.employerPf > 0 ? salary.employerPf - epsContribution : 0;
        const displayGratuity = salary.gratuity > 0 ? -Math.abs(salary.gratuity) : 0;
    
        const earningsData = [
            { label: 'Basic Salary', value: salary.earnBasicSalary }, { label: 'HRA', value: salary.earnHRA },
            { label: 'Convenyance Expenses', value: salary.earnConveyance }, { label: 'Medical Allowance', value: salary.earnMedicalAllowance },
            { label: 'Other Expenses', value: salary.earnOtherAllowance }, { label: 'EPS@8.33%', value: epsContribution },
            { label: 'EPF@3.67%', value: epfContribution }, { label: 'Gratuity', value: displayGratuity },
        ];
        const deductionsData = [
            { label: 'Provident Fund Employee@12%', value: salary.pf }, { label: 'Professional Tax', value: salary.pt },
        ];
    
        const totalEarnings = earningsData.reduce((sum, item) => sum + (item.value || 0), 0);
        const totalDeductions = deductionsData.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0);
        const netPayable = totalEarnings - totalDeductions;
        
        doc.setLineWidth(0.4); doc.line(margin, y, pageWidth - margin, y); y += 6;
        
        const earningX = margin + 2, earningAmtX = margin + 90, deductionX = margin + 100, deductionAmtX = pageWidth - margin - 2;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text('Earnings', earningX, y); doc.text('Amount', earningAmtX, y, { align: 'right' });
        doc.text('Deductions', deductionX, y); doc.text('Amount', deductionAmtX, y, { align: 'right' });
        y += 6;
        
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        const tableLineHeight = 6;
        const numRows = Math.max(earningsData.length, deductionsData.length);
        for (let i = 0; i < numRows; i++) {
            if (i < earningsData.length && earningsData[i].value !== 0) {
                const item = earningsData[i];
                const valueStr = item.label === 'Gratuity' ? `(-) ${formatCurrency(Math.abs(item.value))}` : formatCurrency(item.value);
                doc.text(item.label, earningX, y); doc.text(valueStr, earningAmtX, y, { align: 'right' });
            }
            if (i < deductionsData.length && (deductionsData[i].label === 'Professional Tax' || deductionsData[i].value !== 0)) {
                const item = deductionsData[i];
                doc.text(item.label, deductionX, y); doc.text(formatCurrency(item.value), deductionAmtX, y, { align: 'right' });
            }
            y += tableLineHeight;
        }
        
        // 6. Totals
        y += 2;
        doc.setLineWidth(0.4); doc.line(margin, y, earningAmtX, y); doc.line(deductionX-2, y, deductionAmtX+2, y); y += 6;
        
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text('Total Earnings', earningX, y); doc.text(formatCurrency(totalEarnings), earningAmtX, y, { align: 'right' });
        doc.text('Total Deductions', deductionX, y); doc.text(formatCurrency(totalDeductions), deductionAmtX, y, { align: 'right' });
        y += 8;
        
        doc.setLineWidth(0.4); doc.line(margin, y, pageWidth - margin, y); y += 6;
        doc.text('Net Amount', margin, y); doc.text(formatCurrency(netPayable), deductionAmtX, y, { align: 'right' });
        y += 8;
        
        // 7. Footer
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        const amountInWords = `Amount (in words): INR ${numberToWordsIndian(Math.round(netPayable))} Only`;
        const textLines = doc.splitTextToSize(amountInWords, pageWidth - margin * 2);
        doc.text(textLines, margin, y);
        
        const footerY = doc.internal.pageSize.getHeight() - 30;
        doc.text(`for Talent Corner HR Services Pvt. Ltd.`, pageWidth - margin, footerY, { align: 'right' });
        doc.text('Authorised Signatory', pageWidth - margin, footerY + 15, { align: 'right' });
        
        doc.save(filename);
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
            await generatePayslipPDF(employee, totalSalary, period, yearText, `Payslip_${employee.name}_${selectedYear}.pdf`);
        } else {
            for (const monthIndex of months) {
                const salary = calculateSalary(employee, monthIndex, payrollData);
                if (salary) {
                    const period = formatDateRange(monthIndex, selectedYear);
                    await generatePayslipPDF(employee, salary, period, yearText, `Payslip_${employee.name}_${getMonthName(monthIndex)}_${selectedYear}.pdf`);
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