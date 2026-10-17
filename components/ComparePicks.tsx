"use client";

import { useMemo, useState } from "react";
import { Game, Player, Pick as PickType } from "@/lib/types";
import { formatDisplayDate, formatGameTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import TeamLogo from "@/components/TeamLogo";
import { ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";

interface ComparePicksProps {
  players: Player[];
  games: Game[];
  picks: PickType[];
  revealed: boolean;
}

interface Side {
  id: string;
  name: string;
  picks: Record<string, string>;
  correct: number;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= kk; i++) {
    result = (result * (n - kk + i)) / i;
  }
  return result;
}

function tossUpOdds(correctA: number, correctB: number, swings: number) {
  let aWins = 0;
  let ties = 0;
  let bWins = 0;
  let total = 0;
  for (let bPoints = 0; bPoints <= swings; bPoints++) {
    const ways = binomial(swings, bPoints);
    total += ways;
    const aScore = correctA + (swings - bPoints);
    const bScore = correctB + bPoints;
    if (aScore > bScore) aWins += ways;
    else if (aScore === bScore) ties += ways;
    else bWins += ways;
  }
  const pct = (n: number) => (total === 0 ? 0 : Math.round((100 * n) / total));
  return { a: pct(aWins), tie: pct(ties), b: pct(bWins) };
}

function outlook(
  nameA: string,
  nameB: string,
  correctA: number,
  correctB: number,
  swings: number
): string {
  const lead = correctA - correctB;
  const leader = lead > 0 ? nameA : nameB;
  const trailer = lead > 0 ? nameB : nameA;
  const margin = Math.abs(lead);

  if (swings === 0) {
    if (margin === 0) {
      return "They're tied. Every remaining game is the same pick, so the gap can't change.";
    }
    return `${leader} finishes ahead by ${margin}. Every remaining game is the same pick, so the gap can't change.`;
  }

  if (margin === 0) {
    return `They're tied. Whoever takes more of the ${swings} game${swings === 1 ? "" : "s"} they picked differently will finish ahead.`;
  }

  if (margin > swings) {
    return `${leader} has clinched. ${trailer} can gain at most ${swings} more point${swings === 1 ? "" : "s"} from games they picked differently.`;
  }

  if (margin === swings) {
    return `${leader} leads by ${margin}. ${trailer} can only tie by winning all ${swings} game${swings === 1 ? "" : "s"} they picked differently.`;
  }

  return `${leader} leads by ${margin}. ${trailer} needs ${margin} of the ${swings} different remaining games to tie, and ${margin + 1} to take the lead.`;
}

export default function ComparePicks({
  players,
  games,
  picks,
  revealed,
}: ComparePicksProps) {
  const [playerAId, setPlayerAId] = useState("");
  const [playerBId, setPlayerBId] = useState("");
  const [showSame, setShowSame] = useState(false);

  const pickMaps = useMemo(() => {
    const maps = new Map<string, Record<string, string>>();
    for (const pick of picks) {
      const current = maps.get(pick.player_id) || {};
      current[pick.game_id] = pick.picked_team;
      maps.set(pick.player_id, current);
    }
    return maps;
  }, [picks]);

  const comparablePlayers = players.filter((player) => pickMaps.has(player.id));

  const buildSide = (id: string): Side | null => {
    const player = players.find((p) => p.id === id);
    if (!player) return null;
    const playerPicks = pickMaps.get(id) || {};
    let correct = 0;
    for (const game of games) {
      if (game.status === "final" && game.winner && playerPicks[game.id] === game.winner) {
        correct++;
      }
    }
    return { id, name: player.name, picks: playerPicks, correct };
  };

  const sideA = playerAId ? buildSide(playerAId) : null;
  const sideB = playerBId ? buildSide(playerBId) : null;

  const comparison = useMemo(() => {
    if (!sideA || !sideB) return null;
    const differentOpen: Game[] = [];
    const differentFinal: Game[] = [];
    const same: Game[] = [];

    for (const game of games) {
      const pickA = sideA.picks[game.id];
      const pickB = sideB.picks[game.id];
      if (!pickA && !pickB) continue;
      if (pickA && pickB && pickA === pickB) {
        same.push(game);
        continue;
      }
      if (game.status === "final" && game.winner) {
        differentFinal.push(game);
      } else {
        differentOpen.push(game);
      }
    }

    return { differentOpen, differentFinal, same };
  }, [games, sideA, sideB]);

  const selectClass =
    "w-full rounded-lg border border-border bg-card px-3 py-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary";

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ArrowLeftRight className="h-6 w-6 text-primary" />
          Compare
        </h1>
        <p className="text-sm text-muted-foreground">
          See where two players differ, and who can still finish ahead
        </p>
      </div>

      {!revealed && (
        <div className="rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          Comparison opens once the first game starts.
        </div>
      )}

      {revealed && comparablePlayers.length < 2 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">Not enough picks yet</p>
          <p className="text-sm">Two players need to submit before you can compare</p>
        </div>
      )}

      {revealed && comparablePlayers.length >= 2 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <select
              value={playerAId}
              onChange={(e) => {
                const next = e.target.value;
                setPlayerAId(next);
                if (next && next === playerBId) setPlayerBId("");
              }}
              className={selectClass}
            >
              <option value="">Player A</option>
              {comparablePlayers
                .filter((player) => player.id !== playerBId)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
            </select>
            <select
              value={playerBId}
              onChange={(e) => {
                const next = e.target.value;
                setPlayerBId(next);
                if (next && next === playerAId) setPlayerAId("");
              }}
              className={selectClass}
            >
              <option value="">Player B</option>
              {comparablePlayers
                .filter((player) => player.id !== playerAId)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
            </select>
          </div>

          {sideA && sideB && comparison && (
            <ComparisonBody
              sideA={sideA}
              sideB={sideB}
              comparison={comparison}
              showSame={showSame}
              onToggleSame={() => setShowSame((open) => !open)}
            />
          )}
        </>
      )}
    </div>
  );
}

