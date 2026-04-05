/**
 * Flinch Auditor - Content Script
 * Intercepts AI prompts and analyzes for sensitive data.
 */

const API_URL = 'http://localhost:3000/api/analyze'; // Update with production URL
const ORG_ID = 'ORG_DEMO_123';

// Platform Detection
const PLATFORM = window.location.hostname.includes('chatgpt') ? 'ChatGPT' :
                 window.location.hostname.includes('claude') ? 'Claude' : 'Gemini';

// Selectors for different platforms
const SELECTORS = {
  ChatGPT: {
    input: '#prompt-textarea',
    button: 'button[data-testid="send-button"]'
  },
  Claude: {
    input: 'div[contenteditable="true"]',
    button: 'button[aria-label="Send Message"]'
  },
  Gemini: {
    input: 'div[contenteditable="true"]',
    button: 'button[aria-label="Send message"]'
  }
};

async function checkPrompt(text) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: text,
        platform: PLATFORM,
        organizationId: ORG_ID,
        userHash: btoa(navigator.userAgent).substring(0, 16) // Simple anonymized hash
      })
    });
    return await response.json();
  } catch (err) {
    console.error('Flinch: Backend unreachable', err);
    return { safe: true }; // Fail open for MVP, or fail closed for high security
  }
}

function showOverlay(violations, onBypass) {
  const overlay = document.createElement('div');
  overlay.id = 'flinch-overlay';
  overlay.innerHTML = `
    <div class="flinch-modal">
      <div class="flinch-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flinch-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>
        <h2>Flinch Alert: Sensitive Data Detected</h2>
      </div>
      <div class="flinch-body">
        <p>Sharing this information violates <strong>Corporate Policy Section 4.2</strong>.</p>
        <div class="flinch-violations">
          ${violations.map(v => `<div class="violation-item"><strong>${v.violationType}</strong>: ${v.severity} Severity</div>`).join('')}
        </div>
        <p class="flinch-footer">This incident has been logged for compliance auditing (SOC 2 / GDPR).</p>
      </div>
      <div class="flinch-actions">
        <button id="flinch-cancel" class="btn-secondary">Cancel & Edit</button>
        <button id="flinch-bypass" class="btn-danger">Request Exception</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('flinch-cancel').onclick = () => overlay.remove();
  document.getElementById('flinch-bypass').onclick = () => {
    const reason = prompt('Please provide a business justification for this exception:');
    if (reason) {
      onBypass(reason);
      overlay.remove();
    }
  };
}

// Intercept Logic
document.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    const selector = SELECTORS[PLATFORM];
    const input = document.querySelector(selector.input);
    if (input && input.innerText.trim()) {
      e.preventDefault();
      e.stopPropagation();
      
      const result = await checkPrompt(input.innerText);
      if (!result.safe) {
        showOverlay(result.violations, (reason) => {
          // Log override and allow send
          console.log('Flinch: Override logged', reason);
          // Trigger original send logic here
        });
      } else {
        // Allow original Enter behavior
      }
    }
  }
}, true);
