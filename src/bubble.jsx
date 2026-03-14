import React, { useState, useEffect } from "react";
import "./bubble.css";

// Format water value compactly: "0.00123 L" → "0.001 L"
function formatWater(val) {
  if (!val || val === 0) return "0 L";
  if (val < 0.001) return "<0.001 L";
  if (val < 1) return val.toFixed(3) + " L";
  return val.toFixed(2) + " L";
}

export default function GreenPromptBubble() {
  const [score, setScore]   = useState(100);
  const [water, setWater]   = useState(0);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage) return;

    // Initial load
    chrome.storage.local.get(["score", "alerts", "stats"], (data) => {
      if (typeof data.score === "number") setScore(data.score);
      if (Array.isArray(data.alerts)) setAlerts(data.alerts);
      if (data.stats?.waterConsumed != null) setWater(data.stats.waterConsumed);
    });

    // Live updates
    const listener = (changes) => {
      if (changes.score?.newValue != null)  setScore(changes.score.newValue);
      if (changes.alerts?.newValue != null) setAlerts(changes.alerts.newValue);
      if (changes.stats?.newValue?.waterConsumed != null)
        setWater(changes.stats.newValue.waterConsumed);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const latestAlert = alerts[0] || null;

  return (
    <div className="gp-stack">
      {/* Decorative mini bubbles for "rising" aesthetic */}
      <div className="gp-deco" />
      <div className="gp-deco" />
      <div className="gp-deco" />

      {/* Alert bubble – only show if any alerts */}
      {latestAlert && (
        <div className="gp-bubble gp-bubble--alert">
          !
          <div className="gp-tooltip">{latestAlert}</div>
        </div>
      )}

      {/* Water bubble */}
      <div className="gp-bubble gp-bubble--water">
        <span className="gp-water-value">{formatWater(water)}</span>
        <span className="gp-water-label">Water</span>
        <div className="gp-tooltip">💧 Water used by AI prompts</div>
      </div>

      {/* Score bubble – largest, clickable */}
      <div
        className="gp-bubble gp-bubble--score"
        onClick={() => window.open(chrome.runtime.getURL("popup.html"), "_blank")}
        title="Open GreenPrompt dashboard"
      >
        <span className="gp-score-value">{score}</span>
        <span className="gp-score-label">Score</span>
        <div className="gp-tooltip">🌿 GreenPrompt score: {score}/100</div>
      </div>
    </div>
  );
}
