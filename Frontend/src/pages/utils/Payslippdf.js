import { jsPDF } from "jspdf";

// =====================================================
// NUMBER TO WORDS - INDIAN FORMAT
// =====================================================

export const numberToWordsIndian = (num) => {
  const value = Math.floor(Number(num || 0));
  if (value === 0) return "Zero";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertLessThanThousand = (n) => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return `${tens[Math.floor(n / 10)]} ${units[n % 10]}`.trim();
    return `${units[Math.floor(n / 100)]} Hundred ${convertLessThanThousand(n % 100)}`.trim();
  };

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const remainder = value % 1000;

  const result = [];
  if (crore > 0) result.push(`${convertLessThanThousand(crore)} Crore`);
  if (lakh > 0) result.push(`${convertLessThanThousand(lakh)} Lakh`);
  if (thousand > 0) result.push(`${convertLessThanThousand(thousand)} Thousand`);
  if (remainder > 0) result.push(convertLessThanThousand(remainder));

  return result.join(" ");
};

// =====================================================
// INDIAN CURRENCY FORMAT (e.g. 1234567.5 -> "12,34,567.50")
// =====================================================

export const formatCurrencyIndian = (num) => {
  if (num == null || Number.isNaN(Number(num))) return "0.00";
  const str = Number(num).toFixed(2);
  const [integerPart, fractionPart] = str.split(".");
  const lastThree = integerPart.length > 3 ? integerPart.slice(-3) : integerPart;
  const otherNumbers = integerPart.slice(0, integerPart.length - 3);
  const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const finalInteger = otherNumbers ? `${formattedOther},${lastThree}` : lastThree;
  return `${finalInteger}.${fractionPart}`;
};

// =====================================================
// SHARED PAYSLIP PDF TEMPLATE (no company logo)
// =====================================================
//
// employee: {
//   name, id, department, designation, branchOfficeName,
//   bankACNumber, bankName, joiningDate, panCard, uanNumber,
//   pfACNumber, esiRegistrationNumber, pran
// }
// periodLabel: fully-formed text describing the pay period,
//   e.g. "for the month of April 2024" or "for Apr 2023 to Mar 2024"
// earnings / deductions: arrays of { label, value } — only pass the
//   line items you want printed; this function does not filter them.
// netPayable: final take-home number (falls back to earnings - deductions if omitted)
// filename: the .pdf filename to save as

