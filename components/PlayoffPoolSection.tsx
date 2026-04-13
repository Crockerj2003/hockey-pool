"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Player,
  PlayoffPick,
  PlayoffSettings,
  PlayoffTeamOption,
} from "@/lib/types";
import { ParsedRosterPlayerWithTeam } from "@/lib/nhl-playoff";
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

  const [allSkaters, setAllSkaters] = useState<ParsedRosterPlayerWithTeam[]>(
    []
  );
  const [allGoalies, setAllGoalies] = useState<ParsedRosterPlayerWithTeam[]>(
    []
  );
  const [combinedLoading, setCombinedLoading] = useState(false);
  const [skaterIds, setSkaterIds] = useState<number[]>([]);
  const [goalieId, setGoalieId] = useState<number | null>(null);
  const [existingPicks, setExistingPicks] = useState<PlayoffPick[]>([]);
  const [skaterFilter, setSkaterFilter] = useState("");
  /** Empty string = all playoff teams */
  const [filterTeam, setFilterTeam] = useState("");

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
      setAllSkaters([]);
      setAllGoalies([]);
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
    } catch {
      setError("Failed to load playoff roster");
    }
  }, [selectedPlayer]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  const hasSubmittedRoster = existingPicks.length > 0;
  const canEdit =
    !!selectedPlayer &&
    !picksLocked &&
    !hasSubmittedRoster &&
    teams.length > 0;

  useEffect(() => {
    if (!canEdit) {
      if (!hasSubmittedRoster) {
        setAllSkaters([]);
        setAllGoalies([]);
      }
      return;
    }
    let cancelled = false;
    setCombinedLoading(true);
    setError(null);
    fetch("/api/playoff/all-rosters", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAllSkaters(data.skaters || []);
        setAllGoalies(data.goalies || []);
        if (data.error) setError(data.error);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load playoff rosters");
      })
      .finally(() => {
        if (!cancelled) setCombinedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit, hasSubmittedRoster]);

  const handlePlayerChange = (id: string) => {
    setSelectedPlayer(id);
    setSkaterIds([]);
    setGoalieId(null);
    setFilterTeam("");
    setExistingPicks([]);
    setSubmittedFlash(false);
    setError(null);
    if (id) localStorage.setItem("hockey-pool-player", id);
    else localStorage.removeItem("hockey-pool-player");
  };

  const filteredSkaters = useMemo(() => {
    let list = allSkaters;
    if (filterTeam) {
      list = list.filter((p) => p.team_abbrev === filterTeam);
    }
    const q = skaterFilter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.team_abbrev.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const pa = a.season_points ?? 0;
      const pb = b.season_points ?? 0;
      if (pb !== pa) return pb - pa;
      return a.name.localeCompare(b.name);
    });
  }, [allSkaters, skaterFilter, filterTeam]);

  const displayedGoalies = useMemo(() => {
    let list = filterTeam
      ? allGoalies.filter((g) => g.team_abbrev === filterTeam)
      : allGoalies;
    return [...list].sort((a, b) => {
      const wa = a.season_wins ?? 0;
      const wb = b.season_wins ?? 0;
      if (wb !== wa) return wb - wa;
      return a.name.localeCompare(b.name);
    });
  }, [allGoalies, filterTeam]);

  useEffect(() => {
    if (!goalieId) return;
    const g = allGoalies.find((x) => x.nhl_player_id === goalieId);
    if (!g) return;
    if (filterTeam && g.team_abbrev !== filterTeam) {
      setGoalieId(null);
    }
  }, [filterTeam, goalieId, allGoalies]);

  const toggleSkater = (id: number) => {
    setSkaterIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 15) return prev;
      return [...prev, id];
    });
  };

  const readyToSubmit =
    canEdit &&
    skaterIds.length === 15 &&
    goalieId !== null &&
    !combinedLoading &&
    allSkaters.length > 0 &&
    allGoalies.length > 0;

  const handleSubmit = async () => {
    if (!selectedPlayer || goalieId === null) return;
    setSubmitting(true);
    setError(null);

    const rosterRows: Array<{
      nhl_player_id: number;
      team_abbrev: string;
      is_goalie: boolean;
    }> = [];

    for (const id of skaterIds) {
      const p = allSkaters.find((x) => x.nhl_player_id === id);
      if (p) {
        rosterRows.push({
          nhl_player_id: id,
          team_abbrev: p.team_abbrev,
          is_goalie: false,
        });
      }
    }
    const g = allGoalies.find((x) => x.nhl_player_id === goalieId);
    if (g) {
      rosterRows.push({
        nhl_player_id: goalieId,
        team_abbrev: g.team_abbrev,
        is_goalie: true,
      });
    }

    if (rosterRows.length !== 16) {
      setError("Could not resolve all players. Refresh and try again.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/playoff/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: selectedPlayer,
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
      await loadExisting();
      setTimeout(() => setSubmittedFlash(false), 2500);
    } catch {
      setError("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const showPickers = canEdit;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Playoff Pool</h1>
        <p className="text-sm text-muted-foreground">
          Pick any 15 skaters and 1 goalie from playoff teams (16 players total,
          any mix of teams). Lists sort by regular-season points (skaters) and
          wins (goalies), highest first. Skaters score from playoff points;
          goalies from playoff wins.
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
              Your roster
            </p>
            <ul className="divide-y divide-border text-sm">
              {existingPicks.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 py-2 first:pt-0"
                >
                  <span>
                    <span className="font-medium">{p.player_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {p.team_abbrev} · {p.is_goalie ? "G" : "Skater"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {p.stat_value} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {combinedLoading && showPickers && (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading all playoff team rosters…
          </p>
        </div>
      )}

      {!combinedLoading && showPickers && allSkaters.length > 0 && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Team filter
              </label>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t.abbrev} value={t.abbrev}>
                    {t.abbrev} — {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={skaterFilter}
                  onChange={(e) => setSkaterFilter(e.target.value)}
                  placeholder="Name or team…"
                  className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Skaters ({skaterIds.length}/15)
              </h2>
              <span className="text-xs text-muted-foreground">
                Sorted by NHL points (high → low)
              </span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border bg-card p-2 hide-scrollbar">
              {filteredSkaters.map((p) => {
                const on = skaterIds.includes(p.nhl_player_id);
                const disabled = !on && skaterIds.length >= 15;
                const pts = p.season_points ?? 0;
                return (
                  <label
                    key={`${p.team_abbrev}-${p.nhl_player_id}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 transition-colors sm:gap-3",
                      on ? "bg-primary/15" : "hover:bg-secondary/50",
                      disabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-border"
                      checked={on}
                      disabled={disabled}
                      onChange={() => toggleSkater(p.nhl_player_id)}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.team_abbrev} · {p.positionCode}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground sm:text-sm">
                      {pts} pts
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Goalie (1) — any playoff team
              </label>
              <span className="text-xs text-muted-foreground">
                Sorted by NHL wins (high → low)
              </span>
            </div>
            <select
              value={goalieId ?? ""}
              onChange={(e) =>
                setGoalieId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-base text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a goalie…</option>
              {displayedGoalies.map((g) => (
                <option key={g.nhl_player_id} value={g.nhl_player_id}>
                  {g.name} ({g.team_abbrev}) — {g.season_wins ?? 0} W
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
