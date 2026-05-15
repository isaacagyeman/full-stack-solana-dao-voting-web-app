import { Link } from "wouter";
import { motion } from "framer-motion";
import { ShieldCheck, Vote, BarChart3, Users, Lock, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

const features = [
  {
    icon: ShieldCheck,
    title: "Cryptographic Integrity",
    desc: "Every vote is hashed and anchored to a distributed ledger, making results tamper-evident and auditable.",
  },
  {
    icon: Users,
    title: "Organization Management",
    desc: "Create private voting groups for your school, company, union, or community with role-based access control.",
  },
  {
    icon: Vote,
    title: "Flexible Election Types",
    desc: "Run single-choice, multi-choice, ranked-choice, or yes/no elections with custom candidate lists.",
  },
  {
    icon: BarChart3,
    title: "Live Results & Analytics",
    desc: "Watch real-time tallies with beautiful charts, turnout tracking, and winner announcements.",
  },
  {
    icon: Lock,
    title: "Anonymous by Default",
    desc: "Ballots are separated from voter identities. Your vote is private; only the count is public.",
  },
  {
    icon: Zap,
    title: "Instant & Free to Use",
    desc: "No blockchain fees, no gas costs, no waiting. Results are available the moment voting closes.",
  },
];

const steps = [
  { step: "1", title: "Create an organization", desc: "Set up your voting group and invite members by email." },
  { step: "2", title: "Design your election", desc: "Add candidates, set dates, and choose an election type." },
  { step: "3", title: "Members vote securely", desc: "Each eligible member casts their ballot from any device." },
  { step: "4", title: "Results are final & verified", desc: "Instant tally with a full cryptographic audit trail." },
];

const fade = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white py-24 px-4">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
        >
          <motion.div variants={fade} className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            Blockchain-verified elections
          </motion.div>
          <motion.h1 variants={fade} className="text-5xl sm:text-6xl font-extrabold mb-6 leading-tight">
            Trusted digital elections
            <br />
            <span className="text-blue-200">for every organization</span>
          </motion.h1>
          <motion.p variants={fade} className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
            Run secure, transparent, and verifiable elections for your school, company, union, or community — powered by cryptographic integrity.
          </motion.p>
          <motion.div variants={fade} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-base px-8 h-12">
                Start for free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 font-semibold text-base px-8 h-12">
                Sign in
              </Button>
            </Link>
          </motion.div>
          <motion.p variants={fade} className="mt-6 text-blue-200 text-sm">
            Demo: <span className="font-mono bg-white/10 px-2 py-0.5 rounded">admin@demo.com</span> / <span className="font-mono bg-white/10 px-2 py-0.5 rounded">demo1234</span>
          </motion.p>
        </motion.div>
      </section>

      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything you need for fair elections</h2>
            <p className="text-slate-500 text-lg">Purpose-built for organizations that take governance seriously.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Up and running in minutes</h2>
            <p className="text-slate-500 text-lg">Four simple steps from setup to certified results.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.step}
                className="flex gap-4 items-start"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {s.step}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{s.title}</h3>
                  <p className="text-slate-500 text-sm">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-blue-600 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to run your first election?</h2>
          <p className="text-blue-100 mb-8 text-lg">Join thousands of organizations who trust VoteChain for their governance decisions.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-8 h-12">
                Create free account
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-blue-100 text-sm">
            {["No credit card required", "Unlimited elections", "Full audit trail", "GDPR-ready"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-8 px-4 bg-slate-900 text-slate-400 text-center text-sm">
        <p>© 2024 VoteChain. Secure, transparent governance for modern organizations.</p>
      </footer>
    </div>
  );
}
