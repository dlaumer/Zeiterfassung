
import { createRoot } from "react-dom/client";
import AdminApp from "./admin/AdminApp.tsx";
import App from "./app/App.tsx";
import "./styles/index.css";

const routeSegment = window.location.pathname
  .split("/")
  .filter(Boolean)[0] ?? null;

const isAdminRoute = routeSegment === "admin";

createRoot(document.getElementById("root")!).render(
  isAdminRoute ? <AdminApp /> : <App participantId={routeSegment} />,
);
  
