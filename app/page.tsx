"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import RegularSeasonPicks from "@/components/RegularSeasonPicks";
import PlayoffPoolSection from "@/components/PlayoffPoolSection";

const MODE_KEY = "hockey-pool-mode";

export default function HomePage() {
  const [mode, setMode] = useState<"regular" | "playoff">("regular");

  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "playoff" || saved === "regular") {
      setMode(saved);
    }
  }, []);

  const setModeAndPersist = (next: "regular" | "playoff") => {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };

  return (
    <div className="px-4">
      <div className="mb-6 flex gap-1 rounded-lg bg-secondary p-1">
        <button
          type="button"
          onClick={() => setModeAndPersist("regular")}
          className={cn(
            "flex-1 rounded-md py-2.5 text-sm font-medium transition-all",
            mode === "regular"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Regular season
        </button>
        <button
          type="button"
          onClick={() => setModeAndPersist("playoff")}
          className={cn(
            "flex-1 rounded-md py-2.5 text-sm font-medium transition-all",
            mode === "playoff"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Playoffs
        </button>
      </div>

      {mode === "regular" ? <RegularSeasonPicks /> : <PlayoffPoolSection />}
    </div>
  );
}
