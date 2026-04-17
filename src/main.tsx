
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

const participantId = window.location.pathname
  .split("/")
  .filter(Boolean)[0] ?? null;

createRoot(document.getElementById("root")!).render(
  <App participantId={participantId} />,
);
  
