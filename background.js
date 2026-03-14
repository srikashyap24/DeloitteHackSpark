// Constants for metrics
const ENERGY_PER_TOKEN = 0.00002; // kWh
const WATER_PER_TOKEN = 0.00008; // liters
const CO2_PER_TOKEN = 0.00001; // kg

// Default stats
const defaultStats = {
  tokensUsed: 0,
  promptsSent: 0,
  repeatedPrompts: 0,
  energyConsumed: 0,
  waterConsumed: 0,
  co2Emitted: 0,
  efficiencyScore: 100,
  aiUsage: {}
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PROMPT_SUBMITTED") {
    handleNewPrompt(message.payload);
  }
});

function handleNewPrompt(payload) {
  chrome.storage.local.get(["stats"], (result) => {
    let stats = result.stats || defaultStats;
    
    // Ensure aiUsage exists for backwards compatibility
    if (!stats.aiUsage) {
      stats.aiUsage = {};
    }
    
    // Update raw stats
    stats.tokensUsed += payload.tokens;
    stats.promptsSent += 1;
    if (payload.isRepeated) {
      stats.repeatedPrompts += 1;
    }
    
    // Track usage dynamically by AI platform and model name when available.
    if (payload.aiType) {
      const aiModel = sanitizeModelName(payload.aiModel);
      const usageKey = aiModel ? `${payload.aiType} (${aiModel})` : payload.aiType;
      stats.aiUsage[usageKey] = (stats.aiUsage[usageKey] || 0) + 1;
    }

    // Calculate environmental impact
    stats.energyConsumed = stats.tokensUsed * ENERGY_PER_TOKEN;
    stats.waterConsumed = stats.tokensUsed * WATER_PER_TOKEN;
    stats.co2Emitted = stats.tokensUsed * CO2_PER_TOKEN;

    // Calculate dynamic efficiency score (0-100)
    // Reduce score based on long prompts (> 500 tokens) and repeated prompts
    let penalty = 0;
    if (payload.isRepeated) penalty += 5;
    if (payload.tokens > 500) penalty += 2;
    
    stats.efficiencyScore = Math.max(0, stats.efficiencyScore - penalty);

    chrome.storage.local.set({ stats });

    // Optional Enhancement: Sending to Streamlit dashboard API
    // sendToDashboard(payload, stats);
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
