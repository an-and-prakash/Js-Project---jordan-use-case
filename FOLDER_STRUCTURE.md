# Project Folder Structure

## Overview

This project is organized into a clean, modular structure for better maintainability and scalability.

```
js_project/
├── src/                          # Source code directory
│   ├── modules/                  # Core JavaScript modules
│   │   ├── firebase-config.js    # Firebase configuration and DB operations
│   │   ├── env-config.js         # Environment configuration (API keys, endpoints)
│   │   ├── auth.js               # Authentication logic
│   │   └── report-generation.js  # Report generation engine
│   │
│   ├── styles/                   # Stylesheets
│   │   ├── final_style.css       # Main styles for dashboard and reports
│   │   ├── login.css             # Login page styles
│   │   ├── history_style.css     # History page styles
│   │   └── view_report.css       # Report viewing page styles
│   │
│   ├── pages/                    # HTML pages
│   │   ├── index.html            # Main dashboard/home page
│   │   ├── login.html            # Login page
│   │   ├── history.html          # Report history page
│   │   ├── view_report.html      # Report viewing page
│   │   ├── desg.html             # Report generation dashboard
│   │   └── env-loader.html       # Environment loader script
│   │
│   └── config/                   # Configuration files
│       ├── .env                  # Environment variables (local, NOT in git)
│       └── .env.example          # Example environment template
│
├── docs/                         # Documentation
│   ├── ENV_SETUP.md             # Environment setup guide
│   ├── SECURITY_SETUP.md        # Security implementation guide
│   ├── DYNAMIC_TOPIC_IMPLEMENTATION.md  # Training topic feature docs
│   └── FOLDER_STRUCTURE.md      # This file
│
├── references/                   # Reference materials and external resources
│
├── .git/                        # Git repository
├── .gitignore                   # Git ignore rules
├── .vscode/                     # VS Code workspace settings
├── README.md                    # Project overview and setup guide
├── config.js                    # Legacy config file (to be migrated)
└── view_report.js              # Report viewing page script
```

## Directory Details

### `/src/modules/` - Core Business Logic

- **firebase-config.js** - Firebase Realtime Database setup, authentication, and data operations
- **env-config.js** - Centralized environment variable management (API keys, endpoints)
- **auth.js** - User authentication and session management
- **report-generation.js** - Excel processing, report generation, PDF exports

### `/src/styles/` - Styling Assets

- **final_style.css** - Primary stylesheet (dashboard, reports, tables, charts)
- **login.css** - Authentication page styling
- **history_style.css** - Report history view styling
- **view_report.css** - Saved report viewing styling

### `/src/pages/` - HTML Templates

- **index.html** - Main application entry point
- **login.html** - Authentication interface
- **desg.html** - Report generation dashboard
- **history.html** - View saved reports
- **view_report.html** - Display individual report
- **env-loader.html** - Environment setup helper

### `/src/config/` - Configuration

- **.env** - Local environment variables (DO NOT commit)
- **.env.example** - Template for environment setup

### `/docs/` - Documentation

- Setup guides
- Feature implementation documentation
- Architecture notes

## Import Paths

When importing modules, use relative paths:

```javascript
// From any page:
import { db, showMessage } from "../modules/firebase-config.js";
import { envConfig } from "../modules/env-config.js";
import { generateReports } from "../modules/report-generation.js";
```

## Best Practices

1. **Modules** contain pure business logic - no HTML generation
2. **Pages** contain HTML templates and import modules as needed
3. **Styles** are organized by page/feature
4. **Config** files are environment-specific and secure
5. **Docs** are always up-to-date with implementation

## Migration Notes

- Legacy files (`config.js`, root-level scripts) should be migrated into `/src/modules/`
- HTML files are currently in root but should move to `/src/pages/` once build system is in place
- Update import paths when moving files