function ComparisonBody({
  sideA,
  sideB,
  comparison,
  showSame,
  onToggleSame,
}: {
  sideA: Side;
  sideB: Side;
  comparison: { differentOpen: Game[]; differentFinal: Game[]; same: Game[] };
  showSame: boolean;
  onToggleSame: () => void;
}) {
  const swings = comparison.differentOpen.filter(
    (game) => sideA.picks[game.id] && sideB.picks[game.id]
  ).length;
  const missingSwing = comparison.differentOpen.length - swings;
  const odds =
    missingSwing === 0 ? tossUpOdds(sideA.correct, sideB.correct, swings) : null;
  const summary = outlook(
    sideA.name,
    sideB.name,
    sideA.correct,
    sideB.correct,
    swings
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <ScoreCard name={sideA.name} correct={sideA.correct} />
        <ScoreCard name={sideB.name} correct={sideB.correct} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">{summary}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Games they picked the same way can&apos;t change the lead.
          {odds &&
            swings > 0 &&
            " Odds below treat each different remaining game as a 50/50."}
        </p>
        {odds && swings > 0 && (
          <p className="mt-3 text-sm font-medium tabular-nums">
            {sideA.name} {odds.a}% · Tie {odds.tie}% · {sideB.name} {odds.b}%
          </p>
        )}
      </div>

      <GameGroup
        title={`Can still swing it (${swings})`}
        games={comparison.differentOpen}
        sideA={sideA}
        sideB={sideB}
        empty="They picked the same teams on every game still to be decided."
      />
      <GameGroup
        title={`Already decided (${comparison.differentFinal.length})`}
        games={comparison.differentFinal}
        sideA={sideA}
        sideB={sideB}
        empty="No decided games where they picked different teams."
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <button
          type="button"
          onClick={onToggleSame}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
        >
          Same pick ({comparison.same.length})
          {showSame ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {showSame && (
          <div className="border-t border-border px-4 py-3">
            <GameGroup
              title=""
              games={comparison.same}
              sideA={sideA}
              sideB={sideB}
              empty="They didn't match on any game."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ name, correct }: { name: string; correct: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="truncate text-sm text-muted-foreground">{name}</p>
      <p className="text-2xl font-bold tabular-nums">{correct}</p>
      <p className="text-xs text-muted-foreground">correct so far</p>
    </div>
  );
}

function GameGroup({
  title,
  games,
  sideA,
  sideB,
  empty,
}: {
  title: string;
  games: Game[];
  sideA: Side;
  sideB: Side;
  empty: string;
}) {
  const byDate = games.reduce(
    (acc, game) => {
      if (!acc[game.game_date]) acc[game.game_date] = [];
      acc[game.game_date].push(game);
      return acc;
    },
    {} as Record<string, Game[]>
  );
  const dates = Object.keys(byDate).sort();

  return (
    <section>
      {title && <h2 className="mb-2 text-sm font-semibold">{title}</h2>}
      {games.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        dates.map((date) => (
          <div key={date} className="mb-3 last:mb-0">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              {formatDisplayDate(date)}
            </h3>
            <div className="space-y-2">
              {byDate[date].map((game) => (
                <CompareRow
                  key={game.id}
                  game={game}
                  sideA={sideA}
                  sideB={sideB}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function CompareRow({
  game,
  sideA,
  sideB,
}: {
  game: Game;
  sideA: Side;
  sideB: Side;
}) {
  const pickA = sideA.picks[game.id];
  const pickB = sideB.picks[game.id];
  const decided = game.status === "final" && !!game.winner;
  const aHit = decided && pickA === game.winner;
  const bHit = decided && pickB === game.winner;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {formatGameTime(game.game_time)} · {game.away_team} @ {game.home_team}
        </span>
        <span>
          {decided ? `Final · ${game.winner}` : game.status === "live" ? "Live" : "Upcoming"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PickChip
          name={sideA.name}
          team={pickA}
          logo={logoFor(game, pickA)}
          hit={aHit}
          miss={decided && !!pickA && !aHit}
        />
        <PickChip
          name={sideB.name}
          team={pickB}
          logo={logoFor(game, pickB)}
          hit={bHit}
          miss={decided && !!pickB && !bHit}
        />
      </div>
    </div>
  );
}

function logoFor(game: Game, team?: string) {
  if (team === game.away_team) return game.away_team_logo;
  if (team === game.home_team) return game.home_team_logo;
  return "";
}

function PickChip({
  name,
  team,
  logo,
  hit,
  miss,
}: {
  name: string;
  team?: string;
  logo: string;
  hit: boolean;
  miss: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2",
        hit && "bg-green-500/10",
        miss && "bg-red-500/10",
        !hit && !miss && "bg-secondary/60"
      )}
    >
      {team ? (
        <TeamLogo src={logo} alt={team} size={28} />
      ) : (
        <div className="h-7 w-7" />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{name}</p>
        <p className="text-sm font-semibold">{team || "No pick"}</p>
      </div>
    </div>
  );
}
