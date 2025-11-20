// ===================================
// FILE 1: firebase-config.js
// Firebase initialization, authentication, and data management
// ===================================

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

const firebaseConfig = window._env_;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Global variables
export let questions = [];
export let trainers = [];

// ===================================
// AUTHENTICATION
// ===================================

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../../index.html";
  }
});

document.getElementById("logoutBtno")?.addEventListener("click", () => {
  signOut(auth)
    .then(() => {
      console.log("User signed out");
      window.location.href = "../../index.html";
    })
    .catch((error) => {
      console.error("Error signing out:", error);
    });
});

// ===================================
// FIREBASE DATA LOADING
// ===================================

window.onload = async () => {
  const dbRef = ref(db);
  try {
    const loadingEl = document.getElementById("loading");
    const outputEl = document.getElementById("output");

    if (loadingEl) loadingEl.style.display = "block";
    if (outputEl) outputEl.innerHTML = "";

    const snapshot = await get(child(dbRef, "questions"));
    if (snapshot.exists()) {
      const questionsObj = snapshot.val();
      questions = Object.values(questionsObj);
      console.log("Questions Array:", questions);
      renderQuestionList();
    } else {
      console.log("No questions found");
    }
  } catch (error) {
    console.error("Error fetching questions:", error);
  } finally {
    const loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.style.display = "none";
  }

  // Load trainers
  await loadTrainers();
};

// ===================================
// QUESTIONS MANAGEMENT
// ===================================

export function renderQuestionList() {
  const list = document.getElementById("questionList");
  if (!list) return;

  list.innerHTML = "";
  questions.forEach((q) => {
    const li = document.createElement("li");
    li.textContent = q;
    list.appendChild(li);
  });
}

export function openModal() {
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

export function closeModal() {
  document.getElementById("questionModal").style.display = "none";
}

export function addQuestion() {
  const container = document.getElementById("questionInputs");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter new question";
  container.appendChild(input);
}

export function saveQuestions() {
  const inputs = document.querySelectorAll("#questionInputs input");
  questions = [];
  inputs.forEach((inp) => {
    if (inp.value.trim() !== "") questions.push(inp.value.trim());
  });

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
}

// ===================================
// TRAINERS MANAGEMENT
// ===================================

export async function loadTrainers() {
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

export function renderTrainerDropdown() {
  const select = document.getElementById("trainerNameSelect");
  if (!select) return;

  select.innerHTML = "";
  trainers.forEach((t) => {
    const option = document.createElement("option");
    option.value = t;
    option.textContent = t;
    select.appendChild(option);
  });
}

export function openTrainerModal() {
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

export function closeTrainerModal() {
  document.getElementById("trainerModal").style.display = "none";
}

export function addTrainer() {
  const container = document.getElementById("trainerInputs");
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter trainer name";
  container.appendChild(input);
}

export function saveTrainers() {
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

// ===================================
// REPORT HISTORY MANAGEMENT
// ===================================

export async function saveReportToHistory() {
  const reportName = document.getElementById("reportName").value.trim();

  if (!reportName) {
    showMessage("error", "Please enter a report name");
    return;
  }

  const currentReportData = window.prepareReportData?.();

  if (!currentReportData || currentReportData.length === 0) {
    showMessage("error", "No report data to save");
    return;
  }

  try {
    showLoading("Saving report...");

    const timestamp = Date.now();
    const date = new Date(timestamp);
    const formattedDate = date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const formattedTime = date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const historyEntry = {
      reportName,
      reportType:
        window.fileType === "single_trainer"
          ? "Single Trainer"
          : "Multiple Trainers",
      trainingTopic: window.trainingTopic || "Tech Fundamentals",
      timestamp,
      date: formattedDate,
      time: formattedTime,
      reports: currentReportData,
      questionsUsed: [...questions],
      fileInfo: {
        traineeCount: window.excelRows?.length || 0,
        trainerCount: currentReportData.length,
      },
    };

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

export function openSaveReportModal() {
  document.getElementById("saveReportModal").style.display = "flex";
  document.getElementById("reportName").value = "";
}

export function closeSaveReportModal() {
  document.getElementById("saveReportModal").style.display = "none";
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

export function showLoading(message = "Loading...") {
  const loadingDiv = document.getElementById("loading");
  if (loadingDiv) {
    loadingDiv.querySelector("div:last-child").textContent = message;
    loadingDiv.style.display = "flex";
  }
}

export function hideLoading() {
  const loadingEl = document.getElementById("loading");
  if (loadingEl) loadingEl.style.display = "none";
}

export function showMessage(type, message) {
  const existingMsg = document.querySelector(".error, .success");
  if (existingMsg) existingMsg.remove();

  const msgDiv = document.createElement("div");
  msgDiv.className = type;
  msgDiv.textContent = message;
  document.getElementById("dashboardPage");
}

// Make functions globally accessible
window.openModal = openModal;
window.closeModal = closeModal;
window.addQuestion = addQuestion;
window.saveQuestions = saveQuestions;
window.openTrainerModal = openTrainerModal;
window.closeTrainerModal = closeTrainerModal;
window.addTrainer = addTrainer;
window.saveTrainers = saveTrainers;
window.openSaveReportModal = openSaveReportModal;
window.closeSaveReportModal = closeSaveReportModal;
window.saveReportToHistory = saveReportToHistory;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showMessage = showMessage;
