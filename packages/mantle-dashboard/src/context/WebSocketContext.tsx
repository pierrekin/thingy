import type { MantleClient } from "@mantle-team/client";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { type ConnectionStatus, type GetAuthToken, wsStore } from "../ws-store";

type WebSocketContextValue = {
  client: MantleClient | null;
  status: ConnectionStatus;
};

type WebSocketProviderProps = {
  children: ReactNode;
  getAuthToken?: GetAuthToken;
};

export function WebSocketProvider({
  children,
  getAuthToken,
}: WebSocketProviderProps) {
  useEffect(() => {
    wsStore.setAuthTokenProvider(getAuthToken ?? null);
  }, [getAuthToken]);

  useEffect(() => {
    wsStore.acquire();
    return () => wsStore.release();
  }, []);

  return <>{children}</>;
}

export function useWebSocketContext(): WebSocketContextValue {
  return useSyncExternalStore(wsStore.subscribe, wsStore.getSnapshot);
}
