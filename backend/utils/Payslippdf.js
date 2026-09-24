const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

// ============================================================
// SETTINGS
// ============================================================

// Set to true to draw red boxes where the signature/stamp should appear.
// Turn it back to false once you can see the images.
const DEBUG_IMAGES = true;

// ============================================================
// COMPANY DETAILS
// ============================================================

const COMPANY_NAME = "Talent Corner HR Services Pvt Ltd.";
const COMPANY_ADDRESS_LINE1 = "708/709, Bhaveshwar Arcade NX";
const COMPANY_ADDRESS_LINE2 = "Opp Shreyas Cinema, LBS Marg, Ghatkopar(W),";
const COMPANY_ADDRESS_LINE3 = "Mumbai-400086";
const COMPANY_UDYAM = "UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)";
const COMPANY_EMAIL = "E-Mail : accounts@talentcorner.in";

// ============================================================
// SIGNATURE / STAMP FILES
// ============================================================

const STAMP_FILE = "talent-corner-stamp.png";
const SIGNATURE_FILE = "talent-corner-signature.png";

// The code looks for the images in all of these folders
const ASSET_DIRS = [
    path.join(__dirname, "../assets"),
    path.join(__dirname, "assets"),
    path.join(__dirname, "../../assets"),
    path.join(process.cwd(), "assets"),
    path.join(process.cwd(), "backend/assets"),
];

// ============================================================
// HELPERS
// ============================================================

const money = (value) => {
    return Number(value ?? 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const textValue = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") {
        return "";
    }

    return String(value);
};

// ============================================================
// IMAGE LOADER
// Returns { data, format } or null. Logs the exact reason.
// ============================================================

const loadImage = (fileName) => {
    for (const dir of ASSET_DIRS) {
        const fullPath = path.join(dir, fileName);

        if (!fs.existsSync(fullPath)) {
            continue;
        }

        const buffer = fs.readFileSync(fullPath);
        const header = buffer.slice(0, 4).toString("hex");

        const isPng = header === "89504e47";
        const isJpg = header.startsWith("ffd8");

        console.log(
            `Found ${fileName}:`,
            fullPath,
            "| bytes:",
            buffer.length,
            "| header:",
            header
        );

        if (!isPng && !isJpg) {
            console.error("❌ Not a real PNG/JPG file:", fullPath);
            return null;
        }

                if (isPng) {
            console.log(
                `   PNG info -> width: ${buffer.readUInt32BE(16)}, height: ${buffer.readUInt32BE(20)}, ` +
                `bitDepth: ${buffer[24]}, colorType: ${buffer[25]}, interlaced: ${buffer[28] === 1}`
            );
        }

        return {
            data: new Uint8Array(buffer),
            format: isPng ? "PNG" : "JPEG",
        };
    }

    console.error(`❌ ${fileName} NOT FOUND. Looked in:`);
    ASSET_DIRS.forEach((dir) => {
        let contents = "(folder does not exist)";

        if (fs.existsSync(dir)) {
            contents = fs.readdirSync(dir).join(", ") || "(empty folder)";
        }

        console.error("   -", dir, "=>", contents);
    });

    return null;
};

// ============================================================
// NUMBER TO WORDS
// ============================================================

