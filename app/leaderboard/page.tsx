"use client";

import { useState, useEffect } from "react";
import { Game, LeaderboardEntry, Pick as PickType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Trophy, Loader2, Medal, ChevronDown, ChevronUp } from "lucide-react";
import { formatDisplayDate, isWeekendLocked } from "@/lib/dates";
import GameCard from "@/components/GameCard";

interface WeekOption {
  id: string;
  start_date: string;
  end_date: string;
}

function formatWeekLabel(week: WeekOption): string {
  const start = new Date(`${week.start_date}T12:00:00`);
  const end = new Date(`${week.end_date}T12:00:00`);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

export default function LeaderboardPage() {
  const [mode, setMode] = useState<"weekend" | "alltime">("weekend");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [playerPicksByPlayerId, setPlayerPicksByPlayerId] = useState<
    Record<string, Record<string, string>>
  >({});
  const [gamesByPlayerId, setGamesByPlayerId] = useState<Record<string, Game[]>>(
    {}
  );
  const [picksRevealedByPlayerId, setPicksRevealedByPlayerId] = useState<
    Record<string, boolean>
  >({});
  const [loadingPlayerId, setLoadingPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPlayer, setCurrentPlayer] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPlayer(localStorage.getItem("hockey-pool-player"));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      mode,
      t: String(Date.now()),
    });
    if (mode === "weekend" && selectedWeekId) {
      params.set("week_id", selectedWeekId);
    }

    fetch(`/api/leaderboard?${params.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        setLeaderboard(data.leaderboard || []);
        setTotalGames(data.total_games || 0);
        setWeeks(data.weeks || []);
        if (
          mode === "weekend" &&
          !selectedWeekId &&
          typeof data.selected_week_id === "string"
        ) {
          setSelectedWeekId(data.selected_week_id);
        }
      })
      .catch(() => {
        setLeaderboard([]);
        setWeeks([]);
      })
      .finally(() => setLoading(false));
  }, [mode, selectedWeekId]);

  useEffect(() => {
    setExpandedPlayerId(null);
  }, [mode, selectedWeekId]);

  const loadPlayerPicks = async (playerId: string) => {
    if (mode !== "weekend" || !selectedWeekId) return;

    setLoadingPlayerId(playerId);
    try {
      const params = new URLSearchParams({
        player_id: playerId,
        week_id: selectedWeekId,
        t: String(Date.now()),
      });
      const res = await fetch(`/api/picks?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      const picks = (data.picks || []) as PickType[];
      const games = (data.games || []) as Game[];
      const pickMap: Record<string, string> = {};
      picks.forEach((p) => {
        pickMap[p.game_id] = p.picked_team;
      });
      setPlayerPicksByPlayerId((prev) => ({ ...prev, [playerId]: pickMap }));
      setGamesByPlayerId((prev) => ({ ...prev, [playerId]: games }));
      setPicksRevealedByPlayerId((prev) => ({
        ...prev,
        [playerId]: isWeekendLocked(data.week?.lock_time || null),
      }));
    } finally {
      setLoadingPlayerId(null);
    }
  };

  const togglePlayerExpansion = async (playerId: string) => {
    if (mode !== "weekend") return;
    if (expandedPlayerId === playerId) {
      setExpandedPlayerId(null);
      return;
    }
    setExpandedPlayerId(playerId);
    if (!gamesByPlayerId[playerId]) {
      await loadPlayerPicks(playerId);
    }
  };

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

      {mode === "weekend" && weeks.length > 0 && (
        <div className="mb-4">
          <select
            value={selectedWeekId}
            onChange={(e) => setSelectedWeekId(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          >
            {weeks.map((week) => (
              <option key={week.id} value={week.id}>
                {formatWeekLabel(week)}
              </option>
            ))}
          </select>
        </div>
      )}

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
            const isExpanded =
              mode === "weekend" && expandedPlayerId === entry.player_id;
            const playerGames = gamesByPlayerId[entry.player_id] || [];
            const playerPicks = playerPicksByPlayerId[entry.player_id] || {};
            const picksRevealed = picksRevealedByPlayerId[entry.player_id] || false;
            const groupedGames = playerGames.reduce(
              (acc, game) => {
                if (!acc[game.game_date]) acc[game.game_date] = [];
                acc[game.game_date].push(game);
                return acc;
              },
              {} as Record<string, Game[]>
            );
            const groupedDates = Object.keys(groupedGames).sort();

            return (
              <div
                key={entry.player_id}
                className={cn(
                  "overflow-hidden rounded-xl border transition-all",
                  isCurrentPlayer
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-card"
                )}
              >
                <button
                  onClick={() => togglePlayerExpansion(entry.player_id)}
                  disabled={mode !== "weekend"}
                  className={cn(
                    "flex w-full items-center gap-3 p-4 text-left",
                    mode === "weekend" &&
                      "hover:bg-secondary/40 active:bg-secondary/60"
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

                  {mode === "weekend" && (
                    <div className="ml-2">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    {loadingPlayerId === entry.player_id ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : groupedDates.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No picks for this week
                      </p>
                    ) : (
                      <>
                        {!picksRevealed && (
                          <div className="mb-3 rounded-lg bg-yellow-500/10 px-3 py-2 text-xs text-yellow-400">
                            Picks for this week are hidden until the first game
                            starts.
                          </div>
                        )}
                        {groupedDates.map((date) => (
                          <div key={date} className="mb-4 last:mb-0">
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                              {formatDisplayDate(date)}
                            </h3>
                            <div className="space-y-2">
                              {groupedGames[date].map((game) => (
                                <GameCard
                                  key={game.id}
                                  game={game}
                                  pickedTeam={
                                    picksRevealed
                                      ? playerPicks[game.id]
                                      : undefined
                                  }
                                  locked={true}
                                  showResult={picksRevealed}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
