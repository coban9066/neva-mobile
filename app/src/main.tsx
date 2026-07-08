import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Fontlar offline paketlenir — CDN yok (offline-first kuralı)
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "./index.css";

// Tema: ilk boyamadan önce uygula (flash önleme)
if (localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
