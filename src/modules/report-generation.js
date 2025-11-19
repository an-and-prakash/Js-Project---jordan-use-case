import {
  questions,
  showLoading,
  hideLoading,
  showMessage,
} from "./firebase-config.js";

export let excelRows = [];
export let fileType = null;
export let detectedTrainers = [];
export let studentsWithVeryPoorRatings = {};
export let trainingTopic = "Tech Fundamentals";

// ===================================
// CONSTANTS & UTILITIES
// ===================================

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

const CHART_COLORS = {
  pie: ["#001f3f", "#003d7a", "#0051b3", "#0066cc", "#4C9EFF"],
  bar: "#4C9EFF",
};

const safeId = (s) => (s || "").replace(/\s+/g, "_").replace(/[^\w\-]/g, "");

const findColumn = (keywords) => {
  const headers = Object.keys(excelRows[0] || {});
  return headers.find((h) =>
    keywords.some((kw) => h.toLowerCase().includes(kw))
  );
};

// ===================================
// FILE HANDLING
// ===================================

document
  .getElementById("fileInput")
  ?.addEventListener("change", handleFile, false);

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
  const multiTrainerPattern = /\.\.([^.\d]+)$/;
  const hasMultipleTrainers = headers.some((h) => multiTrainerPattern.test(h));

  if (hasMultipleTrainers) {
    return analyzeMultipleTrainers(headers, multiTrainerPattern);
  }

  return analyzeSingleTrainer(headers);
}

function analyzeMultipleTrainers(headers, pattern) {
  const validHeaders = headers.slice(5, headers.length - 3);
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

  console.log("Multiple Trainers Detected:", Array.from(allTrainers));
  console.log("Question Groups:", orderedGroups);

  return {
    type: "multiple_trainers",
    trainers: Array.from(allTrainers),
    groups: orderedGroups,
    questionCount: Object.keys(orderedGroups).length,
  };
}

