/**

 * For development: Variables are loaded from window._env_ (set via build process)
 * For production: Variables should be injected at runtime
 */

// Load environment variables from window._env_ object
// This object is populated by your build tool or HTML script
const getEnvVar = (key) => {
  if (typeof window !== "undefined" && window._env_ && window._env_[key]) {
    return window._env_[key];
  }

  // Fallback: Return empty string if not found
  console.warn(`Environment variable ${key} not found`);
  return "";
};

export const envConfig = {
  // Gemini API
  geminiApiKey: getEnvVar("VITE_GEMINI_API_KEY"),
  geminiEndpoint:
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",

  // Firebase Configuration
  firebase: {
    apiKey: getEnvVar("VITE_FIREBASE_API_KEY"),
    authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN"),
    databaseURL: getEnvVar("VITE_FIREBASE_DATABASE_URL"),
    projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnvVar("VITE_FIREBASE_APP_ID"),
    measurementId: getEnvVar("VITE_FIREBASE_MEASUREMENT_ID"),
  },
};

// Validate that critical environment variables are set
const validateEnv = () => {
  const requiredVars = [
    "VITE_GEMINI_API_KEY",
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_PROJECT_ID",
  ];

  const missing = requiredVars.filter((varName) => !getEnvVar(varName));

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

// Run validation
validateEnv();

export default envConfig;
