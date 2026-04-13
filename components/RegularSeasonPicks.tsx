"use client";

import { useState, useEffect, useCallback } from "react";
import { Game, Player, Pick as PickType } from "@/lib/types";
import { formatDisplayDate, isWeekendLocked } from "@/lib/dates";
import GameCard from "@/components/GameCard";
import { Lock, Send, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RegularSeasonPicks() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [games, setGames] = useState<Game[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [existingPicks, setExistingPicks] = useState<PickType[]>([]);
  const [lockTime, setLockTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSelectablePlayers = useCallback(async () => {
    try {
      const [playersRes, picksRes] = await Promise.all([
        fetch("/api/players", { cache: "no-store" }),
        fetch("/api/picks", { cache: "no-store" }),
      ]);
      const playersData = await playersRes.json();
      const picksData = await picksRes.json();
      const submittedPlayerIds = new Set<string>(
        (picksData.picks || []).map((p: PickType) => p.player_id)
      );
      const availablePlayers = (playersData.players || []).filter(
        (p: Player) => !submittedPlayerIds.has(p.id)
      );
      setPlayers(availablePlayers);
    } catch {
      setError("Failed to load players");
    }
  }, []);

  useEffect(() => {
    loadSelectablePlayers();
  }, [loadSelectablePlayers]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedPlayer
        ? `/api/picks?player_id=${selectedPlayer}`
        : "/api/picks";
      const res = await fetch(url);
      const data = await res.json();

      setGames(data.games || []);
      setLockTime(data.week?.lock_time || null);

      if (selectedPlayer && data.picks) {
        const pickMap: Record<string, string> = {};
        data.picks.forEach((p: PickType) => {
          pickMap[p.game_id] = p.picked_team;
        });
        setPicks(pickMap);
        setExistingPicks(data.picks);
      }
    } catch {
      setError("Failed to load games");
    } finally {
      setLoading(false);
    }
  }, [selectedPlayer]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const saved = localStorage.getItem("hockey-pool-player");
    if (saved) setSelectedPlayer(saved);
  }, []);

  useEffect(() => {
    if (selectedPlayer && !players.some((p) => p.id === selectedPlayer)) {
      setSelectedPlayer("");
      setPicks({});
      setExistingPicks([]);
      localStorage.removeItem("hockey-pool-player");
    }
  }, [players, selectedPlayer]);

  const handlePlayerChange = (playerId: string) => {
    setSelectedPlayer(playerId);
    setPicks({});
    setExistingPicks([]);
    setSubmitted(false);
    localStorage.setItem("hockey-pool-player", playerId);
  };

  const handlePick = (gameId: string, team: string) => {
    setPicks((prev) => ({ ...prev, [gameId]: team }));
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!selectedPlayer) return;

    setSubmitting(true);
    setError(null);

    try {
      const picksArray = Object.entries(picks).map(([game_id, picked_team]) => ({
        game_id,
        picked_team,
      }));

      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: selectedPlayer,
          picks: picksArray,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit picks");
      } else {
        const submittedPlayerId = selectedPlayer;
        setSubmitted(true);
        setSelectedPlayer("");
        setPicks({});
        setExistingPicks([]);
        localStorage.removeItem("hockey-pool-player");
        setPlayers((prev) => prev.filter((p) => p.id !== submittedPlayerId));
        setTimeout(() => setSubmitted(false), 3000);
      }
    } catch {
      setError("Failed to submit picks");
    } finally {
      setSubmitting(false);
    }
  };

  const locked = isWeekendLocked(lockTime);

  const gamesByDate = games.reduce(
    (acc, game) => {
      if (!acc[game.game_date]) acc[game.game_date] = [];
      acc[game.game_date].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );

  const sortedDates = Object.keys(gamesByDate).sort();
  const pickedCount = Object.keys(picks).length;
  const totalGames = games.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hockey Pool</h1>
        <p className="text-sm text-muted-foreground">
          Pick the winner of each game
        </p>
      </div>

      <div className="mb-4">
        <select
          value={selectedPlayer}
          onChange={(e) => handlePlayerChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Select your name...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {locked && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Picks are locked. The first game has started.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && games.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No games this weekend</p>
          <p className="text-sm">Check back when games are synced</p>
        </div>
      )}

      {!loading &&
        sortedDates.map((date) => (
          <div key={date} className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">
              {formatDisplayDate(date)}
            </h2>
            <div className="space-y-3">
              {gamesByDate[date].map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  pickedTeam={picks[game.id]}
                  onPick={selectedPlayer ? handlePick : undefined}
                  locked={locked || !selectedPlayer}
                  showResult={locked}
                />
              ))}
            </div>
          </div>
        ))}

      {selectedPlayer && !locked && games.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {pickedCount}/{totalGames} games picked
              </span>
              {existingPicks.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Previously saved picks loaded
                </span>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || pickedCount === 0}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold transition-all",
                submitted
                  ? "bg-green-500 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
                (submitting || pickedCount === 0) && "opacity-50"
              )}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : submitted ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Picks Saved!
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit Picks
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {selectedPlayer && !locked && games.length > 0 && (
        <div className="h-28" />
      )}
    </div>
  );
}
