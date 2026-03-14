import React, { useState, useEffect } from "react";
import "./bubble.css";

// Returns bubble style (gradient + shadow) based on score
function getBubbleStyle(score) {
  if (score >= 90) {
    return {
      background: "radial-gradient(circle at 30% 30%, #6ee7b7, #10b981)",
      boxShadow: "0 6px 24px rgba(16, 185, 129, 0.5)",
    };
  } else if (score >= 70) {
    return {
      background: "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b)",
      boxShadow: "0 6px 24px rgba(245, 158, 11, 0.5)",
    };
  } else {
    return {
      background: "radial-gradient(circle at 30% 30%, #fca5a5, #ef4444)",
      boxShadow: "0 6px 24px rgba(239, 68, 68, 0.5)",
    };
  }
}

function GreenPromptBubble() {
  const [score, setScore] = useState(100);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      // Load current score on mount
      chrome.storage.local.get(["score"], (data) => {
        if (typeof data.score === "number") {
          setScore(data.score);
        }
      });

      // Live listener for score changes
      const listener = (changes) => {
        if (changes.score && typeof changes.score.newValue === "number") {
          setScore(changes.score.newValue);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  const bubbleStyle = getBubbleStyle(score);

  return (
    <div className="greenprompt-bubble" style={bubbleStyle}>
      <span className="greenprompt-score">{score}</span>
      <span className="greenprompt-label">score</span>
      <div className="greenprompt-tooltip">
        <strong>GreenPrompt</strong>
        {score} / 100
      </div>
    </div>
  );
}

export default GreenPromptBubble;
