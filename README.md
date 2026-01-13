# 🛡️ GuardianAI: Intelligence-Driven Security Analysis SaaS

GuardianAI is a next-generation security orchestration and analysis platform. It combines industry-standard security engines with Advanced Large Language Models (LLMs) to not only detect vulnerabilities but to provide production-ready fixes and deep analytical reasoning.

![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Next.js](https://img.shields.io/badge/next.js-14-black)
![Docker](https://img.shields.io/badge/docker-ready-blue)

## 🚀 Key Features

- **Multi-Engine Scanning**: Integrated with **Semgrep**, **CodeQL**, and **OWASP ZAP** for comprehensive Static (SAST) and Dynamic (DAST) analysis.
- **AI-Powered Synthesis**: Automatically normalizes hundreds of raw tool findings into a clean, actionable report using state-of-the-art LLMs.
- **Autonomous Fix Engine**: Generates precise code snippets and unified diffs to fix detected vulnerabilities instantly.
- **Real-time Pipeline Monitoring**: Live execution logs and progress tracking for ongoing security audits.
- **Interactive Dashboard**: Professional-grade UI for managing projects, scanning GitHub repositories, and analyzing posture.
- **Direct Repository Integration**: Scan any public or private GitHub repository (via access tokens).

## 🛠️ Tech Stack

### **Core Infrastructure**
- **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion, Lucide-React.
- **Backend**: FastAPI (Asynchronous Python), Pydantic, Motor (MongoDB Driver).
- **Database**: MongoDB (Primary store), SQLAlchemy (Optional SQLite fallback).

### **Security Arsenal**
- **Static Analysis (SAST)**:
  - **Semgrep**: Fast, pattern-based scanning for 30+ languages.
  - **CodeQL**: Deep semantic analysis to find complex data flow vulnerabilities.
- **Dynamic Analysis (DAST)**:
  - **OWASP ZAP**: Automated baseline scanning for deployed web applications.

---

## ⚙️ Installation & Setup

### **Prerequisites**
- Docker & Docker Compose
- Node.js 18+ (for local frontend development)
- Python 3.10+ (for local backend development)

### **1. Clone the Repository**
```bash
git clone https://github.com/your-username/guardian-ai.git
cd guardian-ai
```

### **2. Environment Configuration**
Create a `.env` file in the `backend/` directory:
```env
# Database Settings
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=security_saas

# AI & LLM Settings
OPENROUTER_API_KEY=your_openrouter_key

# Security Credentials
GITHUB_TOKEN=your_github_personal_access_token
SECRET_KEY=generate_a_secure_random_string
```

---

## 🐳 Docker Deployment (Recommended)

The easiest way to run the entire stack (including security tools) is using Docker Compose.

```bash
cd backend
docker-compose up --build -d
```

*Note: For the backend to communicate with a local MongoDB, ensure `MONGODB_URL` is set to `mongodb://host.docker.internal:27017`.*

---

## 💻 Local Development

### **Backend Setup**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

### **Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

---

## 🏗️ Architecture Overview

1.  **Target Selection**: User provides a GitHub URL or a live Endpoint.
2.  **Orchestration**: `ScanJob` initializes a temporary environment and clones the code.
3.  **Static Analysis**: Semgrep and CodeQL run in parallel to identify pattern-based and data-flow bugs.
4.  **Dynamic Analysis**: OWASP ZAP crawls the live endpoint for runtime vulnerabilities.
5.  **AI Normalization**: The `LLMService` processes raw results, removes duplicates, and adds developer-friendly descriptions/fixes.
6.  **Reporting**: A unified JSON report is generated and stored for UI rendering.

---

## 🤝 Contributing
Contributions are welcome! Please follow the standard fork-and-pull-request workflow.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---
*Created with ❤️ by Sameer Malik*
