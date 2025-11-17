# Environment Configuration Setup Guide

## Overview

This project uses environment variables to keep sensitive information (API keys, Firebase credentials) secure and away from version control.

## Files Created

1. **`.env`** - Your actual environment variables (DO NOT commit to git)
2. **`.env.example`** - Template file showing what variables are needed (safe to commit)
3. **`.gitignore`** - Prevents `.env` from being committed
4. **`env-config.js`** - Module to access environment variables in your JavaScript code
5. **`env-loader.html`** - HTML script to load `.env` file in the browser

## Setup Instructions

### 1. Configure Your Environment Variables

The `.env` file is already created with your current values. If you need to update any values:

```env
# Gemini API Configuration
VITE_GEMINI_API_KEY=your_actual_api_key

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 2. Update Your HTML Files

Add the environment loader script at the **beginning** of your `<head>` section:

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Load environment variables first -->
    <script src="./env-loader.html"></script>

    <!-- Your other scripts and styles -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <!-- ... rest of your head ... -->
  </head>
  <body>
    <!-- ... your HTML content ... -->
  </body>
</html>
```

### 3. Update Your JavaScript Files

#### For `config.js`:

```javascript
// OLD (Hardcoded - UNSAFE)
window._env_ = {
  apiKey: "AIzaSyB1WuMsdZdPfuimZ7kfdeaeOsepRYOOSz8",
  // ... other keys
};

// NEW (Using environment variables)
// window._env_ is populated by env-loader.html automatically
```

#### For API Key Usage in JavaScript:

```javascript
// OLD (Hardcoded - UNSAFE)
const API_KEY = "AIzaSyAIjhn5kPPAYRjPrhZy2f8moH6ozfUaR2o";

// NEW (Using environment variables)
import { envConfig } from "./env-config.js";

const API_KEY = envConfig.geminiApiKey;
```

#### For Firebase Configuration:

```javascript
// OLD (Hardcoded - UNSAFE)
const firebaseConfig = {
  apiKey: "AIzaSyB1WuMsdZdPfuimZ7kfdeaeOsepRYOOSz8",
  // ... other config
};

// NEW (Using environment variables)
import { envConfig } from "./env-config.js";

const firebaseConfig = envConfig.firebase;
```

## Important Security Notes

⚠️ **NEVER commit `.env` to git!**

- The `.gitignore` file already prevents this
- Always use `.env.example` as a template for new team members
- Share `.env` values securely (email, secure password manager, etc.)

## For Team Members

When setting up the project:

1. Clone the repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with actual values (provided by project lead)
4. Never commit `.env`

## Development vs Production

### Development:

- Environment variables are loaded from `.env` file
- Use `env-loader.html` in your HTML files

### Production:

- Inject environment variables at build time or runtime
- Use environment variables from your hosting platform (GitHub Actions, Firebase Hosting, etc.)
- Example for GitHub Actions:
  ```yaml
  env:
    VITE_GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
    VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
  ```

## Accessing Environment Variables in Your Code

### Method 1: Using env-config.js (Recommended)

```javascript
import { envConfig } from "./env-config.js";

// Access Gemini API Key
const geminiKey = envConfig.geminiApiKey;

// Access Firebase config
const fbConfig = envConfig.firebase;
```

### Method 2: Direct from window object (After env-loader runs)

```javascript
const geminiKey = window._env_.VITE_GEMINI_API_KEY;
```

## Troubleshooting

### "Environment variable not found" warning

- Make sure `env-loader.html` script is loaded before your app code
- Check that `.env` file exists in the project root
- Verify the `.env` file is not in `.gitignore` (it shouldn't be, but check)

### Variables showing as empty

- Ensure `.env` file has correct syntax: `KEY=value`
- Check for typos in variable names
- Make sure `.env` file is in the root directory

### .env file being committed

- Run: `git rm --cached .env` to remove it from git tracking
- Verify `.gitignore` contains `.env`
- Check if you accidentally added `.env` to `.gitignore` exceptions

## Next Steps

1. Update `config.js` to remove hardcoded Firebase config
2. Update `final_index.js` to use `envConfig.geminiApiKey` instead of hardcoded key
3. Update `report-generation.js` to use `envConfig.geminiApiKey` instead of hardcoded key
4. Add `env-loader.html` script to all your HTML files
5. Test that the application still works with the new configuration

## References

- [Node.js dotenv package](https://github.com/motdotla/dotenv) (inspiration)
- [12 Factor App - Config](https://12factor.net/config)
- [Firebase Security Best Practices](https://firebase.google.com/support/guides/sensitive-data-in-firebase)
