import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  child,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1WuMsdZdPfuimZ7kfdeaeOsepRYOOSz8",
  authDomain: "js-project-55861.firebaseapp.com",
  databaseURL: "https://js-project-55861-default-rtdb.firebaseio.com",
  projectId: "js-project-55861",
  storageBucket: "js-project-55861.firebasestorage.app",
  messagingSenderId: "792815063603",
  appId: "1:792815063603:web:6d84def26f72886583c946",
  measurementId: "G-0SCRHVW7Y1",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app); // <-- now app exists

let questions = [];

window.onload = async () => {
  const dbRef = ref(db);
  try {
    // Show loading
    loading.style.display = "block";
    output.innerHTML = "";
    const snapshot = await get(child(dbRef, "questions"));
    if (snapshot.exists()) {
      const questionsObj = snapshot.val();
      questions = Object.values(questionsObj);
      console.log("Questions Array:", questions);

      // Render after fetching
      renderQuestionList();
    } else {
      console.log("No questions found");
    }
  } catch (error) {
    console.error("Error fetching questions:", error);
  } finally {
    // Hide loading once done
    loading.style.display = "none";
  }
};

function showLoading(message = "Loading...") {
  const loadingDiv = document.getElementById("loading");
  loadingDiv.querySelector("div:last-child").textContent = message;
  loadingDiv.style.display = "flex";
}

function hideLoading() {
  document.getElementById("loading").style.display = "none";
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("User signed out");
      window.location.href = "login.html";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
    });
});

let excelRows = [];
let fileType = null; // 'multiple_trainers' or 'single_trainer'
let detectedTrainers = [];
// Global variable to store students with very poor ratings for each trainer
let studentsWithVeryPoorRatings = {};

// let questions = [
//     "The trainer provided me adequate opportunity to ask questions/clarify the concepts",
//     "Included an appropriate number of activities, exercise, and interaction during the session",
//     "The trainer is a Subject Matter Expert and approachable",
//     "The trainer encouraged participation and enthusiasm throughout the class "
// ]; // default 4

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

document
  .getElementById("fileInput")
  .addEventListener("change", handleFile, false);

