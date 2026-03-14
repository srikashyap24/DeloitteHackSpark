document.addEventListener("DOMContentLoaded", () => {
    loadStats();

    document.getElementById("reset-btn").addEventListener("click", () => {
        chrome.storage.local.remove("stats", () => {
            loadStats();
        });
    });
});

function loadStats() {
    chrome.storage.local.get(["stats"], (result) => {
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
        
        const stats = result.stats || defaultStats;
        
        // Ensure aiUsage exists for backwards compatibility
        if (!stats.aiUsage) {
            stats.aiUsage = {};
        }
        
        // Update DOM
        document.getElementById("tokens-val").innerText = Math.round(stats.tokensUsed).toLocaleString();
        document.getElementById("energy-val").innerText = stats.energyConsumed.toFixed(5);
        document.getElementById("water-val").innerText = stats.waterConsumed.toFixed(5);
        document.getElementById("co2-val").innerText = stats.co2Emitted.toFixed(5);
        
        // Update AI Platform Usage dynamically
        const aiContainer = document.getElementById("ai-usage-container");
        aiContainer.innerHTML = "";
        
        let hasUsage = false;
        
        // Sort platforms by usage count (highest first)
        const sortedPlatforms = Object.entries(stats.aiUsage)
            .filter(([_, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);

        sortedPlatforms.forEach(([platformName, count]) => {
            hasUsage = true;
            aiContainer.innerHTML += `
                <div class="ai-platform">
                    <span class="platform-name">${platformName}</span>
                    <span class="platform-count">${count} prompts</span>
                </div>
            `;
        });
        
        if (!hasUsage) {
            aiContainer.innerHTML = `
                <div class="ai-platform" style="justify-content: center;">
                    <span class="platform-name" style="color: var(--text-muted);">No AI usage tracked yet.</span>
                </div>
            `;
        }
        
        const scoreCircle = document.getElementById("score-circle");
        const scoreValue = document.getElementById("score-value");
        scoreValue.innerText = stats.efficiencyScore;
        
        // Color code score and add glow effects
        if (stats.efficiencyScore > 80) {
            scoreCircle.style.borderColor = "#4ade80"; // green
            scoreCircle.style.boxShadow = "0 0 15px rgba(74, 222, 128, 0.4)";
        } else if (stats.efficiencyScore > 50) {
            scoreCircle.style.borderColor = "#facc15"; // yellow
            scoreCircle.style.boxShadow = "0 0 15px rgba(250, 204, 21, 0.4)";
        } else {
            scoreCircle.style.borderColor = "#ef4444"; // red
            scoreCircle.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.4)";
        }

        updateAlertsAndTips(stats);
        updateBadges(stats);
    });
}

function updateAlertsAndTips(stats) {
    const alertsList = document.getElementById("alerts-list");
    alertsList.innerHTML = "";

    const tips = [];
    
    if (stats.efficiencyScore > 90 && stats.promptsSent > 0) {
        tips.push({ text: "Great job! You are prompting efficiently.", type: "tip" });
    }

    if (stats.tokensUsed > 10000) {
        tips.push({ text: "⚠ High AI energy usage detected. Consider smaller scopes.", type: "alert" });
    }

    if (stats.repeatedPrompts > 2) {
        tips.push({ text: "⚠ Repeated prompts detected. Try grouping questions.", type: "alert" });
    }
    
    if (tips.length === 0) {
        tips.push({ text: "• Use smaller AI models when possible", type: "tip" });
        tips.push({ text: "• Reduce prompt length", type: "tip" });
        tips.push({ text: "• Avoid repeated prompts", type: "tip" });
    }

    tips.forEach(tip => {
        const li = document.createElement("li");
        li.innerText = tip.text;
        li.className = tip.type; // 'alert' or 'tip'
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
