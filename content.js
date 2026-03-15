// ── Allowlist: only run on supported AI platforms ─────────────────────────────
const ALLOWED_SITES = [
  "chat.openai.com",
  "chatgpt.com",
  "claude.ai",
  "gemini.google.com",
  "perplexity.ai",
  "poe.com",
  "copilot.microsoft.com"
];

if (!ALLOWED_SITES.includes(window.location.hostname)) {
  // Not an AI platform — stop all tracking
  throw new Error("[EcoPrompt] Site not in allowlist, skipping.");
}

// Function to rough guess tokens
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

const PLATFORM_MODEL_REGEX = {
  ChatGPT: /^(gpt-|o\d)/,
  Gemini: /^gemini/,
  Claude: /^claude/,
  Copilot: /^(gpt-|o\d|claude)/,
  Perplexity: /^(sonar|gpt-|o\d|claude|gemini|llama|mistral)/
};

function detectAIPlatform(hostname) {
  const host = hostname.replace("www.", "");
  if (host.includes("chatgpt")) return "ChatGPT";
  if (host.includes("gemini")) return "Gemini";
  if (host.includes("claude")) return "Claude";
  if (host.includes("copilot") || host.includes("bing")) return "Copilot";
  if (host.includes("perplexity")) return "Perplexity";
  return host.split(".")[0].replace(/^./, (c) => c.toUpperCase());
}

function normalizeVersionToken(value) {
  return String(value || "")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/(\d)[\s-]+(?=\d)/g, "$1.")
    .replace(/\.{2,}/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");
}

