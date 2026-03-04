"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const CHANGELOG_VERSION = "2026-02-week-history";
const STORAGE_KEY = `hockey-pool-changelog-dismissed:${CHANGELOG_VERSION}`;

export default function ChangelogBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
    setVisible(!dismissed);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">What&apos;s New</p>
          <p className="text-xs text-muted-foreground">
            We shipped a few updates to make the pool easier to follow.
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss changelog"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-1 text-sm text-foreground/90">
        <li>- Standings now include a week selector for previous weekends.</li>
        <li>- Tap a player in standings to view that week&apos;s picks.</li>
        <li>- All Picks stay hidden until first game start.</li>
      </ul>
    </div>
  );
}
