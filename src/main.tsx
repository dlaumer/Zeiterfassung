
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  const getParticipantIdFromPath = (pathname: string): string | null => {
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length !== 1) {
      return null;
    }

    return segments[0];
  };

  const participantId = getParticipantIdFromPath(window.location.pathname);

  createRoot(document.getElementById("root")!).render(<App participantId={participantId} />);
  
