// ==========================================
// AUTH.JS — Firebase Authentication With Email Verification
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// ---------------- FIREBASE CONFIG ---------------- //
const firebaseConfig = {
  // Firebase
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

// ---------------- AUTO REDIRECT (ONLY IF VERIFIED) ---------------- //
onAuthStateChanged(auth, (user) => {
  if (user && user.emailVerified) {
    window.location.href = "src/pages/desg.html";
  }
});

// =======================================================
// LOGIN FUNCTION
// =======================================================
window.login = function () {
  const email = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMsg = document.getElementById("errorMsg");
  const successMsg = document.getElementById("successMsg");
  const loading = document.getElementById("loading");
  const btn = document.getElementById("loginBtn");

  errorMsg.style.display = "none";
  successMsg.style.display = "none";

  if (!email || !password) {
    errorMsg.textContent = "⚠️ Please fill in all fields.";
    errorMsg.style.display = "block";
    return;
  }

  loading.style.display = "block";
  btn.disabled = true;
  btn.textContent = "Signing In...";

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // BLOCK LOGIN IF NOT VERIFIED
      if (!user.emailVerified) {
        loading.style.display = "none";
        btn.disabled = false;
        btn.textContent = "Sign In";

        errorMsg.innerHTML = `
           Email not verified. Please check your inbox.<br><br>
          <button id="resendBtn" style="
            padding: 6px 10px;
            border: none;
            background: #007bff;
            color: white;
            border-radius: 5px;
            cursor: pointer;
          ">Resend Verification Email</button>
        `;
        errorMsg.style.display = "block";

        // RESEND VERIFICATION
        document.getElementById("resendBtn").onclick = () => {
          sendEmailVerification(user)
            .then(() => {
              successMsg.textContent = "Verification email resent!";
              successMsg.style.display = "block";
            })
            .catch((err) => {
              errorMsg.textContent = err.message;
              errorMsg.style.display = "block";
            });
        };

        signOut(auth);
        return;
      }

      // VERIFIED → PROCEED
      loading.style.display = "none";
      successMsg.style.display = "block";
      btn.textContent = "Redirecting...";

      setTimeout(() => {
        window.location.href = "src/pages/desg.html";
      }, 1000);
    })
    .catch((error) => {
      loading.style.display = "none";
      btn.disabled = false;
      btn.textContent = "Sign In";
      errorMsg.textContent = error.message;
      errorMsg.style.display = "block";
    });
};

// =======================================================
// SIGNUP FUNCTION WITH EMAIL VERIFICATION
// =======================================================
window.signup = function () {
  const email = document.getElementById("signupEmail").value.trim();
  const pass = document.getElementById("signupPassword").value.trim();
  const confirm = document.getElementById("signupConfirm").value.trim();

  const errorMsg = document.getElementById("signupError");
  const successMsg = document.getElementById("signupSuccess");

  errorMsg.style.display = "none";
  successMsg.style.display = "none";

  if (!email || !pass || !confirm) {
    errorMsg.textContent = "⚠️ All fields are required.";
    errorMsg.style.display = "block";
    return;
  }

  if (pass !== confirm) {
    errorMsg.textContent = "⚠️ Passwords do not match.";
    errorMsg.style.display = "block";
    return;
  }

  createUserWithEmailAndPassword(auth, email, pass)
    .then((userCredential) => {
      const user = userCredential.user;

      // SEND VERIFICATION EMAIL
      sendEmailVerification(user)
        .then(() => {
          successMsg.textContent =
            "Account created! A verification email has been sent. Please verify before logging in.";
          successMsg.style.display = "block";
        })
        .catch((err) => {
          errorMsg.textContent =
            "Failed to send verification email: " + err.message;
          errorMsg.style.display = "block";
        });
    })
    .catch((error) => {
      errorMsg.textContent = error.message;
      errorMsg.style.display = "block";
    });
};
