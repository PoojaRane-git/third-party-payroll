import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

import logo from "../../../assets/logo.jpeg";

import api from "../../services/api";
import EmployeeLayout from "./EmployeeLayout";

// =====================================================
// NUMBER TO WORDS - INDIAN FORMAT
// =====================================================

const numberToWordsIndian = (num) => {
  const value = Math.floor(Number(num || 0));

  if (value === 0) return "Zero";

  const units = [
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
  ];

  const teens = [
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

  const convertLessThanThousand = (n) => {
    if (n === 0) return "";

    if (n < 10) {
      return units[n];
    }

    if (n < 20) {
      return teens[n - 10];
    }

    if (n < 100) {
      return `${tens[Math.floor(n / 10)]} ${
        units[n % 10]
      }`.trim();
    }

    return `${units[Math.floor(n / 100)]} Hundred ${
      convertLessThanThousand(n % 100)
    }`.trim();
  };

  let crore = Math.floor(value / 10000000);

  let lakh = Math.floor(
    (value % 10000000) / 100000
  );

  let thousand = Math.floor(
    (value % 100000) / 1000
  );

  let remainder = value % 1000;

  const result = [];

  if (crore > 0) {
    result.push(
      `${convertLessThanThousand(crore)} Crore`
    );
  }

  if (lakh > 0) {
    result.push(
      `${convertLessThanThousand(lakh)} Lakh`
    );
  }

  if (thousand > 0) {
    result.push(
      `${convertLessThanThousand(thousand)} Thousand`
    );
  }

  if (remainder > 0) {
    result.push(
      convertLessThanThousand(remainder)
    );
  }

  return result.join(" ");
};

// =====================================================
// LOAD IMAGE
// =====================================================

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);

    img.onerror = () =>
      reject(
        new Error(
          `Unable to load image: ${src}`
        )
      );

    img.src = src;
  });
};

// =====================================================
// COMPONENT
// =====================================================

