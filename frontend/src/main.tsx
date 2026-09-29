/**
 * The web page starts here: load the fonts and styles, then show <App />.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/open-sans/latin-600.css";
import "@fontsource/open-sans/latin-700.css";
import "@fontsource/open-sans/latin-800.css";
import "./styles/index.css";
import App from "./app/App";

const root = document.getElementById("root");
if (!root) {
  throw new Error("The page is missing its #root element.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