function capitalizeWord(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

const MODEL_PARSERS = [
  {
    re: /\bchatgpt\b(?:\s*(?:model|version|v))?(?:\s*[-: ]*)(?:gpt[- ]?)?(o\d+(?:[.\- ]\d+)?|\d+(?:[.\- ]\d+)*o?)(?:\s*(thinking|mini|pro|high|low|turbo|nano|preview))?\b/i,
    build: (m) => {
      const version = normalizeVersionToken(m[1]);
      if (!version) return null;
      return `${/^o\d/.test(version) ? version : `gpt-${version}`}${m[2] ? ` ${m[2]}` : ""}`.trim();
    }
  },
  {
    re: /\bgpt[- ]?(\d+)(?:[.\- ](\d+))?(?:[.\- ](\d+))?\b/i,
    build: (m, compact) => {
      let model = `gpt-${m[1]}${m[2] ? `.${m[2]}` : ""}${m[3] ? `.${m[3]}` : ""}`;
      const suffixes = compact.match(/\b(thinking|mini|pro|high|low|turbo|nano|preview)\b/g);
      if (suffixes?.length) model += ` ${Array.from(new Set(suffixes)).join(" ")}`;
      return model;
    }
  },
  {
    re: /\bo(\d+)(?:[.\- ](\d+))?(?:[- ](mini|pro|high))?\b/i,
    build: (m) => `o${m[1]}${m[2] ? `.${m[2]}` : ""}${m[3] ? `-${m[3]}` : ""}`
  },
  {
    re: /\bgemini(?:\s*[- ]?(pro|flash(?:[- ]?lite)?|thinking))?(?:\s*[- ]?(\d+(?:[.\- ]\d+)*))?(?:\s*[- ]?(pro|flash(?:[- ]?lite)?|thinking))?\b/i,
    build: (m) => {
      const tier = m[1] || m[3] || "";
      const version = m[2] ? normalizeVersionToken(m[2]) : "";
      return tier || version ? `Gemini${version ? ` ${version}` : ""}${tier ? ` ${capitalizeWord(tier.replace(/\s+/g, "-"))}` : ""}`.trim() : null;
    }
  },
  {
    re: /\bclaude(?:\s+(sonnet|opus|haiku))?(?:\s*[- ]?(\d+(?:[.\- ]\d+)*))?\b/i,
    build: (m) => {
      const family = m[1] ? capitalizeWord(m[1]) : "";
      const version = m[2] ? normalizeVersionToken(m[2]) : "";
      return family || version ? `Claude${family ? ` ${family}` : ""}${version ? ` ${version}` : ""}`.trim() : null;
    }
  },
  {
    re: /\b(sonnet|opus|haiku)(?:\s+(?:model|version|v))?\s*[- ]?(\d+(?:[.\- ]\d+)*)\b/i,
    build: (m) => `Claude ${capitalizeWord(m[1])} ${normalizeVersionToken(m[2])}`.trim()
  },
  { re: /\b(sonar(?:\s*(?:pro|reasoning))?)\b/i, build: (m) => m[1].replace(/^sonar/i, "Sonar") },
  { re: /\b(llama\s*3(?:\.\d+)?(?:\s*(?:8b|70b|405b))?)\b/i, build: (m) => m[1] },
  { re: /\b(mistral(?:\s*(?:large|medium|small|codestral))?)\b/i, build: (m) => m[1] }
];

function parseModel(text) {
  if (!text) return null;
  const safe = String(text)
    .replace(/_/g, "-")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[^a-zA-Z0-9.\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return null;

  const compact = safe.toLowerCase();
  for (const parser of MODEL_PARSERS) {
    const match = compact.match(parser.re);
    if (!match) continue;
    const model = parser.build(match, compact);
    if (model) return model;
  }
  return null;
}

function modelBelongsToPlatform(aiType, modelName) {
  if (!modelName) return false;
  const rule = PLATFORM_MODEL_REGEX[aiType];
  return !rule || rule.test(modelName.toLowerCase());
}

function getModelForPlatform(text, aiType) {
  const model = parseModel(text);
  return modelBelongsToPlatform(aiType, model) ? model : null;
}

function cleanVisibleText(node) {
  const value = (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  return value && value.length <= 140 ? value : "";
}

function modelFromNode(node, aiType) {
  const hints = [
    node?.getAttribute?.("aria-label"),
    node?.getAttribute?.("title"),
    node?.getAttribute?.("data-testid"),
    node?.getAttribute?.("data-model"),
    node?.getAttribute?.("data-model-slug"),
    node?.getAttribute?.("data-value"),
    cleanVisibleText(node)
  ];
  for (const hint of hints) {
    const model = getModelForPlatform(hint, aiType);
    if (model) return model;
  }
  return null;
}

function detectClaudeModelNearComposer() {
  const inputs = document.querySelectorAll("#prompt-textarea, textarea, div[contenteditable='true']");
  const roots = new Set();
  for (let i = 0; i < Math.min(inputs.length, 8); i += 1) {
    const input = inputs[i];
    if (!input) continue;
    roots.add(input);
    if (input.parentElement) roots.add(input.parentElement);
    const form = input.closest("form");
    if (form) roots.add(form);
    const section = input.closest("section, [role='group'], [role='form']");
    if (section) roots.add(section);
  }

  for (const root of Array.from(roots).slice(0, 18)) {
    const rootModel = getModelForPlatform(cleanVisibleText(root), "Claude");
    if (rootModel) return rootModel;

    const nodes = root.querySelectorAll("button, [role='button'], [aria-label], [title], [data-testid], [data-model], [data-model-slug], span, p");
    for (let i = 0; i < Math.min(nodes.length, 90); i += 1) {
      const model = modelFromNode(nodes[i], "Claude");
      if (model) return model;
    }
  }
  return null;
}

function detectAIModel(aiType) {
  if (aiType === "Gemini") return "Gemini 3";

  try {
    const url = new URL(window.location.href);
    for (const key of ["model", "engine", "variant", "model_slug"]) {
      const model = getModelForPlatform(url.searchParams.get(key), aiType);
      if (model) return model;
    }
  } catch (error) {
    // Ignore invalid URLs and continue with DOM-based detection.
  }

  const selectorsByType = {
    ChatGPT: ['[data-testid="model-switcher-dropdown-button"]', '[data-testid*="model-switcher" i]', 'button[id*="model-switcher" i]', 'header [aria-haspopup="menu"]', 'header [data-model-slug]', 'header [data-model]', 'header [data-testid*="model" i]', 'header button[aria-label*="model" i]', 'button[aria-label*="chatgpt" i]'],
    Claude: ['header [data-testid*="model" i]', 'header button[aria-label*="model" i]', 'header [data-model]', 'form [data-testid*="model" i]', 'form button[aria-label*="model" i]', 'form [data-model]', '[data-testid*="model-selector" i]'],
    Copilot: ['header button[aria-label*="model" i]', 'header [data-testid*="model" i]'],
    Perplexity: ['header button[aria-label*="model" i]', 'header [data-testid*="model" i]']
  };

  for (const selector of selectorsByType[aiType] || []) {
    const nodes = document.querySelectorAll(selector);
    for (let i = 0; i < Math.min(nodes.length, 30); i += 1) {
      const model = modelFromNode(nodes[i], aiType);
      if (model) return model;
    }
  }

  if (aiType === "Claude") {
    const model = detectClaudeModelNearComposer();
    if (model) return model;
  }

  const fallbackHints = [document.title];
  document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[name="twitter:title"]').forEach((meta) => fallbackHints.push(meta.content || ""));
  for (const hint of fallbackHints) {
    const model = getModelForPlatform(hint, aiType);
    if (model) return model;
  }

  return null;
}

function formatModelForPlatform(aiType, model) {
  if (!model) return null;
  return aiType === "Claude" ? model.replace(/^claude\s+/i, "").trim() || model : model;
}

// Track if we've processed a specific prompt to avoid duplicates
let lastPrompt = "";
let lastPromptTime = 0;

// Output Token Tracking
let isGeneratingOutput = false;
let baselineTextLength = 0;
let outputTimer = null;
let currentPlatform = "";

function handlePromptSubmit(promptText) {
  promptText = promptText.trim();
  if (!promptText) return;

  const now = Date.now();
  // Simple debounce and duplicate prevention (2 seconds)
  if (promptText === lastPrompt && now - lastPromptTime < 2000) {
    return;
  }

  const isRepeated = promptText === lastPrompt;
  lastPrompt = promptText;
  lastPromptTime = now;

  const tokenCount = estimateTokens(promptText);

  // Dynamically identify the AI platform and model in use.
  const hostname = window.location.hostname;
  const aiType = detectAIPlatform(hostname);
  const aiModel = formatModelForPlatform(aiType, detectAIModel(aiType));

  // Send data to background script
  chrome.runtime.sendMessage({
    type: "PROMPT_SUBMITTED",
    payload: {
      text: promptText,
      textLength: promptText.length,
      tokens: tokenCount,
      isRepeated: isRepeated,
      aiType: aiType,
      aiModel: aiModel,
      timestamp: now
    }
  });

  // Prepare for AI output token tracking
  baselineTextLength = document.body.innerText.length;
  currentPlatform = aiType;
  isGeneratingOutput = true;
}

// Global MutationObserver to watch for AI responses streaming into the page
const outputObserver = new MutationObserver(() => {
    if (!isGeneratingOutput) return;

    // Reset the debounce timer whenever the DOM changes (i.e., streaming continues)
    clearTimeout(outputTimer);

    // If DOM stops changing for exactly 2 full seconds, we consider generation "done"
    outputTimer = setTimeout(() => {
        isGeneratingOutput = false; // Turn off tracker
        
        const finalLength = document.body.innerText.length;
        const diff = finalLength - baselineTextLength;

        if (diff > 0) {
            const outputTokens = estimateTokens("a".repeat(diff)); // Calculate tokens roughly
            
            // Send captured output to the background immediately
            chrome.runtime.sendMessage({
                type: "OUTPUT_GENERATED",
                payload: {
                    outputTokens: outputTokens,
                    aiType: currentPlatform,
                    timestamp: Date.now()
                }
            });
        }
    }, 2000);
});

// Start observing all content additions across the entire body natively
outputObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

// Listen for combinations of sending messages on AI platforms
document.addEventListener(
  "keydown",
  (e) => {
    // Capture "Enter" key presses (without shift, which usually means new line)
    if (e.key === "Enter" && !e.shiftKey) {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT" || activeEl.isContentEditable)) {
        let text = activeEl.value || activeEl.innerText || activeEl.textContent;
        handlePromptSubmit(text);
      }
    }
  },
  true
);

document.addEventListener(
  "click",
  (e) => {
    // Try to find a generic send/submit button action, even if it's a div, span, or SVG
    const target = e.target.closest(
      'button, [role="button"], [aria-label*="send" i], [aria-label*="Submit" i], [data-testid*="send" i], form, .send-button'
    );

    if (target) {
      // Look for common patterns indicating a submit/send button
      const ariaLabel = target.getAttribute("aria-label")?.toLowerCase() || "";
      const testId = target.getAttribute("data-testid")?.toLowerCase() || "";
      const tooltip = target.getAttribute("title")?.toLowerCase() || "";
      const htmlContent = target.innerHTML?.toLowerCase() || "";

      // Most AI platforms have an SVG send arrow, "send" in test-id, or "send" aria labels
      const isSendAction =
        target.tagName === "BUTTON" ||
        target.tagName === "FORM" ||
        ariaLabel.includes("send") ||
        ariaLabel.includes("submit") ||
        ariaLabel.includes("message") ||
        testId.includes("send") ||
        testId.includes("submit") ||
        tooltip.includes("send") ||
        tooltip.includes("submit") ||
        htmlContent.includes("<svg") ||
        htmlContent.includes("send") ||
        e.target.tagName.toLowerCase() === "svg" ||
        e.target.tagName.toLowerCase() === "path";

      if (isSendAction) {
        // Check if we are currently focused in an input
        let textarea = document.activeElement;
        if (!textarea || !(textarea.tagName === "TEXTAREA" || textarea.tagName === "INPUT" || textarea.isContentEditable)) {
          // Fallback to searching the DOM for the most likely main input area
          textarea =
            document.getElementById("prompt-textarea") ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector("textarea") ||
            document.querySelector('input[type="text"]');
        }

        if (textarea) {
          let text = textarea.value || textarea.innerText || textarea.textContent;
          handlePromptSubmit(text);
        }
      }
    }
  },
  true
);
