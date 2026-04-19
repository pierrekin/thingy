import { type ReactNode, useEffect, useMemo, useState } from "react";
import { NavButton } from "./components/NavButton";
import { Navbar } from "./components/Navbar";
import {
  useWebSocketContext,
  WebSocketProvider,
} from "./context/WebSocketContext";
import { useStateSubscription } from "./hooks/useStateSubscription";
import { useVisibleHub } from "./hooks/useVisibleHub";
import { InfrastructurePage } from "./pages/InfrastructurePage";
import { MainPage } from "./pages/MainPage";

type Page = "main" | "infrastructure";

/**
 * Round a timestamp down to the nearest bucket boundary
 */
function roundDown(timestamp: number, bucketDurationMs: number): number {
  return Math.floor(timestamp / bucketDurationMs) * bucketDurationMs;
}

type AppContentProps = {
  navbarIcon?: ReactNode;
  navbarTrailing?: ReactNode;
};

export function AppContent({ navbarIcon, navbarTrailing }: AppContentProps) {
  const [page, setPage] = useState<Page>("main");
  const { status } = useWebSocketContext();

  useEffect(() => {
    if (status === "connected") window.mantleLoader?.finish();
  }, [status]);

  // Calculate display window (dashboard is source of truth)
  const subscriptionParams = useMemo(() => {
    const now = Date.now();
    const bucketDurationMs = 5 * 60 * 1000; // 5 minutes
    const lookbackMs = 60 * 60 * 1000; // 60 minutes

    return {
      start: roundDown(now - lookbackMs, bucketDurationMs),
      end: null, // live mode
      bucketDurationMs,
    };
  }, []); // Static for now - will add time controls later

  // Create state subscription
  const subscriptionId = useStateSubscription(subscriptionParams);
  // Query visible data
  const hub = useVisibleHub(subscriptionId, subscriptionParams);

  const navActions =
    page === "main" ? (
      <NavButton onClick={() => setPage("infrastructure")}>
        Infrastructure
      </NavButton>
    ) : (
      <NavButton onClick={() => setPage("main")}>Targets</NavButton>
    );

  return (
    <>
      <Navbar
        title={hub.name}
        icon={navbarIcon}
        actions={navActions}
        trailing={navbarTrailing}
      />
      {page === "infrastructure" ? (
        <InfrastructurePage hub={hub} />
      ) : (
        <MainPage hub={hub} />
      )}
      {status === "disconnected" && (
        <div className="fixed bottom-4 right-4 bg-critical text-bone px-3 py-2 rounded-md text-sm">
          Disconnected - Reconnecting...
        </div>
      )}
    </>
  );
}

type AppProps = {
  getAuthToken?: () => Promise<string | null>;
  navbarIcon?: ReactNode;
  navbarTrailing?: ReactNode;
};

export default function App({
  getAuthToken,
  navbarIcon,
  navbarTrailing,
}: AppProps) {
  return (
    <WebSocketProvider getAuthToken={getAuthToken}>
      <div className="mx-auto max-w-md min-h-screen bg-charcoal">
        <AppContent navbarIcon={navbarIcon} navbarTrailing={navbarTrailing} />
      </div>
    </WebSocketProvider>
  );
}
