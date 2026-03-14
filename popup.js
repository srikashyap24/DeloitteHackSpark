document.addEventListener("DOMContentLoaded", () => {
    loadStats();

    document.getElementById("reset-btn").addEventListener("click", () => {
        chrome.storage.local.remove("stats", () => {
            loadStats();
        });
    });
});

function loadStats() {
    chrome.storage.local.get(["stats", "score", "alerts"], (result) => {
        const defaultStats = {
            tokensUsed: 0,
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
            aiUsage: {}
        };
        
        const stats = result.stats || defaultStats;
        
        // Ensure properties exist for backwards compatibility with old saves
        if (!stats.aiUsage) stats.aiUsage = {};
        if (typeof stats.costEstimated === 'undefined') stats.costEstimated = 0;
        
        // Safely parse tokens to avoid NaN
        const inputTokens = Number(stats.inputTokens) || 0;
        const outputTokens = Number(stats.outputTokens) || 0;
        const totalTokens = Number(stats.totalTokens) || 0;

        // Update DOM
        document.getElementById("tokens-input").innerText = Math.round(inputTokens).toLocaleString();
        document.getElementById("tokens-output").innerText = Math.round(outputTokens).toLocaleString();
        document.getElementById("tokens-total").innerText = Math.round(totalTokens).toLocaleString();
        document.getElementById("energy-val").innerText = stats.energyConsumed.toFixed(5) + " kWh";
        document.getElementById("water-val").innerText = stats.waterConsumed.toFixed(5) + " L";
        document.getElementById("co2-val").innerText = stats.co2Emitted.toFixed(5) + " kg";
        // document.getElementById("cost-val").innerText = "$" + stats.costEstimated.toFixed(5);
        
        // Use dedicated score from calculateScore() — fallback to stats.efficiencyScore
        const displayScore = (typeof result.score === 'number') ? result.score : stats.efficiencyScore;
        const scoreCircle = document.getElementById("score-circle");
        const scoreValue = document.getElementById("score-value");
        scoreValue.innerText = displayScore;
        
        // Color code score and add glow effects
        if (displayScore > 80) {
            scoreCircle.style.borderColor = "#4ade80"; // green
            scoreCircle.style.boxShadow = "0 0 15px rgba(74, 222, 128, 0.4)";
        } else if (displayScore > 50) {
            scoreCircle.style.borderColor = "#facc15"; // yellow
            scoreCircle.style.boxShadow = "0 0 15px rgba(250, 204, 21, 0.4)";
        } else {
            scoreCircle.style.borderColor = "#ef4444"; // red
            scoreCircle.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.4)";
        }

        // Pass dedicated alerts array collected from calculateScore()
        const storedAlerts = Array.isArray(result.alerts) ? result.alerts : [];
        updateAlertsAndTips(stats, storedAlerts);
        updateBadges(stats);
        updatePromptIntelligence(stats);
    });
}

