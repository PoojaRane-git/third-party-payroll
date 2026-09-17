const { jsPDF } = require("jspdf");

// ============================================================
// HELPERS
// ============================================================

const money = (value) => {
    const num = Number(value || 0);

    return num.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const numberToWordsIndian = (number) => {
    number = Math.floor(Number(number || 0));

    if (number === 0) return "Zero";

    const ones = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];

    const tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ];

    const twoDigits = (n) => {
        if (n < 20) return ones[n];

        return (
            tens[Math.floor(n / 10)] +
            (n % 10 ? " " + ones[n % 10] : "")
        );
    };

    const convert = (n) => {
        let result = "";

        if (n >= 10000000) {
            result +=
                convert(Math.floor(n / 10000000)) +
                " Crore ";
            n %= 10000000;
        }

        if (n >= 100000) {
            result +=
                convert(Math.floor(n / 100000)) +
                " Lakh ";
            n %= 100000;
        }

        if (n >= 1000) {
            result +=
                convert(Math.floor(n / 1000)) +
                " Thousand ";
            n %= 1000;
        }

        if (n >= 100) {
            result +=
                ones[Math.floor(n / 100)] +
                " Hundred ";
            n %= 100;
        }

        if (n > 0) {
            if (result !== "") result += "and ";
            result += twoDigits(n);
        }

        return result.trim();
    };

    return convert(number);
};

// ============================================================
// MONTH RANGE
// ============================================================

const getMonthRange = (salaryMonth) => {
    if (!salaryMonth) {
        return {
            start: "1 Aug 2025",
            end: "31 Aug 2025",
        };
    }

    const [year, month] = String(salaryMonth)
        .split("-")
        .map(Number);

    if (!year || !month) {
        return {
            start: "1 Aug 2025",
            end: "31 Aug 2025",
        };
    }

    const startDate = new Date(
        year,
        month - 1,
        1
    );

    const endDate = new Date(
        year,
        month,
        0
    );

    const formatDate = (date) =>
        date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });

    return {
        start: formatDate(startDate),
        end: formatDate(endDate),
    };
};

// ============================================================
// GENERATE PAYSLIP PDF
// SAME FORMAT AS YOUR IMAGE
// ============================================================

