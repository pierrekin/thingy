import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import markDark from "@mantle-team/mantle-brand/mark-dark.svg";
import { colors } from "@mantle-team/mantle-brand/tokens";
import App from "./App.tsx";

document
  .querySelector('meta[name="theme-color"]')
  ?.setAttribute("content", colors.charcoal);

const root = document.getElementById("root");
if (!root) {
  throw new Error('index.html is missing a <div id="root"> element');
}
createRoot(root).render(
  <StrictMode>
    <App navbarIcon={<img src={markDark} alt="Mantle" />} />
  </StrictMode>,
);
