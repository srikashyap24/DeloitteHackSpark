import React from "react";
import { createRoot } from "react-dom/client";
import EcoPromptBubble from "./bubble.jsx";

function mount() {
  let container = document.getElementById("ecoprompt-root");
  if (!container) {
    container = document.createElement("div");
    container.id = "ecoprompt-root";
    document.documentElement.appendChild(container);
  }
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <EcoPromptBubble />
    </React.StrictMode>
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
