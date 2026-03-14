// Per-Model Impact Data (Per 1 Million Tokens)
// Values converted to per-token rates
const MODEL_IMPACT = {
  claude: { energy: 6.864 / 1000000, co2: 2.704 / 1000000, water: 33.50 / 1000000, cost: 0.132 / 1000000 },
  gemini: { energy: 6.864 / 1000000, co2: 2.704 / 1000000, water: 33.50 / 1000000, cost: 0.132 / 1000000 },
  gpt: { energy: 13.728 / 1000000, co2: 5.409 / 1000000, water: 66.99 / 1000000, cost: 1.81 / 1000000 },
  average: {
      energy: ((6.864 + 6.864 + 13.728) / 3) / 1000000,
      co2: ((2.704 + 2.704 + 5.409) / 3) / 1000000,
      water: ((33.50 + 33.50 + 66.99) / 3) / 1000000,
      cost: ((0.132 + 0.132 + 1.81) / 3) / 1000000
  }
};

// Default stats
const defaultStats = {
  tokensUsed: 0, // Legacy fallback
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  promptsSent: 0,
  repeatedPrompts: 0,
  energyConsumed: 0,
  waterConsumed: 0,
  co2Emitted: 0,
  costEstimated: 0,
  efficiencyScore: 100,
  aiUsage: {},
  last_prompts: []
};

// ─── updateScore ───────────────────────────────────────────────────────────────────
// Reads last_prompts from COMMITTED storage and recomputes score + alerts.
// Must be called AFTER chrome.storage.local.set() to ensure data is current.
function updateScore() {
    chrome.storage.local.get(["stats"], (result) => {
        const stats = result.stats || {};
        const prompts = stats.last_prompts || [];

        let score = 100;
        const alerts = [];

        if (prompts.length === 0) {
            chrome.storage.local.set({ score, alerts });
            return;
        }

        const latest = prompts[0]; // Most recent prompt

        // Penalty 1: Very Short Prompt (< 10 chars)
        if (latest.length > 0 && latest.length < 10) {
            score -= 2;
            alerts.push("⚠ Prompt is very short. Add more context to improve AI efficiency.");
        }

        // Penalty 2: Very Long Prompt (> 300 chars)
        if (latest.length > 300) {
            score -= 3;
            alerts.push("⚠ Prompt is very long. Consider breaking it into smaller tasks.");
        }

        // Penalty 3: Repeated Prompt (same text appears in last 5)
        const texts = prompts.map(p => p.text);
        const isDuplicate = texts.slice(1).some(t => t === latest.text);
        if (isDuplicate) {
            score -= 5;
            alerts.push("⚠ Repeated prompt detected. Try refining the prompt instead of repeating it.");
        }

        // Penalty 4: Prompt Spamming (3+ prompts within 30 seconds)
        if (prompts.length >= 3) {
            const timeDiff = prompts[0].time - prompts[2].time;
            if (timeDiff < 30000) {
                score -= 3;
                alerts.push("⚠ Rapid prompting detected. Try refining your prompt instead of sending multiple prompts.");
            }
        }

        // Penalty 5: Very Large AI Output (output_tokens > 1000)
        const recentOutput = stats.recentOutputTokens || 0;
        if (recentOutput > 1000) {
            score -= 4;
            alerts.push("⚠ AI generated a very large response. Consider requesting shorter answers.");
        }

        // Penalty 6: Very High Token Usage (total > 1500 tokens)
        const recentInput = stats.recentInputTokens || 0;
        if ((recentInput + recentOutput) > 1500) {
            score -= 5;
            alerts.push("⚠ This prompt generated a high number of tokens.");
        }

        // Clamp score to 0–100
        score = Math.max(0, Math.min(100, score));

        // Save score and alerts as dedicated storage keys
        chrome.storage.local.set({ score, alerts });
    });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PROMPT_SUBMITTED") {
    handleNewPrompt(message.payload);
  } else if (message.type === "OUTPUT_GENERATED") {
    handleOutputGenerated(message.payload);
  }
});

