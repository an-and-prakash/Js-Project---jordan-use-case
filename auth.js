    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
    import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } 
      from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

    // Your Firebase config
    const firebaseConfig = {
      apiKey: "AIzaSyB1WuMsdZdPfuimZ7kfdeaeOsepRYOOSz8",
      authDomain: "js-project-55861.firebaseapp.com",
      databaseURL: "https://js-project-55861-default-rtdb.firebaseio.com",
      projectId: "js-project-55861",
      storageBucket: "js-project-55861.firebasestorage.app",
      messagingSenderId: "792815063603",
      appId: "1:792815063603:web:6d84def26f72886583c946",
      measurementId: "G-0SCRHVW7Y1"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // ✅ Auto redirect if user is already signed in
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Already signed in as:", user.email);
        window.location.href = "desg.html";
      }
    });

    // ✅ Login function
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
          loading.style.display = "none";
          successMsg.style.display = "block";
          btn.textContent = "Redirecting...";
          setTimeout(() => {
            window.location.href = "combied.html";
          }, 1200);
        })
        .catch((error) => {
          loading.style.display = "none";
          btn.disabled = false;
          btn.textContent = "Sign In";
          errorMsg.textContent = error.message;
          errorMsg.style.display = "block";
        });
    };

    
    document.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        login();
      }
    });