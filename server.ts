import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (using environment variables or default credentials)
// In this environment, we'll use the client SDK for simplicity if admin isn't configured,
// but for a "production-ready" MVP, we'd use admin.
// For now, I'll implement the analysis logic and use a mock/simple logging.

const app = express();
app.use(express.json());

const PORT = 3000;

// PII & Credential Patterns
const PATTERNS = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
  AWS_KEY: /\bAKIA[0-9A-Z]{16}\b/g,
  AWS_SECRET: /\b[0-9a-zA-Z+/]{40}\b/g,
  BEARER_TOKEN: /\bBearer\s+[a-zA-Z0-9._~+/-]+\b/gi,
  PROPRIETARY_CODE: /\/\/\s*CONFIDENTIAL\s*PROPRIETARY|Copyright\s*\(c\)\s*20\d{2}\s*Internal\s*Use\s*Only/gi,
};

interface AnalysisResult {
  violationType: string;
  severity: 'LOW' | 'HIGH' | 'CRITICAL';
  detected: string[];
}

function analyzePrompt(text: string): AnalysisResult[] {
  const results: AnalysisResult[] = [];

  if (PATTERNS.EMAIL.test(text)) {
    results.push({ violationType: 'EMAIL', severity: 'LOW', detected: text.match(PATTERNS.EMAIL) || [] });
  }
  if (PATTERNS.SSN.test(text)) {
    results.push({ violationType: 'SSN', severity: 'CRITICAL', detected: text.match(PATTERNS.SSN) || [] });
  }
  if (PATTERNS.AWS_KEY.test(text)) {
    results.push({ violationType: 'AWS_KEY', severity: 'HIGH', detected: text.match(PATTERNS.AWS_KEY) || [] });
  }
  if (PATTERNS.BEARER_TOKEN.test(text)) {
    results.push({ violationType: 'BEARER_TOKEN', severity: 'HIGH', detected: text.match(PATTERNS.BEARER_TOKEN) || [] });
  }
  if (PATTERNS.PROPRIETARY_CODE.test(text)) {
    results.push({ violationType: 'PROPRIETARY_CODE', severity: 'HIGH', detected: text.match(PATTERNS.PROPRIETARY_CODE) || [] });
  }

  return results;
}

// API Endpoints
app.post('/api/analyze', (req, res) => {
  const { prompt, platform, userHash, organizationId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const violations = analyzePrompt(prompt);
  
  // In a real app, we'd log to Firestore here.
  // For the MVP, we return the violations so the extension can handle the UI.
  res.json({
    safe: violations.length === 0,
    violations,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Flinch Auditor Server running on http://localhost:${PORT}`);
  });
}

startServer();
