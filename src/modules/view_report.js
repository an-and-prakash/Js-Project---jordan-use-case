// view_report.js

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
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = window._env_;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let currentReportData = null;
const ratingLabels = ["Excellent", "Very Good", "Good", "Average", "Very Poor"];

// Auth check
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../../index.html";
  } else {
    loadReport();
  }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      window.location.href = "../../index.html";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
    });
});

// Load report from Firebase
async function loadReport() {
  const reportId = localStorage.getItem("viewReportId");

  if (!reportId) {
    alert("No report selected");
    window.location.href = "history.html";
    return;
  }

  const loading = document.getElementById("loading");
  loading.style.display = "flex";

  try {
    console.log("Trying to load reportId:", reportId);

    const reportRef = ref(db, `history/${reportId}`);
    const snapshot = await get(reportRef);
    console.log("Snapshot exists:", snapshot.exists());
    console.log("Snapshot value:", snapshot.val());

    if (snapshot.exists()) {
      currentReportData = snapshot.val();
      displayReport();
    } else {
      alert("Report not found");
      window.location.href = "history.html";
    }
  } catch (error) {
    console.error("Error loading report:", error);
    alert("Failed to load report");
    window.location.href = "history.html";
  } finally {
    loading.style.display = "none";
  }
}

// Display report metadata
function displayReportMetadata() {
  const metadataDiv = document.getElementById("reportMetadata");

  console.log("hi");
  metadataDiv.innerHTML = `
        <div class="metadata-content">
            <h2>${currentReportData.reportName}</h2>
            <div class="metadata-grid">
                <div class="metadata-item">
                    <i class="fa-solid fa-calendar"></i>
                    <span><strong>Date:</strong> ${currentReportData.date}</span>
                </div>
                <div class="metadata-item">
                    <i class="fa-solid fa-clock"></i>
                    <span><strong>Time:</strong> ${currentReportData.time}</span>
                </div>
                <div class="metadata-item">
                    <i class="fa-solid fa-tag"></i>
                    <span><strong>Type:</strong> ${currentReportData.reportType}</span>
                </div>
                <div class="metadata-item">
                    <i class="fa-solid fa-users"></i>
                    <span><strong>Trainers:</strong> ${currentReportData.fileInfo.trainerCount}</span>
                </div>
            </div>
        </div>
    `;

  console.log("hi");
}

// Display report
function displayReport() {
  console.log("hi");
  displayReportMetadata();

  const output = document.getElementById("output");
  output.innerHTML = "";

  // If multiple trainers, create filter dropdown
  if (currentReportData.reportType === "Multiple Trainers") {
    const trainerNames = currentReportData.reports.map((r) => r.trainerName);
    createTrainerFilterDropdown(trainerNames);
  }
  console.log("hi");
  // Generate each report
  currentReportData.reports.forEach((report) => {
    generateReportHTML(
      report,
      currentReportData.trainingTopic || "Tech Fundamentals"
    );
  });

  document.getElementById("reportPage").classList.remove("hidden");

  console.log("hyrr");
}

// Create trainer filter dropdown
function createTrainerFilterDropdown(trainerNames) {
  const filterSection = document.getElementById("trainerFilterSection");
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
}

// Filter reports by trainer
window.filterReportsByTrainer = function () {
  const selectedTrainer = document.getElementById("trainerFilter").value;
  const allReports = document.querySelectorAll(".report");

  allReports.forEach((report) => {
    const reportTitle = report.querySelector("h2").textContent;
    // Extract trainer name from title format "ILP - [Topic] Feedback — [TrainerName]"
    const trainerName = reportTitle.split(" — ")[1]?.trim() || "";

    if (selectedTrainer === "all" || trainerName === selectedTrainer) {
      report.style.display = "block";
    } else {
      report.style.display = "none";
    }
  });

  updateBulkActionsVisibility();
};

// Update bulk actions visibility
function updateBulkActionsVisibility() {
  const trainerFilter = document.getElementById("trainerFilter");
  const selectedTrainer = trainerFilter ? trainerFilter.value : "all";
  const bulkActions = document.querySelector(".bulk-actions");

  if (bulkActions) {
    if (selectedTrainer === "all") {
      bulkActions.style.display = "block";
    } else {
      bulkActions.style.display = "none";
    }
  }
}

// Generate report HTML
function generateReportHTML(report, trainingTopic = "Tech Fundamentals") {
  console.log("Report object received:", report);

  const output = document.getElementById("output");
  const div = document.createElement("div");
  div.className = "report";

  const tableRows = (report.tableData || [])
    .map(
      (row) => `
    <tr>
      <td style="text-align:left">${row.category || ""}</td>
      <td>${row.excellent || 0}</td>
      <td>${row.veryGood || 0}</td>
      <td>${row.good || 0}</td>
      <td>${row.average || 0}</td>
      <td>${row.veryPoor || 0}</td>
      <td>${row.total || 0}</td>
    </tr>
  `
    )
    .join("");

  const commentsWell = report.commentsWell || [];
  const commentsImprove = report.commentsImprove || [];
  const TraineesWithPoor = report.TraineesWithPoorRatings || [];

  div.innerHTML = `
    <div class="report-content">
      <h2>ILP - ${trainingTopic} Feedback — ${report.trainerName || ""}</h2>
      <div class="meta">
        <div><strong>Batch Name:</strong> ${report.batchName || ""}</div>
        <div><strong>Total Trainee Count:</strong> ${
          report.traineeCount || 0
        }</div>
        <div><strong>Trainer Name:</strong> ${report.trainerName || ""}</div>
        <div><strong>Overall Program Rating (out of 5):</strong> ${
          report.overallRating || 0
        }</div>
        ${
          TraineesWithPoor.length > 0
            ? `<div><strong>Trainees with "Very Poor" ratings:</strong> ${TraineesWithPoor.length}</div>`
            : ""
        }
      </div>
      <table>
        <tr>
          <th>Category</th>
          ${ratingLabels.map((l) => `<th>${l}</th>`).join("")}
          <th>Total</th>
        </tr>
        ${tableRows}
      </table>
      ${
        commentsWell.length > 0
          ? `
        <div class="section">
          <h3>What went well / things you most liked</h3>
          <ul>${commentsWell.map((c) => `<li>${c}</li>`).join("")}</ul>
        </div>`
          : ""
      }
      ${
        commentsImprove.length > 0
          ? `
        <div class="section">
          <h3>What needs improvement</h3>
          <ul>${commentsImprove.map((c) => `<li>${c}</li>`).join("")}</ul>
        </div>`
          : ""
      }
      ${
        TraineesWithPoor.length > 0
          ? `
        <div class="section">
          <h3>Trainees with "Very Poor" Ratings</h3>
          <p>The following Trainees gave "Very Poor" ratings:</p>
          <ul>${TraineesWithPoor.map((s) => `<li>${s}</li>`).join("")}</ul>
        </div>`
          : ""
      }
    </div>
    <div class="report-actions">
      <button onclick="downloadPDF(this)">
        <i class="fa-solid fa-arrow-down"></i> Download PDF
      </button>
    </div>
  `;

  output.appendChild(div);
  console.log("Finished generateReportHTML");
}

// Download single report as PDF
window.downloadPDF = async function (button) {
  const reportDiv = button.closest(".report").querySelector(".report-content");
  const { jsPDF } = window.jspdf;

  const canvas = await html2canvas(reportDiv, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");

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
};

// Download all reports as PDF
window.downloadAllReports = async function () {
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

  pdf.save(`${currentReportData.reportName}_All_Reports.pdf`);
};