function analyzeSingleTrainer(headers) {
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
    if (index < 5) return false;
    const normalized = header.toLowerCase();
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

  const isMultiTrainer = analysis.type === "multiple_trainers";

  let infoHTML = `
    <h3>File Analysis Complete</h3>
    <p><strong>No of Trainees:</strong> ${rowCount}</p>
    <p><strong>No of Questions:</strong> ${questions.length}</p>
    <p><strong>File Type:</strong> ${
      isMultiTrainer ? "Multiple Trainers" : "Single Trainer"
    }</p>
  `;

  if (isMultiTrainer) {
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
  const emailKey = findColumn(["email", "mail"]);
  const nameKey = findColumn(["name"]);
  const studentsWithVeryPoor = [];

  excelRows.forEach((row, index) => {
    const hasVeryPoorRating = columns.some((column) => {
      const rating = row[column];
      return rating && NORMALIZE(rating).includes("poor");
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
// GEMINI AI SUMMARIZATION
// ===================================

async function summarizeWithGemini(label, comments) {
  if (!comments.length) return [`No ${label} comments available.`];

  const API_KEY = window._env_.geminiApiKey;
  const ENDPOINT = window._env_.geminiEndpoint;
  // const API_KEY = " window._env_.geminiApiKey";
  // const ENDPOINT = "window._env_.geminiEndpoint";
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

async function getCommentSummaries(headers) {
  const commentWellKey = findColumn(["what went"]);
  const commentImproveKey = findColumn(["what needs", "what need"]);

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

  return Promise.all([
    summarizeWithGemini("What went well", commentsWell),
    summarizeWithGemini("What needs improvement", commentsImprove),
  ]);
}

// ===================================
// REPORT GENERATION
// ===================================

export function generateReports() {
  if (!excelRows.length || !fileType) {
    showMessage("error", "Please upload an Excel file first.");
    return;
  }

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

  clearExistingReportUI();

  const headers = Object.keys(excelRows[0]);
  const ratingColumns = headers.slice(8, headers.length - 3);

  studentsWithVeryPoorRatings[trainerName] = getStudentsWithVeryPoorRating(
    trainerName,
    ratingColumns
  );

  const [summaryWell, summaryImprove] = await getCommentSummaries(headers);

  generateReport(trainerName, ratingColumns, summaryWell, summaryImprove);

  hideLoading();
  switchToReportPage();
  addSaveButtonToReportPage();
}

async function generateMultipleTrainerReports() {
  showLoading("Generating Report...");

  const headers = Object.keys(excelRows[0]);
  const trainerDataMap = buildTrainerDataMap(headers);

  const [summaryWell, summaryImprove] = await getCommentSummaries(headers);

  Object.entries(trainerDataMap).forEach(([trainer, items]) => {
    const cols = items.map((i) => i.column);
    studentsWithVeryPoorRatings[trainer] = getStudentsWithVeryPoorRating(
      trainer,
      cols
    );
    generateReport(trainer, cols, summaryWell, summaryImprove);
  });

  createTrainerFilterDropdown(Object.keys(trainerDataMap));

  hideLoading();
  switchToReportPage();
  addSaveButtonToReportPage();
}

function buildTrainerDataMap(headers) {
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

  return trainerDataMap;
}

function calculateRatings(columns) {
  const ratings = columns.map(() => ({
    Excellent: 0,
    "Very Good": 0,
    Good: 0,
    Average: 0,
    "Very Poor": 0,
  }));

  let totalScore = 0,
    scoreCount = 0;

  excelRows.forEach((row) => {
    columns.forEach((col, i) => {
      const val = row[col];
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
  return { ratings, overall };
}

function getOverallRatingClass(overall) {
  const overallNumeric = overall === "N/A" ? null : parseFloat(overall);
  if (overallNumeric === null) return "";
  if (overallNumeric > 4) return "rating-success";
  if (overallNumeric >= 3 && overallNumeric <= 3.9) return "rating-warning";
  return "rating-danger";
}

function generateReport(trainerName, columns, commentsWell, commentsImprove) {
  const { ratings, overall } = calculateRatings(columns);
  const studentsWithVeryPoor = studentsWithVeryPoorRatings[trainerName] || [];
  const overallClass = getOverallRatingClass(overall);
  const safeTrainer = safeId(trainerName);

  const output = document.getElementById("output");
  const div = document.createElement("div");
  div.className = "report";

  div.innerHTML = buildReportHTML(
    trainerName,
    overall,
    overallClass,
    studentsWithVeryPoor,
    columns,
    ratings,
    commentsWell,
    commentsImprove,
    safeTrainer
  );

  if (output) output.appendChild(div);

  renderCharts(safeTrainer, ratings, columns);

  if (fileType === "single_trainer") {
    switchToReportPage();
  }
}

function buildReportHTML(
  trainerName,
  overall,
  overallClass,
  studentsWithVeryPoor,
  columns,
  ratings,
  commentsWell,
  commentsImprove,
  safeTrainer
) {
  return `
  <div class="report-content">
    <h2>ILP - ${trainingTopic} Feedback — ${trainerName}</h2>

    <div class="meta">
      <div><strong>Batch Name:</strong> ILP 2024-25 Batch</div>
      <div><strong>Total Trainee Count:</strong> ${excelRows.length}</div>
      <div><strong>Trainer Name:</strong> ${trainerName}</div>
      <div><strong>Overall Program Rating (out of 5):</strong> <span class="${overallClass}">${overall}</span></div>
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

    ${buildCommentsSection(
      "What went well / things you most liked",
      commentsWell
    )}
    ${buildCommentsSection("What needs improvement", commentsImprove)}
    ${buildStudentsSection(studentsWithVeryPoor)}
  </div>
  
  <div class="report-actions">
    <button onclick="downloadPDF(this)"><i class="fa-solid fa-arrow-down"></i> Download PDF</button>
    ${buildEmailButtons(trainerName, studentsWithVeryPoor)}
  </div>
`;
}

function buildCommentsSection(title, comments) {
  if (comments.length === 0) return "";
  return `
    <div class="section">
      <h3>${title}</h3>
      <ul>${comments.map((c) => `<li>${c}</li>`).join("")}</ul>
    </div>
  `;
}

function buildStudentsSection(students) {
  if (students.length === 0) return "";
  return `
    <div class="section">
      <h3>Students with "Very Poor" Ratings</h3>
      <p>The following students gave "Very Poor" ratings:</p>
      <ul>
        ${students
          .map((student) => `<li>${student.name} (${student.email})</li>`)
          .join("")}
      </ul>
    </div>
  `;
}

function buildEmailButtons(trainerName, students) {
  if (students.length === 0) return "";
  return `
    <button onclick="openOutlookWebWithEmails('${trainerName}')" class="email-btn">
      <i class="fa-solid fa-envelope"></i> Open Outlook with Emails
    </button>
    <button onclick="copyEmailsToClipboard('${trainerName}')" class="copy-btn">
      <i class="fa-solid fa-copy"></i> Copy Emails
    </button>
  `;
}

// ===================================
// CHART RENDERING
// ===================================

function renderCharts(safeTrainer, ratings, columns) {
  renderPieChart(safeTrainer, ratings);
  renderBarChart(safeTrainer, columns);
}

function renderPieChart(safeTrainer, ratings) {
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

  const enhancedColors = {
    pie: [
      "#1E3A8A", // Excellent - Deep Navy
      "#3B82F6", // Very Good - Bright Blue
      "#10B981", // Good - Emerald Green
      "#F59E0B", // Average - Amber
      "#EF4444", // Very Poor - Red
    ],
  };

  new Chart(document.getElementById("pie_" + safeTrainer), {
    type: "pie",
    plugins: [ChartDataLabels],
    data: {
      labels: Object.keys(pieData),
      datasets: [
        {
          data: Object.values(pieData),
          backgroundColor: enhancedColors.pie,
          borderWidth: 3,
          borderColor: "#ffffff",
          hoverOffset: 15,
          hoverBorderWidth: 4,
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
          font: {
            size: 14,
            weight: "bold",
            family: "Segoe UI",
          },
          padding: { bottom: 20, top: 10 },
          color: "#1f2937",
        },
        legend: {
          position: "bottom",
          labels: {
            padding: 16,
            font: { size: 14, family: "'Segoe UI', Arial, sans-serif" },
            color: "#374151",
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 12,
            boxHeight: 12,
          },
        },
        tooltip: {
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: 12,
          titleFont: { size: 14, weight: "bold" },
          bodyFont: { size: 13 },
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function (context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return ` ${context.label}: ${context.parsed} (${percentage}%)`;
            },
          },
        },
        datalabels: {
          color: "#ffffff",
          font: {
            weight: "bold",
            size: 13,
            family: "'Segoe UI', Arial, sans-serif",
          },
          textStrokeColor: "rgba(0, 0, 0, 0.3)",
          textStrokeWidth: 2,
          formatter: (value, ctx) => {
            if (value === 0) return "";
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value}\n${percentage}%`;
          },
        },
      },
    },
  });
}

function renderBarChart(safeTrainer, columns) {
  const barLabels = columns.map((_, i) => "Q" + (i + 1));

  const barData = columns.map((c) => {
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
  if (barCanvas?.parentElement) {
    barCanvas.parentElement.style.width = "880px";
    barCanvas.parentElement.style.height = "480px";
    barCanvas.style.width = "100%";
    barCanvas.style.height = "100%";
  }

  const ctx = barCanvas.getContext("2d");

  // Smooth vertical gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 450);
  gradient.addColorStop(0, "#1d4ed8"); // deep blue
  gradient.addColorStop(1, "#3b82f6"); // light blue

  new Chart(barCanvas, {
    type: "bar",
    plugins: [ChartDataLabels],
    data: {
      labels: barLabels,
      datasets: [
        {
          label: "Average Rating",
          data: barData,
          backgroundColor: gradient,

          
          barThickness: 70,
          maxBarThickness: 80,
          barPercentage: 0.9,
          

          borderRadius: {
            topLeft: 10,
            topRight: 10,
            bottomLeft: 0,
            bottomRight: 0,
          },
          borderSkipped: "bottom",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      layout: { padding: { top: 25, right: 30, left: 15, bottom: 20 } },

      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 5,
          ticks: {
            stepSize: 1,
            font: { size: 13, family: "'Segoe UI', Arial" },
            color: "#4b5563",
            padding: 8,
          },
          grid: {
            color: "rgba(0,0,0,0.05)",
            drawBorder: false,
            lineWidth: 1.2,
          },
          title: {
            display: true,
            text: "Rating (0–5)",
            font: { size: 14, weight: "bold", family: "'Segoe UI', Arial" },
            color: "#374151",
            padding: { bottom: 10 },
          },
        },

        x: {
          grid: { display: false },
          ticks: {
            font: { size: 13, family: "'Segoe UI', Arial" },
            color: "#4b5563",
            padding: 8,
          },
          title: {
            display: true,
            text: "Questions",
            font: { size: 14, weight: "bold", family: "'Segoe UI', Arial" },
            color: "#374151",
            padding: { top: 10 },
          },
        },
      },

      plugins: {
        title: {
          display: true,
          text: "Average Rating Per Question",
          font: { size: 20, weight: "bold", family: "'Segoe UI', Arial" },
          color: "#1f2937",
          padding: { bottom: 30 },
        },

        legend: { display: false },

        tooltip: {
          backgroundColor: "rgba(0,0,0,0.85)",
          bodyFont: { size: 14 },
          titleFont: { size: 15, weight: "bold" },
          cornerRadius: 8,
          displayColors: false,
          padding: 12,
          callbacks: {
            title: (ctx) => `Question ${ctx[0].dataIndex + 1}`,
            label: (ctx) => `Average: ${parseFloat(ctx.parsed.y).toFixed(2)}`,
          },
        },

        datalabels: {
          anchor: "end",
          align: "end",
          offset: 10,
          font: { size: 13, weight: "bold", family: "'Segoe UI', Arial" },
          color: "#1f2937",
          backgroundColor: "rgba(255,255,255,0.9)",
          borderRadius: 5,
          padding: { left: 6, right: 6, top: 4, bottom: 4 },
          formatter: (v) => parseFloat(v).toFixed(2),
        },
      },
    },
  });
}

// ===================================
// UI HELPERS
// ===================================

function clearExistingReportUI() {
  const existingFilter = document.getElementById("trainerFilterSection");
  if (existingFilter) existingFilter.remove();

  const bulkActions = document.querySelector(".bulk-actions");
  if (bulkActions) bulkActions.style.display = "none";

  const output = document.getElementById("output");
  if (output) output.innerHTML = "";
}

function switchToReportPage() {
  document.getElementById("dashboardPage")?.classList.add("hidden");
  document.getElementById("reportPage")?.classList.remove("hidden");
}

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

    const trainerName = reportTitle.split(" — ")[1]?.trim() || "";
    report.style.display =
      selectedTrainer === "all" || trainerName === selectedTrainer
        ? "block"
        : "none";
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
  const { imgWidth, imgHeight } = calculatePDFDimensions(pdf, canvas);

  pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

  const trainerName =
    reportDiv.querySelector("h2")?.textContent.split(" — ")[1]?.trim() ||
    "TrainerReport";
  pdf.save(`${trainerName}_Feedback_Report.pdf`);
}

function calculatePDFDimensions(pdf, canvas) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let imgWidth = pageWidth - 20;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight > pageHeight - 20) {
    imgHeight = pageHeight - 20;
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }

  return { imgWidth, imgHeight };
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

    const { imgWidth, imgHeight } = calculatePDFDimensions(pdf, canvas);

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

    const report = extractReportData(reportContent);
    if (report) reports.push(report);
  });

  return reports;
}

function extractReportData(reportContent) {
  const trainerName = reportContent
    .querySelector("h2")
    ?.textContent.split(" — ")[1]
    ?.trim();
  const metaData = extractMetaData(reportContent);
  const tableData = extractTableData(reportContent);
  const sections = extractSections(reportContent);

  return {
    trainerName,
    ...metaData,
    tableData,
    ...sections,
  };
}

function extractMetaData(reportContent) {
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
      traineeCount = parseInt(text.replace("Total Trainee Count:", "").trim());
    } else if (text.includes("Overall Program Rating")) {
      overallRating = text.split(":")[1].trim();
    }
  });

  return { batchName, traineeCount, overallRating };
}

function extractTableData(reportContent) {
  const table = reportContent.querySelector("table");
  const tableData = [];
  const rows = table?.querySelectorAll("tr") || [];

  rows.forEach((row, index) => {
    if (index === 0) return; // Skip header
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

  return tableData;
}

function extractSections(reportContent) {
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

  return { commentsWell, commentsImprove, studentsWithPoorRatings };
}

function addSaveButtonToReportPage() {
  const reportPage = document.getElementById("reportPage");
  if (!reportPage) return;

  const existingSaveBtn = document.getElementById("saveReportBtn");
  if (existingSaveBtn) return;

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

// ===================================
// GLOBAL EXPORTS
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
