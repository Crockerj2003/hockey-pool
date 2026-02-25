"use client";

import { useState, useEffect, useCallback } from "react";
import { Player, Game } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Shield,
  LogIn,
  UserPlus,
  RefreshCw,
  Loader2,
  Users,
  Zap,
  Settings,
} from "lucide-react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authToken, setAuthToken] = useState("");

  const handleLogin = async () => {
    setAuthError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setAuthenticated(true);
        setAuthToken(password);
      } else {
        setAuthError("Invalid password");
      }
    } catch {
      setAuthError("Connection error");
    }
  };

  if (!authenticated) {
    return (
      <div className="px-4">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Shield className="h-6 w-6 text-primary" />
            Admin
          </h1>
        </div>

        <div className="mx-auto max-w-sm space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Enter admin password"
            className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
          />
          {authError && (
            <p className="text-sm text-red-400">{authError}</p>
          )}
          <button
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            <LogIn className="h-5 w-5" />
            Log In
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard authToken={authToken} />;
}

function AdminDashboard({ authToken }: { authToken: string }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState("");
  const [activeTab, setActiveTab] = useState<"players" | "sync" | "override">(
    "players"
  );

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  const loadPlayers = useCallback(async () => {
    const res = await fetch("/api/players?all=true");
    const data = await res.json();
    setPlayers(data.players || []);
  }, []);

  const loadGames = useCallback(async () => {
    const res = await fetch("/api/picks");
    const data = await res.json();
    setGames(data.games || []);
  }, []);

  useEffect(() => {
    loadPlayers();
    loadGames();
  }, [loadPlayers, loadGames]);

  const addPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setAddingPlayer(true);
    setPlayerError("");

    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newPlayerName.trim() }),
      });

      if (res.ok) {
        setNewPlayerName("");
        loadPlayers();
      } else {
        const data = await res.json();
        setPlayerError(data.error || "Failed to add player");
      }
    } catch {
      setPlayerError("Connection error");
    } finally {
      setAddingPlayer(false);
    }
  };

  const togglePlayer = async (id: string, currentActive: boolean) => {
    await fetch("/api/players", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ id, is_active: !currentActive }),
    });
    loadPlayers();
  };

  const triggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers,
      });
      const data = await res.json();

      if (res.ok) {
        setSyncResult(
          `Synced ${data.games_upserted} games, updated ${data.scores_updated} scores`
        );
        loadGames();
      } else {
        setSyncResult(`Error: ${data.error}`);
      }
    } catch {
      setSyncResult("Sync failed - connection error");
    } finally {
      setSyncing(false);
    }
  };

  const overrideWinner = async (gameId: string, winner: string) => {
    await fetch("/api/admin", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ game_id: gameId, winner }),
    });
    loadGames();
  };

  return (
    <div className="px-4">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield className="h-6 w-6 text-primary" />
          Admin Dashboard
        </h1>
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-lg bg-secondary p-1">
        {[
          { key: "players" as const, label: "Players", icon: Users },
          { key: "sync" as const, label: "Sync", icon: Zap },
          { key: "override" as const, label: "Override", icon: Settings },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-medium transition-all",
              activeTab === key
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Players tab */}
      {activeTab === "players" && (
        <div>
          {/* Add player form */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="New player name"
              className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={addPlayer}
              disabled={addingPlayer}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 active:scale-95"
            >
              {addingPlayer ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add
            </button>
          </div>
          {playerError && (
            <p className="mb-4 text-sm text-red-400">{playerError}</p>
          )}

          {/* Player list */}
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <span className="font-medium">{player.name}</span>
                <button
                  onClick={() => togglePlayer(player.id, player.is_active)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                    player.is_active
                      ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                      : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  )}
                >
                  {player.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync tab */}
      {activeTab === "sync" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sync fetches the weekend game schedule from the NHL API and updates
            scores for completed games.
          </p>
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
          >
            {syncing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
            {syncing ? "Syncing..." : "Sync Games & Scores"}
          </button>
          {syncResult && (
            <div
              className={cn(
                "rounded-lg px-4 py-3 text-sm",
                syncResult.startsWith("Error")
                  ? "bg-red-500/10 text-red-400"
                  : "bg-green-500/10 text-green-400"
              )}
            >
              {syncResult}
            </div>
          )}
          <div className="rounded-lg bg-secondary/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Auto-sync schedule</p>
            <p className="mt-1">
              Cron job runs every 30 minutes daily from 12PM-11PM UTC so
              upcoming weekend games are synced before Friday. You can also
              trigger a manual sync anytime using the button above.
            </p>
          </div>
        </div>
      )}

      {/* Override tab */}
      {activeTab === "override" && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Manually set the winner of a game. This will override the NHL API
            result.
          </p>
          {games.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No games synced yet. Go to the Sync tab first.
            </p>
          ) : (
            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {game.away_team} @ {game.home_team}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        game.status === "final"
                          ? "bg-secondary text-muted-foreground"
                          : game.status === "live"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {game.status.toUpperCase()}
                    </span>
                  </div>
                  {game.winner && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Current winner: <span className="font-semibold text-foreground">{game.winner}</span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => overrideWinner(game.id, game.away_team)}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                        game.winner === game.away_team
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      )}
                    >
                      {game.away_team} Wins
                    </button>
                    <button
                      onClick={() => overrideWinner(game.id, game.home_team)}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-sm font-medium transition-all",
                        game.winner === game.home_team
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground hover:bg-secondary/80"
                      )}
                    >
                      {game.home_team} Wins
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
