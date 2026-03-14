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

    // Track for comparison in handleOutputGenerated
    stats.recentInputTokens = payload.tokens;

    // --- NEW BEHAVIORAL SCORING SYSTEM ---
    let scoreChange = 0;

    // Existing Rule: Repeated prompt penalty
    if (payload.isRepeated) scoreChange -= 5;

    // Rule 1: Short Prompt Reward (< 80 chars) vs Penalty (< 10 chars)
    if (payload.textLength < 10) {
        scoreChange -= 2; // Penalty: Very Short
    } else if (payload.textLength < 80) {
        scoreChange += 2; // Reward: Short
    }

    // Rule 2: Unique Prompts Reward (Last 5 are all different)
    if (stats.last_prompts.length >= 5) {
        const uniqueTexts = new Set(stats.last_prompts.map(p => p.text));
        if (uniqueTexts.size === 5) scoreChange += 3;
    }

    // Rule 4: Consistent Platform Usage (4+ in a row)
    if (stats.last_prompts.length >= 4) {
        const lastSite = stats.last_prompts[0].site;
        const consistent = stats.last_prompts.slice(0, 4).every(p => p.site === lastSite);
        if (consistent) scoreChange += 2;
    }

    // Rule 5: Improved Prompt Length (shorter than previous)
    if (stats.last_prompts.length >= 2) {
        if (stats.last_prompts[0].length < stats.last_prompts[1].length) {
            scoreChange += 2;
        }
    }

    // Penalty 1: Very Long Prompt (> 300 characters)
    if (payload.textLength > 300) scoreChange -= 3;

    // Penalty 3: Rapid Prompt Spamming (3 prompts within 30 seconds)
    if (stats.last_prompts.length >= 3) {
        const timeDiff = stats.last_prompts[0].time - stats.last_prompts[2].time;
        if (timeDiff < 30000) scoreChange -= 3;
    }

    // Penalty 5: Excessive Prompting (> 8 prompts)
    if (stats.promptsSent > 8) scoreChange -= 4;

    // Legacy logic cleanup/re-application
    if (payload.tokens > 500) scoreChange -= 2; // Keep mild penalty for high token inputs

    // Apply score update
    stats.efficiencyScore = Math.min(100, Math.max(0, stats.efficiencyScore + scoreChange));

    chrome.storage.local.set({ stats });
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

    // --- OUTPUT BASED SCORING ---
    let scoreChange = 0;
    const inputTokens = stats.recentInputTokens || 1; // Fallback to avoid div by zero
    const totalPromptTokens = inputTokens + payload.outputTokens;

    // Reward 3: Efficient Token Usage (Total < 200)
    if (totalPromptTokens < 200) scoreChange += 4;

    // Reward 6: Balanced Output Size (Output < 4x Input)
    if (payload.outputTokens < 4 * inputTokens) scoreChange += 3;

    // Penalty 2: Very Large AI Output (> 1000 tokens)
    if (payload.outputTokens > 1000) scoreChange -= 4;

    // Penalty 6: High Token Cost Prompt (total_tokens > 1500)
    if (totalPromptTokens > 1500) scoreChange -= 5;

    // Apply score update
    stats.efficiencyScore = Math.min(100, Math.max(0, stats.efficiencyScore + scoreChange));

    chrome.storage.local.set({ stats });
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
