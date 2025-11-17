// ===================================
// FILE 2: report-generation.js
// Excel file processing, report generation, and PDF exports
// ===================================

import { db, questions, showLoading, hideLoading, showMessage } from './firebase-config.js';

// Global variables
export let excelRows = [];
export let fileType = null;
export let detectedTrainers = [];
export let studentsWithVeryPoorRatings = {};

// Constants
const NORMALIZE = (s) => ("" + (s || "")).toString().trim().toLowerCase();

const ratingMap = {
  excellent: 5,
  "very good": 4,
  verygood: 4,
  good: 3,
  average: 2,
  poor: 1,
  "very poor": 1,
  verypoor: 1,
};

const ratingLabels = ["Excellent", "Very Good", "Good", "Average", "Very Poor"];

// ===================================
// FILE HANDLING
// ===================================

document.getElementById("fileInput")?.addEventListener("change", handleFile, false);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      excelRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (excelRows.length === 0) {
        showMessage("error", "The Excel file appears to be empty or has no data rows.");
        return;
      }

      const headers = Object.keys(excelRows[0]);
      const analysis = analyzeFileStructure(headers);

      fileType = analysis.type;
      detectedTrainers = analysis.trainers;

      extractQuestionsFromHeaders(headers, analysis);
      displayFileAnalysis(analysis, headers.length, excelRows.length);
    } catch (error) {
      showMessage("error", "Error reading Excel file: " + error.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function analyzeFileStructure(headers) {
  const validHeaders = headers.slice(5, headers.length - 3);
  const pattern = /\.+([^.\d]+)$/;
  const trainerGroups = {};
  const allTrainers = new Set();

  validHeaders.forEach((header) => {
    const match = header.match(pattern);
    if (match) {
      const trainer = match[1].trim();
      allTrainers.add(trainer);
      const question = header.replace(pattern, "").trim();
      if (!trainerGroups[question]) trainerGroups[question] = [];
      trainerGroups[question].push(trainer);
    }
  });

  const orderedGroups = {};
  validHeaders.forEach((header) => {
    const base = header.replace(pattern, "").trim();
    if (trainerGroups[base] && !orderedGroups[base]) {
      orderedGroups[base] = trainerGroups[base];
    }
  });

  console.log("Ordered Groups:", orderedGroups);
  
  if (Object.keys(orderedGroups).length > 0) {
    return {
      type: "multiple_trainers",
      trainers: Array.from(allTrainers),
      groups: orderedGroups,
      questionCount: Object.keys(orderedGroups).length
    };
  }

  const singleTrainerQuestion = headers[5]?.trim();
  const restFields = validHeaders.slice(1);

  return {
    type: "single_trainer",
    mainQuestion: singleTrainerQuestion,
    additionalFields: restFields,
    questionCount: headers.slice(7, headers.length - 4).length
  };
}

function extractQuestionsFromHeaders(headers, analysis) {
  questions.length = 0;

  if (analysis.type === "multiple_trainers") {
    const validHeaders = headers.slice(5, headers.length - 3);
    const pattern = /\.+([^.\d]+)$/;
    const seenQuestions = new Set();

    validHeaders.forEach((header) => {
      const baseQuestion = header.replace(pattern, "").trim();
      if (baseQuestion && !seenQuestions.has(baseQuestion)) {
        seenQuestions.add(baseQuestion);
        questions.push(baseQuestion);
      }
    });
  } else {
    const ratingHeaders = headers.slice(7, headers.length - 4);
    questions.push(...ratingHeaders.map(h => h.trim()).filter(q => q));
  }

  console.log("Extracted Questions from Excel:", questions);
  window.renderQuestionList?.();
}

function displayFileAnalysis(analysis, columnCount, rowCount) {
  const fileInfoDiv = document.getElementById("fileInfoDisplay");
  const analysisDiv = document.getElementById("fileAnalysis");
  const type1Section = document.getElementById("type1Section");
  const type2Section = document.getElementById("type2Section");

  type1Section?.classList.add("hidden");
  type2Section?.classList.add("hidden");

  let infoHTML = `
    <h3>File Analysis Complete</h3>
    <p><strong>No of Trainees:</strong> ${rowCount}</p>
    <p><strong>No of Questions:</strong> ${questions.length}</p>
    <p><strong>File Type:</strong> ${
      analysis.type === "multiple_trainers" ? "Multiple Trainers" : "Single Trainer"
    }</p>
  `;

  if (analysis.type === "multiple_trainers") {
    infoHTML += `<p><strong>Trainers:</strong> ${analysis.trainers.join(", ")}</p>`;
    type1Section?.classList.remove("hidden");
  } else {
    infoHTML += `<p><strong>Note:</strong> Please specify trainer name below.</p>`;
    type2Section?.classList.remove("hidden");
  }

  if (fileInfoDiv) fileInfoDiv.innerHTML = infoHTML;
  analysisDiv?.classList.remove("hidden");

  showMessage("success", `Excel file loaded successfully! ${questions.length} questions detected.`);
}

// ===================================
// STUDENT DATA HELPERS
// ===================================

function getStudentsWithVeryPoorRating(trainerName, columns) {
  const emailKey = findEmailColumn();
  const nameKey = findNameColumn();
  const studentsWithVeryPoor = [];

  excelRows.forEach((row, index) => {
    let hasVeryPoorRating = false;

    columns.forEach((column) => {
      const rating = row[column];
      if (rating && NORMALIZE(rating).includes("poor")) {
        hasVeryPoorRating = true;
      }
    });

    if (hasVeryPoorRating) {
      const email = emailKey ? row[emailKey] : "";
      const name = nameKey ? row[nameKey] : `Student ${index + 1}`;

      if (email && email.trim()) {
        studentsWithVeryPoor.push({
          name: name || "Unknown",
          email: email.trim(),
        });
      }
    }
  });

  return studentsWithVeryPoor;
}

function findEmailColumn() {
  const headers = Object.keys(excelRows[0] || {});
  return headers.find(
    (header) =>
      header.toLowerCase().includes("email") ||
      header.toLowerCase().includes("mail")
  );
}

function findNameColumn() {
  const headers = Object.keys(excelRows[0] || {});
  return headers.find(
    (header) =>
      header.toLowerCase().includes("name") &&
      !header.toLowerCase().includes("trainer")
  );
}

// ===================================
// EMAIL FUNCTIONS
// ===================================

export function openOutlookWebWithEmails(trainerName) {
  const students = studentsWithVeryPoorRatings[trainerName] || [];

  if (students.length === 0) {
    alert('No students with "Very Poor" ratings found for this trainer.');
    return;
  }

  const emails = students.map((student) => student.email).join(";");
  const subject = encodeURIComponent(`Follow-up: Training Feedback - ${trainerName}`);
  const body = encodeURIComponent(
    `Dear Team,\n\nThis is a follow-up regarding the recent training session conducted by ${trainerName}. We would like to discuss your feedback to help us improve our training programs.\n\nBest regards,\nJordan S Ben,\nLearing and development`
  );

  const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${emails}&subject=${subject}&body=${body}`;
  window.open(outlookWebUrl, "_blank");
}

export function copyEmailsToClipboard(trainerName) {
  const students = studentsWithVeryPoorRatings[trainerName] || [];

  if (students.length === 0) {
    alert('No students with "Very Poor" ratings found for this trainer.');
    return;
  }

  const emailList = students
    .map((student) => `${student.name} <${student.email}>`)
    .join("\n");

  navigator.clipboard
    .writeText(emailList)
    .then(() => alert("Email list copied to clipboard!"))
    .catch((err) => {
      console.error("Failed to copy emails: ", err);
      const textArea = document.createElement("textarea");
      textArea.value = emailList;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Email list copied to clipboard!");
    });
}

// ===================================
// REPORT GENERATION
// ===================================

export function generateReports() {
  if (!excelRows.length || !fileType) {
    showMessage("error", "Please upload an Excel file first.");
    return;
  }

  studentsWithVeryPoorRatings = {};

  if (fileType === "single_trainer") {
    const trainerName = document.getElementById("trainerNameSelect")?.value;
    if (!trainerName) {
      showMessage("error", "Please enter a trainer name for single trainer feedback.");
      return;
    }
    generateSingleTrainerReport(trainerName);
  } else {
    generateMultipleTrainerReports();
  }
}

async function generateSingleTrainerReport(trainerName) {
  showLoading("Generating Report...");

  const existingFilter = document.getElementById("trainerFilterSection");
  if (existingFilter) existingFilter.remove();
  const bulkActions = document.querySelector(".bulk-actions");
  if (bulkActions) bulkActions.style.display = "none";

  const headers = Object.keys(excelRows[0]);
  const ratingColumns = headers.slice(7, headers.length - 4);

  const studentsWithVeryPoor = getStudentsWithVeryPoorRating(trainerName, ratingColumns);
  studentsWithVeryPoorRatings[trainerName] = studentsWithVeryPoor;

  const commentWellKey = headers.find((k) => k.toLowerCase().includes("what went"));
  const commentImproveKey = headers.find(
    (k) => k.toLowerCase().includes("what needs") || k.toLowerCase().includes("what need")
  );

  const commentsWell = commentWellKey
    ? excelRows.map((r) => r[commentWellKey]).filter((c) => c && c.toString().trim())
    : [];

  const commentsImprove = commentImproveKey
    ? excelRows.map((r) => r[commentImproveKey]).filter((c) => c && c.toString().trim())
    : [];

  const output = document.getElementById("output");
  if (output) output.innerHTML = "";

  const API_KEY = "AIzaSyAIjhn5kPPAYRjPrhZy2f8moH6ozfUaR2o";
  const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  async function summarizeWithGemini(label, comments) {
    if (!comments.length) return [`No ${label} comments available.`];

    const feedbackText = comments.join("\n");
    const prompt = `Summarize the following trainee feedback about "${label}" into 3-4 clear bullet points. Return only bullet points:\n\n${feedbackText}`;

    try {
      const response = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("Gemini error:", result);
        return [`Error summarizing ${label}.`];
      }

      let summary = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      summary = summary.replace(/\*/g, "").split("\n").filter((l) => l.trim() !== "");
      return summary;
    } catch (err) {
      console.error("Gemini fetch failed:", err);
      return [`Error fetching summary for ${label}.`];
    }
  }

  Promise.all([
    summarizeWithGemini("What went well", commentsWell),
    summarizeWithGemini("What needs improvement", commentsImprove),
  ])
    .then(([summaryWell, summaryImprove]) => {
      generateReport(trainerName, ratingColumns, summaryWell, summaryImprove);
    })
    .finally(() => {
      hideLoading();
    });

  addSaveButtonToReportPage();
}

async function generateMultipleTrainerReports() {
  showLoading("Generating Report...");

  const headers = Object.keys(excelRows[0]);
  const validHeaders = headers.slice(5, headers.length - 3);

  const pattern = /\.+([^.\d]+)$/;
  const trainerGroups = {};
  const allTrainers = new Set();

  validHeaders.forEach((h) => {
    const match = h.match(pattern);
    if (match) {
      const trainer = match[1].trim();
      allTrainers.add(trainer);
      const question = h.replace(pattern, "").trim();
      if (!trainerGroups[question]) trainerGroups[question] = [];
      trainerGroups[question].push({ trainer, column: h });
    }
  });

  const commentWellKey = headers.find((k) => k.toLowerCase().includes("what went"));
  const commentImproveKey = headers.find(
    (k) => k.toLowerCase().includes("what needs") || k.toLowerCase().includes("what need")
  );

  const commentsWell = commentWellKey
    ? excelRows.map((r) => r[commentWellKey]).filter((c) => c && c.toString().trim())
    : [];

  const commentsImprove = commentImproveKey
    ? excelRows.map((r) => r[commentImproveKey]).filter((c) => c && c.toString().trim())
    : [];

  const output = document.getElementById("output");
  if (output) output.innerHTML = "";

  const API_KEY = "AIzaSyAIjhn5kPPAYRjPrhZy2f8moH6ozfUaR2o";
  const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  async function summarizeWithGemini(label, comments) {
    if (!comments.length) return [`No ${label} comments available.`];

    const feedbackText = comments.join("\n");
    const prompt = `Summarize the following trainee feedback about "${label}" into 3-4 clear bullet points. Return only bullet points:\n\n${feedbackText}`;

    try {
      const response = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error("Gemini error:", result);
        return [`Error summarizing ${label}.`];
      }

      let summary = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      summary = summary.replace(/\*/g, "").split("\n").filter((l) => l.trim() !== "");
      return summary;
    } catch (err) {
      console.error("Gemini fetch failed:", err);
      return [`Error fetching summary for ${label}.`];
    }
  }

  const [summaryWell, summaryImprove] = await Promise.all([
    summarizeWithGemini("What went well", commentsWell),
    summarizeWithGemini("What needs improvement", commentsImprove),
  ]).finally(() => {
    hideLoading();
  });

  const trainerDataMap = {};
  allTrainers.forEach((trainer) => {
    trainerDataMap[trainer] = [];
    Object.entries(trainerGroups).forEach(([question, arr]) => {
      const match = arr.find((a) => a.trainer === trainer);
      if (match) {
        trainerDataMap[trainer].push({ question, column: match.column });
      }
    });
  });

  Object.entries(trainerDataMap).forEach(([trainer, items]) => {
    const cols = items.map((i) => i.column);
    const studentsWithVeryPoor = getStudentsWithVeryPoorRating(trainer, cols);
    studentsWithVeryPoorRatings[trainer] = studentsWithVeryPoor;
    generateReport(trainer, cols, summaryWell, summaryImprove);
  });

  createTrainerFilterDropdown([...allTrainers]);

  document.getElementById("dashboardPage")?.classList.add("hidden");
  document.getElementById("reportPage")?.classList.remove("hidden");
  addSaveButtonToReportPage();
}

function generateReport(trainerName, columns, commentsWell, commentsImprove) {
  const ratings = {};
  columns.forEach(
    (c, i) =>
      (ratings[i] = {
        Excellent: 0,
        "Very Good": 0,
        Good: 0,
        Average: 0,
        "Very Poor": 0,
      })
  );

  let totalScore = 0,
    scoreCount = 0;
  excelRows.forEach((r) => {
    columns.forEach((c, i) => {
      const val = r[c];
      if (!val) return;

      const norm = NORMALIZE(val);
      let label = null;
      if (norm.includes("excellent")) label = "Excellent";
      else if (norm.includes("very good")) label = "Very Good";
      else if (norm === "good") label = "Good";
      else if (norm === "average") label = "Average";
      else if (norm.includes("poor")) label = "Very Poor";
      if (label) ratings[i][label]++;

      if (ratingMap[norm] !== undefined) {
        totalScore += ratingMap[norm];
        scoreCount++;
      }
    });
  });

  const overall = scoreCount ? (totalScore / scoreCount).toFixed(2) : "N/A";
  const studentsWithVeryPoor = studentsWithVeryPoorRatings[trainerName] || [];

  const output = document.getElementById("output");
  const div = document.createElement("div");
  div.className = "report";

  div.innerHTML = `
  <div class="report-content">
    <h2>ILP - Tech Fundamentals Feedback — ${trainerName}</h2>
    <div class="meta">
      <div><strong>Batch Name:</strong> ILP 2024-25 Batch</div>
      <div><strong>Total Trainee Count:</strong> ${excelRows.length}</div>
      <div><strong>Trainer Name:</strong> ${trainerName}</div>
      <div><strong>Overall Program Rating (out of 5):</strong> ${overall}</div>
      ${
        studentsWithVeryPoor.length > 0
          ? `<div><strong>Students with "Very Poor" ratings:</strong> ${studentsWithVeryPoor.length}</div>`
          : ""
      }
    </div>
    <table>
      <tr>
        <th>Category</th>
        ${ratingLabels.map((l) => `<th>${l}</th>`).join("")}
        <th>Total</th>
      </tr>
      ${columns
        .map(
          (c, i) => `
        <tr>
          <td style="text-align:left">${questions[i] || "Category " + (i + 1)}</td>
          <td>${ratings[i]["Excellent"]}</td>
          <td>${ratings[i]["Very Good"]}</td>
          <td>${ratings[i]["Good"]}</td>
          <td>${ratings[i]["Average"]}</td>
          <td>${ratings[i]["Very Poor"]}</td>
          <td>${excelRows.length}</td>
        </tr>
      `
        )
        .join("")}
    </table>
    ${
      commentsWell.length > 0
        ? `
    <div class="section">
      <h3>What went well / things you most liked</h3>
      <ul>${commentsWell.map((c) => `<li>${c}</li>`).join("")}</ul>
    </div>
    `
        : ""
    }
    ${
      commentsImprove.length > 0
        ? `
    <div class="section">
      <h3>What needs improvement</h3>
      <ul>${commentsImprove.map((c) => `<li>${c}</li>`).join("")}</ul>
    </div>
    `
        : ""
    }
    ${
      studentsWithVeryPoor.length > 0
        ? `
    <div class="section">
      <h3>Students with "Very Poor" Ratings</h3>
      <p>The following students gave "Very Poor" ratings:</p>
      <ul>
        ${studentsWithVeryPoor
          .map((student) => `<li>${student.name} (${student.email})</li>`)
          .join("")}
      </ul>
    </div>
    `
        : ""
    }
  </div>
  <div class="report-actions">
    <button onclick="downloadPDF(this)"><i class="fa-solid fa-arrow-down"></i> Download PDF</button>
    ${
      studentsWithVeryPoor.length > 0
        ? `
      <button onclick="openOutlookWebWithEmails('${trainerName}')" class="email-btn">
        <i class="fa-solid fa-envelope"></i> Open Outlook with Emails
      </button>
      <button onclick="copyEmailsToClipboard('${trainerName}')" class="copy-btn">
        <i class="fa-solid fa-copy"></i> Copy Emails
      </button>
    `
        : ""
    }
  </div>
`;

  if (output) output.appendChild(div);

  if (fileType === "single_trainer") {
    document.getElementById("dashboardPage")?.classList.add("hidden");
    document.getElementById("reportPage")?.classList.remove("hidden");
  }
}

// ===================================
// UI HELPERS
// ===================================

function createTrainerFilterDropdown(trainerNames) {
  const reportPage = document.getElementById("reportPage");
  if (!reportPage) return;

  const existingFilter = document.getElementById("trainerFilterSection");
  if (existingFilter) existingFilter.remove();

  const filterSection = document.createElement("div");
  filterSection.id = "trainerFilterSection";
  filterSection.className = "trainer-filter-section";
  filterSection.innerHTML = `
    <div class="filter-container">
      <label for="trainerFilter">
        <i class="fa-solid fa-filter"></i> Filter by Trainer:
      </label>
      <select id="trainerFilter" onchange="filterReportsByTrainer()">
        <option value="all">Show All Trainers</option>
        ${trainerNames.map((name) => `<option value="${name}">${name}</option>`).join("")}
      </select>
    </div>
  `;

  const backButton = reportPage.querySelector('button[onclick="goBack()"]');
  if (backButton) backButton.after(filterSection);
}

export function filterReportsByTrainer() {
  const selectedTrainer = document.getElementById("trainerFilter")?.value;
  const allReports = document.querySelectorAll(".report");

  allReports.forEach((report) => {
    const reportTitle = report.querySelector("h2")?.textContent;
    if (!reportTitle) return;
    
    const trainerName = reportTitle.replace("ILP - Tech Fundamentals Feedback — ", "").trim();

    if (selectedTrainer === "all" || trainerName === selectedTrainer) {
      report.style.display = "block";
    } else {
      report.style.display = "none";
    }
  });

  updateBulkActionsVisibility();
}

export function updateBulkActionsVisibility() {
  const selectedTrainer = document.getElementById("trainerFilter")?.value;
  const bulkActions = document.querySelector(".bulk-actions");

  if (bulkActions) {
    bulkActions.style.display = selectedTrainer === "all" ? "block" : "none";
  }
}

export function goBack() {
  localStorage.removeItem("viewReportId");
  document.getElementById("reportPage")?.classList.add("hidden");
  document.getElementById("dashboardPage")?.classList.remove("hidden");
}

// ===================================
// PDF GENERATION
// ===================================

export async function downloadPDF(button) {
  const reportDiv = button.closest(".report")?.querySelector(".report-content");
  if (!reportDiv) return;
  
  const { jsPDF } = window.jspdf;

  const poorSection = Array.from(reportDiv.querySelectorAll(".section"))
    .find(sec => sec.querySelector("h3")?.textContent.includes("Very Poor"));

  if (poorSection) poorSection.style.display = "none";

  const canvas = await html2canvas(reportDiv, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");

  if (poorSection) poorSection.style.display = "block";

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let imgWidth = pageWidth - 20;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;
  if (imgHeight > pageHeight - 20) {
    imgHeight = pageHeight - 20;
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }

  pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

  const trainerName =
    reportDiv.querySelector("h2")?.textContent
      .replace("ILP - Tech Fundamentals Feedback — ", "").trim() || "TrainerReport";

  pdf.save(`${trainerName}_Feedback_Report.pdf`);
}

export async function downloadAllReports() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const reports = document.querySelectorAll(".report .report-content");

  if (!reports.length) {
    alert("No reports available to download.");
    return;
  }

  for (let i = 0; i < reports.length; i++) {
    const reportDiv = reports[i];

    const poorSection = Array.from(reportDiv.querySelectorAll(".section"))
      .find(sec => sec.querySelector("h3")?.textContent.includes("Very Poor"));

    if (poorSection) poorSection.style.display = "none";

    const canvas = await html2canvas(reportDiv, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    if (poorSection) poorSection.style.display = "block";

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    let imgWidth = pageWidth - 20;
    let imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight > pageHeight - 20) {
      imgHeight = pageHeight - 20;
      imgWidth = (canvas.width * imgHeight) / canvas.height;
    }

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
  }

  pdf.save("All_Trainers_Feedback_Reports.pdf");
}

// ===================================
// REPORT DATA PREPARATION
// ===================================

export function prepareReportData() {
  const reports = [];
  const reportDivs = document.querySelectorAll(".report");
  
  reportDivs.forEach(reportDiv => {
    const reportContent = reportDiv.querySelector(".report-content");
    if (!reportContent) return;
    
    const trainerName = reportContent.querySelector("h2")?.textContent
      .replace("ILP - Tech Fundamentals Feedback — ", "").trim();
    
    const metaDiv = reportContent.querySelector(".meta");
    const metaDivs = metaDiv?.querySelectorAll("div") || [];
    
    let batchName = "";
    let traineeCount = 0;
    let overallRating = "";
    
    metaDivs.forEach(div => {
      const text = div.textContent;
      if (text.includes("Batch Name:")) {
        batchName = text.replace("Batch Name:", "").trim();
      } else if (text.includes("Total Trainee Count:")) {
        traineeCount = parseInt(text.replace("Total Trainee Count:", "").trim());
      } else if (text.includes("Overall Program Rating")) {
        overallRating = text.split(":")[1].trim();
      }
    });
    
    const table = reportContent.querySelector("table");
    const tableData = [];
    const rows = table?.querySelectorAll("tr") || [];
    
    rows.forEach((row, index) => {
      if (index === 0) return;
      const cells = row.querySelectorAll("td");
      if (cells.length > 0) {
        tableData.push({
          category: cells[0].textContent.trim(),
          excellent: parseInt(cells[1].textContent),
          veryGood: parseInt(cells[2].textContent),
          good: parseInt(cells[3].textContent),
          average: parseInt(cells[4].textContent),
          veryPoor: parseInt(cells[5].textContent),
          total: parseInt(cells[6].textContent)
        });
      }
    });
    
    const sections = reportContent.querySelectorAll(".section");
    let commentsWell = [];
    let commentsImprove = [];
    let studentsWithPoorRatings = [];
    
    sections.forEach(section => {
      const heading = section.querySelector("h3")?.textContent;
      const items = section.querySelectorAll("li");
      
      if (heading?.includes("What went well")) {
        commentsWell = Array.from(items).map(li => li.textContent);
      } else if (heading?.includes("What needs improvement")) {
        commentsImprove = Array.from(items).map(li => li.textContent);
      } else if (heading?.includes("Very Poor")) {
        studentsWithPoorRatings = Array.from(items).map(li => li.textContent);
      }
    });
    
    reports.push({
      trainerName,
      batchName,
      traineeCount,
      overallRating,
      tableData,
      commentsWell,
      commentsImprove,
      studentsWithPoorRatings
    });
  });
  
  return reports;
}

function addSaveButtonToReportPage() {
  const reportPage = document.getElementById("reportPage");
  if (!reportPage) return;
  
  const existingSaveBtn = document.getElementById("saveReportBtn");
  
  if (!existingSaveBtn) {
    const backButton = reportPage.querySelector('button[onclick="goBack()"]');
    if (backButton) {
      const saveButton = document.createElement("button");
      saveButton.id = "saveReportBtn";
      saveButton.onclick = window.openSaveReportModal;
      saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Report';
      saveButton.style.marginLeft = "10px";
      backButton.after(saveButton);
    }
  }
}

// ===================================
// MAKE FUNCTIONS GLOBALLY ACCESSIBLE
// ===================================

window.generateReports = generateReports;
window.goBack = goBack;
window.downloadPDF = downloadPDF;
window.openOutlookWebWithEmails = openOutlookWebWithEmails;
window.copyEmailsToClipboard = copyEmailsToClipboard;
window.downloadAllReports = downloadAllReports;
window.filterReportsByTrainer = filterReportsByTrainer;
window.createTrainerFilterDropdown = createTrainerFilterDropdown;
window.updateBulkActionsVisibility = updateBulkActionsVisibility;
window.prepareReportData = prepareReportData;
window.addSaveButtonToReportPage = addSaveButtonToReportPage;
window.excelRows = excelRows;
window.fileType = fileType;