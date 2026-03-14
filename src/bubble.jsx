import React, { useState, useEffect } from "react";
import "./bubble.css";

// ── Single shared color palette ───────────────────
// All bubbles use the same color determined by the score.
function getScoreColor(score) {
  if (score >= 90) return "#2563EB"; // dark blue  – efficient
  if (score >= 75) return "#9BC9D6"; // light blue – good
  if (score >= 60) return "#E7CD90"; // yellow     – moderate
  if (score >= 40) return "#F28546"; // orange     – poor
  return "#E74343";                  // red        – critical
}

// Format water compactly
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

    chrome.storage.local.get(["score", "alerts", "stats"], (data) => {
      if (typeof data.score === "number") setScore(data.score);
      if (Array.isArray(data.alerts))    setAlerts(data.alerts);
      if (data.stats?.waterConsumed != null) setWater(data.stats.waterConsumed);
    });

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
  // One color for everything — driven purely by score
  const color = getScoreColor(score);

  return (
    <div className="gp-stack">
      {/* Decorative rising mini-bubbles */}
      <div className="gp-deco" style={{ background: color, opacity: 0.4 }} />
      <div className="gp-deco" style={{ background: color, opacity: 0.3 }} />
      <div className="gp-deco" style={{ background: color, opacity: 0.35 }} />

      {/* Alert bubble – only shown when alerts exist */}
      {latestAlert && (
        <div className="gp-bubble gp-bubble--alert" style={{ background: color }}>
          !
          <div className="gp-tooltip">{latestAlert}</div>
        </div>
      )}

      {/* Water bubble */}
      <div className="gp-bubble gp-bubble--water" style={{ background: color }}>
        <span className="gp-water-value">{formatWater(water)}</span>
        <span className="gp-water-label">Water</span>
        <div className="gp-tooltip">💧 Water used by AI prompts</div>
      </div>

      {/* Score bubble – largest, clickable */}
      <div
        className="gp-bubble gp-bubble--score"
        style={{ background: color }}
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
