"use client";

import { useState, useEffect, useMemo } from "react";
import { Game, Player, Pick as PickType, PlayoffPick } from "@/lib/types";
import { formatDisplayDate, isWeekendLocked } from "@/lib/dates";
import { cn } from "@/lib/utils";
import GameCard from "@/components/GameCard";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface PlayerPickData {
  player: Player;
  picks: Record<string, string>;
  correct: number;
  incorrect: number;
  pending: number;
}

type PlayoffPickRow = PlayoffPick & { player_name_display?: string };

export default function PicksViewPage() {
  const [view, setView] = useState<"weekend" | "playoff">("weekend");

  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [allPicks, setAllPicks] = useState<PickType[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [lockTime, setLockTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [playoffPicks, setPlayoffPicks] = useState<PlayoffPickRow[]>([]);
  const [playoffLoading, setPlayoffLoading] = useState(true);
  const [playoffLocked, setPlayoffLocked] = useState(false);

  useEffect(() => {
    async function loadWeekend() {
      try {
        const [playersRes, picksRes] = await Promise.all([
          fetch("/api/players"),
          fetch("/api/picks"),
        ]);
        const playersData = await playersRes.json();
        const picksData = await picksRes.json();

        setPlayers(playersData.players || []);
        setGames(picksData.games || []);
        setAllPicks(picksData.picks || []);
        setLockTime(picksData.week?.lock_time || null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadWeekend();
  }, []);

  useEffect(() => {
    async function loadPlayoff() {
      setPlayoffLoading(true);
      try {
        const res = await fetch("/api/playoff/picks", { cache: "no-store" });
        const data = await res.json();
        setPlayoffPicks(data.picks || []);
        setPlayoffLocked(!!data.picks_locked);
      } catch {
        setPlayoffPicks([]);
      } finally {
        setPlayoffLoading(false);
      }
    }
    loadPlayoff();
  }, []);

  const playerData: PlayerPickData[] = players.map((player) => {
    const playerPicks = allPicks.filter((p) => p.player_id === player.id);
    const pickMap: Record<string, string> = {};
    let correct = 0;
    let incorrect = 0;
    let pending = 0;

    playerPicks.forEach((p) => {
      pickMap[p.game_id] = p.picked_team;
      if (p.is_correct === true) correct++;
      else if (p.is_correct === false) incorrect++;
      else pending++;
    });

    return { player, picks: pickMap, correct, incorrect, pending };
  });

  playerData.sort((a, b) => b.correct - a.correct);

  const gamesByDate = games.reduce(
    (acc, game) => {
      if (!acc[game.game_date]) acc[game.game_date] = [];
      acc[game.game_date].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );
  const sortedDates = Object.keys(gamesByDate).sort();
  const picksRevealed = isWeekendLocked(lockTime);

  const playoffByPlayer = useMemo(() => {
    const m = new Map<
      string,
      { name: string; rows: PlayoffPickRow[]; teamLabel: string }
    >();
    for (const row of playoffPicks) {
      const id = row.player_id;
      const name =
        row.player_name_display ||
        players.find((p) => p.id === id)?.name ||
        "Unknown";
      if (!m.has(id)) {
        m.set(id, { name, rows: [], teamLabel: "" });
      }
      const g = m.get(id)!;
      g.rows.push(row);
    }
    for (const g of Array.from(m.values())) {
      const abbrevs = Array.from(
        new Set(g.rows.map((r) => r.team_abbrev).filter(Boolean))
      ).sort();
      g.teamLabel =
        abbrevs.length <= 2
          ? abbrevs.join(" · ")
          : `${abbrevs.length} teams`;
    }
    for (const g of Array.from(m.values())) {
      g.rows.sort((a, b) => {
        if (a.is_goalie !== b.is_goalie) return a.is_goalie ? 1 : -1;
        return a.player_name.localeCompare(b.player_name);
      });
    }
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => {
        const ptsA = a.rows.reduce((s, r) => s + (r.stat_value || 0), 0);
        const ptsB = b.rows.reduce((s, r) => s + (r.stat_value || 0), 0);
        return ptsB - ptsA;
      });
  }, [playoffPicks, players]);

  if (view === "weekend" && loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (view === "playoff" && playoffLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="mb-6 flex gap-1 rounded-lg bg-secondary p-1">
        <button
          type="button"
          onClick={() => setView("weekend")}
          className={cn(
            "flex-1 rounded-md py-2.5 text-sm font-medium transition-all",
            view === "weekend"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Weekend games
        </button>
        <button
          type="button"
          onClick={() => setView("playoff")}
          className={cn(
            "flex-1 rounded-md py-2.5 text-sm font-medium transition-all",
            view === "playoff"
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Playoff rosters
        </button>
      </div>

      {view === "weekend" && (
        <>
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6 text-primary" />
              All Picks
            </h1>
            <p className="text-sm text-muted-foreground">
              {picksRevealed
                ? "See what everyone picked this weekend"
                : "Picks are hidden until the first game starts"}
            </p>
          </div>

          {!picksRevealed && (
            <div className="mb-4 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              Picks will be revealed once the first game starts.
            </div>
          )}

          {playerData.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No picks yet</p>
              <p className="text-sm">
                Picks will show up once players submit them
              </p>
            </div>
          )}

          <div className="space-y-2">
            {playerData.map(({ player, picks, correct, incorrect, pending }) => {
              const isExpanded = expandedPlayer === player.id;
              const totalPicked = correct + incorrect + pending;

              return (
                <div
                  key={player.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <button
                    onClick={() =>
                      setExpandedPlayer(isExpanded ? null : player.id)
                    }
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50 active:bg-secondary/70"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{player.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {correct}
                        </span>
                        <span className="flex items-center gap-1 text-red-400">
                          <XCircle className="h-3 w-3" />
                          {incorrect}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {pending}
                        </span>
                        {totalPicked === 0 && (
                          <span className="text-muted-foreground">
                            No picks yet
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      {totalPicked === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No picks submitted
                        </p>
                      ) : (
                        sortedDates.map((date) => (
                          <div key={date} className="mb-4 last:mb-0">
                            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                              {formatDisplayDate(date)}
                            </h3>
                            <div className="space-y-2">
                              {gamesByDate[date].map((game) => (
                                <GameCard
                                  key={game.id}
                                  game={game}
                                  pickedTeam={
                                    picksRevealed ? picks[game.id] : undefined
                                  }
                                  locked={true}
                                  showResult={picksRevealed}
                                />
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "playoff" && (
        <>
          <div className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6 text-primary" />
              Playoff rosters
            </h1>
            <p className="text-sm text-muted-foreground">
              {playoffLocked
                ? "Full rosters are visible for the postseason"
                : "Rosters stay hidden until the playoffs begin"}
            </p>
          </div>

          {!playoffLocked && (
            <div className="mb-4 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
              Playoff rosters are hidden until the postseason starts (lock time
              is reached).
            </div>
          )}

          {playoffByPlayer.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No playoff rosters yet</p>
              <p className="text-sm">Check back after entries are submitted</p>
            </div>
          )}

          <div className="space-y-2">
            {playoffByPlayer.map((group) => {
              const isExpanded = expandedPlayer === group.id;
              const totalPts = group.rows.reduce(
                (s, r) => s + (r.stat_value || 0),
                0
              );
              return (
                <div
                  key={group.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPlayer(isExpanded ? null : group.id)
                    }
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50 active:bg-secondary/70"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{group.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {group.teamLabel} · {group.rows.length} players ·{" "}
                        {totalPts} pts
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {isExpanded && playoffLocked && (
                    <div className="border-t border-border px-4 pb-4 pt-3">
                      <ul className="divide-y divide-border text-sm">
                        {group.rows.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between py-2 first:pt-0"
                          >
                            <span>
                              {r.player_name}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {r.is_goalie ? "G" : "Skater"}
                              </span>
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {r.stat_value} pts
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {isExpanded && !playoffLocked && (
                    <div className="border-t border-border px-4 pb-4 pt-3 text-sm text-muted-foreground">
                      Roster hidden until playoffs begin.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
