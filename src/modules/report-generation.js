// ===================================
// FILE 2: report-generation.js
// Excel file processing, report generation, and PDF exports
// ===================================

import {
  db,
  questions,
  showLoading,
  hideLoading,
  showMessage,
} from "./firebase-config.js";
import { envConfig } from "./env-config.js";

// Global variables
export let excelRows = [];
export let fileType = null;
export let detectedTrainers = [];
export let studentsWithVeryPoorRatings = {};
export let trainingTopic = "Tech Fundamentals"; // Default topic, can be changed by user

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

document
  .getElementById("fileInput")
  ?.addEventListener("change", handleFile, false);

// small helper to create safe element ids
function safeId(s) {
  return (s || "").replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
}

// store chart instances so we can destroy when rerendering
window._feedbackCharts = window._feedbackCharts || {};

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
        showMessage(
          "error",
          "The Excel file appears to be empty or has no data rows."
        );
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
  // First, try to detect multiple trainers pattern (headers with ".." followed by trainer name)
  const multiTrainerPattern = /\.\.([^.\d]+)$/;
  const trainerGroups = {};
  const allTrainers = new Set();

  // Check if this is a multiple trainer file
  const hasMultipleTrainers = headers.some((h) => multiTrainerPattern.test(h));

  if (hasMultipleTrainers) {
    // Skip first 5 columns (Id, Start time, Completion time, Email, Name)
    const validHeaders = headers.slice(5);

    validHeaders.forEach((header) => {
      const match = header.match(multiTrainerPattern);
      if (match) {
        const trainer = match[1].trim();
        allTrainers.add(trainer);
        // Extract question by removing the trainer suffix
        const question = header.replace(multiTrainerPattern, "").trim();
        if (!trainerGroups[question]) trainerGroups[question] = [];
        trainerGroups[question].push(trainer);
      }
    });

    // Preserve order of questions as they appear
    const orderedGroups = {};
    validHeaders.forEach((header) => {
      const base = header.replace(multiTrainerPattern, "").trim();
      if (trainerGroups[base] && !orderedGroups[base]) {
        orderedGroups[base] = trainerGroups[base];
      }
    });

    console.log("Multiple Trainers Detected:", Array.from(allTrainers));
    console.log("Question Groups:", orderedGroups);

    return {
      type: "multiple_trainers",
      trainers: Array.from(allTrainers),
      groups: orderedGroups,
      questionCount: Object.keys(orderedGroups).length,
    };
  }

  // Single trainer detection
  // Dynamically identify rating columns by excluding metadata and comment columns
  const excludedKeywords = [
    "id",
    "start time",
    "completion time",
    "email",
    "name",
    "what went well",
    "what needs improvement",
    "what less liked",
    "arrangements",
    "location",
    "seating",
    "projector",
    "overall quality",
  ];

  const ratingHeaders = headers.filter((header, index) => {
    const normalized = header.toLowerCase();
    // Skip first 5 columns (metadata)
    if (index < 5) return false;
    // Skip if contains excluded keywords
    return !excludedKeywords.some((keyword) => normalized.includes(keyword));
  });

  console.log("Single Trainer - Rating Headers:", ratingHeaders);

  return {
    type: "single_trainer",
    questionCount: ratingHeaders.length,
    ratingHeaders: ratingHeaders,
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
    const ratingHeaders = headers.slice(8, headers.length - 3);
    questions.push(...ratingHeaders.map((h) => h.trim()).filter((q) => q));
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
      analysis.type === "multiple_trainers"
        ? "Multiple Trainers"
        : "Single Trainer"
    }</p>
  `;

  if (analysis.type === "multiple_trainers") {
    infoHTML += `<p><strong>Trainers:</strong> ${analysis.trainers.join(
      ", "
    )}</p>`;
    type1Section?.classList.remove("hidden");
  } else {
    infoHTML += `<p><strong>Note:</strong> Please specify trainer name below.</p>`;
    type2Section?.classList.remove("hidden");
  }

  if (fileInfoDiv) fileInfoDiv.innerHTML = infoHTML;
  analysisDiv?.classList.remove("hidden");

  showMessage(
    "success",
    `Excel file loaded successfully! ${questions.length} questions detected.`
  );
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
  const subject = encodeURIComponent(
    `Follow-up: Training Feedback - ${trainerName}`
  );
  const body = encodeURIComponent(
    `Dear Team,\n\nThis is a follow-up regarding the recent training session conducted by ${trainerName}. We would like to discuss your feedback to help us improve our training programs.\n\nBest regards,\n[your name],\nLearing and development`
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

  // Get the training topic from the input field
  trainingTopic =
    document.getElementById("trainingTopic")?.value || "Tech Fundamentals";

  studentsWithVeryPoorRatings = {};

  if (fileType === "single_trainer") {
    const trainerName = document.getElementById("trainerNameSelect")?.value;
    if (!trainerName) {
      showMessage(
        "error",
        "Please enter a trainer name for single trainer feedback."
      );
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
  const ratingColumns = headers.slice(8, headers.length - 3);

  const studentsWithVeryPoor = getStudentsWithVeryPoorRating(
    trainerName,
    ratingColumns
  );
  studentsWithVeryPoorRatings[trainerName] = studentsWithVeryPoor;

  const commentWellKey = headers.find((k) =>
    k.toLowerCase().includes("what went")
  );
  const commentImproveKey = headers.find(
    (k) =>
      k.toLowerCase().includes("what needs") ||
      k.toLowerCase().includes("what need")
  );

  const commentsWell = commentWellKey
    ? excelRows
        .map((r) => r[commentWellKey])
        .filter((c) => c && c.toString().trim())
    : [];

  const commentsImprove = commentImproveKey
    ? excelRows
        .map((r) => r[commentImproveKey])
        .filter((c) => c && c.toString().trim())
    : [];

  const output = document.getElementById("output");
  if (output) output.innerHTML = "";

  const API_KEY = envConfig.geminiApiKey;
  const ENDPOINT = envConfig.geminiEndpoint;

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
      summary = summary
        .replace(/\*/g, "")
        .split("\n")
        .filter((l) => l.trim() !== "");
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

  const commentWellKey = headers.find((k) =>
    k.toLowerCase().includes("what went")
  );
  const commentImproveKey = headers.find(
    (k) =>
      k.toLowerCase().includes("what needs") ||
      k.toLowerCase().includes("what need")
  );

  const commentsWell = commentWellKey
    ? excelRows
        .map((r) => r[commentWellKey])
        .filter((c) => c && c.toString().trim())
    : [];

  const commentsImprove = commentImproveKey
    ? excelRows
        .map((r) => r[commentImproveKey])
        .filter((c) => c && c.toString().trim())
    : [];

  const output = document.getElementById("output");
  if (output) output.innerHTML = "";

  const API_KEY = envConfig.geminiApiKey;
  const ENDPOINT = envConfig.geminiEndpoint;

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
      summary = summary
        .replace(/\*/g, "")
        .split("\n")
        .filter((l) => l.trim() !== "");
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

  // --- create safe ids and build the report HTML ---
  const safeTrainer = safeId(trainerName); // ensure valid DOM ids
  const output = document.getElementById("output");
  const div = document.createElement("div");
  div.className = "report";

  div.innerHTML = `
  <div class="report-content">
    <h2>ILP - ${trainingTopic} Feedback — ${trainerName}</h2>

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
          <td style="text-align:left">${
            questions[i] || "Category " + (i + 1)
          }</td>
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

    
    <div class="analytics-section">
      <div style="display: flex; gap: 20px; justify-content: center; align-items: flex-start; flex-wrap: wrap;">
        <div class="chart-container pie-chart-container" style="width:360px; height:360px;">
          <canvas id="pie_${safeTrainer}"></canvas>
        </div>

        <div class="chart-container bar-chart-container" style="width:520px; height:360px;">
          <canvas id="bar_${safeTrainer}"></canvas>
        </div>
      </div>
    </div>

    <!-- comments and other sections unchanged -->
  </div>

  <div class="report-actions"> ... </div>
  `;

  if (output) output.appendChild(div);

  // Build Pie Data (unchanged)
  const pieData = {
    Excellent: 0,
    "Very Good": 0,
    Good: 0,
    Average: 0,
    "Very Poor": 0,
  };
  Object.values(ratings).forEach((r) => {
    Object.keys(r).forEach((k) => (pieData[k] += r[k]));
  });

  // PIE CHART: make it fill its container
  new Chart(document.getElementById("pie_" + safeTrainer), {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: Object.keys(pieData),
      datasets: [
        {
          data: Object.values(pieData),
          backgroundColor: [
            "#001f3f",
            "#003d7a",
            "#0051b3",
            "#0066cc",
            "#4C9EFF",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Overall Rating Distribution",
          font: { size: 14, weight: "bold" },
          padding: { bottom: 10 },
        },
        legend: {
          position: "bottom",
          labels: { padding: 12, font: { size: 13 } },
        },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 12 },
          formatter: (value, ctx) => {
            if (value === 0) return "";
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value}\n(${percentage}%)`;
          },
        },
      },
    },
  });

  // BAR CHART - AVERAGE RATING PER QUESTION (bigger & clearer)
  const barLabels = columns.map((_, i) => "Q" + (i + 1));
  const barData = columns.map((c, i) => {
    let total = 0,
      count = 0;
    excelRows.forEach((r) => {
      const nv = ratingMap[NORMALIZE(r[c])];
      if (nv) {
        total += nv;
        count++;
      }
    });
    return count ? (total / count).toFixed(2) : 0;
  });

  const barCanvas = document.getElementById("bar_" + safeTrainer);
  // Ensure parent container size is enforced (helps charts render large)
  if (barCanvas && barCanvas.parentElement) {
    barCanvas.parentElement.style.width =
      barCanvas.parentElement.style.width || "720px";
    barCanvas.parentElement.style.height =
      barCanvas.parentElement.style.height || "380px";
    // let chart fill the parent
    barCanvas.style.width = "100%";
    barCanvas.style.height = "100%";
  }

  new Chart(barCanvas, {
    type: "bar",
    plugins: [ChartDataLabels],
    data: {
      labels: barLabels,
      datasets: [
        {
          label: "Average Rating",
          data: barData,
          // visual tuning for bigger bars
          backgroundColor: "#4C9EFF",
          barThickness: 34, // fixed thickness for clarity
          maxBarThickness: 60, // cap thickness on wide screens
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // allow filling the parent container
      layout: { padding: { top: 10, right: 10, left: 10, bottom: 10 } },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMin: 0,
          suggestedMax: 5,
          ticks: { stepSize: 1 },
          title: {
            display: true,
            text: "Rating Score (0-5)",
            font: { size: 12, weight: "bold" },
          },
        },
        x: {
          title: {
            display: true,
            text: "Questions",
            font: { size: 12, weight: "bold" },
          },
          ticks: { maxRotation: 0, autoSkip: false },
        },
      },
      plugins: {
        title: {
          display: true,
          text: "Average Rating Per Question",
          font: { size: 14, weight: "bold" },
          padding: { bottom: 35,left:20 },
        },
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "end",
          font: { size: 12, weight: "bold" },
          color: "#0b63d6",
          offset: 6,
          formatter: (value) => (value ? parseFloat(value).toFixed(2) : "0"),
        },
      },
    },
  });

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
        ${trainerNames
          .map((name) => `<option value="${name}">${name}</option>`)
          .join("")}
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

    // Extract trainer name from title format "ILP - [Topic] Feedback — [TrainerName]"
    const trainerName = reportTitle.split(" — ")[1]?.trim() || "";

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

  const poorSection = Array.from(reportDiv.querySelectorAll(".section")).find(
    (sec) => sec.querySelector("h3")?.textContent.includes("Very Poor")
  );

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
    reportDiv.querySelector("h2")?.textContent.split(" — ")[1]?.trim() ||
    "TrainerReport";

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

    const poorSection = Array.from(reportDiv.querySelectorAll(".section")).find(
      (sec) => sec.querySelector("h3")?.textContent.includes("Very Poor")
    );

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

  reportDivs.forEach((reportDiv) => {
    const reportContent = reportDiv.querySelector(".report-content");
    if (!reportContent) return;

    const trainerName = reportContent
      .querySelector("h2")
      ?.textContent.split(" — ")[1]
      ?.trim();

    const metaDiv = reportContent.querySelector(".meta");
    const metaDivs = metaDiv?.querySelectorAll("div") || [];

    let batchName = "";
    let traineeCount = 0;
    let overallRating = "";

    metaDivs.forEach((div) => {
      const text = div.textContent;
      if (text.includes("Batch Name:")) {
        batchName = text.replace("Batch Name:", "").trim();
      } else if (text.includes("Total Trainee Count:")) {
        traineeCount = parseInt(
          text.replace("Total Trainee Count:", "").trim()
        );
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
          total: parseInt(cells[6].textContent),
        });
      }
    });

    const sections = reportContent.querySelectorAll(".section");
    let commentsWell = [];
    let commentsImprove = [];
    let studentsWithPoorRatings = [];

    sections.forEach((section) => {
      const heading = section.querySelector("h3")?.textContent;
      const items = section.querySelectorAll("li");

      if (heading?.includes("What went well")) {
        commentsWell = Array.from(items).map((li) => li.textContent);
      } else if (heading?.includes("What needs improvement")) {
        commentsImprove = Array.from(items).map((li) => li.textContent);
      } else if (heading?.includes("Very Poor")) {
        studentsWithPoorRatings = Array.from(items).map((li) => li.textContent);
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
      studentsWithPoorRatings,
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
      saveButton.innerHTML =
        '<i class="fa-solid fa-floppy-disk"></i> Save Report';
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
window.trainingTopic = trainingTopic;
