import { useEffect, useRef, useState } from "react";
import { useDataStore } from "../subscriptions/data-store";
import { deriveHub } from "../subscriptions/derive-hub";
import type { StateSubscriptionParams } from "../subscriptions/types";
import type { Hub } from "../types";

/**
 * Hook to get the visible Hub data for a subscription.
 * Uses a single Zustand subscription with debouncing to avoid cascade re-renders.
 */
export function useVisibleHub(
  subscriptionId: string | null,
  params?: StateSubscriptionParams,
): Hub {
  const [hub, setHub] = useState<Hub>({
    name: "Hub",
    providers: [],
    channels: [],
    agents: [],
    targets: [],
  });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!subscriptionId || !params) {
      setHub({
        name: "Hub",
        providers: [],
        channels: [],
        agents: [],
        targets: [],
      });
      return;
    }

    // Initial render
    setHub(deriveHub(subscriptionId, params));

    // Subscribe to store changes with RAF debouncing
    const unsubscribe = useDataStore.subscribe(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        setHub(deriveHub(subscriptionId, params));
        rafRef.current = null;
      });
    });

    return () => {
      unsubscribe();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [subscriptionId, params]);

  return hub;
}
