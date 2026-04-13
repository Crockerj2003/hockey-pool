"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Player,
  PlayoffPick,
  PlayoffSettings,
  PlayoffTeamOption,
} from "@/lib/types";
import TeamLogo from "@/components/TeamLogo";
import { ParsedRosterPlayer } from "@/lib/nhl-playoff";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  Lock,
  Search,
  Send,
  Snowflake,
} from "lucide-react";

export default function PlayoffPoolSection() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [teams, setTeams] = useState<PlayoffTeamOption[]>([]);
  const [settings, setSettings] = useState<PlayoffSettings | null>(null);
  const [picksLocked, setPicksLocked] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [roster, setRoster] = useState<ParsedRosterPlayer[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [skaterIds, setSkaterIds] = useState<number[]>([]);
  const [goalieId, setGoalieId] = useState<number | null>(null);
  const [existingPicks, setExistingPicks] = useState<PlayoffPick[]>([]);
  const [skaterFilter, setSkaterFilter] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submittedFlash, setSubmittedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/playoff/status", { cache: "no-store" });
      const data = await res.json();
      setSettings(data.settings);
      setTeams(data.teams || []);
      setPicksLocked(!!data.picks_locked);
    } catch {
      setError("Failed to load playoff data");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadSelectablePlayers = useCallback(async () => {
    try {
      const playersRes = await fetch("/api/players", { cache: "no-store" });
      const playersData = await playersRes.json();
      setPlayers(playersData.players || []);
    } catch {
      setError("Failed to load players");
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    loadSelectablePlayers();
  }, [loadSelectablePlayers]);

  useEffect(() => {
    const saved = localStorage.getItem("hockey-pool-player");
    if (saved) setSelectedPlayer(saved);
  }, []);

  useEffect(() => {
    if (selectedPlayer && !players.some((p) => p.id === selectedPlayer)) {
      setSelectedPlayer("");
      setExistingPicks([]);
      setSkaterIds([]);
      setGoalieId(null);
      setSelectedTeam("");
      setRoster([]);
      localStorage.removeItem("hockey-pool-player");
    }
  }, [players, selectedPlayer]);

  const loadExisting = useCallback(async () => {
    if (!selectedPlayer) {
      setExistingPicks([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/playoff/picks?player_id=${selectedPlayer}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const rows = data.picks || [];
      setExistingPicks(rows);
      setPicksLocked(!!data.picks_locked);
      if (rows.length > 0 && rows[0]?.team_abbrev) {
        setSelectedTeam(rows[0].team_abbrev);
      }
    } catch {
      setError("Failed to load playoff roster");
    }
  }, [selectedPlayer]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  useEffect(() => {
    if (!selectedTeam) {
      setRoster([]);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    fetch(`/api/playoff/roster?team=${encodeURIComponent(selectedTeam)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setRoster(data.roster || []);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load roster");
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTeam]);

  const handlePlayerChange = (id: string) => {
    setSelectedPlayer(id);
    setSkaterIds([]);
    setGoalieId(null);
    setSelectedTeam("");
    setRoster([]);
    setExistingPicks([]);
    setSubmittedFlash(false);
    setError(null);
    if (id) localStorage.setItem("hockey-pool-player", id);
    else localStorage.removeItem("hockey-pool-player");
  };

  const skatersOnRoster = useMemo(
    () => roster.filter((p) => !p.is_goalie),
    [roster]
  );
  const goaliesOnRoster = useMemo(
    () => roster.filter((p) => p.is_goalie),
    [roster]
  );

  const filteredSkaters = useMemo(() => {
    const q = skaterFilter.trim().toLowerCase();
    if (!q) return skatersOnRoster;
    return skatersOnRoster.filter((p) => p.name.toLowerCase().includes(q));
  }, [skatersOnRoster, skaterFilter]);

  const toggleSkater = (id: number) => {
    setSkaterIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 15) return prev;
      return [...prev, id];
    });
  };

  const hasSubmittedRoster = existingPicks.length > 0;
  const canEdit =
    !!selectedPlayer &&
    !picksLocked &&
    !hasSubmittedRoster &&
    teams.length > 0;

  const readyToSubmit =
    canEdit && skaterIds.length === 15 && goalieId !== null && selectedTeam;

  const handleSubmit = async () => {
    if (!selectedPlayer || !selectedTeam || !goalieId) return;
    setSubmitting(true);
    setError(null);
    const rosterRows: Array<{
      nhl_player_id: number;
      player_name: string;
      is_goalie: boolean;
    }> = [];
    for (const id of skaterIds) {
      const p = skatersOnRoster.find((x) => x.nhl_player_id === id);
      if (p)
        rosterRows.push({
          nhl_player_id: id,
          player_name: p.name,
          is_goalie: false,
        });
    }
    const g = goaliesOnRoster.find((x) => x.nhl_player_id === goalieId);
    if (g)
      rosterRows.push({
        nhl_player_id: goalieId,
        player_name: g.name,
        is_goalie: true,
      });

    try {
      const res = await fetch("/api/playoff/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: selectedPlayer,
          team_abbrev: selectedTeam,
          roster: rosterRows,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save roster");
        return;
      }
      setSubmittedFlash(true);
      setSkaterIds([]);
      setGoalieId(null);
      setRoster([]);
      await loadExisting();
      setTimeout(() => setSubmittedFlash(false), 2500);
    } catch {
      setError("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const showTeamGrid = canEdit;
  const showPickers = canEdit && !!selectedTeam;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Playoff Pool</h1>
        <p className="text-sm text-muted-foreground">
          Build a 16-player roster (15 skaters + 1 goalie) for the entire
          postseason. Skaters score fantasy points from playoff points; goalies
          from playoff wins.
        </p>
      </div>

      {settings && (
        <p className="mb-4 text-xs text-muted-foreground">
          Season {settings.season_id} · Bracket {settings.bracket_calendar_year}
        </p>
      )}

      <div className="mb-4">
        <select
          value={selectedPlayer}
          onChange={(e) => handlePlayerChange(e.target.value)}
          disabled={statusLoading}
          className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">Select your name...</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {selectedPlayer && picksLocked && !hasSubmittedRoster && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            Playoff picks are locked — the postseason has begun. You did not
            submit a roster in time.
          </span>
        </div>
      )}

      {selectedPlayer && hasSubmittedRoster && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            {picksLocked
              ? "Your playoff roster is locked in for the postseason."
              : "Your playoff roster is saved. You can review it below."}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {submittedFlash && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          Roster submitted for the playoffs!
        </div>
      )}

      {statusLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!statusLoading && teams.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          <Snowflake className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="font-medium text-foreground">No playoff teams yet</p>
          <p className="mt-1 text-sm">
            The NHL bracket is not available right now. Check back as the
            postseason approaches.
          </p>
        </div>
      )}

      {!statusLoading &&
        teams.length > 0 &&
        selectedPlayer &&
        hasSubmittedRoster && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-muted-foreground">
              Your roster · {existingPicks[0]?.team_abbrev}
            </p>
            <ul className="divide-y divide-border text-sm">
              {existingPicks.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-2 first:pt-0"
                >
                  <span>
                    {p.player_name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.is_goalie ? "G" : "Skater"}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {p.stat_value} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {!statusLoading && showTeamGrid && selectedPlayer && (
        <div className="mb-4">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Choose your team
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {teams.map((t) => {
              const active = selectedTeam === t.abbrev;
              return (
                <button
                  key={t.abbrev}
                  type="button"
                  onClick={() => {
                    setSelectedTeam(t.abbrev);
                    setSkaterIds([]);
                    setGoalieId(null);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition-all active:scale-[0.98]",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-secondary/40"
                  )}
                >
                  <TeamLogo src={t.logo} alt={t.abbrev} size={40} />
                  <span className="font-semibold leading-tight">{t.abbrev}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rosterLoading && showPickers && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!rosterLoading && showPickers && roster.length > 0 && (
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Skaters ({skaterIds.length}/15)
              </h2>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={skaterFilter}
                onChange={(e) => setSkaterFilter(e.target.value)}
                placeholder="Search skaters..."
                className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border bg-card p-2 hide-scrollbar">
              {filteredSkaters.map((p) => {
                const on = skaterIds.includes(p.nhl_player_id);
                const disabled = !on && skaterIds.length >= 15;
                return (
                  <label
                    key={p.nhl_player_id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors",
                      on ? "bg-primary/15" : "hover:bg-secondary/50",
                      disabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggleSkater(p.nhl_player_id)}
                    />
                    <span className="flex-1 text-sm">
                      {p.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.positionCode}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted-foreground">
              Goalie (1)
            </label>
            <select
              value={goalieId ?? ""}
              onChange={(e) =>
                setGoalieId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a goalie...</option>
              {goaliesOnRoster.map((g) => (
                <option key={g.nhl_player_id} value={g.nhl_player_id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {showPickers && readyToSubmit && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit playoff roster
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showPickers && readyToSubmit && <div className="h-28" />}
    </div>
  );
}
