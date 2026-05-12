import { useParams } from "wouter";
import { Link } from "wouter";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  useGetProposal,
  useListVotesForProposal,
  useGetMyVote,
  useCastVote,
  getGetProposalQueryKey,
  getListVotesForProposalQueryKey,
  getGetMyVoteQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { VoteBar } from "@/components/VoteBar";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { truncateAddress, formatDate, formatRelativeTime } from "@/lib/format";
import { ArrowLeft, Wallet, CheckCircle2, XCircle, MinusCircle, Users } from "lucide-react";

export default function ProposalDetail() {
  const { id } = useParams();
  const proposalId = parseInt(id ?? "0", 10);
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proposal, isLoading: proposalLoading } = useGetProposal(proposalId, {
    query: { enabled: !!proposalId, queryKey: getGetProposalQueryKey(proposalId) },
  });

  const { data: votes, isLoading: votesLoading } = useListVotesForProposal(proposalId, {
    query: { enabled: !!proposalId, queryKey: getListVotesForProposalQueryKey(proposalId) },
  });

  const walletAddr = publicKey?.toBase58() ?? "";
  const { data: myVoteData } = useGetMyVote(proposalId, walletAddr, {
    query: {
      enabled: !!proposalId && !!walletAddr,
      queryKey: getGetMyVoteQueryKey(proposalId, walletAddr),
    },
  });

  const myVote = myVoteData?.vote;
  const castVote = useCastVote();

  const handleVote = (voteType: "for" | "against" | "abstain") => {
    if (!publicKey) {
      toast({ title: "Connect your wallet to vote", variant: "destructive" });
      return;
    }

    castVote.mutate(
      {
        id: proposalId,
        data: {
          voterAddress: publicKey.toBase58(),
          voteType,
          votingPower: 1,
          txSignature: null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: `Voted ${voteType} successfully` });
          queryClient.invalidateQueries({ queryKey: getGetProposalQueryKey(proposalId) });
          queryClient.invalidateQueries({ queryKey: getListVotesForProposalQueryKey(proposalId) });
          queryClient.invalidateQueries({ queryKey: getGetMyVoteQueryKey(proposalId, publicKey.toBase58()) });
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : "Vote failed";
          toast({ title: message, variant: "destructive" });
        },
      }
    );
  };

  if (proposalLoading) {
    return (
      <Layout>
        <div className="space-y-4 max-w-4xl">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-60 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </Layout>
    );
  }

  if (!proposal) {
    return (
      <Layout>
        <div className="text-center py-16">
          <p className="text-muted-foreground">Proposal not found.</p>
          <Link href="/proposals"><a className="text-primary text-sm mt-2 block hover:underline">Back to proposals</a></Link>
        </div>
      </Layout>
    );
  }

  const isActive = proposal.status === "active";
  const canVote = isActive && !!publicKey && !myVote;

  return (
    <Layout>
      <div className="max-w-4xl space-y-6">
        {/* Back + Title */}
        <div className="flex items-center gap-3">
          <Link href="/proposals">
            <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={proposal.status} />
              {proposal.daoName && (
                <Link href={`/daos/${proposal.daoId}`}>
                  <span className="text-xs text-primary hover:underline cursor-pointer">{proposal.daoName}</span>
                </Link>
              )}
            </div>
            <h1 className="text-xl font-bold leading-tight">{proposal.title}</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Description */}
            <div className="bg-card border border-card-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Description</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{proposal.description}</p>
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="text-muted-foreground/60">Proposer</span>
                  <p className="font-mono mt-0.5">{truncateAddress(proposal.creatorAddress, 6)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/60">Created</span>
                  <p className="mt-0.5">{formatDate(proposal.createdAt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/60">Voting ends</span>
                  <p className="mt-0.5">{formatDate(proposal.endTime)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground/60">Time remaining</span>
                  <p className="mt-0.5"><CountdownTimer endTime={proposal.endTime} /></p>
                </div>
              </div>
            </div>

            {/* Votes */}
            <div className="bg-card border border-card-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Voting Results</h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {(votes ?? []).length} voters
                </div>
              </div>
              <VoteBar
                votesFor={proposal.votesFor}
                votesAgainst={proposal.votesAgainst}
                votesAbstain={proposal.votesAbstain}
                quorumRequired={proposal.quorumRequired}
              />
            </div>

            {/* Voter list */}
            <div className="bg-card border border-card-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Votes Cast</h3>
              {votesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
                </div>
              ) : (votes ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No votes yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {(votes ?? []).map((v) => (
                    <div key={v.id} className="py-3 flex items-center justify-between" data-testid={`vote-row-${v.id}`}>
                      <span className="font-mono text-xs text-muted-foreground">{truncateAddress(v.voterAddress, 6)}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground/60">{formatRelativeTime(v.createdAt)}</span>
                        {v.voteType === "for" && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />For</span>}
                        {v.voteType === "against" && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" />Against</span>}
                        {v.voteType === "abstain" && <span className="flex items-center gap-1 text-xs text-gray-400"><MinusCircle className="w-3.5 h-3.5" />Abstain</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Voting panel */}
          <div className="space-y-4">
            <div className="bg-card border border-card-border rounded-lg p-5 sticky top-20">
              <h3 className="text-sm font-semibold mb-4">Cast Your Vote</h3>

              {!publicKey ? (
                <div className="text-center py-4">
                  <Wallet className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Connect your wallet to vote on this proposal.</p>
                </div>
              ) : myVote ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">You voted</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your vote: <span className={`font-semibold ${myVote.voteType === "for" ? "text-emerald-400" : myVote.voteType === "against" ? "text-red-400" : "text-gray-400"}`}>{myVote.voteType}</span>
                  </p>
                </div>
              ) : !isActive ? (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">This proposal is no longer accepting votes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    data-testid="button-vote-for"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={!canVote || castVote.isPending}
                    onClick={() => handleVote("for")}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Vote For
                  </Button>
                  <Button
                    data-testid="button-vote-against"
                    className="w-full bg-red-700 hover:bg-red-800 text-white"
                    disabled={!canVote || castVote.isPending}
                    onClick={() => handleVote("against")}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Vote Against
                  </Button>
                  <Button
                    data-testid="button-vote-abstain"
                    variant="secondary"
                    className="w-full"
                    disabled={!canVote || castVote.isPending}
                    onClick={() => handleVote("abstain")}
                  >
                    <MinusCircle className="w-4 h-4 mr-2" />
                    Abstain
                  </Button>
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Voting power: 1 vote
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
