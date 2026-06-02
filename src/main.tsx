
import { createRoot } from "react-dom/client";
import AdminApp from "./admin/AdminApp.tsx";
import App from "./app/App.tsx";
import LandingPage from "./app/LandingPage.tsx";
import logoSmall from "./assets/logoSmall.png";
import "./styles/index.css";

const routeSegment = window.location.pathname
  .split("/")
  .filter(Boolean)[0] ?? null;

const isAdminRoute = routeSegment === "admin";

document.title = isAdminRoute
  ? "Admin mETHric"
  : routeSegment
    ? "Tracking mETHric"
    : "mETHric";

const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  ?? document.createElement("link");
favicon.rel = "icon";
favicon.href = logoSmall;
document.head.appendChild(favicon);

createRoot(document.getElementById("root")!).render(
  isAdminRoute ? <AdminApp /> : routeSegment ? <App participantId={routeSegment} /> : <LandingPage />,
);
  
