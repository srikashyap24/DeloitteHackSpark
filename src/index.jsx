import React from "react";
import { createRoot } from "react-dom/client";
import GreenPromptBubble from "./bubble.jsx";

function mount() {
  let container = document.getElementById("greenprompt-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "greenprompt-root";
    document.documentElement.appendChild(container);
  }
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <GreenPromptBubble />
    </React.StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
