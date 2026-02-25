"use client";

import { cn } from "@/lib/utils";
import { Game } from "@/lib/types";
import { formatGameTime } from "@/lib/dates";
import TeamLogo from "./TeamLogo";
import { Check, X, Clock } from "lucide-react";

interface GameCardProps {
  game: Game;
  pickedTeam?: string;
  onPick?: (gameId: string, team: string) => void;
  locked: boolean;
  showResult?: boolean;
}

export default function GameCard({
  game,
  pickedTeam,
  onPick,
  locked,
  showResult = false,
}: GameCardProps) {
  const isCorrect = showResult && pickedTeam === game.winner;
  const isIncorrect =
    showResult && game.winner && pickedTeam && pickedTeam !== game.winner;
  const isPending = showResult && !game.winner;
  const isLive = game.status === "live";
  const isFinal = game.status === "final";

  return (
    <div
      className={cn(
        "relative rounded-xl border bg-card p-3 transition-all",
        isCorrect && "border-green-500/50 bg-green-500/5",
        isIncorrect && "border-red-500/50 bg-red-500/5",
        isLive && "border-yellow-500/50"
      )}
    >
      {/* Status badge */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatGameTime(game.game_time)}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            game.status === "scheduled" && "bg-secondary text-muted-foreground",
            isLive && "animate-pulse bg-yellow-500/20 text-yellow-400",
            isFinal && "bg-secondary text-muted-foreground"
          )}
        >
          {isLive ? "LIVE" : isFinal ? "FINAL" : "Scheduled"}
        </span>
      </div>

      {/* Teams */}
      <div className="flex items-center gap-2">
        {/* Away Team */}
        <button
          disabled={locked || isFinal}
          onClick={() => onPick?.(game.id, game.away_team)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1.5 rounded-lg p-2 transition-all",
            pickedTeam === game.away_team
              ? "bg-primary/20 ring-2 ring-primary"
              : "hover:bg-secondary/50",
            locked && "cursor-default",
            !locked && !isFinal && "active:scale-95"
          )}
        >
          <TeamLogo src={game.away_team_logo} alt={game.away_team} size={44} />
          <span className="text-sm font-semibold">{game.away_team}</span>
        </button>

        {/* VS divider */}
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-muted-foreground">@</span>
        </div>

        {/* Home Team */}
        <button
          disabled={locked || isFinal}
          onClick={() => onPick?.(game.id, game.home_team)}
          className={cn(
            "flex flex-1 flex-col items-center gap-1.5 rounded-lg p-2 transition-all",
            pickedTeam === game.home_team
              ? "bg-primary/20 ring-2 ring-primary"
              : "hover:bg-secondary/50",
            locked && "cursor-default",
            !locked && !isFinal && "active:scale-95"
          )}
        >
          <TeamLogo src={game.home_team_logo} alt={game.home_team} size={44} />
          <span className="text-sm font-semibold">{game.home_team}</span>
        </button>
      </div>

      {/* Result indicator */}
      {showResult && pickedTeam && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {isCorrect && (
            <>
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">
                Correct
              </span>
            </>
          )}
          {isIncorrect && (
            <>
              <X className="h-4 w-4 text-red-400" />
              <span className="text-xs font-medium text-red-400">
                Wrong
              </span>
            </>
          )}
          {isPending && (
            <>
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Pending
              </span>
            </>
          )}
        </div>
      )}

      {/* Winner overlay for final games */}
      {isFinal && game.winner && (
        <div className="mt-1 text-center text-xs text-muted-foreground">
          Winner: <span className="font-semibold text-foreground">{game.winner}</span>
        </div>
      )}
    </div>
  );
}