function handleNewPrompt(payload) {
  chrome.storage.local.get(["stats"], (result) => {
    let stats = result.stats || defaultStats;
    
    // Ensure inputs exist for backwards compatibility
    if (!stats.aiUsage) stats.aiUsage = {};
    if (typeof stats.inputTokens === 'undefined') stats.inputTokens = stats.tokensUsed || 0;
    if (typeof stats.outputTokens === 'undefined') stats.outputTokens = 0;
    if (typeof stats.totalTokens === 'undefined') stats.totalTokens = stats.tokensUsed || 0;
    
    // Update raw stats
    stats.tokensUsed += payload.tokens;
    stats.inputTokens += payload.tokens;
    stats.totalTokens += payload.tokens;
    
    stats.promptsSent += 1;
    if (payload.isRepeated) {
      stats.repeatedPrompts += 1;
    }
    
    // Track usage dynamically by AI platform name and model.
    const platformId = payload.aiType || "unknown";
    const aiModel = sanitizeModelName(payload.aiModel);
    if (!stats.aiUsage[platformId]) {
        stats.aiUsage[platformId] = { prompts: 0, tokens: 0, models: {} };
    }
    if (!stats.aiUsage[platformId].models) stats.aiUsage[platformId].models = {};
    stats.aiUsage[platformId].prompts += 1;
    stats.aiUsage[platformId].tokens += payload.tokens;
    if (aiModel) {
      stats.aiUsage[platformId].models[aiModel] = (stats.aiUsage[platformId].models[aiModel] || 0) + 1;
    }

    // Track Last 5 Prompts for Prompt Intelligence insights
    if (!stats.last_prompts) {
        stats.last_prompts = [];
    }
    
    // Add new prompt to array securely targeting what we need
    stats.last_prompts.unshift({
        text: payload.text || "",
        site: platformId,
        model: aiModel || "",
        length: payload.textLength || 0,
        time: payload.timestamp || Date.now()
    });
    
    // Maintain a strict 5 prompt maximum window
    if (stats.last_prompts.length > 5) {
        stats.last_prompts.pop();
    }

    // Map platformId to the correct model
    const pIdLower = platformId.toLowerCase();
    let modelRates = MODEL_IMPACT.average;
    
    if (pIdLower.includes('chatgpt') || pIdLower.includes('openai')) {
        modelRates = MODEL_IMPACT.gpt;
    } else if (pIdLower.includes('claude') || pIdLower.includes('anthropic')) {
        modelRates = MODEL_IMPACT.claude;
    } else if (pIdLower.includes('gemini') || pIdLower.includes('google')) {
        modelRates = MODEL_IMPACT.gemini;
    }
    
    // Safety fallback for old stats missing costEstimated
    if (typeof stats.costEstimated === 'undefined') stats.costEstimated = 0;

    // Calculate environmental impact proportionally
    stats.energyConsumed += (payload.tokens * modelRates.energy);
    stats.waterConsumed += (payload.tokens * modelRates.water);
    stats.co2Emitted += (payload.tokens * modelRates.co2);
    stats.costEstimated += (payload.tokens * modelRates.cost);

    // Track for comparison in updateScore()
    stats.recentInputTokens = payload.tokens;

    // Save stats first, then recompute score from committed storage
    chrome.storage.local.set({ stats }, () => {
        updateScore();
    });
  });
}

function handleOutputGenerated(payload) {
  chrome.storage.local.get(["stats"], (result) => {
    let stats = result.stats || defaultStats;

    // Safety sync
    if (typeof stats.inputTokens === 'undefined') stats.inputTokens = stats.tokensUsed || 0;
    if (typeof stats.outputTokens === 'undefined') stats.outputTokens = 0;
    if (typeof stats.totalTokens === 'undefined') stats.totalTokens = stats.tokensUsed || 0;
    if (typeof stats.costEstimated === 'undefined') stats.costEstimated = 0;

    stats.outputTokens += payload.outputTokens;
    stats.totalTokens += payload.outputTokens;
    stats.tokensUsed += payload.outputTokens; // Legacy update

    // Map platformId to the correct model
    const pIdLower = (payload.aiType || "unknown").toLowerCase();
    let modelRates = MODEL_IMPACT.average;
    
    if (pIdLower.includes('chatgpt') || pIdLower.includes('openai')) {
        modelRates = MODEL_IMPACT.gpt;
    } else if (pIdLower.includes('claude') || pIdLower.includes('anthropic')) {
        modelRates = MODEL_IMPACT.claude;
    } else if (pIdLower.includes('gemini') || pIdLower.includes('google')) {
        modelRates = MODEL_IMPACT.gemini;
    }

    // Calculate environmental impact proportionally for just the output
    stats.energyConsumed += (payload.outputTokens * modelRates.energy);
    stats.waterConsumed += (payload.outputTokens * modelRates.water);
    stats.co2Emitted += (payload.outputTokens * modelRates.co2);
    stats.costEstimated += (payload.outputTokens * modelRates.cost);

    // Track output tokens for Penalty 5 and 6
    stats.recentOutputTokens = payload.outputTokens;

    // Save stats first, then recompute score from committed storage
    chrome.storage.local.set({ stats }, () => {
        updateScore();
    });
  });
}

function sanitizeModelName(aiModel) {
  if (typeof aiModel !== "string") return "";
  return aiModel.replace(/[^a-zA-Z0-9.\- ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

function sendToDashboard(payload, stats) {
    /* 
    fetch('https://your-streamlit-api.com/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload, stats })
    }).catch(err => console.error("Error sending to dashboard", err));
    */
}