const generatePayslipPDF = async (payroll) => {
    if (!payroll) {
        throw new Error(
            "Payroll data is missing"
        );
    }

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = 210;

    // ========================================================
    // EMPLOYEE DETAILS
    // ========================================================

    const employeeName =
        payroll.employee_name ||
        payroll.name ||
        "Employee";

    const employeeNumber =
        payroll.employee_code ||
        payroll.employee_ref_id ||
        payroll.id ||
        "N/A";

    const designation =
        payroll.designation ||
        "N/A";

    const location =
        payroll.location ||
        payroll.work_location ||
        "Head Office";

    const salaryMonth =
        payroll.salary_month ||
        "2025-08";

    const {
        start: monthStart,
        end: monthEnd,
    } = getMonthRange(salaryMonth);

    const bankName =
        payroll.bank_name ||
        "N/A";

    const accountNumber =
        payroll.account_number ||
        "N/A";

    const ifsc =
        payroll.ifsc_code ||
        "N/A";

    const pan =
        payroll.pan_number ||
        "N/A";

    const uan =
        payroll.uan_number ||
        payroll.pran ||
        "N/A";

    const esicNumber =
        payroll.esic_number ||
        "N/A";

    const joiningDate =
        payroll.joining_date
            ? new Date(
                  payroll.joining_date
              ).toLocaleDateString(
                  "en-GB"
              )
            : "N/A";

    // ========================================================
    // SALARY
    // ========================================================

    const basicSalary = Number(
        payroll.basic_salary || 0
    );

    const hra = Number(
        payroll.hra || 0
    );

    const conveyance = Number(
        payroll.conveyance ||
        payroll.conveyance_allowance ||
        0
    );

    const medicalAllowance = Number(
        payroll.medical_allowance || 0
    );

    const otherAllowance = Number(
        payroll.other_allowance || 0
    );

    const gratuity = Number(
        payroll.gratuity || 0
    );

    const pf = Number(
        payroll.pf || 0
    );

    const esic = Number(
        payroll.esic || 0
    );

    const professionalTax = Number(
        payroll.professional_tax || 0
    );

    const tax = Number(
        payroll.tax || 0
    );

    const lop = Number(
        payroll.lop || 0
    );

    const grossSalary = Number(
        payroll.gross_salary ||
        (
            basicSalary +
            hra +
            conveyance +
            medicalAllowance +
            otherAllowance +
            payroll.overtime +
            payroll.bonus
        )
    );

    const totalDeductions = Number(
        payroll.total_deductions ??
        (
            pf +
            esic +
            professionalTax +
            tax +
            lop
        )
    );

    const netSalary = Number(
        payroll.net_salary ??
        (
            grossSalary -
            totalDeductions
        )
    );

    // ========================================================
    // GROSS STRUCTURE
    // ========================================================

    const fixedGross =
        Number(payroll.fixed_gross_salary) ||
        Number(payroll.pay_rate) ||
        (
            basicSalary > 0
                ? basicSalary * 2
                : grossSalary
        );

    const grossBasic =
        Math.round(
            fixedGross * 0.50
        );

    const grossHRA =
        Math.round(
            grossBasic * 0.50
        );

    const grossConveyance =
        conveyance || 1200;

    const grossMedical =
        medicalAllowance || 1000;

    const grossOther =
        otherAllowance ||
        Math.max(
            0,
            Math.round(
                fixedGross -
                grossBasic -
                grossHRA -
                grossConveyance -
                grossMedical
            )
        );

    // ========================================================
    // OUTER BORDER
    // ========================================================

    doc.setLineWidth(0.6);

    doc.rect(
        17,
        51,
        176,
        232
    );

    // ========================================================
    // COMPANY HEADER
    // ========================================================

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(17);

    doc.text(
        "Talent Corner HR Services Pvt Ltd.",
        17,
        18
    );

    doc.setFont(
        "helvetica",
        "normal"
    );

    doc.setFontSize(8.5);

    doc.text(
        "708/709, Bhaveshwar Arcade NX",
        17,
        25
    );

    doc.text(
        "Opp Shreyas Cinema, LBS Marg, Ghatkopar(W),",
        17,
        29
    );

    doc.text(
        "Mumbai-400086",
        17,
        33
    );

    doc.text(
        "UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)",
        17,
        37
    );

    doc.text(
        "E-Mail : accounts@talentcorner.in",
        17,
        41
    );

    // ========================================================
    // PAYSLIP TITLE
    // ========================================================

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(15);

    doc.text(
        "Pay Slip",
        22,
        61
    );

    doc.setFont(
        "helvetica",
        "normal"
    );

    doc.setFontSize(9);

    doc.text(
        `for ${monthStart} to ${monthEnd}`,
        22,
        67
    );

    doc.line(
        22,
        72,
        188,
        72
    );

    // ========================================================
    // CENTER TITLE
    // ========================================================

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(12);

    doc.text(
        `Pay Slip for ${monthStart} to ${monthEnd}`,
        pageWidth / 2,
        79,
        {
            align: "center",
        }
    );

    doc.text(
        String(
            employeeName
        ).toUpperCase(),
        pageWidth / 2,
        85,
        {
            align: "center",
        }
    );

    doc.line(
        22,
        91,
        188,
        91
    );

    // ========================================================
    // EMPLOYEE DETAILS
    // ========================================================

    const leftX = 22;
    const rightX = 111;

    let leftY = 99;
    let rightY = 99;

    const addInfo = (
        x,
        y,
        label,
        value
    ) => {
        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(7.5);

        doc.text(
            label,
            x,
            y
        );

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.text(
            String(value || "N/A"),
            x + 40,
            y
        );
    };

    // ========================================================
    // LEFT
    // ========================================================

    addInfo(
        leftX,
        leftY,
        "Employee Number:",
        employeeNumber
    );

    leftY += 7;

    addInfo(
        leftX,
        leftY,
        "Function:",
        "CS"
    );

    leftY += 7;

    addInfo(
        leftX,
        leftY,
        "Designation:",
        designation
    );

    leftY += 7;

    addInfo(
        leftX,
        leftY,
        "Location:",
        location
    );

    leftY += 7;

    // ========================================================
    // BANK
    // ========================================================

    doc.setFont(
        "helvetica",
        "normal"
    );

    doc.setFontSize(7.5);

    doc.text(
        "Bank Details:",
        leftX,
        leftY
    );

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.text(
        `Name - ${bankName}`,
        leftX + 40,
        leftY
    );

    leftY += 4;

    doc.text(
        "BRANCH - N/A",
        leftX + 40,
        leftY
    );

    leftY += 4;

    doc.text(
        `IFSC code - ${ifsc}`,
        leftX + 40,
        leftY
    );

    leftY += 4;

    doc.text(
        `ACC NO. ${accountNumber}`,
        leftX + 40,
        leftY
    );

    leftY += 8;

    addInfo(
        leftX,
        leftY,
        "Date of joining:",
        joiningDate
    );

    // ========================================================
    // RIGHT
    // ========================================================

    addInfo(
        rightX,
        rightY,
        "Tax Regime:",
        "Regular Tax Regime"
    );

    rightY += 7;

    addInfo(
        rightX,
        rightY,
        "Income Tax Number (PAN):",
        pan
    );

    rightY += 7;

    addInfo(
        rightX,
        rightY,
        "Universal Account Number (UAN):",
        uan
    );

    rightY += 7;

    addInfo(
        rightX,
        rightY,
        "PF account number:",
        payroll.pran || "N/A"
    );

    rightY += 7;

    addInfo(
        rightX,
        rightY,
        "ESI Number:",
        esicNumber
    );

    rightY += 7;

    addInfo(
        rightX,
        rightY,
        "PR Account Number (PRAN):",
        payroll.pran || "N/A"
    );

    // ========================================================
    // SALARY TABLE
    // ========================================================

    const tableX = 22;
    const tableY = 143;

    const widths = [
        38,
        23,
        23,
        38,
        23,
        23,
    ];

    const rowHeight = 7;

    const headers = [
        "Earnings",
        "Amount",
        "Gross Salary",
        "Deductions",
        "Amount",
        "Gross Salary",
    ];

    // ========================================================
    // TABLE HEADER
    // ========================================================

    let x = tableX;

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(7.5);

    headers.forEach(
        (header, index) => {

            doc.setFillColor(
                242,
                242,
                242
            );

            doc.rect(
                x,
                tableY,
                widths[index],
                rowHeight,
                "FD"
            );

            doc.text(
                header,
                x + 2,
                tableY + 5
            );

            x += widths[index];
        }
    );

    // ========================================================
    // ROW HELPER
    // ========================================================

    const drawSalaryRow = (
        y,
        earningLabel,
        earningAmount,
        earningGross,
        deductionLabel = "",
        deductionAmount = "",
        deductionGross = ""
    ) => {

        let currentX = tableX;

        const values = [
            earningLabel,

            formatNumberWithCommas(
                earningAmount
            ),

            formatNumberWithCommas(
                earningGross
            ),

            deductionLabel,

            deductionAmount === ""
                ? ""
                : formatNumberWithCommas(
                    deductionAmount
                ),

            deductionGross === ""
                ? ""
                : deductionGross,
        ];

        values.forEach(
            (value, index) => {

                doc.rect(
                    currentX,
                    y,
                    widths[index],
                    rowHeight
                );

                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(7);

                if (
                    index === 1 ||
                    index === 2 ||
                    index === 4 ||
                    index === 5
                ) {

                    doc.text(
                        String(value),
                        currentX +
                        widths[index] -
                        2,
                        y + 5,
                        {
                            align: "right",
                        }
                    );

                } else {

                    doc.text(
                        String(value),
                        currentX + 2,
                        y + 5
                    );
                }

                currentX +=
                    widths[index];
            }
        );
    };

    // ========================================================
    // FORMAT NUMBER
    // ========================================================

    const formatNumberWithCommas = (
        value
    ) => {
        return Number(
            value || 0
        ).toLocaleString(
            "en-IN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }
        );
    };

    // ========================================================
    // SALARY ROWS
    // ========================================================

    let rowY =
        tableY + rowHeight;

    // BASIC

    drawSalaryRow(
        rowY,
        "Basic Salary",
        basicSalary,
        grossBasic,
        "Provident Fund",
        pf,
        "-"
    );

    rowY += rowHeight;

    // HRA

    drawSalaryRow(
        rowY,
        "HRA",
        hra,
        grossHRA,
        esic > 0
            ? "ESIC"
            : "",
        esic > 0
            ? esic
            : "",
        esic > 0
            ? "-"
            : ""
    );

    rowY += rowHeight;

    // CONVEYANCE

    drawSalaryRow(
        rowY,
        "Conveyance Expenses",
        conveyance,
        grossConveyance,
        professionalTax > 0
            ? "Professional Tax"
            : "",
        professionalTax > 0
            ? professionalTax
            : "",
        professionalTax > 0
            ? "-"
            : ""
    );

    rowY += rowHeight;

    // MEDICAL

    drawSalaryRow(
        rowY,
        "Medical Allowance",
        medicalAllowance,
        grossMedical,
        tax > 0
            ? "Income Tax"
            : "",
        tax > 0
            ? tax
            : "",
        tax > 0
            ? "-"
            : ""
    );

    rowY += rowHeight;

    // OTHER

    drawSalaryRow(
        rowY,
        "Other Expenses",
        otherAllowance,
        grossOther,
        lop > 0
            ? "Loss of Pay"
            : "",
        lop > 0
            ? lop
            : "",
        lop > 0
            ? "-"
            : ""
    );

    rowY += rowHeight;

    // GRATUITY

    drawSalaryRow(
        rowY,
        "Gratuity",
        gratuity,
        0,
        "",
        "",
        ""
    );

    rowY += rowHeight;

    // ========================================================
    // TOTAL
    // ========================================================

    const totalEarnings =
        Number(basicSalary) +
        Number(hra) +
        Number(conveyance) +
        Number(medicalAllowance) +
        Number(otherAllowance) +
        Number(gratuity);

    let totalX = tableX;

    const totalValues = [
        "Total Earnings",

        formatNumberWithCommas(
            totalEarnings
        ),

        formatNumberWithCommas(
            grossSalary
        ),

        "Total Deductions",

        formatNumberWithCommas(
            totalDeductions
        ),

        formatNumberWithCommas(
            totalDeductions
        ),
    ];

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(7.5);

    totalValues.forEach(
        (value, index) => {

            doc.setFillColor(
                243,
                243,
                243
            );

            doc.rect(
                totalX,
                rowY,
                widths[index],
                rowHeight,
                "FD"
            );

            if (
                index === 1 ||
                index === 2 ||
                index === 4 ||
                index === 5
            ) {

                doc.text(
                    String(value),
                    totalX +
                    widths[index] -
                    2,
                    rowY + 5,
                    {
                        align: "right",
                    }
                );

            } else {

                doc.text(
                    String(value),
                    totalX + 2,
                    rowY + 5
                );
            }

            totalX += widths[index];
        }
    );

    // ========================================================
    // NET AMOUNT
    // ========================================================

    rowY += rowHeight;

    let netX = tableX;

    const netValues = [
        "",
        "",
        "",
        "Net Amount",
        formatNumberWithCommas(
            netSalary
        ),
        formatNumberWithCommas(
            netSalary
        ),
    ];

    netValues.forEach(
        (value, index) => {

            doc.rect(
                netX,
                rowY,
                widths[index],
                rowHeight
            );

            doc.setFont(
                "helvetica",
                "bold"
            );

            doc.setFontSize(7.5);

            if (
                index === 4 ||
                index === 5
            ) {

                doc.text(
                    String(value),
                    netX +
                    widths[index] -
                    2,
                    rowY + 5,
                    {
                        align: "right",
                    }
                );

            } else {

                doc.text(
                    String(value),
                    netX + 2,
                    rowY + 5
                );
            }

            netX += widths[index];
        }
    );

    // ========================================================
    // AMOUNT IN WORDS
    // ========================================================

    const wordsY =
        rowY + 17;

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(8);

    doc.text(
        "Amount (in words):",
        tableX,
        wordsY
    );

    doc.setFont(
        "helvetica",
        "normal"
    );

    doc.setFontSize(7.5);

    doc.text(
        `INR ${numberToWordsIndian(
            Math.round(netSalary)
        )} Rupees only`,
        tableX,
        wordsY + 6
    );

    doc.line(
        tableX,
        wordsY + 10,
        188,
        wordsY + 10
    );

    // ========================================================
    // SIGNATURE
    // ========================================================

    const signatureY =
        wordsY + 25;

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(8);

    doc.text(
        "for Talent Corner HR Services Pvt Ltd.",
        188,
        signatureY,
        {
            align: "right",
        }
    );

    // ========================================================
    // SIGNATURE PLACEHOLDER
    // ========================================================

    doc.setFont(
        "helvetica",
        "italic"
    );

    doc.setFontSize(18);

    doc.text(
        "✓",
        157,
        wordsY + 31
    );

    // ========================================================
    // STAMP
    // ========================================================

    doc.setLineWidth(0.5);

    doc.circle(
        178,
        wordsY + 31,
        10
    );

    doc.circle(
        178,
        wordsY + 31,
        7
    );

    doc.setFont(
        "helvetica",
        "bold"
    );

    doc.setFontSize(5);

    doc.text(
        "TALENT CORNER HR",
        178,
        wordsY + 28,
        {
            align: "center",
        }
    );

    doc.text(
        "MUMBAI",
        178,
        wordsY + 32,
        {
            align: "center",
        }
    );

    doc.text(
        "AUTHORISED",
        178,
        wordsY + 35,
        {
            align: "center",
        }
    );

    // ========================================================
    // RETURN BUFFER
    // ========================================================

    return Buffer.from(
        doc.output("arraybuffer")
    );
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    generatePayslipPDF,
};