export const generatePayslipPDF = ({
  employee,
  periodLabel,
  earnings,
  deductions,
  netPayable,
  filename,
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // 1. Header — plain centered company block, no logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Talent Corner HR Services Pvt. Ltd.", pageWidth / 2, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("708/709, Bhaveshwar Arcade NX, Opp Shreyas Cinema, LBS Marg", pageWidth / 2, y + 11, { align: "center" });
  doc.text("Ghatkopar(W), Mumbai-400086", pageWidth / 2, y + 16, { align: "center" });
  doc.text("GSTIN : 27AACCT6635P1ZP", pageWidth / 2, y + 21, { align: "center" });
  doc.text("UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)", pageWidth / 2, y + 26, { align: "center" });
  doc.text("E-Mail : accounts@talentcorner.in", pageWidth / 2, y + 31, { align: "center" });
  y += 40;

  // 2. Title + period
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Pay Slip", pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(periodLabel, pageWidth / 2, y, { align: "center" });
  y += 10;

  // 3. Employee name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text((employee.name || "N/A").toUpperCase(), pageWidth / 2, y, { align: "center" });
  y += 12;

  // 4. Details section (wrapping-safe two-column layout)
  const col1X = margin;
  const col2X = pageWidth / 2 + 10;
  const detailLineHeight = 5;
  doc.setFontSize(10);

  const detailsLeft = [
    { label: "Employee Number", value: employee.id || "N/A" },
    { label: "Function", value: employee.department || "N/A" },
    { label: "Designation", value: employee.designation || "N/A" },
    { label: "Location", value: employee.branchOfficeName || "N/A" },
    {
      label: "Bank Details",
      value: `${employee.bankACNumber || ""}, ${employee.bankName || ""}`.replace(/^, /, "") || "N/A",
    },
    {
      label: "Date of joining",
      value: employee.joiningDate
        ? new Date(employee.joiningDate)
            .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
            .replace(/ /g, "-")
        : "N/A",
    },
  ];
  const detailsRight = [
    { label: "Tax Regime", value: "Regular Tax Regime" },
    { label: "Income Tax Number (PAN)", value: employee.panCard || "N/A" },
    { label: "Universal Account Number (UAN)", value: employee.uanNumber || "N/A" },
    { label: "PF account number", value: employee.pfACNumber || "N/A" },
    { label: "ESI Number", value: employee.esiRegistrationNumber || "N/A" },
    { label: "PR Account Number (PRAN)", value: employee.pran || "N/A" },
  ];

  const leftLabelMaxWidth = 45;
  const rightLabelMaxWidth = 45;
  const leftValueX = col1X + leftLabelMaxWidth;
  const rightValueX = col2X + rightLabelMaxWidth;
  const leftValueMaxWidth = col2X - leftValueX - 2;
  const rightValueMaxWidth = pageWidth - rightValueX - margin;

  for (let i = 0; i < Math.max(detailsLeft.length, detailsRight.length); i++) {
    const currentY = y;
    let leftLabelLines = [""],
      leftValueLines = [""],
      rightLabelLines = [""],
      rightValueLines = [""];

    if (detailsLeft[i]) {
      leftLabelLines = doc.splitTextToSize(detailsLeft[i].label, leftLabelMaxWidth);
      leftValueLines = doc.splitTextToSize(String(detailsLeft[i].value), leftValueMaxWidth);
    }
    if (detailsRight[i]) {
      rightLabelLines = doc.splitTextToSize(detailsRight[i].label, rightLabelMaxWidth);
      rightValueLines = doc.splitTextToSize(String(detailsRight[i].value), rightValueMaxWidth);
    }

    const maxLines = Math.max(leftLabelLines.length, leftValueLines.length, rightLabelLines.length, rightValueLines.length);

    if (detailsLeft[i]) {
      doc.setFont("helvetica", "normal");
      doc.text(leftLabelLines, col1X, currentY);
      doc.text(":", leftValueX - 5, currentY);
      doc.setFont("helvetica", "bold");
      doc.text(leftValueLines, leftValueX, currentY);
    }
    if (detailsRight[i]) {
      doc.setFont("helvetica", "normal");
      doc.text(rightLabelLines, col2X, currentY);
      doc.text(":", rightValueX - 5, currentY);
      doc.setFont("helvetica", "bold");
      doc.text(rightValueLines, rightValueX, currentY);
    }

    y += maxLines * detailLineHeight + 1;
  }
  y += 5;

  // 5. Earnings & deductions table
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const earningX = margin + 2,
    earningAmtX = margin + 90,
    deductionX = margin + 100,
    deductionAmtX = pageWidth - margin - 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Earnings", earningX, y);
  doc.text("Amount", earningAmtX, y, { align: "right" });
  doc.text("Deductions", deductionX, y);
  doc.text("Amount", deductionAmtX, y, { align: "right" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const tableLineHeight = 6;
  const numRows = Math.max(earnings.length, deductions.length);

  for (let i = 0; i < numRows; i++) {
    if (earnings[i]) {
      const item = earnings[i];
      const valueStr =
        item.value < 0 ? `(-) ${formatCurrencyIndian(Math.abs(item.value))}` : formatCurrencyIndian(item.value);
      doc.text(item.label, earningX, y);
      doc.text(valueStr, earningAmtX, y, { align: "right" });
    }
    if (deductions[i]) {
      const item = deductions[i];
      doc.text(item.label, deductionX, y);
      doc.text(formatCurrencyIndian(item.value), deductionAmtX, y, { align: "right" });
    }
    y += tableLineHeight;
  }

  // 6. Totals
  const totalEarnings = earnings.reduce((sum, item) => sum + (item.value || 0), 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + (item.value > 0 ? item.value : 0), 0);
  const net = netPayable != null ? netPayable : totalEarnings - totalDeductions;

  y += 2;
  doc.setLineWidth(0.4);
  doc.line(margin, y, earningAmtX, y);
  doc.line(deductionX - 2, y, deductionAmtX + 2, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total Earnings", earningX, y);
  doc.text(formatCurrencyIndian(totalEarnings), earningAmtX, y, { align: "right" });
  doc.text("Total Deductions", deductionX, y);
  doc.text(formatCurrencyIndian(totalDeductions), deductionAmtX, y, { align: "right" });
  y += 8;

  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.text("Net Amount", margin, y);
  doc.text(formatCurrencyIndian(net), deductionAmtX, y, { align: "right" });
  y += 8;

  // 7. Amount in words + signature
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const amountInWords = `Amount (in words): INR ${numberToWordsIndian(Math.round(net))} Only`;
  const textLines = doc.splitTextToSize(amountInWords, pageWidth - margin * 2);
  doc.text(textLines, margin, y);

  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.text("for Talent Corner HR Services Pvt. Ltd.", pageWidth - margin, footerY, { align: "right" });
  doc.text("Authorised Signatory", pageWidth - margin, footerY + 15, { align: "right" });

  doc.save(filename);
};