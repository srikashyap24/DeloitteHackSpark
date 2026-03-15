<div align="center">
  <img src="icons/icon128.png" alt="GreenPrompt Logo" width="128" />
</div>

# GreenPrompt – AI Sustainability Monitor

**A browser extension that tracks AI prompt usage and estimates its environmental impact in real time, including energy consumption, water usage, and CO₂ emissions.**

---

## 🌍 The Problem

AI interactions consume massive amounts of real-world resources—including electricity to power GPU clusters, fresh water for cooling data centers, and the resulting carbon emissions. As everyday usage of AI grows, individual users currently have no visibility into the environmental footprint of their chat sessions.

## 💡 The Solution

**GreenPrompt** monitors user prompts across major AI platforms and translates token usage into tangible environmental impact metrics. By offering real-time feedback, behavioral nudges, and a dynamic sustainability score, the extension encourages highly efficient, responsible AI usage.

---

## ✨ Features

- **Real-time AI prompt tracking**
- **Token estimation** for both input (context) and output (generation)
- **Environmental impact calculations** estimating real-world resource footprints
- **Energy, water, and CO₂ estimates** per prompt and per session
- **Sustainability score system** highlighting efficient vs. wasteful behavior
- **Floating bubble UI** with live feedback on all web pages
- **Behavioral nudges and alerts** to flag overly long or repeated prompts
- **Prompt intelligence insights** including average prompt length and model usage
- **Cross-platform monitoring** (ChatGPT, Claude, Gemini, etc.)

---

## 📊 Environmental Impact Calculations

Calculations assume the **US national average electricity mix** for carbon intensity and water cooling efficiency. Estimates are based on industry research matching token generation to hardware power draw.

**Model Averages per 1 Million Tokens:**

| Metric | Claude / Gemini Models | GPT Models |
| :--- | :--- | :--- |
| **Energy** | 6.864 kWh | 13.728 kWh |
| **CO₂ Emissions** | 2.704 kg | 5.409 kg |
| **Water Usage** | 33.50 L | 66.99 L |
| **Estimated Cost** | $0.132 | $1.81 |

> *Reference: Token-based energy estimates derived from the Tokenomy AI energy usage estimator.*

---

## 🎯 Sustainability Score Logic

The extension calculates a dynamic **Sustainability Score** that determines the color of the UI and the state of the Polar Bear visualization.

- **Range:** `0` (Critical) – `100` (Excellent)
- **Starting Score:** `100`

The system uses a penalty-only model with a single exception for perfect prompts.

**Example Penalties:**
- **Very short prompt (<10 chars):** `-2 points`
- **Very large AI output (>1000 tokens):** `-4 points`
- **Repeated prompt (spam):** `-5 points`
- **High token interaction (>1500 tokens):** `-5 points`

**Reward Rule:**
If a prompt triggers **no penalties** at all, the score increases by **+1** (capped at a maximum of 100).

---

## 🧠 Prompt Intelligence

The dashboard provides intelligent feedback on your prompting habits, including:
- **Average prompt length**
- **Platforms used**
- **Prompt efficiency tips**
- **Suggestions to reduce token usage** (e.g., breaking questions down, avoiding redundancy)

---

## 🖥️ User Interface

**Floating Bubbles (In-Page UI):**
- Sustainability score badge
- Live water consumption tracker
- Alert notifications

**Extension Popup Dashboard:**
- **Polar Bear Visualization:** A dynamic SVG climate metaphor showing the bear sinking as your score drops.
- **Metrics Panel:** Energy consumption, Water usage, CO₂ emissions, Token usage.
- **Prompt Intelligence Insights** and earned badges.

**Dynamic Color System:**
The entire UI color theme changes based on your current score:
| Condition | Color | Meaning |
| :--- | :--- | :--- |
| **≥ 90** | 🔵 **Blue** | Highly Efficient |
| **≥ 75** | 🩵 **Light Blue** | Good |
| **≥ 60** | 🟡 **Yellow** | Moderate |
| **≥ 40** | 🟠 **Orange** | Warning |
| **< 40** | 🔴 **Red** | Inefficient |

---

## ⚙️ Technical Architecture

**Browser Extension Flow:**
1. **Prompt Detection:** Content scripts observe chat interfaces via DOM mutations.
2. **Token Estimation:** Text lengths are analyzed and approximated.
3. **Environmental Impact Calculation:** Background scripts apply resource cost models.
4. **Scoring System:** Penalties and rewards are calculated, and the score is clamped 0–100.
5. **User Feedback Interface:** React (UI widgets) and injected CSS reflect the state dynamically.

**Technologies Used:**
- Chrome Extension Manifest V3 APIs
- JavaScript (ES6)
- React.js UI components
- Webpack bundler
- `chrome.storage.local` for state management

---

## 🚀 Installation & Usage

**Local Installation (Developer Mode):**
1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/srikashyap24/DeloitteHackSpark.git
   ```
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (toggle in the top right corner).
4. Click **Load unpacked**.
5. Select the cloned `Extension` folder.

**Usage:**
1. Pin the extension to your Chrome toolbar.
2. Open an AI platform (such as ChatGPT, Claude, or Gemini).
3. Send prompts normally—GreenPrompt tracks your usage automatically in the background.
4. Click the floating score bubble or the extension icon to view your environmental impact metrics, efficiency score, and prompt intelligence insights.

---

## 🔮 Future Improvements

- More accurate exact-token tracking APIs (bypassing approximation)
- Organization/Enterprise dashboards for team environmental budgets
- Deeper AI efficiency analytics and prompt rewriting suggestions
- Additional custom AI platform integrations

---
*Built for the Deloitte HackSpark Hackathon.*