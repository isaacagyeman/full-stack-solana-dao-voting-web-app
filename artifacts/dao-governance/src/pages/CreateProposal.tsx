import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCreateProposal, getListProposalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Wallet } from "lucide-react";
import { Link } from "wouter";

type FormData = {
  title: string;
  description: string;
  quorumRequired: number;
  startTime: string;
  endTime: string;
};

function validate(data: FormData): Partial<Record<keyof FormData, string>> {
  const errors: Partial<Record<keyof FormData, string>> = {};
  if (!data.title || data.title.trim().length < 3) errors.title = "Title must be at least 3 characters";
  if (!data.description || data.description.trim().length < 20) errors.description = "Description must be at least 20 characters";
  if (!data.quorumRequired || data.quorumRequired < 1) errors.quorumRequired = "Quorum must be at least 1";
  if (!data.startTime) errors.startTime = "Start time is required";
  if (!data.endTime) errors.endTime = "End time is required";
  return errors;
}

export default function CreateProposal() {
  const { id } = useParams();
  const daoId = parseInt(id ?? "0", 10);
  const [, setLocation] = useLocation();
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProposal = useCreateProposal();

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 5 * 60 * 1000).toISOString().slice(0, 16);
  const defaultEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const form = useForm<FormData>({
    defaultValues: {
      title: "",
      description: "",
      quorumRequired: 10,
      startTime: defaultStart,
      endTime: defaultEnd,
    },
  });

  const onSubmit = (data: FormData) => {
    if (!publicKey) {
      toast({ title: "Connect your wallet to create a proposal", variant: "destructive" });
      return;
    }

    const errors = validate(data);
    if (Object.keys(errors).length > 0) {
      Object.entries(errors).forEach(([field, message]) => {
        form.setError(field as keyof FormData, { message });
      });
      return;
    }

    createProposal.mutate(
      {
        data: {
          daoId,
          title: data.title,
          description: data.description,
          creatorAddress: publicKey.toBase58(),
          quorumRequired: data.quorumRequired,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
          txSignature: null,
        },
      },
      {
        onSuccess: (proposal) => {
          toast({ title: "Proposal created successfully" });
          queryClient.invalidateQueries({ queryKey: getListProposalsQueryKey({ daoId }) });
          setLocation(`/proposals/${proposal.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create proposal", variant: "destructive" });
        },
      }
    );
  };

  if (!publicKey) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-16">
          <Wallet className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Connect your wallet</h2>
          <p className="text-sm text-muted-foreground">You need to connect a Solana wallet to create proposals.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/daos/${daoId}`}>
            <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Create Proposal</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Submit a new governance proposal for community vote</p>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposal Title</FormLabel>
                    <FormControl>
                      <Input data-testid="input-title" placeholder="e.g. SIP-43: Expand validator incentives" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        data-testid="input-description"
                        placeholder="Describe the proposal, its motivation, and expected impact..."
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quorumRequired"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quorum Required (votes)</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-quorum"
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input data-testid="input-start-time" type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input data-testid="input-end-time" type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-mono">
                  Creator: {publicKey.toBase58().slice(0, 8)}...
                </p>
                <Button
                  type="submit"
                  disabled={createProposal.isPending}
                  data-testid="button-submit"
                >
                  {createProposal.isPending ? "Creating..." : "Create Proposal"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </Layout>
  );
}