const numberToWordsIndian = (number) => {
    number = Math.floor(Number(number ?? 0));

    if (number === 0) {
        return "Zero";
    }

    const ones = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
        "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
        "Sixteen", "Seventeen", "Eighteen", "Nineteen",
    ];

    const tens = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
        "Eighty", "Ninety",
    ];

    const twoDigits = (n) => {
        if (n < 20) {
            return ones[n];
        }

        return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : "");
    };

    const convert = (n) => {
        let result = "";

        if (n >= 10000000) {
            result += `${convert(Math.floor(n / 10000000))} Crore `;
            n %= 10000000;
        }

        if (n >= 100000) {
            result += `${convert(Math.floor(n / 100000))} Lakh `;
            n %= 100000;
        }

        if (n >= 1000) {
            result += `${convert(Math.floor(n / 1000))} Thousand `;
            n %= 1000;
        }

        if (n >= 100) {
            result += `${ones[Math.floor(n / 100)]} Hundred `;
            n %= 100;
        }

        if (n > 0) {
            if (result !== "") {
                result += "and ";
            }

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
        throw new Error("salary_month is required.");
    }

    const parts = String(salaryMonth).split("-");

    if (parts.length !== 2) {
        throw new Error(`Invalid salary_month: ${salaryMonth}`);
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);

    if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    ) {
        throw new Error(`Invalid salary_month: ${salaryMonth}`);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

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
// ============================================================

const generatePayslipPDF = async (payroll) => {
    if (!payroll) {
        throw new Error("Payroll data is missing.");
    }

    console.log("============================================");
    console.log("Generating Payslip PDF");
    console.log("Employee:", payroll.employee_name);
    console.log("Employee Code:", payroll.employee_code);
    console.log("Salary Month:", payroll.salary_month);
    console.log("============================================");

    // ========================================================
    // CREATE PDF
    // ========================================================

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });

    const pageWidth = 210;

    // ========================================================
    // EMPLOYEE DETAILS
    // ========================================================

    const employeeName = textValue(payroll.employee_name);
    const employeeNumber = textValue(payroll.employee_code);
    const designation = textValue(payroll.designation);
    const location = textValue(payroll.location);
    const salaryMonth = textValue(payroll.salary_month);

    if (!employeeName) {
        throw new Error("Employee name is missing.");
    }

    if (!employeeNumber) {
        throw new Error("Employee code is missing.");
    }

    if (!salaryMonth) {
        throw new Error("Salary month is missing.");
    }

    const { start: monthStart, end: monthEnd } = getMonthRange(salaryMonth);

    // ========================================================
    // BANK DETAILS
    // ========================================================

    const bankName = textValue(payroll.bank_name);
    const accountNumber = textValue(payroll.account_number);
    const ifsc = textValue(payroll.ifsc_code);
    const bankBranch = textValue(payroll.bank_branch);

    // ========================================================
    // STATUTORY DETAILS
    // ========================================================

    const pan = textValue(payroll.pan_number);
    const uan = textValue(payroll.uan_number);
    const pfAccountNumber = textValue(payroll.pf_account_number);
    const esicNumber = textValue(payroll.esic_number);
    const pran = textValue(payroll.pran);
    const taxRegime = textValue(payroll.tax_regime);

    const functionName = textValue(
        payroll.function_name || payroll.function || payroll.department
    );

    const joiningDate = payroll.joining_date
        ? new Date(payroll.joining_date).toLocaleDateString("en-GB")
        : "";

    // ========================================================
    // EARNINGS
    // ========================================================

    const basicSalary = Number(payroll.basic_salary ?? 0);
    const hra = Number(payroll.hra ?? 0);

    const conveyance = Number(
        payroll.conveyance ?? payroll.conveyance_allowance ?? 0
    );

    const medicalAllowance = Number(payroll.medical_allowance ?? 0);
    const otherAllowance = Number(payroll.other_allowance ?? 0);
    const overtime = Number(payroll.overtime ?? 0);
    const bonus = Number(payroll.bonus ?? 0);
    const gratuity = Number(payroll.gratuity ?? 0);

    // ========================================================
    // DEDUCTIONS
    // ========================================================

    const pf = Number(payroll.pf ?? 0);
    const esic = Number(payroll.esic ?? 0);
    const professionalTax = Number(payroll.professional_tax ?? 0);
    const tax = Number(payroll.tax ?? 0);
    const lop = Number(payroll.lop ?? 0);

    // ========================================================
    // TOTALS
    // ========================================================

    const calculatedGross =
        basicSalary +
        hra +
        conveyance +
        medicalAllowance +
        otherAllowance +
        overtime +
        bonus;

    const grossSalary =
        payroll.gross_salary !== null && payroll.gross_salary !== undefined
            ? Number(payroll.gross_salary)
            : calculatedGross;

    const calculatedDeductions = pf + esic + professionalTax + tax + lop;

    const totalDeductions =
        payroll.total_deductions !== null &&
        payroll.total_deductions !== undefined
            ? Number(payroll.total_deductions)
            : calculatedDeductions;

    const netSalary =
        payroll.net_salary !== null && payroll.net_salary !== undefined
            ? Number(payroll.net_salary)
            : grossSalary - totalDeductions;

    // ========================================================
    // OUTER BORDER
    // ========================================================

    doc.setLineWidth(0.6);
    doc.rect(17, 51, 176, 232);

    // ========================================================
    // COMPANY HEADER
    // ========================================================

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(COMPANY_NAME, 17, 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(COMPANY_ADDRESS_LINE1, 17, 25);
    doc.text(COMPANY_ADDRESS_LINE2, 17, 29);
    doc.text(COMPANY_ADDRESS_LINE3, 17, 33);
    doc.text(COMPANY_UDYAM, 17, 37);
    doc.text(COMPANY_EMAIL, 17, 41);

    // ========================================================
    // PAYSLIP TITLE
    // ========================================================

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Pay Slip", 22, 61);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`for ${monthStart} to ${monthEnd}`, 22, 67);

    doc.line(22, 72, 188, 72);

    // ========================================================
    // CENTER TITLE
    // ========================================================

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);

    doc.text(`Pay Slip for ${monthStart} to ${monthEnd}`, pageWidth / 2, 79, {
        align: "center",
    });

    doc.text(employeeName.toUpperCase(), pageWidth / 2, 85, {
        align: "center",
    });

    doc.line(22, 91, 188, 91);

    // ========================================================
    // EMPLOYEE DETAILS
    // ========================================================

    const leftX = 22;
    const rightX = 111;

    let leftY = 99;
    let rightY = 99;

    const addInfo = (x, y, label, value) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(label, x, y);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(textValue(value), x + 40, y);
    };

    // LEFT DETAILS

    addInfo(leftX, leftY, "Employee Number:", employeeNumber);
    leftY += 7;

    addInfo(leftX, leftY, "Function:", functionName);
    leftY += 7;

    addInfo(leftX, leftY, "Designation:", designation);
    leftY += 7;

    addInfo(leftX, leftY, "Location:", location);
    leftY += 7;

    // BANK DETAILS

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Bank Details:", leftX, leftY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);

    doc.text(`Name - ${bankName}`, leftX + 40, leftY);
    leftY += 4;

    doc.text(`BRANCH - ${bankBranch}`, leftX + 40, leftY);
    leftY += 4;

    doc.text(`IFSC code - ${ifsc}`, leftX + 40, leftY);
    leftY += 4;

    doc.text(`ACC NO. ${accountNumber}`, leftX + 40, leftY);

    // RIGHT DETAILS

    const addStatutoryInfo = (x, y, label, value) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(label, x, y);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(textValue(value), 188, y, { align: "right" });
    };

    addStatutoryInfo(rightX, rightY, "Tax Regime:", taxRegime);
    rightY += 7;

    addStatutoryInfo(rightX, rightY, "Income Tax Number (PAN):", pan);
    rightY += 7;

    addStatutoryInfo(rightX, rightY, "Universal Account Number (UAN):", uan);
    rightY += 7;

    addStatutoryInfo(rightX, rightY, "PF account number:", pfAccountNumber);
    rightY += 7;

    addStatutoryInfo(rightX, rightY, "ESI Number:", esicNumber);
    rightY += 7;

    addStatutoryInfo(rightX, rightY, "PR Account Number (PRAN):", pran);
    rightY += 7;

    addStatutoryInfo(rightX, rightY, "Date of joining:", joiningDate);

    // ========================================================
    // SALARY TABLE
    // ========================================================

    const tableX = 22;
    const tableY = 143;

    const widths = [38, 23, 23, 38, 23, 23];
    const rowHeight = 7;

    const headers = [
        "Earnings",
        "Amount",
        "Gross Salary",
        "Deductions",
        "Amount",
        "Gross Salary",
    ];

    let x = tableX;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);

    headers.forEach((header, index) => {
        doc.setFillColor(242, 242, 242);
        doc.rect(x, tableY, widths[index], rowHeight, "F");
        doc.text(header, x + 2, tableY + 5);
        x += widths[index];
    });

    // ROW HELPER

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
            money(earningAmount),
            money(earningGross),
            deductionLabel,
            deductionAmount === "" ? "" : money(deductionAmount),
            deductionGross === "" ? "" : String(deductionGross),
        ];

        values.forEach((value, index) => {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.2);

            if (index === 1 || index === 2 || index === 4 || index === 5) {
                doc.text(String(value), currentX + widths[index] - 2, y + 5, {
                    align: "right",
                });
            } else {
                doc.text(String(value), currentX + 2, y + 5);
            }

            currentX += widths[index];
        });
    };

    // SALARY ROWS

    let rowY = tableY + rowHeight;

    drawSalaryRow(
        rowY,
        "Basic Salary",
        basicSalary,
        basicSalary,
        "Provident Fund",
        pf,
        "-"
    );
    rowY += rowHeight;

    drawSalaryRow(
        rowY,
        "HRA",
        hra,
        hra,
        esic > 0 ? "ESIC" : "",
        esic > 0 ? esic : "",
        esic > 0 ? "-" : ""
    );
    rowY += rowHeight;

    drawSalaryRow(
        rowY,
        "Conveyance Expenses",
        conveyance,
        conveyance,
        professionalTax > 0 ? "Professional Tax" : "",
        professionalTax > 0 ? professionalTax : "",
        professionalTax > 0 ? "-" : ""
    );
    rowY += rowHeight;

    drawSalaryRow(
        rowY,
        "Medical Allowance",
        medicalAllowance,
        medicalAllowance,
        tax > 0 ? "Income Tax" : "",
        tax > 0 ? tax : "",
        tax > 0 ? "-" : ""
    );
    rowY += rowHeight;

    drawSalaryRow(
        rowY,
        "Other Expenses",
        otherAllowance,
        otherAllowance,
        lop > 0 ? "Loss of Pay" : "",
        lop > 0 ? lop : "",
        lop > 0 ? "-" : ""
    );
    rowY += rowHeight;

    drawSalaryRow(rowY, "Gratuity", gratuity, gratuity, "", "", "");

    // ========================================================
    // TOTAL
    // ========================================================

    rowY += rowHeight;

    const totalEarnings =
        basicSalary +
        hra +
        conveyance +
        medicalAllowance +
        otherAllowance +
        overtime +
        bonus;

    let totalX = tableX;

    const totalValues = [
        "Total Earnings",
        money(totalEarnings),
        money(grossSalary),
        "Total Deductions",
        money(totalDeductions),
        money(totalDeductions),
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);

    totalValues.forEach((value, index) => {
        doc.setFillColor(243, 243, 243);
        doc.rect(totalX, rowY, widths[index], rowHeight, "F");

        if (index === 1 || index === 2 || index === 4 || index === 5) {
            doc.text(String(value), totalX + widths[index] - 2, rowY + 5, {
                align: "right",
            });
        } else {
            doc.text(String(value), totalX + 2, rowY + 5);
        }

        totalX += widths[index];
    });

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
        money(netSalary),
        money(netSalary),
    ];

    netValues.forEach((value, index) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);

        if (index === 4 || index === 5) {
            doc.text(String(value), netX + widths[index] - 2, rowY + 5, {
                align: "right",
            });
        } else if (value) {
            doc.text(String(value), netX + 2, rowY + 5);
        }

        netX += widths[index];
    });

    // ========================================================
    // AMOUNT IN WORDS
    // ========================================================

    const wordsY = rowY + 17;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Amount (in words):", tableX, wordsY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    doc.text(
        `INR ${numberToWordsIndian(Math.round(netSalary))} Rupees only`,
        tableX,
        wordsY + 6
    );

    doc.line(tableX, wordsY + 10, 188, wordsY + 10);

    // ========================================================
    // SIGNATURE / STAMP AREA
    // ========================================================

    const signatureTextY = 245;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text(`for ${COMPANY_NAME}`, 188, signatureTextY, {
        align: "right",
    });

    // Positions: x, y, width, height (mm)
    const SIGNATURE_BOX = { x: 143, y: 247, w: 32, h: 10.5 };
    const STAMP_BOX = { x: 171, y: 236, w: 25, h: 25 };

    const signature = loadImage(SIGNATURE_FILE);
    const stamp = loadImage(STAMP_FILE);

    // Red boxes show where the images should appear (debug only)
    if (DEBUG_IMAGES) {
        doc.setDrawColor(255, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(SIGNATURE_BOX.x, SIGNATURE_BOX.y, SIGNATURE_BOX.w, SIGNATURE_BOX.h);
        doc.rect(STAMP_BOX.x, STAMP_BOX.y, STAMP_BOX.w, STAMP_BOX.h);
        doc.setDrawColor(0, 0, 0);
    }

    if (signature) {
        try {
            doc.addImage(
                signature.data,
                signature.format,
                SIGNATURE_BOX.x,
                SIGNATURE_BOX.y,
                SIGNATURE_BOX.w,
                SIGNATURE_BOX.h
            );

            console.log("✅ Signature added successfully.");
        } catch (error) {
            console.error("❌ Signature addImage failed:", error.message);
        }
    }

    if (stamp) {
        try {
            doc.addImage(
                stamp.data,
                stamp.format,
                STAMP_BOX.x,
                STAMP_BOX.y,
                STAMP_BOX.w,
                STAMP_BOX.h
            );

            console.log("✅ Stamp added successfully.");
        } catch (error) {
            console.error("❌ Stamp addImage failed:", error.message);
        }
    }

    // ========================================================
    // RETURN PDF
    // ========================================================

    console.log("Payslip PDF generated successfully.");

    return Buffer.from(doc.output("arraybuffer"));
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    generatePayslipPDF,
};