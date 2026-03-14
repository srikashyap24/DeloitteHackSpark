import React, { useState, useEffect } from "react";
import "./bubble.css";

// ── Brand Palette ─────────────────────────────────
const PALETTE = {
  darkBlue:  "#205D82",
  lightBlue: "#9BC9D6",
  yellow:    "#E7CD90",
  orange:    "#F28546",
  red:       "#E74343",
};

// Score bubble: color reflects sustainability level
function getScoreColor(score) {
  if (score >= 90) return PALETTE.darkBlue;
  if (score >= 75) return PALETTE.lightBlue;
  if (score >= 60) return PALETTE.yellow;
  if (score >= 40) return PALETTE.orange;
  return PALETTE.red;
}

// Water bubble: shifts from cool to warm as water usage rises
function getWaterColor(water) {
  if (water < 0.05)  return PALETTE.lightBlue;
  if (water < 0.5)   return PALETTE.yellow;
  if (water < 2)     return PALETTE.orange;
  return PALETTE.red;
}

// Alert bubble: red if the alert text sounds severe, else orange
function getAlertColor(alertText) {
  if (!alertText) return PALETTE.orange;
  const severe = ["repeated", "high", "rapid", "large", "excessive"];
  return severe.some(w => alertText.toLowerCase().includes(w))
    ? PALETTE.red
    : PALETTE.orange;
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
  const scoreColor  = getScoreColor(score);
  const waterColor  = getWaterColor(water);
  const alertColor  = getAlertColor(latestAlert);

  return (
    <div className="gp-stack">
      {/* Decorative rising mini-bubbles */}
      <div className="gp-deco" />
      <div className="gp-deco" />
      <div className="gp-deco" />

      {/* Alert bubble – conditional */}
      {latestAlert && (
        <div
          className="gp-bubble gp-bubble--alert"
          style={{ background: alertColor }}
        >
          !
          <div className="gp-tooltip">{latestAlert}</div>
        </div>
      )}

      {/* Water bubble */}
      <div
        className="gp-bubble gp-bubble--water"
        style={{ background: waterColor }}
      >
        <span className="gp-water-value">{formatWater(water)}</span>
        <span className="gp-water-label">Water</span>
        <div className="gp-tooltip">💧 Water used by AI prompts</div>
      </div>

      {/* Score bubble – largest, clickable */}
      <div
        className="gp-bubble gp-bubble--score"
        style={{ background: scoreColor }}
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
