
import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";

const AdminApp = lazy(() => import("./admin/AdminApp.tsx"));
const App = lazy(() => import("./app/App.tsx"));
const LandingPage = lazy(() => import("./app/LandingPage.tsx"));
import logoSmall from "./assets/logoSmall.png";
import "./styles/index.css";

const routeSegment = window.location.pathname
  .split("/")
  .filter(Boolean)[0] ?? null;

const isAdminRoute = routeSegment === "admin";
const isStatisticsRoute = routeSegment === "statistics";

document.title = isStatisticsRoute ? "Statistics mETHric" : isAdminRoute
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
  <Suspense fallback={<div role="status" aria-label="Loading" className="min-h-screen bg-slate-50" />}>
  {isStatisticsRoute ? <AdminApp statistics /> : isAdminRoute ? <AdminApp participantId={window.location.pathname.split('/').filter(Boolean)[1]} /> : routeSegment ? <App participantId={routeSegment} /> : <LandingPage />}
  </Suspense>,
);
  
