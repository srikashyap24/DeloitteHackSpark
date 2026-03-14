// Function to rough guess tokens
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
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
  if (promptText === lastPrompt && (now - lastPromptTime) < 2000) {
    return;
  }

  const isRepeated = (promptText === lastPrompt);
  lastPrompt = promptText;
  lastPromptTime = now;

  const tokenCount = estimateTokens(promptText);

  // Dynamically identify the AI platform based on the current hostname
  const hostname = window.location.hostname;
  let aiType = hostname.replace('www.', ''); // Use domain as the identifier

  // Try to clean it up for display (e.g. chatgpt.com -> ChatGPT)
  if (aiType.includes('chatgpt')) aiType = 'ChatGPT';
  else if (aiType.includes('gemini')) aiType = 'Gemini';
  else if (aiType.includes('claude')) aiType = 'Claude';
  else if (aiType.includes('copilot') || aiType.includes('bing')) aiType = 'Copilot';
  else if (aiType.includes('perplexity')) aiType = 'Perplexity';
  else {
      // General fallback that formats the domain name nicely
      const parts = aiType.split('.');
      if (parts.length >= 2) {
          // Capitalize first letter of domain name
          aiType = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
  }

  // Send data to background script
  chrome.runtime.sendMessage({
    type: "PROMPT_SUBMITTED",
    payload: {
      text: promptText,
      textLength: promptText.length,
      tokens: tokenCount,
      isRepeated: isRepeated,
      aiType: aiType,
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
document.addEventListener('keydown', (e) => {
  // Capture "Enter" key presses (without shift, which usually means new line)
  if (e.key === 'Enter' && !e.shiftKey) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.isContentEditable)) {
      let text = activeEl.value || activeEl.innerText || activeEl.textContent;
      handlePromptSubmit(text);
    }
  }
}, true);

document.addEventListener('click', (e) => {
  // Try to find a generic send/submit button action, even if it's a div, span, or SVG
  const target = e.target.closest('button, [role="button"], [aria-label*="send" i], [aria-label*="Submit" i], [data-testid*="send" i], form, .send-button');
  
  if (target) {
    // Look for common patterns indicating a submit/send button
    const ariaLabel = target.getAttribute('aria-label')?.toLowerCase() || "";
    const testId = target.getAttribute('data-testid')?.toLowerCase() || "";
    const tooltip = target.getAttribute('title')?.toLowerCase() || "";
    const htmlContent = target.innerHTML?.toLowerCase() || "";
    
    // Most AI platforms have an SVG send arrow, "send" in test-id, or "send" aria labels
    const isSendAction = 
      target.tagName === 'BUTTON' ||
      target.tagName === 'FORM' ||
      ariaLabel.includes('send') || ariaLabel.includes('submit') || ariaLabel.includes('message') ||
      testId.includes('send') || testId.includes('submit') ||
      tooltip.includes('send') || tooltip.includes('submit') ||
      htmlContent.includes('<svg') || htmlContent.includes('send') || 
      e.target.tagName.toLowerCase() === 'svg' || e.target.tagName.toLowerCase() === 'path';
    
    if (isSendAction) {
      // Check if we are currently focused in an input
      let textarea = document.activeElement;
      if (!textarea || !(textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT' || textarea.isContentEditable)) {
          // Fallback to searching the DOM for the most likely main input area
          textarea = document.getElementById('prompt-textarea') || 
                     document.querySelector('div[contenteditable="true"]') ||
                     document.querySelector('textarea') ||
                     document.querySelector('input[type="text"]');
      }
                       
      if (textarea) {
        let text = textarea.value || textarea.innerText || textarea.textContent;
        handlePromptSubmit(text);
      }
    }
  }
}, true);
