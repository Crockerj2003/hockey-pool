"use client";

import { useState, useEffect } from "react";
import { LeaderboardEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Trophy, Loader2, Medal } from "lucide-react";

export default function LeaderboardPage() {
  const [mode, setMode] = useState<"weekend" | "alltime">("weekend");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPlayer(localStorage.getItem("hockey-pool-player"));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?mode=${mode}`)
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data.leaderboard || []);
        setTotalGames(data.total_games || 0);
      })
      .catch(() => setLeaderboard([]))
      .finally(() => setLoading(false));
  }, [mode]);

  return (
    <div className="px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trophy className="h-6 w-6 text-yellow-400" />
          Standings
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-lg bg-secondary p-1">
        <button
          onClick={() => setMode("weekend")}
          className={cn(
            "flex-1 rounded-md py-2.5 text-sm font-medium transition-all",
            mode === "weekend"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          This Weekend
        </button>
        <button
          onClick={() => setMode("alltime")}
          className={cn(
            "flex-1 rounded-md py-2.5 text-sm font-medium transition-all",
            mode === "alltime"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          All-Time
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && leaderboard.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No data yet</p>
          <p className="text-sm">Standings will appear once picks are made</p>
        </div>
      )}

      {/* Leaderboard */}
      {!loading && leaderboard.length > 0 && (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => {
            const isCurrentPlayer = entry.player_id === currentPlayer;
            const rank = index + 1;

            return (
              <div
                key={entry.player_id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 transition-all",
                  isCurrentPlayer
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card"
                )}
              >
                {/* Rank */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                  {rank === 1 ? (
                    <Medal className="h-6 w-6 text-yellow-400" />
                  ) : rank === 2 ? (
                    <Medal className="h-6 w-6 text-gray-300" />
                  ) : rank === 3 ? (
                    <Medal className="h-6 w-6 text-amber-600" />
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">
                      {rank}
                    </span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1">
                  <span
                    className={cn(
                      "font-semibold",
                      isCurrentPlayer && "text-primary"
                    )}
                  >
                    {entry.player_name}
                  </span>
                  {isCurrentPlayer && (
                    <span className="ml-2 text-xs text-primary">(You)</span>
                  )}
                </div>

                {/* Score */}
                <div className="text-right">
                  <div className="text-lg font-bold">{entry.correct}</div>
                  <div className="text-xs text-muted-foreground">
                    /{mode === "weekend" ? totalGames : entry.total}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
