"use client";

import { useEffect, useState } from "react";

/** Client hook: whether playoff UI tabs are visible (from Admin toggle). */
export function usePlayoffsUiEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/playoff/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEnabled(!!data.settings?.ui_enabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, loading };
}
