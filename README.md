# 🛡️ Flinch Auditor
**Real-time GenAI Data Leak Prevention (DLP)**

Flinch Auditor is a zero-trust security layer designed for corporate teams using ChatGPT, Claude, and Gemini. It intercepts sensitive data (PII, Credentials, API Keys) locally before it ever reaches third-party AI servers.

### 🌟 Key Features
- **Deterministic & Semantic Detection:** Uses Microsoft Presidio for high-accuracy PII catching.
- **Just-in-Time Training:** Alerts employees in real-time, reducing repeat violations.
- **CISO Oversight:** Real-time dashboard for monitoring organizational risk without storing private chat content.

### 📁 Repository Structure
- `/chrome-extension`: The browser-side interception engine.
- `/backend`: Node.js/FastAPI logic for high-speed analysis.
- `/dashboard`: React-based audit trail for compliance teams.

---
*Developed by Aniket Singh | Cybersecurity Research @ MAHE*