function updatePromptIntelligence(stats) {
    const lastPrompts = stats.last_prompts || [];
    
    // Default Empty State
    if (lastPrompts.length === 0) {
        document.getElementById("intel-avg-len").innerText = "0";
        document.getElementById("intel-platforms-list").innerHTML = '<li><span style="color:var(--text-muted)">None recorded</span></li>';
        document.getElementById("intel-advice-list").innerHTML = '<li><span style="color:var(--text-muted)">Send prompts to get AI efficiency advice!</span></li>';
        return;
    }
    
    // 1. Calculate Average Length
    const totalLength = lastPrompts.reduce((sum, p) => sum + p.length, 0);
    const avgLength = Math.round(totalLength / lastPrompts.length);
    document.getElementById("intel-avg-len").innerText = `${avgLength}`;
    
    // 2. Count Platforms Used and most-used model per platform.
    const platformStats = {};
    lastPrompts.forEach((p) => {
        const site = p.site || "Unknown";
        if (!platformStats[site]) {
            platformStats[site] = { count: 0, models: {} };
        }
        platformStats[site].count += 1;

        const model = typeof p.model === "string" ? p.model.trim() : "";
        if (model) {
            platformStats[site].models[model] = (platformStats[site].models[model] || 0) + 1;
        }
    });
    
    const platformsList = document.getElementById("intel-platforms-list");
    platformsList.innerHTML = "";
    Object.entries(platformStats).forEach(([site, info]) => {
        const usageModels = stats.aiUsage?.[site]?.models || {};
        const mergedModels = { ...usageModels };
        Object.entries(info.models).forEach(([model, count]) => {
            mergedModels[model] = (mergedModels[model] || 0) + count;
        });
        const topModel = Object.entries(mergedModels).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
        const siteLabel = topModel ? `${site} (${topModel})` : site;
        platformsList.innerHTML += `<li>${siteLabel} – ${info.count} prompt${info.count > 1 ? 's' : ''}</li>`;
    });
    
    // 3. Generate Advice Rules based on data
    const adviceList = document.getElementById("intel-advice-list");
    adviceList.innerHTML = "";
    
    const advices = [];
    
    if (avgLength > 200) {
        advices.push("• Try breaking long prompts into smaller tasks.");
    }
    if (avgLength < 40) {
        advices.push("• Prompts are very short. Adding more context may improve response quality.");
    }
    if (Object.keys(platformStats).length > 1) {
        advices.push("• Good practice: you are comparing results across multiple AI systems.");
    }
    if (lastPrompts.length === 5) {
        advices.push("• Consider reusing optimized prompts to reduce repeated token usage.");
    }
    
    if (advices.length === 0) {
        advices.push("• Your prompt patterns are looking balanced and efficient!");
    }
    
    advices.forEach(adv => {
        adviceList.innerHTML += `<li>${adv}</li>`;
    });
}


function updateAlertsAndTips(stats, storedAlerts = []) {
    const alertsList = document.getElementById("alerts-list");
    alertsList.innerHTML = "";

    // Build alert items from the dedicated calculateScore() alerts array
    const activeAlerts = storedAlerts.map(text => ({ text, type: "alert" }));

    // Fall back to extra checks from stats (high usage, repeated prompts)
    if (stats.tokensUsed > 10000) {
        activeAlerts.push({ text: "⚠ High AI energy usage detected. Consider smaller scopes.", type: "alert" });
    }
    if (stats.repeatedPrompts > 2) {
        activeAlerts.push({ text: "⚠ Repeated prompts detected. Try grouping questions.", type: "alert" });
    }

    // Only show positive tip when there are NO active alerts
    const activeTips = [];
    if (activeAlerts.length === 0 && stats.promptsSent > 0) {
        activeTips.push({ text: "Great job! You are prompting efficiently.", type: "tip" });
    }

    // Default fallback when there are no prompts yet
    if (activeAlerts.length === 0 && activeTips.length === 0) {
        activeTips.push({ text: "• Use smaller AI models when possible", type: "tip" });
        activeTips.push({ text: "• Reduce prompt length", type: "tip" });
        activeTips.push({ text: "• Avoid repeated prompts", type: "tip" });
    }

    [...activeAlerts, ...activeTips].forEach(msg => {
        const li = document.createElement("li");
        li.innerText = msg.text;
        li.className = msg.type;
        alertsList.appendChild(li);
    });
}

function updateBadges(stats) {
    const rewardsContainer = document.getElementById("rewards-container");
    rewardsContainer.innerHTML = "";

    if (stats.tokensUsed < 5000 && stats.promptsSent >= 5) {
        rewardsContainer.innerHTML += `<span class="badge" title="Low token usage">🌱 Green AI User</span>`;
    }
    if (stats.efficiencyScore >= 95 && stats.promptsSent >= 2) {
        rewardsContainer.innerHTML += `<span class="badge" title="Short efficient prompts">⚡ Efficient Prompter</span>`;
    }
    if (stats.co2Emitted < 0.05 && stats.promptsSent >= 10) {
        rewardsContainer.innerHTML += `<span class="badge" title="Reduced emissions">🌍 Carbon Saver</span>`;
    }
    
    // Add default blank state if no badges
    if (rewardsContainer.innerHTML === "") {
        rewardsContainer.innerHTML = `<span class="badge badge-default" title="Submit more to earn badges">Earn badges by prompting</span>`;
    }
}
