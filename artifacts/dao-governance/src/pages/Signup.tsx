import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useSignup } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, AlertCircle, Eye, EyeOff, CheckCircle2, Gavel, Vote } from "lucide-react";

export default function Signup() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"organizer" | "voter">("voter");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const signupMutation = useSignup({
    mutation: {
      onSuccess(data) {
        login(data.token, data.user as never);
        navigate("/dashboard");
      },
      onError(err: unknown) {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Something went wrong";
        setError(msg);
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    signupMutation.mutate({ data: { email, password, name, role } });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 h-16 flex items-center">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-slate-900">VoteChain</span>
          </div>
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
              <p className="text-slate-500">Start running secure elections in minutes</p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-slate-700 font-medium mb-1.5 block">I am signing up as a…</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("voter")}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                      role === "voter"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Vote className="w-5 h-5" />
                    Voter
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("organizer")}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                      role === "organizer"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <Gavel className="w-5 h-5" />
                    Election organizer
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {role === "organizer"
                    ? "Organizers create organizations and run elections."
                    : "Voters join an organization with a voting reference to cast ballots."}
                </p>
              </div>
              <div>
                <Label htmlFor="name" className="text-slate-700 font-medium">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="mt-1.5 h-11"
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-slate-700 font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  className="mt-1.5 h-11"
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="h-11 pr-10"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                disabled={signupMutation.isPending}
              >
                {signupMutation.isPending ? "Creating account…" : "Create free account"}
              </Button>
            </form>

            <div className="mt-6 space-y-2">
              {["No credit card required", "Unlimited elections & members", "Full audit trail included"].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link href="/login">
                <span className="text-blue-600 font-medium hover:underline cursor-pointer">Sign in</span>
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
