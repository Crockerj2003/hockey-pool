"use client";

import { useState, useEffect } from "react";
import { Game, Player, Pick as PickType } from "@/lib/types";
import { formatDisplayDate } from "@/lib/dates";
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

export default function PicksViewPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [allPicks, setAllPicks] = useState<PickType[]>([]);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
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
      } catch {
        // Handle errors silently
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Build player pick data
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

  // Sort by most correct picks
  playerData.sort((a, b) => b.correct - a.correct);

  // Group games by date
  const gamesByDate = games.reduce(
    (acc, game) => {
      if (!acc[game.game_date]) acc[game.game_date] = [];
      acc[game.game_date].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );
  const sortedDates = Object.keys(gamesByDate).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6 text-primary" />
          All Picks
        </h1>
        <p className="text-sm text-muted-foreground">
          See what everyone picked this weekend
        </p>
      </div>

      {/* No data */}
      {playerData.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No picks yet</p>
          <p className="text-sm">Picks will show up once players submit them</p>
        </div>
      )}

      {/* Player accordions */}
      <div className="space-y-2">
        {playerData.map(({ player, picks, correct, incorrect, pending }) => {
          const isExpanded = expandedPlayer === player.id;
          const totalPicked = correct + incorrect + pending;

          return (
            <div
              key={player.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              {/* Accordion header */}
              <button
                onClick={() =>
                  setExpandedPlayer(isExpanded ? null : player.id)
                }
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50 active:bg-secondary/70"
              >
                <div className="flex-1">
                  <div className="font-semibold">{player.name}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
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
                      <span className="text-muted-foreground">No picks yet</span>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {/* Expanded picks */}
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
                              pickedTeam={picks[game.id]}
                              locked={true}
                              showResult={true}
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
    </div>
  );
}
