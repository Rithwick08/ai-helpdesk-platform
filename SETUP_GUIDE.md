# 🛡️ AI-Powered Cybersecurity & IT Helpdesk Platform — Complete Setup Guide

> This guide is written for **anyone** who wants to run this project from scratch on their own machine.
> Follow every step in order. Do not skip steps.

---

## 📋 Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Clone the Repository](#2-clone-the-repository)
3. [API Keys & Third-Party Services](#3-api-keys--third-party-services)
4. [Database Setup (PostgreSQL)](#4-database-setup-postgresql)
5. [Backend Setup (FastAPI)](#5-backend-setup-fastapi)
6. [Frontend Setup (React + Vite)](#6-frontend-setup-react--vite)
7. [Running the Full Application](#7-running-the-full-application)
8. [Telephony / Voice Feature (Optional)](#8-telephony--voice-feature-optional)
9. [Default Login Credentials](#9-default-login-credentials)
10. [Project Structure Overview](#10-project-structure-overview)
11. [Common Errors & Fixes](#11-common-errors--fixes)

---

## 1. System Requirements

Make sure the following are installed on your machine before starting:

| Tool | Minimum Version | How to Check |
|------|----------------|--------------|
| **Python** | 3.10+ | `python3 --version` |
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **PostgreSQL** | 14+ | `psql --version` |
| **Git** | Any | `git --version` |

### Installing Prerequisites (macOS)

```bash
# Install Homebrew if not installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python 3
brew install python3

# Install Node.js (includes npm)
brew install node

# Install PostgreSQL
brew install postgresql@14
brew services start postgresql@14
```

### Installing Prerequisites (Ubuntu/Debian Linux)

```bash
sudo apt update

# Python 3
sudo apt install python3 python3-pip python3-venv -y

# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# PostgreSQL
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Installing Prerequisites (Windows)

- Python: https://www.python.org/downloads/
- Node.js: https://nodejs.org/
- PostgreSQL: https://www.postgresql.org/download/windows/
- Git: https://git-scm.com/download/win

> ⚠️ On Windows, use **Git Bash** or **WSL2** (Windows Subsystem for Linux) to run all shell commands below.

---

## 2. Clone the Repository

```bash
git clone https://github.com/Rithwick08/ai-helpdesk-platform.git
cd ai-helpdesk-platform
```

---

## 3. API Keys & Third-Party Services

This project uses **four** external APIs. You need to sign up and get keys for each one.

### 3.1 Groq API (AI / LLM Engine)

The backend uses Groq to run LLaMA models for all AI chat features.

1. Go to: https://console.groq.com/
2. Sign up for a free account.
3. Navigate to **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

> 💡 You can create multiple Groq keys (the project supports up to 4 for load balancing).

---

### 3.2 Deepgram API (Speech-to-Text)

Used for live voice transcription during AI phone calls.

1. Go to: https://console.deepgram.com/
2. Sign up for a free account (includes free credits).
3. Go to **API Keys** → **Create a New API Key**
4. Copy the key (a long hex string like `be81202d...`)

---

### 3.3 Sarvam AI API (Text-to-Speech)

Used for generating spoken voice responses during AI phone calls.

1. Go to: https://www.sarvam.ai/
2. Sign up and navigate to the Developer Console.
3. Create an API Key.
4. Copy the key (starts with `sk_...`)

---

### 3.4 Twilio (Phone Call Infrastructure) — *Optional for Voice Feature*

Required only if you want to use the **AI Voice Phone Agent** feature.

1. Go to: https://www.twilio.com/
2. Sign up for a free trial account.
3. From the Twilio Console, note down:
   - **Account SID** (starts with `AC...`)
   - **Auth Token**
   - **Phone Number** (buy a trial number, e.g. `+15173144869`)
4. See [Section 8](#8-telephony--voice-feature-optional) for webhook configuration.

---

## 4. Database Setup (PostgreSQL)

### 4.1 Create the Database and User

Open a terminal and run:

```bash
# On macOS/Linux — enter the PostgreSQL shell
psql postgres
```

```sql
-- Inside psql, run these commands:

-- Create a dedicated database user
CREATE USER your_db_username WITH PASSWORD 'your_db_password';

-- Create the database
CREATE DATABASE ai_helpdesk;

-- Grant all privileges on the database to your user
GRANT ALL PRIVILEGES ON DATABASE ai_helpdesk TO your_db_username;

-- Exit psql
\q
```

> ⚠️ Remember the username and password you just set — you'll need them in the `.env` file next.

---

### 4.2 Verify Database Connection

```bash
psql -U your_db_username -d ai_helpdesk -h localhost
# If it opens a prompt without error, you're good. Type \q to exit.
```

---

## 5. Backend Setup (FastAPI)

### 5.1 Navigate to the Backend Directory

```bash
cd backend
```

---

### 5.2 Create and Activate a Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate

# On Windows (Git Bash or WSL):
source venv/Scripts/activate

# You should see (venv) in your terminal prompt
```

---

### 5.3 Install Python Dependencies

```bash
pip install --upgrade pip
pip install -r ../requirements.txt
```

Additionally, install the Twilio library (not in requirements.txt):

```bash
pip install twilio
```

---

### 5.4 Create the Backend `.env` File

Create a file named `.env` inside the `backend/` folder:

```bash
# Make sure you are in the backend/ directory
touch .env
```

Open `backend/.env` in a text editor and add the following. **Replace all placeholder values** with your actual credentials:

```env
# ── Database ───────────────────────────────────────────────────────────────────
DB_USER=your_db_username
DB_PASSWORD=your_db_password
DB_NAME=ai_helpdesk

# ── Groq AI (LLM) ─────────────────────────────────────────────────────────────
# Primary key (required)
GROQ_API_KEY=gsk_your_primary_groq_key_here

# Optional additional keys for load balancing (can be same as primary if you only have one)
GROQ_API_KEY_1=gsk_your_groq_key_1_here
GROQ_API_KEY_2=gsk_your_groq_key_2_here
GROQ_API_KEY_3=gsk_your_groq_key_3_here

# ── Deepgram (Speech-to-Text) ──────────────────────────────────────────────────
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# ── Sarvam AI (Text-to-Speech) ────────────────────────────────────────────────
SARVAM_API_KEY=sk_your_sarvam_api_key_here

# ── Twilio Telephony (Optional — needed only for voice call feature) ────────────
TWILIO_ACCOUNT_SID=ACyour_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_WEBHOOK_URL=https://your-tunnel-url.trycloudflare.com/telephony/incoming
TWILIO_VALIDATE_SIGNATURE=false
```

> ⚠️ **Security Warning**: Never commit your `.env` file to git. The `.gitignore` already excludes it.
> 
> ℹ️ `TWILIO_VALIDATE_SIGNATURE=false` is fine for local development. Set it to `true` in production.

---

### 5.5 Create Database Tables

From inside the `backend/` directory (with venv active):

```bash
python create_tables.py
```

Expected output:
```
Tables Created Successfully!
```

---

### 5.6 Seed Default Users

```bash
python seed_users.py
```

Expected output:
```
Created user: admin@cybershield.ai
Created user: employee@cybershield.ai
Created user: it@cybershield.ai
Created user: soc@cybershield.ai
Seeding complete. Password for all users is: password123
```

---

### 5.7 Start the Backend Server

```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

If successful, you will see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

✅ **Backend is running at:** http://localhost:8000  
✅ **API Docs (Swagger UI) at:** http://localhost:8000/docs  
✅ **Health check:** http://localhost:8000/ → should return `{"message": "Backend Working"}`

---

## 6. Frontend Setup (React + Vite)

> Open a **new terminal window/tab** while the backend is still running.

### 6.1 Navigate to the Frontend Directory

```bash
# From the project root
cd frontend
```

---

### 6.2 Install Node Dependencies

```bash
npm install
```

---

### 6.3 Create the Frontend `.env` File

Create a file named `.env` inside the `frontend/` folder:

```bash
touch .env
```

Add the following content to `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

> This tells the React app where the backend API is running.

---

### 6.4 Start the Frontend Development Server

```bash
npm run dev
```

If successful, you will see:
```
  VITE v8.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

✅ **Frontend is running at:** http://localhost:5173

---

## 7. Running the Full Application

After completing all steps above, you should have two terminals open:

| Terminal | Command | URL |
|----------|---------|-----|
| **Terminal 1** — Backend | `uvicorn app:app --reload` | http://localhost:8000 |
| **Terminal 2** — Frontend | `npm run dev` | http://localhost:5173 |

Open your browser and go to **http://localhost:5173** to use the application.

---

## 8. Telephony / Voice Feature (Optional)

The AI Voice Phone Agent feature requires Twilio and a publicly accessible URL for webhooks.

### 8.1 Install Cloudflare Tunnel (Free, No Account Required)

Cloudflare Tunnel exposes your local backend server to the internet so Twilio can reach it.

```bash
# macOS
brew install cloudflared

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

### 8.2 Start the Tunnel

Make sure your backend is already running, then run:

```bash
cloudflared tunnel --url http://localhost:8000
```

You will get a public URL like:
```
https://camps-ons-playing-billing.trycloudflare.com
```

### 8.3 Update Your Backend `.env`

Update `backend/.env` with the new tunnel URL:

```env
TWILIO_WEBHOOK_URL=https://your-tunnel-url.trycloudflare.com/telephony/incoming
```

Restart your backend server after this change.

### 8.4 Configure Twilio Webhook

1. Go to the [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your phone number
4. Under **Voice & Fax → A Call Comes In**, set:
   - **Webhook**: `https://your-tunnel-url.trycloudflare.com/telephony/incoming`
   - **HTTP Method**: `HTTP POST`
5. Save the configuration

> ⚠️ The Cloudflare tunnel URL changes every time you restart `cloudflared`. Update it in both your `.env` and Twilio Console whenever you restart.

---

## 9. Default Login Credentials

After running `seed_users.py`, these accounts are available:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Admin** | admin@cybershield.ai | password123 | Full access — manage users, view all data |
| **Employee** | employee@cybershield.ai | password123 | Submit tickets, use AI assistant, training |
| **IT Support** | it@cybershield.ai | password123 | Manage IT tickets, view incidents |
| **SOC Analyst** | soc@cybershield.ai | password123 | View alerts, manage security incidents |

> 🔐 Change these passwords immediately in any production deployment.

---

## 10. Project Structure Overview

```
ai-helpdesk-platform/
├── backend/                    # FastAPI Python backend
│   ├── app.py                  # Main entry point — registers all routers
│   ├── database.py             # SQLAlchemy engine + session config
│   ├── create_tables.py        # Run once to create all DB tables
│   ├── seed_users.py           # Run once to seed default users
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # ← YOU MUST CREATE THIS (see Section 5.4)
│   │
│   ├── auth/                   # JWT auth, password hashing
│   ├── config/                 # AI model config (ai_config.py)
│   ├── models/                 # SQLAlchemy ORM models
│   ├── routes/                 # API route handlers
│   │   ├── auth.py             # Login / token
│   │   ├── user.py             # User management
│   │   ├── incident.py         # Security incidents
│   │   ├── alert.py            # Security alerts
│   │   ├── it_ticket.py        # IT support tickets
│   │   ├── assistant.py        # AI chat assistant
│   │   ├── dashboard.py        # Dashboard statistics
│   │   ├── training.py         # Security awareness training
│   │   ├── training_video.py   # Training videos
│   │   ├── password_reset.py   # Password reset flow
│   │   └── security_update.py  # Security updates/announcements
│   │
│   ├── services/               # Business logic services
│   ├── schemas/                # Pydantic request/response schemas
│   ├── agent/                  # AI agent orchestration logic
│   ├── tools/                  # AI tool definitions (for function calling)
│   │
│   └── voice/                  # AI Voice Phone Agent
│       ├── stt/                # Speech-to-Text (Deepgram)
│       ├── tts/                # Text-to-Speech (Sarvam AI)
│       ├── pipeline/           # STT → AI → TTS pipeline
│       └── telephony/          # Twilio phone call handling
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── main.jsx            # React entry point
│   │   ├── App.jsx             # Root app + routing
│   │   ├── pages/              # Full page components (Dashboard, Login, etc.)
│   │   ├── components/         # Reusable UI components
│   │   ├── api/                # Axios API client setup
│   │   ├── services/           # API service functions
│   │   ├── context/            # React context providers
│   │   ├── hooks/              # Custom React hooks
│   │   └── layouts/            # Layout components (sidebar, etc.)
│   ├── .env                    # ← YOU MUST CREATE THIS (see Section 6.3)
│   ├── package.json            # Node.js dependencies
│   └── vite.config.js          # Vite build config + WebSocket proxy
│
├── requirements.txt            # Python deps (used by backend/venv)
└── SETUP_GUIDE.md              # This file
```

---

## 11. Common Errors & Fixes

### ❌ `connection refused` or `could not connect to server` (PostgreSQL)

**Cause**: PostgreSQL is not running.

**Fix**:
```bash
# macOS
brew services start postgresql@14

# Linux
sudo systemctl start postgresql
```

---

### ❌ `FATAL: role "your_db_username" does not exist`

**Cause**: The database user doesn't exist yet.

**Fix**: Follow [Section 4.1](#41-create-the-database-and-user) to create the user.

---

### ❌ `ModuleNotFoundError: No module named 'fastapi'`

**Cause**: Python virtual environment is not activated, or dependencies not installed.

**Fix**:
```bash
cd backend
source venv/bin/activate   # activate the venv first
pip install -r ../requirements.txt
```

---

### ❌ `GROQ_API_KEY not found` or AI responses fail

**Cause**: The `.env` file is missing or has incorrect key names.

**Fix**: Double-check `backend/.env` has exactly `GROQ_API_KEY=gsk_...` (no spaces around `=`).

---

### ❌ Frontend shows network errors / can't reach backend

**Cause**: Backend is not running, or the `VITE_API_BASE_URL` is wrong.

**Fix**:
1. Confirm backend is running: visit http://localhost:8000 in your browser.
2. Check `frontend/.env` contains `VITE_API_BASE_URL=http://localhost:8000`.
3. Restart the frontend dev server after editing `.env`.

---

### ❌ `twilio` import error / voice calls not working

**Cause**: Twilio Python SDK is not installed (it's not in `requirements.txt`).

**Fix**:
```bash
cd backend
source venv/bin/activate
pip install twilio
```

---

### ❌ Twilio webhook failing / voice call drops immediately

**Cause**: Twilio cannot reach your local server because it's not publicly accessible.

**Fix**: Start a Cloudflare tunnel and update `TWILIO_WEBHOOK_URL` in `backend/.env`. See [Section 8](#8-telephony--voice-feature-optional).

---

### ❌ Port already in use

**Fix**:
```bash
# Find what is using port 8000
lsof -i :8000
# Kill that process (replace <PID> with the number shown)
kill -9 <PID>

# Or run backend on a different port
uvicorn app:app --reload --port 8001
# Then update frontend/.env accordingly:
# VITE_API_BASE_URL=http://localhost:8001
```

---

## ✅ Quick-Start Checklist

Copy this checklist and tick off each item as you go:

- [ ] Python 3.10+, Node.js 18+, PostgreSQL 14+ installed
- [ ] Repository cloned
- [ ] Groq API key obtained → https://console.groq.com/
- [ ] Deepgram API key obtained → https://console.deepgram.com/
- [ ] Sarvam AI API key obtained → https://www.sarvam.ai/
- [ ] PostgreSQL running, `ai_helpdesk` database created, user created
- [ ] `backend/venv` created and activated
- [ ] `pip install -r requirements.txt` completed
- [ ] `pip install twilio` completed
- [ ] `backend/.env` created with all keys and DB credentials filled in
- [ ] `python create_tables.py` ran successfully
- [ ] `python seed_users.py` ran successfully
- [ ] Backend server started (`uvicorn app:app --reload`)
- [ ] `frontend/node_modules` installed (`npm install`)
- [ ] `frontend/.env` created with `VITE_API_BASE_URL=http://localhost:8000`
- [ ] Frontend dev server started (`npm run dev`)
- [ ] Logged in at http://localhost:5173 with `admin@cybershield.ai` / `password123`
- [ ] *(Optional)* Twilio credentials added + Cloudflare tunnel running

---

*Built with ❤️ — FastAPI + React + PostgreSQL + Groq + Deepgram + Sarvam AI + Twilio*
