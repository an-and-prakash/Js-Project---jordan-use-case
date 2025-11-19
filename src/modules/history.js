// history.js

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
  remove,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = window._env_;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let allHistory = [];
let filteredHistory = [];

// Auth check
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../../index.html";
  } else {
    loadHistory();
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

// Load history from Firebase
async function loadHistory() {
  const loading = document.getElementById("loading");
  const tableContainer = document.getElementById("historyTableContainer");
  const emptyState = document.getElementById("emptyState");

  loading.style.display = "block";
  tableContainer.style.display = "none";

  try {
    const historyRef = ref(db, "history");
    const snapshot = await get(historyRef);

    if (snapshot.exists()) {
      const historyObj = snapshot.val();
      allHistory = Object.keys(historyObj).map((key) => ({
        id: key,
        ...historyObj[key],
      }));

      // Sort by timestamp (newest first)
      allHistory.sort((a, b) => b.timestamp - a.timestamp);

      filteredHistory = [...allHistory];
      renderHistoryTable();

      tableContainer.style.display = "block";
      emptyState.classList.add("hidden");
    } else {
      tableContainer.style.display = "block";
      emptyState.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error loading history:", error);
    alert("Failed to load history. Please try again.");
  } finally {
    loading.style.display = "none";
  }
}

// Render history table
function renderHistoryTable() {
  const tbody = document.getElementById("historyTableBody");
  tbody.innerHTML = "";

  if (filteredHistory.length === 0) {
    document.getElementById("emptyState").classList.remove("hidden");
    return;
  }

  document.getElementById("emptyState").classList.add("hidden");

  filteredHistory.forEach((entry) => {
    const row = document.createElement("tr");

    const typeClass =
      entry.reportType === "Single Trainer"
        ? "single-trainer"
        : "multiple-trainers";
    const trainerNames = entry.reports.map((r) => r.trainerName).join(", ");
    const trainerCount = entry.reports.length;
    const traineeCount =
      entry.fileInfo?.traineeCount || entry.reports[0]?.traineeCount || 0;

    row.innerHTML = `
            <td><strong>${entry.reportName}</strong></td>
            <td>${entry.date}</td>
            <td>${entry.time}</td>
            <td>
                <span class="report-type-badge ${typeClass}">
                    ${entry.reportType}
                </span>
            </td>
            <td title="${trainerNames}">
                ${trainerCount} trainer${trainerCount > 1 ? "s" : ""}
            </td>
            <td>${traineeCount}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn view-btn" onclick="viewReport('${
                      entry.id
                    }')">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteReport('${
                      entry.id
                    }', '${entry.reportName}')">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;

    tbody.appendChild(row);
  });
}

// Search functionality
document.getElementById("searchInput").addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  filterHistory();
});

// Filter functionality
window.filterHistory = function () {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const typeFilter = document.getElementById("typeFilter").value;

  filteredHistory = allHistory.filter((entry) => {
    const matchesSearch =
      entry.reportName.toLowerCase().includes(searchTerm) ||
      entry.reports.some((r) =>
        r.trainerName.toLowerCase().includes(searchTerm)
      );

    const matchesType = typeFilter === "all" || entry.reportType === typeFilter;

    return matchesSearch && matchesType;
  });

  renderHistoryTable();
};

// View report
window.viewReport = function (reportId) {
  // Store report ID in localStorage to retrieve on view page
  localStorage.setItem("viewReportId", reportId);
  window.location.href = "view_report.html";
};

// Delete report
window.deleteReport = async function (reportId, reportName) {
  if (!confirm(`Are you sure you want to delete "${reportName}"?`)) {
    return;
  }

  try {
    const reportRef = ref(db, `history/${reportId}`);
    await remove(reportRef);

    // Remove from local array
    allHistory = allHistory.filter((entry) => entry.id !== reportId);
    filteredHistory = filteredHistory.filter((entry) => entry.id !== reportId);

    renderHistoryTable();

    // Show success message
    showToast("Report deleted successfully", "success");
  } catch (error) {
    console.error("Error deleting report:", error);
    showToast("Failed to delete report. Please try again.", "error");
  }
};

// Toast notification
function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "success" ? "#28a745" : "#dc3545"};
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add animation styles
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