function analyzeFileStructure(headers) {
  // Look for trainer-related columns
  const potentialTrainerColumns = [];
  const excludeKeywords = [
    "last modified",
    "what went",
    "what need",
    "attention",
    "completion",
    "start",
    "id",
    "email",
    "timestamp",
    "response",
  ];

  headers.forEach((header) => {
    const headerLower = header.toLowerCase();
    const shouldExclude = excludeKeywords.some((keyword) =>
      headerLower.includes(keyword)
    );

    if (!shouldExclude) {
      // Check if this could be a trainer column
      // Look for patterns like "TrainerName1", "TrainerName2" or rating-related columns
      const hasNumbers = /\d+$/.test(header);
      const isRatingColumn =
        headerLower.includes("rating") ||
        headerLower.includes("feedback") ||
        headerLower.includes("score");

      if (hasNumbers || isRatingColumn) {
        potentialTrainerColumns.push(header);
      }
    }
  });

  const trainerGroups = {};
  potentialTrainerColumns.forEach((col) => {
    const baseName = col.replace(/[0-9]+$/, "").trim();
    if (!trainerGroups[baseName]) {
      trainerGroups[baseName] = [];
    }
    trainerGroups[baseName].push(col);
  });

  const trainerNames = Object.keys(trainerGroups).filter(
    (name) => trainerGroups[name].length >= 2
  );

  console.log(trainerGroups);

  if (trainerNames.length > 0) {
    return {
      type: "multiple_trainers",
      trainers: trainerNames,
      groups: trainerGroups,
    };
  } else {
    return {
      type: "single_trainer",
      trainers: [],
      groups: {},
    };
  }
}

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

      displayFileAnalysis(analysis, headers.length, excelRows.length);
    } catch (error) {
      showMessage("error", "Error reading Excel file: " + error.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function displayFileAnalysis(analysis, columnCount, rowCount) {
  const fileInfoDiv = document.getElementById("fileInfoDisplay");
  const analysisDiv = document.getElementById("fileAnalysis");
  const type1Section = document.getElementById("type1Section");
  const type2Section = document.getElementById("type2Section");

  // Reset sections
  type1Section.classList.add("hidden");
  type2Section.classList.add("hidden");

  let infoHTML = `
        <h3>File Analysis Complete</h3>
        
        <p><strong>No of Trainees:</strong> ${rowCount}</p>
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
    type1Section.classList.remove("hidden");
  } else {
    infoHTML += `<p><strong>Note:</strong>  Please specify trainer name below.</p>`;
    type2Section.classList.remove("hidden");
  }

  fileInfoDiv.innerHTML = infoHTML;
  analysisDiv.classList.remove("hidden");

  showMessage(
    "success",
    "Excel file loaded successfully! Please review the analysis above and generate reports."
  );
}

function showMessage(type, message) {
  const existingMsg = document.querySelector(".error, .success");
  if (existingMsg) existingMsg.remove();

  const msgDiv = document.createElement("div");
  msgDiv.className = type;
  msgDiv.textContent = message;
  document.getElementById("dashboardPage");
  // .insertBefore(msgDiv, document.getElementById('fileAnalysis'));

  //   if (type === 'success') {
  //     setTimeout(() => msgDiv.remove(), 5000);
  //   }
}

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

// Helper function to find name column
function findNameColumn() {
  const headers = Object.keys(excelRows[0] || {});
  return headers.find(
    (header) =>
      header.toLowerCase().includes("name") &&
      !header.toLowerCase().includes("trainer")
  );
}

function openOutlookWebWithEmails(trainerName) {
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
    `Dear Team,\n\nThis is a follow-up regarding the recent training session conducted by ${trainerName}. We would like to discuss your feedback to help us improve our training programs.\n\nBest regards,\nJordan S Ben,\nLearing and development`
  );

  // Outlook Web Compose URL
  const outlookWebUrl = `https://outlook.office.com/mail/deeplink/compose?to=${emails}&subject=${subject}&body=${body}`;

  // Open in new tab
  window.open(outlookWebUrl, "_blank");
}

// Function to copy emails to clipboard
function copyEmailsToClipboard(trainerName) {
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
    .then(() => {
      alert("Email list copied to clipboard!");
    })
    .catch((err) => {
      console.error("Failed to copy emails: ", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = emailList;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Email list copied to clipboard!");
    });
}

function openModal() {
  const modal = document.getElementById("questionModal");
  const container = document.getElementById("questionInputs");
  container.innerHTML = "";
  questions.forEach((q, i) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = q;
    input.dataset.index = i;
    container.appendChild(input);
  });
  modal.style.display = "flex";
}

function closeModal() {
  document.getElementById("questionModal").style.display = "none";
}

function addQuestion() {
  const container = document.getElementById("questionInputs");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter new question";
  container.appendChild(input);
}

function saveQuestions() {
  const inputs = document.querySelectorAll("#questionInputs input");
  questions = [];
  inputs.forEach((inp) => {
    if (inp.value.trim() !== "") questions.push(inp.value.trim());
  });

  // Update Firebase
  const dbRef = ref(db, "questions");
  set(dbRef, questions)
    .then(() => {
      console.log("Questions updated in Firebase");
      showMessage("success", "Questions saved successfully!");
      renderQuestionList();
      closeModal();
    })
    .catch((error) => {
      console.error("Error updating questions in Firebase:", error);
      showMessage("error", "Failed to save questions. Try again.");
    });
  renderQuestionList();
  closeModal();
}

function renderQuestionList() {
  const list = document.getElementById("questionList");
  list.innerHTML = "";
  questions.forEach((q) => {
    const li = document.createElement("li");
    li.textContent = q;
    list.appendChild(li);
  });
}
renderQuestionList(); // initial render

function generateReports() {
  if (!excelRows.length || !fileType) {
    showMessage("error", "Please upload an Excel file first.");
    return;
  }

  // Clear previous data
  studentsWithVeryPoorRatings = {};

  if (fileType === "single_trainer") {
    const trainerName = document.getElementById("trainerNameSelect").value;

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

  // Find rating columns (exclude metadata columns)
  const ratingColumns = headers.slice(7, headers.length - 4);

  // Get students with very poor ratings for this trainer
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

  console.log("Raw Well Comments:", commentsWell);
  console.log("Raw Improve Comments:", commentsImprove);

  // Clear previous reports before generating new one
  const output = document.getElementById("output");
  output.innerHTML = "";

  const API_KEY = "AIzaSyAIjhn5kPPAYRjPrhZy2f8moH6ozfUaR2o";
  const ENDPOINT =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
  async function summarizeWithGemini(label, comments) {
    if (!comments.length) return [`No ${label} comments available.`];

    const feedbackText = comments.join("\n");
    const prompt = `Summarize the following trainee feedback about "${label}" into 3-4 clear bullet points. Return only bullet points:\n\n${feedbackText}`;

    try {
      const response = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
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

    

    addSaveButtonToReportPage()
}

async function generateMultipleTrainerReports() {
  showLoading("Generating Report...");
  const headers = Object.keys(excelRows[0]);

  // Detect trainer groups
  const trainerGroups = {};
  headers.forEach((h) => {
    const hl = h.toLowerCase();
    if (
      hl.includes("last modified") ||
      hl.includes("what went") ||
      hl.includes("what need") ||
      hl.includes("attention") ||
      hl.includes("completion") ||
      hl.includes("start") ||
      hl.includes("id") ||
      hl.includes("email") ||
      hl.includes("name")
    )
      return;

    const base = h.replace(/[0-9]+$/, "").trim();
    if (!trainerGroups[base]) trainerGroups[base] = [];
    trainerGroups[base].push(h);
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
  output.innerHTML = "";

  // Summarize comments via Gemini
  const API_KEY = "AIzaSyAIjhn5kPPAYRjPrhZy2f8moH6ozfUaR2o";
  const ENDPOINT =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

  async function summarizeWithGemini(label, comments) {
    if (!comments.length) return [`No ${label} comments available.`];

    const feedbackText = comments.join("\n");
    const prompt = `Summarize the following trainee feedback about "${label}" into 3-4 clear bullet points. Return only bullet points:\n\n${feedbackText}`;

    try {
      const response = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
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

  // Get trainer names for the dropdown
  const trainerNames = Object.keys(trainerGroups);

  Object.entries(trainerGroups).forEach(([trainer, cols]) => {
    // Get students with very poor ratings for this trainer
    const studentsWithVeryPoor = getStudentsWithVeryPoorRating(trainer, cols);
    studentsWithVeryPoorRatings[trainer] = studentsWithVeryPoor;

    generateReport(trainer, cols, summaryWell, summaryImprove);
  });

  // Create the trainer filter dropdown
  createTrainerFilterDropdown(trainerNames);

  document.getElementById("dashboardPage").classList.add("hidden");
  document.getElementById("reportPage").classList.remove("hidden");
  addSaveButtonToReportPage()
}

function createTrainerFilterDropdown(trainerNames) {
  const reportPage = document.getElementById("reportPage");

  // Remove existing filter if any
  const existingFilter = document.getElementById("trainerFilterSection");
  if (existingFilter) {
    existingFilter.remove();
  }

  // Create filter section
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

  // Insert after the back button but before output
  const backButton = reportPage.querySelector('button[onclick="goBack()"]');
  backButton.after(filterSection);
}

function filterReportsByTrainer() {
  const selectedTrainer = document.getElementById("trainerFilter").value;
  const allReports = document.querySelectorAll(".report");

  allReports.forEach((report) => {
    const reportTitle = report.querySelector("h2").textContent;
    const trainerName = reportTitle
      .replace("ILP - Tech Fundamentals Feedback — ", "")
      .trim();

    if (selectedTrainer === "all" || trainerName === selectedTrainer) {
      report.style.display = "block";
    } else {
      report.style.display = "none";
    }
  });

  // Update bulk actions visibility
  updateBulkActionsVisibility();
}

function updateBulkActionsVisibility() {
  const selectedTrainer = document.getElementById("trainerFilter").value;
  const bulkActions = document.querySelector(".bulk-actions");

  if (bulkActions) {
    // Show "Download All" only when "Show All" is selected
    if (selectedTrainer === "all") {
      bulkActions.style.display = "block";
    } else {
      bulkActions.style.display = "none";
    }
  }
}

function generateReport(trainerName, columns, commentsWell, commentsImprove) {
  const ratings = {};
  console.log("hhhhhhhhhhhhhhh", columns);
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
      console.log(r[c]);
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

  // Get students with very poor ratings for email functionality
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

  output.appendChild(div);

  // Switch to report page for single trainer
  if (fileType === "single_trainer") {
    document.getElementById("dashboardPage").classList.add("hidden");
    document.getElementById("reportPage").classList.remove("hidden");
  }
}


function goBack() {
    localStorage.removeItem("viewReportId"); // Clear any stored report ID
    document.getElementById("reportPage").classList.add("hidden");
    document.getElementById("dashboardPage").classList.remove("hidden");
}

async function downloadPDF(button) {
  const reportDiv = button.closest(".report").querySelector(".report-content"); // only content
  const { jsPDF } = window.jspdf;

  const canvas = await html2canvas(reportDiv, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Shrink content to fit inside a single page (no huge empty space)
  let imgWidth = pageWidth - 20;
  let imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight > pageHeight - 20) {
    imgHeight = pageHeight - 20; // scale down to fit
    imgWidth = (canvas.width * imgHeight) / canvas.height;
  }

  pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);

  // File name from trainer heading
  const trainerName =
    reportDiv
      .querySelector("h2")
      ?.textContent.replace("ILP - Tech Fundamentals Feedback — ", "")
      .trim() || "TrainerReport";
  pdf.save(`${trainerName}_Feedback_Report.pdf`);
}

let trainers = [];

// Fetch trainers from Firebase on load
async function loadTrainers() {
  const dbRef = ref(db, "trainers");
  try {
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      trainers = snapshot.val();
    } else {
      trainers = [];
    }
    renderTrainerDropdown();
  } catch (err) {
    console.error("Error loading trainers:", err);
  }
}

function renderTrainerDropdown() {
  const select = document.getElementById("trainerNameSelect");
  select.innerHTML = "";
  trainers.forEach((t) => {
    const option = document.createElement("option");
    option.value = t;
    option.textContent = t;
    select.appendChild(option);
  });
}

// Modal open/close
function openTrainerModal() {
  const modal = document.getElementById("trainerModal");
  const container = document.getElementById("trainerInputs");
  container.innerHTML = "";
  trainers.forEach((t, i) => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = t;
    input.dataset.index = i;
    container.appendChild(input);
  });
  modal.style.display = "flex";
}

function closeTrainerModal() {
  document.getElementById("trainerModal").style.display = "none";
}

function addTrainer() {
  const container = document.getElementById("trainerInputs");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter trainer name";
  container.appendChild(input);
}

function saveTrainers() {
  const inputs = document.querySelectorAll("#trainerInputs input");
  trainers = [];
  inputs.forEach((inp) => {
    if (inp.value.trim() !== "") trainers.push(inp.value.trim());
  });

  const dbRef = ref(db, "trainers");
  set(dbRef, trainers)
    .then(() => {
      console.log("Trainers updated in Firebase");
      showMessage("success", "Trainers saved successfully!");
      renderTrainerDropdown();
      closeTrainerModal();
    })
    .catch((error) => {
      console.error("Error updating trainers in Firebase:", error);
      showMessage("error", "Failed to save trainers. Try again.");
    });
}
async function downloadAllReports() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  const reports = document.querySelectorAll(".report .report-content");

  if (!reports.length) {
    alert("No reports available to download.");
    return;
  }

  for (let i = 0; i < reports.length; i++) {
    const reportDiv = reports[i];
    const canvas = await html2canvas(reportDiv, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

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

loadTrainers();

// Add these functions to your final_index.js file

// Global variable to store current report data
let currentReportData = null;

// Function to prepare report data structure
function prepareReportData() {
    const reports = [];
    const reportDivs = document.querySelectorAll(".report");
    
    reportDivs.forEach(reportDiv => {
        const reportContent = reportDiv.querySelector(".report-content");
        const trainerName = reportContent.querySelector("h2").textContent
            .replace("ILP - Tech Fundamentals Feedback — ", "").trim();
        
        // Extract meta information
        const metaDiv = reportContent.querySelector(".meta");
        const metaDivs = metaDiv.querySelectorAll("div");
        
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
        
        // Extract table data
        const table = reportContent.querySelector("table");
        const tableData = [];
        const rows = table.querySelectorAll("tr");
        
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
                    total: parseInt(cells[6].textContent)
                });
            }
        });
        
        // Extract comments
        const sections = reportContent.querySelectorAll(".section");
        let commentsWell = [];
        let commentsImprove = [];
        let studentsWithPoorRatings = [];
        
        sections.forEach(section => {
            const heading = section.querySelector("h3").textContent;
            const items = section.querySelectorAll("li");
            
            if (heading.includes("What went well")) {
                commentsWell = Array.from(items).map(li => li.textContent);
            } else if (heading.includes("What needs improvement")) {
                commentsImprove = Array.from(items).map(li => li.textContent);
            } else if (heading.includes("Very Poor")) {
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

// Open save report modal
function openSaveReportModal() {
    currentReportData = prepareReportData();
    document.getElementById("saveReportModal").style.display = "flex";
    document.getElementById("reportName").value = "";
}

// Close save report modal
function closeSaveReportModal() {
    document.getElementById("saveReportModal").style.display = "none";
    currentReportData = null;
}

// Save report to Firebase
async function saveReportToHistory() {
    const reportName = document.getElementById("reportName").value.trim();
    
    if (!reportName) {
        showMessage("error", "Please enter a report name");
        return;
    }
    
    if (!currentReportData || currentReportData.length === 0) {
        showMessage("error", "No report data to save");
        return;
    }
    
    try {
        showLoading("Saving report...");
        
        const timestamp = Date.now();
        const date = new Date(timestamp);
        const formattedDate = date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const reportType = fileType === 'single_trainer' ? 'Single Trainer' : 'Multiple Trainers';
        
        const historyEntry = {
            reportName,
            reportType,
            timestamp,
            date: formattedDate,
            time: formattedTime,
            reports: currentReportData,
            questionsUsed: [...questions], // Save questions used at time of generation
            fileInfo: {
                traineeCount: excelRows.length,
                trainerCount: currentReportData.length
            }
        };
        
        // Save to Firebase
        const historyRef = ref(db, "history");
        const newReportRef = push(historyRef);
        await set(newReportRef, historyEntry);
        
        showMessage("success", `Report "${reportName}" saved successfully!`);
        closeSaveReportModal();
        hideLoading();
        
    } catch (error) {
        console.error("Error saving report:", error);
        showMessage("error", "Failed to save report. Please try again.");
        hideLoading();
    }
}

// Update the report page to include Save button
// Modify your existing code where you create the report page buttons
// Add this after the "Go Back" button in the reportPage div:

function addSaveButtonToReportPage() {
    const reportPage = document.getElementById("reportPage");
    const existingSaveBtn = document.getElementById("saveReportBtn");
    
    if (!existingSaveBtn) {
        const backButton = reportPage.querySelector('button[onclick="goBack()"]');
        const saveButton = document.createElement("button");
        saveButton.id = "saveReportBtn";
        saveButton.onclick = openSaveReportModal;
        saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Report';
        saveButton.style.marginLeft = "10px";
        backButton.after(saveButton);
    }
}

// Call this function after generating reports
// Add this line at the end of both generateSingleTrainerReport and generateMultipleTrainerReports:
// addSaveButtonToReportPage();


// Make functions globally accessible
window.openSaveReportModal = openSaveReportModal;
window.closeSaveReportModal = closeSaveReportModal;
window.saveReportToHistory = saveReportToHistory;
window.addSaveButtonToReportPage = addSaveButtonToReportPage;

window.generateReports = generateReports;
window.goBack = goBack;
window.downloadPDF = downloadPDF;
window.openModal = openModal;
window.closeModal = closeModal;
window.addQuestion = addQuestion;
window.saveQuestions = saveQuestions;

window.openTrainerModal = openTrainerModal;
window.closeTrainerModal = closeTrainerModal;
window.addTrainer = addTrainer;
window.saveTrainers = saveTrainers;
window.openOutlookWebWithEmails = openOutlookWebWithEmails;
window.copyEmailsToClipboard = copyEmailsToClipboard;
window.downloadAllReports = downloadAllReports;
window.filterReportsByTrainer = filterReportsByTrainer;
window.createTrainerFilterDropdown = createTrainerFilterDropdown;
window.updateBulkActionsVisibility = updateBulkActionsVisibility;
