interface VoteBarProps {
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorumRequired: number;
}

export function VoteBar({ votesFor, votesAgainst, votesAbstain, quorumRequired }: VoteBarProps) {
  const total = votesFor + votesAgainst + votesAbstain;
  const forPct = total > 0 ? (votesFor / total) * 100 : 0;
  const againstPct = total > 0 ? (votesAgainst / total) * 100 : 0;
  const abstainPct = total > 0 ? (votesAbstain / total) * 100 : 0;
  const quorumPct = Math.min((total / quorumRequired) * 100, 100);

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-secondary">
        {forPct > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        )}
        {againstPct > 0 && (
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${againstPct}%` }}
          />
        )}
        {abstainPct > 0 && (
          <div
            className="bg-gray-500 transition-all duration-500"
            style={{ width: `${abstainPct}%` }}
          />
        )}
        {total === 0 && <div className="w-full" />}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">For</span>
            <span className="font-medium tabular-nums">{votesFor.toLocaleString()}</span>
            <span className="text-muted-foreground/60">({forPct.toFixed(1)}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Against</span>
            <span className="font-medium tabular-nums">{votesAgainst.toLocaleString()}</span>
            <span className="text-muted-foreground/60">({againstPct.toFixed(1)}%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-muted-foreground">Abstain</span>
            <span className="font-medium tabular-nums">{votesAbstain.toLocaleString()}</span>
          </span>
        </div>
        <span className="text-muted-foreground">
          {total.toLocaleString()} / {quorumRequired.toLocaleString()} quorum
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Quorum progress</span>
          <span>{quorumPct.toFixed(0)}%</span>
        </div>
        <div className="flex h-1 rounded-full overflow-hidden bg-secondary">
          <div
            className="bg-primary transition-all duration-500"
            style={{ width: `${quorumPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
