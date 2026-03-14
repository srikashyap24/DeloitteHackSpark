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
    
    // Track usage dynamically by AI platform name
    // Track usage completely separated by AI Website
    const platformId = payload.aiType || "unknown"; // Use payload.aiType as platformId
    if (!stats.aiUsage[platformId]) {
        stats.aiUsage[platformId] = { prompts: 0, tokens: 0 };
    }
    stats.aiUsage[platformId].prompts += 1;
    stats.aiUsage[platformId].tokens += payload.tokens;

    // Track Last 5 Prompts for Prompt Intelligence insights
    if (!stats.last_prompts) {
        stats.last_prompts = [];
    }
    
    // Add new prompt to array securely targeting what we need
    stats.last_prompts.unshift({
        text: payload.text || "",
        site: platformId,
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

    // Calculate dynamic efficiency score (0-100)
    // Reduce score based on long prompts (> 500 tokens) and repeated prompts
    let penalty = 0;
    if (payload.isRepeated) penalty += 5;
    if (payload.tokens > 500) penalty += 2;
    
    stats.efficiencyScore = Math.max(0, stats.efficiencyScore - penalty);

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