const EmployeePayslip = () => {
  // =====================================================
  // STATE
  // =====================================================

  const [payslips, setPayslips] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [downloading, setDownloading] =
    useState(null);

  const [error, setError] =
    useState("");

  // =====================================================
  // FETCH PAYSLIPS
  // =====================================================

  useEffect(() => {
    const fetchPayslips = async () => {
      try {
        setLoading(true);
        setError("");

        console.log(
          "Fetching payslips for logged-in employee..."
        );

        const response = await api.get(
          "/employee/payroll/me"
        );

        console.log(
          "Employee payslip response:",
          response.data
        );

        let data = [];

        if (
          Array.isArray(
            response.data?.payslips
          )
        ) {
          data =
            response.data.payslips;
        } else if (
          Array.isArray(
            response.data?.data
          )
        ) {
          data =
            response.data.data;
        } else if (
          Array.isArray(response.data)
        ) {
          data = response.data;
        }

        console.log(
          "Processed payslips:",
          data
        );

        setPayslips(data);
      } catch (err) {
        console.error(
          "Employee payslip error:",
          err
        );

        console.error(
          "Server response:",
          err.response?.data
        );

        setPayslips([]);

        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Unable to load payslips."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPayslips();
  }, []);

  // =====================================================
  // MONEY FORMATTER
  // =====================================================

  const money = (value) => {
    const amount = Number(
      value ?? 0
    );

    if (!Number.isFinite(amount)) {
      return "0.00";
    }

    return amount.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  };

  // =====================================================
  // DISPLAY
  // =====================================================

  const display = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "N/A";
    }

    return value;
  };

  // =====================================================
  // SALARY MONTH FORMAT
  // =====================================================

  const formatSalaryMonth = (
    value
  ) => {
    if (!value) {
      return "--";
    }

    const text = String(value);

    if (
      /^\d{4}-\d{2}$/.test(
        text
      )
    ) {
      const [year, month] =
        text.split("-");

      const date = new Date(
        Number(year),
        Number(month) - 1,
        1
      );

      return date.toLocaleDateString(
        "en-IN",
        {
          month: "long",
          year: "numeric",
        }
      );
    }

    const date =
      new Date(text);

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date.toLocaleDateString(
        "en-IN",
        {
          month: "long",
          year: "numeric",
        }
      );
    }

    return text;
  };

  // =====================================================
  // STATUS CLASS
  // =====================================================

  const getStatusClass = (
    status
  ) => {
    const value = String(
      status || ""
    )
      .toLowerCase()
      .trim();

    if (
      value === "approved" ||
      value === "locked" ||
      value === "paid"
    ) {
      return "status-badge status-approved";
    }

    if (
      value === "pending" ||
      value === "draft"
    ) {
      return "status-badge status-pending";
    }

    if (
      value === "rejected" ||
      value === "cancelled"
    ) {
      return "status-badge status-rejected";
    }

    return "status-badge";
  };

  // =====================================================
  // DOWNLOAD PAYSLIP
  // =====================================================

  const downloadPayslip =
    async (payslip) => {
      try {
        setDownloading(
          payslip.id
        );

        // =================================================
        // PDF INITIALIZATION
        // =================================================

        const doc =
          new jsPDF({
            orientation:
              "portrait",
            unit: "mm",
            format: "a4",
          });

        const pageWidth =
          doc.internal.pageSize.getWidth();

        const pageHeight =
          doc.internal.pageSize.getHeight();

        const margin = 14;

        const contentWidth =
          pageWidth -
          margin * 2;

        let y = 14;

        // =================================================
        // PDF HELPERS
        // =================================================

        const currency = (
          value
        ) => {
          const amount =
            Number(
              value ?? 0
            );

          if (
            !Number.isFinite(
              amount
            )
          ) {
            return "0.00";
          }

          return amount.toLocaleString(
            "en-IN",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          );
        };

        const line = (
          x1,
          y1,
          x2,
          y2,
          width = 0.3
        ) => {
          doc.setLineWidth(
            width
          );

          doc.line(
            x1,
            y1,
            x2,
            y2
          );
        };

        const box = (
          x,
          top,
          width,
          height
        ) => {
          doc.setLineWidth(
            0.3
          );

          doc.rect(
            x,
            top,
            width,
            height
          );
        };

        // =================================================
        // 1. COMPANY HEADER
        // =================================================

        const headerHeight = 42;

        box(
          margin,
          y,
          contentWidth,
          headerHeight
        );

        // -------------------------------------------------
        // LOGO
        // -------------------------------------------------

        try {
          const img =
            await loadImage(
              logo
            );

          const logoWidth = 32;

          const aspectRatio =
            img.width /
            img.height;

          const logoHeight =
            logoWidth /
            aspectRatio;

          doc.addImage(
            img,
            "JPEG",
            margin + 5,
            y + 5,
            logoWidth,
            logoHeight
          );
        } catch (imageError) {
          console.warn(
            "Payslip logo could not be loaded:",
            imageError
          );

          // Small fallback box
          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(
            11
          );

          doc.text(
            "TC",
            margin + 15,
            y + 20,
            {
              align:
                "center",
            }
          );
        }

        // -------------------------------------------------
        // COMPANY DETAILS
        // -------------------------------------------------

        const companyX =
          margin +
          contentWidth /
            2 +
          13;

        doc.setTextColor(
          20,
          20,
          20
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          13
        );

        doc.text(
          "Talent Corner HR Services Pvt. Ltd.",
          companyX,
          y + 8,
          {
            align:
              "center",
          }
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          8.5
        );

        doc.text(
          "708/709, Bhaveshwar Arcade NX, Opp Shreyas Cinema, LBS Marg",
          companyX,
          y + 14,
          {
            align:
              "center",
          }
        );

        doc.text(
          "Ghatkopar(W), Mumbai-400086",
          companyX,
          y + 19,
          {
            align:
              "center",
          }
        );

        doc.text(
          "GSTIN : 27AACCT6635P1ZP",
          companyX,
          y + 24,
          {
            align:
              "center",
          }
        );

        doc.text(
          "UDYAM Reg No. : UDYAM-MH-19-0067990 (Micro)",
          companyX,
          y + 29,
          {
            align:
              "center",
          }
        );

        doc.text(
          "E-Mail : accounts@talentcorner.in",
          companyX,
          y + 34,
          {
            align:
              "center",
          }
        );

        y +=
          headerHeight +
          8;

        // =================================================
        // 2. PAYSLIP TITLE
        // =================================================

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          16
        );

        doc.text(
          "PAY SLIP",
          pageWidth / 2,
          y,
          {
            align:
              "center",
          }
        );

        y += 6;

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          10
        );

        doc.text(
          `For the month of ${formatSalaryMonth(
            payslip.salary_month
          )}`,
          pageWidth / 2,
          y,
          {
            align:
              "center",
          }
        );

        y += 6;

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          12
        );

        doc.text(
          String(
            payslip.employee_name ||
              "EMPLOYEE"
          ).toUpperCase(),
          pageWidth / 2,
          y,
          {
            align:
              "center",
          }
        );

        y += 9;

        // =================================================
        // 3. EMPLOYEE INFORMATION
        // =================================================

        const infoTop =
          y;

        const infoHeaderHeight =
          8;

        const infoRowHeight =
          7;

        const infoRows = 5;

        const infoHeight =
          infoHeaderHeight +
          infoRows *
            infoRowHeight;

        box(
          margin,
          infoTop,
          contentWidth,
          infoHeight
        );

        // Header background
        doc.setFillColor(
          242,
          244,
          247
        );

        doc.rect(
          margin,
          infoTop,
          contentWidth,
          infoHeaderHeight,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          9
        );

        doc.text(
          "EMPLOYEE INFORMATION",
          margin + 4,
          infoTop + 5.5
        );

        // Vertical divider
        const infoMiddle =
          pageWidth / 2;

        line(
          infoMiddle,
          infoTop +
            infoHeaderHeight,
          infoMiddle,
          infoTop +
            infoHeight
        );

        const leftDetails =
          [
            [
              "Employee No.",
              display(
                payslip.employee_ref_id
              ),
            ],
            [
              "Function",
              display(
                payslip.department
              ),
            ],
            [
              "Designation",
              display(
                payslip.designation
              ),
            ],
            [
              "Location",
              display(
                payslip.branch_office_name
              ),
            ],
            [
              "Payslip ID",
              display(
                payslip.id
              ),
            ],
          ];

        const rightDetails =
          [
            [
              "Status",
              display(
                payslip.status
              ),
            ],
            [
              "PAN",
              display(
                payslip.pan_card
              ),
            ],
            [
              "UAN",
              display(
                payslip.uan_number
              ),
            ],
            [
              "PF Account",
              display(
                payslip.pf_ac_number
              ),
            ],
            [
              "ESI Number",
              display(
                payslip.esi_number
              ),
            ],
          ];

        doc.setFontSize(
          8.5
        );

        for (
          let i = 0;
          i < infoRows;
          i++
        ) {
          const rowY =
            infoTop +
            infoHeaderHeight +
            i *
              infoRowHeight +
            5;

          // Horizontal line
          if (
            i <
            infoRows - 1
          ) {
            line(
              margin,
              infoTop +
                infoHeaderHeight +
                (i + 1) *
                  infoRowHeight,
              margin +
                contentWidth,
              infoTop +
                infoHeaderHeight +
                (i + 1) *
                  infoRowHeight
            );
          }

          // LEFT LABEL
          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.text(
            leftDetails[i][0],
            margin + 4,
            rowY
          );

          doc.text(
            ":",
            margin + 36,
            rowY
          );

          // LEFT VALUE
          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.text(
            leftDetails[i][1],
            margin + 39,
            rowY
          );

          // RIGHT LABEL
          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.text(
            rightDetails[i][0],
            infoMiddle + 4,
            rowY
          );

          doc.text(
            ":",
            infoMiddle + 36,
            rowY
          );

          // RIGHT VALUE
          doc.setFont(
            "helvetica",
            "bold"
          );

          const rightValue =
            String(
              rightDetails[i][1]
            );

          const rightLines =
            doc.splitTextToSize(
              rightValue,
              40
            );

          doc.text(
            rightLines,
            infoMiddle + 39,
            rowY
          );
        }

        y =
          infoTop +
          infoHeight +
          8;

        // =================================================
        // 4. SALARY TABLE
        // =================================================

        const earnings = [
          [
            "Basic Salary",
            Number(
              payslip.basic_salary ||
                0
            ),
          ],
          [
            "Allowances",
            Number(
              payslip.allowances ||
                0
            ),
          ],
          [
            "Overtime",
            Number(
              payslip.overtime ||
                0
            ),
          ],
          [
            "Bonus",
            Number(
              payslip.bonus ||
                0
            ),
          ],
        ];

        const deductions = [
          [
            "Employee PF",
            Number(
              payslip.pf ||
                0
            ),
          ],
          [
            "ESIC",
            Number(
              payslip.esic ||
                0
            ),
          ],
          [
            "Tax / TDS",
            Number(
              payslip.tax ||
                0
            ),
          ],
          [
            "Professional Tax",
            Number(
              payslip.professional_tax ||
                0
            ),
          ],
          [
            "LOP Deduction",
            Number(
              payslip.lop ||
                0
            ),
          ],
        ];

        const totalEarnings =
          Number(
            payslip.gross_salary ??
              earnings.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  item[1],
                0
              )
          );

        const totalDeductions =
          Number(
            payslip.total_deductions ??
              deductions.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  item[1],
                0
              )
          );

        const netPayable =
          Number(
            payslip.net_salary ??
              totalEarnings -
                totalDeductions
          );

        const tableTop =
          y;

        const tableHeaderHeight =
          9;

        const tableRowHeight =
          7;

        const tableRows =
          Math.max(
            earnings.length,
            deductions.length
          );

        const tableTotalRowHeight =
          9;

        const tableHeight =
          tableHeaderHeight +
          tableRows *
            tableRowHeight +
          tableTotalRowHeight;

        const halfWidth =
          contentWidth / 2;

        // Outer border
        box(
          margin,
          tableTop,
          contentWidth,
          tableHeight
        );

        // Header background
        doc.setFillColor(
          242,
          244,
          247
        );

        doc.rect(
          margin,
          tableTop,
          contentWidth,
          tableHeaderHeight,
          "F"
        );

        // Middle divider
        line(
          margin +
            halfWidth,
          tableTop,
          margin +
            halfWidth,
          tableTop +
            tableHeight
        );

        // Header bottom
        line(
          margin,
          tableTop +
            tableHeaderHeight,
          margin +
            contentWidth,
          tableTop +
            tableHeaderHeight
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          9
        );

        doc.text(
          "EARNINGS",
          margin + 4,
          tableTop + 6
        );

        doc.text(
          "DEDUCTIONS",
          margin +
            halfWidth +
            4,
          tableTop + 6
        );

        // Column positions
        const earningAmountX =
          margin +
          halfWidth -
          4;

        const deductionAmountX =
          margin +
          contentWidth -
          4;

        // Table rows
        for (
          let i = 0;
          i < tableRows;
          i++
        ) {
          const rowTop =
            tableTop +
            tableHeaderHeight +
            i *
              tableRowHeight;

          const rowY =
            rowTop + 5;

          // Row separator
          line(
            margin,
            rowTop +
              tableRowHeight,
            margin +
              contentWidth,
            rowTop +
              tableRowHeight
          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.setFontSize(
            8.5
          );

          // Earnings
          if (
            earnings[i]
          ) {
            doc.text(
              earnings[i][0],
              margin + 4,
              rowY
            );

            doc.text(
              currency(
                earnings[i][1]
              ),
              earningAmountX,
              rowY,
              {
                align:
                  "right",
              }
            );
          }

          // Deductions
          if (
            deductions[i]
          ) {
            doc.text(
              deductions[i][0],
              margin +
                halfWidth +
                4,
              rowY
            );

            doc.text(
              currency(
                deductions[i][1]
              ),
              deductionAmountX,
              rowY,
              {
                align:
                  "right",
              }
            );
          }
        }

        // Total row
        const totalTop =
          tableTop +
          tableHeaderHeight +
          tableRows *
            tableRowHeight;

        doc.setFillColor(
          248,
          249,
          250
        );

        doc.rect(
          margin,
          totalTop,
          contentWidth,
          tableTotalRowHeight,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          8.5
        );

        doc.text(
          "TOTAL EARNINGS",
          margin + 4,
          totalTop + 6
        );

        doc.text(
          currency(
            totalEarnings
          ),
          earningAmountX,
          totalTop + 6,
          {
            align:
              "right",
          }
        );

        doc.text(
          "TOTAL DEDUCTIONS",
          margin +
            halfWidth +
            4,
          totalTop + 6
        );

        doc.text(
          currency(
            totalDeductions
          ),
          deductionAmountX,
          totalTop + 6,
          {
            align:
              "right",
          }
        );

        y =
          tableTop +
          tableHeight +
          8;

        // =================================================
        // 5. NET PAYABLE
        // =================================================

        const netTop =
          y;

        const netHeight =
          22;

        box(
          margin,
          netTop,
          contentWidth,
          netHeight
        );

        doc.setFillColor(
          245,
          247,
          250
        );

        doc.rect(
          margin,
          netTop,
          contentWidth,
          netHeight,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          10
        );

        doc.text(
          "NET PAYABLE",
          margin + 5,
          netTop + 8
        );

        doc.setFontSize(
          14
        );

        doc.text(
          `₹ ${currency(
            netPayable
          )}`,
          pageWidth -
            margin -
            5,
          netTop + 9,
          {
            align:
              "right",
          }
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          7.5
        );

        doc.text(
          "Net salary payable to employee",
          margin + 5,
          netTop + 15
        );

        y =
          netTop +
          netHeight +
          7;

        // =================================================
        // 6. AMOUNT IN WORDS
        // =================================================

        const wordsTop =
          y;

        const amountWords =
          `INR ${numberToWordsIndian(
            Math.round(
              netPayable
            )
          )} Only`;

        const wordLines =
          doc.splitTextToSize(
            amountWords,
            contentWidth - 40
          );

        const wordsHeight =
          Math.max(
            16,
            wordLines.length *
              5 +
              10
          );

        box(
          margin,
          wordsTop,
          contentWidth,
          wordsHeight
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          8.5
        );

        doc.text(
          "Amount in Words:",
          margin + 4,
          wordsTop + 7
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.text(
          wordLines,
          margin + 38,
          wordsTop + 7
        );

        y =
          wordsTop +
          wordsHeight +
          7;

        // =================================================
        // 7. EMPLOYER CONTRIBUTION
        // =================================================

        const employerPF =
          Number(
            payslip.employer_pf ||
              0
          );

        const employerESIC =
          Number(
            payslip.employer_esic ||
              0
          );

        const employerTotal =
          Number(
            payslip.total_employer_contribution ??
              employerPF +
                employerESIC
          );

        const employerTop =
          y;

        const employerHeight =
          28;

        box(
          margin,
          employerTop,
          contentWidth,
          employerHeight
        );

        doc.setFillColor(
          242,
          244,
          247
        );

        doc.rect(
          margin,
          employerTop,
          contentWidth,
          8,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          8.5
        );

        doc.text(
          "EMPLOYER CONTRIBUTION",
          margin + 4,
          employerTop + 5.5
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          8
        );

        doc.text(
          "Employer PF",
          margin + 4,
          employerTop + 15
        );

        doc.text(
          `₹ ${currency(
            employerPF
          )}`,
          margin + 70,
          employerTop + 15,
          {
            align:
              "right",
          }
        );

        doc.text(
          "Employer ESIC",
          margin + 80,
          employerTop + 15
        );

        doc.text(
          `₹ ${currency(
            employerESIC
          )}`,
          pageWidth -
            margin -
            4,
          employerTop + 15,
          {
            align:
              "right",
          }
        );

        line(
          margin,
          employerTop + 18,
          margin +
            contentWidth,
          employerTop + 18
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          "Total Employer Contribution",
          margin + 4,
          employerTop + 24
        );

        doc.text(
          `₹ ${currency(
            employerTotal
          )}`,
          pageWidth -
            margin -
            4,
          employerTop + 24,
          {
            align:
              "right",
          }
        );

        y =
          employerTop +
          employerHeight +
          7;

        // =================================================
        // 8. BANK DETAILS
        // =================================================

        const bankTop =
          y;

        const bankHeight =
          25;

        box(
          margin,
          bankTop,
          contentWidth,
          bankHeight
        );

        doc.setFillColor(
          242,
          244,
          247
        );

        doc.rect(
          margin,
          bankTop,
          contentWidth,
          8,
          "F"
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(
          8.5
        );

        doc.text(
          "BANK DETAILS",
          margin + 4,
          bankTop + 5.5
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          8
        );

        doc.text(
          `Bank Name: ${display(
            payslip.bank_name
          )}`,
          margin + 4,
          bankTop + 15
        );

        doc.text(
          `Account No.: ${display(
            payslip.account_number
          )}`,
          margin + 72,
          bankTop + 15
        );

        doc.text(
          `IFSC: ${display(
            payslip.ifsc_code
          )}`,
          margin + 4,
          bankTop + 21
        );

        y =
          bankTop +
          bankHeight +
          7;

        // =================================================
        // 9. FOOTER
        // =================================================

        const footerY =
          pageHeight - 20;

        line(
          margin,
          footerY - 7,
          pageWidth -
            margin,
          footerY - 7
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(
          7
        );

        doc.text(
          "This is a computer-generated payslip and does not require a physical signature.",
          margin,
          footerY
        );

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.text(
          "For Talent Corner HR Services Pvt. Ltd.",
          pageWidth -
            margin,
          footerY - 4,
          {
            align:
              "right",
          }
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.text(
          "Authorised Signatory",
          pageWidth -
            margin,
          footerY + 4,
          {
            align:
              "right",
          }
        );

        // =================================================
        // 10. FILE NAME
        // =================================================

        const month =
          String(
            payslip.salary_month ||
              "payslip"
          ).replace(
            /[^a-zA-Z0-9-_]/g,
            "-"
          );

        const employee =
          String(
            payslip.employee_name ||
              "Employee"
          )
            .replace(
              /[^a-zA-Z0-9]/g,
              "_"
            )
            .replace(
              /_+/g,
              "_"
            );

        doc.save(
          `${employee}_Payslip_${month}.pdf`
        );
      } catch (error) {
        console.error(
          "Payslip download error:",
          error
        );

        alert(
          "Unable to download payslip."
        );
      } finally {
        setDownloading(null);
      }
    };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <EmployeeLayout>
        <div className="empty-state">
          <h3>
            Loading payslips...
          </h3>

          <p>
            Please wait while we load
            your salary records.
          </p>
        </div>
      </EmployeeLayout>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <EmployeeLayout>
      <div>

        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <div className="page-header">
          <div>
            <h1>
              Payslips
            </h1>

            <p>
              View your complete salary
              and payslip records.
            </p>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* =================================================
            NO PAYSLIPS
        ================================================= */}

        {payslips.length === 0 ? (
          <div className="empty-state">
            <h3>
              No payslips available
            </h3>

            <p>
              Your approved payroll records
              will appear here.
            </p>
          </div>
        ) : (
          <div>

            {payslips.map(
              (payslip) => (
                <div
                  key={payslip.id}
                  className="table-card"
                  style={{
                    marginBottom:
                      "25px",
                    padding:
                      "25px",
                  }}
                >

                  {/* =================================================
                      PAYSLIP HEADER
                  ================================================= */}

                  <div
                    style={{
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap:
                        "15px",
                      flexWrap:
                        "wrap",
                      marginBottom:
                        "25px",
                    }}
                  >

                    <div>
                      <h2
                        style={{
                          margin: 0,
                        }}
                      >
                        {formatSalaryMonth(
                          payslip.salary_month
                        )}
                      </h2>

                      <p>
                        Payslip ID:{" "}
                        {display(
                          payslip.id
                        )}
                      </p>
                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap:
                          "12px",
                      }}
                    >

                      <span
                        className={getStatusClass(
                          payslip.status
                        )}
                      >
                        {display(
                          payslip.status
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          downloadPayslip(
                            payslip
                          )
                        }
                        disabled={
                          downloading ===
                          payslip.id
                        }
                        style={{
                          padding:
                            "10px 16px",
                          border:
                            "none",
                          borderRadius:
                            "8px",
                          cursor:
                            downloading ===
                            payslip.id
                              ? "not-allowed"
                              : "pointer",
                          fontWeight:
                            "600",
                        }}
                      >
                        {downloading ===
                        payslip.id
                          ? "Generating..."
                          : "Download Payslip"}
                      </button>
                    </div>
                  </div>

                  {/* =================================================
                      EARNINGS
                  ================================================= */}

                  <h3>
                    Earnings
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Basic Salary
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.basic_salary
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Allowances
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.allowances
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Overtime
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.overtime
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Bonus
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.bonus
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Gross Salary
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.gross_salary
                        )}
                      </strong>
                    </div>

                  </div>

                  {/* =================================================
                      DEDUCTIONS
                  ================================================= */}

                  <h3
                    style={{
                      marginTop:
                        "25px",
                    }}
                  >
                    Deductions
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Employee PF
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.pf
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        ESIC
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.esic
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Tax / TDS
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.tax
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Professional Tax
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.professional_tax
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        LOP Deduction
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.lop
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Deductions
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.total_deductions
                        )}
                      </strong>
                    </div>

                  </div>

                  {/* =================================================
                      NET SALARY
                  ================================================= */}

                  <div
                    style={{
                      marginTop:
                        "25px",
                      padding:
                        "20px",
                      borderRadius:
                        "10px",
                      background:
                        "#f8fafc",
                    }}
                  >

                    <span>
                      Net Salary
                    </span>

                    <h2
                      style={{
                        margin:
                          "5px 0 0",
                      }}
                    >
                      ₹
                      {money(
                        payslip.net_salary
                      )}
                    </h2>

                  </div>

                  {/* =================================================
                      EMPLOYER CONTRIBUTION
                  ================================================= */}

                  <h3
                    style={{
                      marginTop:
                        "25px",
                    }}
                  >
                    Employer Contribution
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Employer PF
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.employer_pf
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Employer ESIC
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.employer_esic
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Employer Contribution
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.total_employer_contribution
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Employer Cost
                      </span>

                      <strong>
                        ₹
                        {money(
                          payslip.total_employer_cost
                        )}
                      </strong>
                    </div>

                  </div>

                  {/* =================================================
                      BANK DETAILS
                  ================================================= */}

                  <h3
                    style={{
                      marginTop:
                        "25px",
                    }}
                  >
                    Bank Details
                  </h3>

                  <div className="profile-grid">

                    <div>
                      <span>
                        Bank Name
                      </span>

                      <strong>
                        {display(
                          payslip.bank_name
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Account Number
                      </span>

                      <strong>
                        {display(
                          payslip.account_number
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        IFSC Code
                      </span>

                      <strong>
                        {display(
                          payslip.ifsc_code
                        )}
                      </strong>
                    </div>

                  </div>

                </div>
              )
            )}

          </div>
        )}

      </div>
    </EmployeeLayout>
  );
};

export default EmployeePayslip;

