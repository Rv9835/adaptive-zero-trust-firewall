'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Shield, Lock, Bot, Activity, Globe, Fingerprint,
  ArrowRight, Zap, CheckCircle2, Layers, Eye, RefreshCcw
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};

const FEATURES = [
  {
    icon: Fingerprint,
    title: 'ML Trust Scoring',
    desc: 'Isolation Forest + XGBoost analyze 12 behavioral signals in real-time to generate a 0–100 trust score per request.',
    color: 'var(--accent-teal)',
    bg: 'var(--accent-teal-dim)',
  },
  {
    icon: Shield,
    title: 'OPA Policy Engine',
    desc: 'Rego policies enforce ALLOW / CHALLENGE / DENY decisions based on trust scores, device state, and IP reputation.',
    color: 'var(--accent-sky)',
    bg: 'var(--accent-sky-dim)',
  },
  {
    icon: Lock,
    title: 'Step-Up MFA',
    desc: 'TOTP-based multi-factor authentication triggers for CHALLENGE decisions. Successful MFA feeds back to retrain ML models.',
    color: 'var(--accent-violet)',
    bg: 'var(--accent-violet-dim)',
  },
  {
    icon: Globe,
    title: 'Reverse Proxy Gateway',
    desc: 'Go-based high-performance reverse proxy with per-IP rate limiting, structured logging, and graceful shutdown.',
    color: 'var(--accent-coral)',
    bg: 'var(--accent-coral-dim)',
  },
  {
    icon: Bot,
    title: 'IoT Behavioral Rules',
    desc: 'Specialized OPA rules detect anomalous IoT traffic patterns and quarantine compromised devices automatically.',
    color: 'var(--accent-amber)',
    bg: 'var(--accent-amber-dim)',
  },
  {
    icon: RefreshCcw,
    title: 'Feedback Loop',
    desc: 'Every MFA verification result feeds back into the ML pipeline, continuously reducing false positives over time.',
    color: 'var(--accent-emerald)',
    bg: 'var(--accent-emerald-dim)',
  },
];

const STEPS = [
  { num: '01', title: 'Request Arrives', desc: 'Every incoming request hits the Go reverse proxy at the edge — no direct backend access ever.', icon: Globe },
  { num: '02', title: 'ML Analysis', desc: 'The ML Engine extracts a 12-dimensional feature vector (IP, geo, time, device, behavior) and scores it with Isolation Forest + XGBoost.', icon: Bot },
  { num: '03', title: 'Policy Decision', desc: 'OPA evaluates the trust score against Rego policies → ALLOW (≥80), CHALLENGE (40–80), or DENY (<30).', icon: Shield },
  { num: '04', title: 'MFA Challenge', desc: 'CHALLENGE triggers step-up TOTP verification. Success raises trust; failure feeds back as a negative signal.', icon: Lock },
  { num: '05', title: 'Continuous Learning', desc: 'MFA outcomes retrain the model, progressively reducing false positives as the system learns your patterns.', icon: RefreshCcw },
];

const STATS = [
  { value: '12', label: 'Feature Signals', color: 'var(--accent-teal)' },
  { value: '4', label: 'Microservices', color: 'var(--accent-sky)' },
  { value: '<50ms', label: 'Scoring Latency', color: 'var(--accent-violet)' },
  { value: '99.5%', label: 'Threat Detection', color: 'var(--accent-coral)' },
];

export default function LandingPage() {
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative py-16 md:py-24 text-center grid-bg rounded-2xl overflow-hidden mb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#080b14]" />
        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent-teal-dim)', border: '1px solid rgba(45, 212, 191, 0.2)' }}
          >
            <Shield size={36} style={{ color: 'var(--accent-teal)' }} />
          </motion.div>

          <motion.h1
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="text-4xl md:text-6xl font-black tracking-tight mb-4"
          >
            <span style={{ color: 'var(--accent-teal)' }}>Adaptive</span>{' '}
            <span className="text-white">Zero Trust</span>
            <br />
            <span className="text-white">Firewall</span>
          </motion.h1>

          <motion.p
            custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="text-lg md:text-xl max-w-2xl mx-auto mb-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            A context-aware ZTNA gateway that evaluates real-time ML trust scores,
            enforces OPA policies, and uses step-up MFA to continuously reduce false positives.
          </motion.p>

          <motion.div
            custom={3} variants={fadeUp} initial="hidden" animate="visible"
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <Link href="/dashboard" className="btn-primary flex items-center gap-2 text-base px-8 py-3">
              <Activity size={18} /> Open Dashboard <ArrowRight size={16} />
            </Link>
            <Link href="/tests" className="btn-secondary flex items-center gap-2 text-base px-8 py-3">
              <Zap size={18} /> Try API Tests
            </Link>
            <Link href="/docs" className="btn-ghost flex items-center gap-2 text-base">
              SDK Documentation →
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══════════ STATS BAR ═══════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.6 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16"
      >
        {STATS.map((stat) => (
          <div key={stat.label} className="card text-center py-6">
            <p className="text-3xl font-black mono mb-1" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
          </div>
        ))}
      </motion.section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="mb-16">
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            How It <span style={{ color: 'var(--accent-teal)' }}>Works</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)' }} className="max-w-xl mx-auto">
            Every request passes through five stages of Zero Trust verification before reaching your backend.
          </p>
        </motion.div>

        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                custom={i} variants={fadeUp} initial="hidden" whileInView="visible"
                viewport={{ once: true }}
                className="card flex items-start gap-5"
              >
                <div
                  className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm"
                  style={{ background: 'var(--accent-teal-dim)', color: 'var(--accent-teal)' }}
                >
                  {step.num}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1 flex items-center gap-2">
                    <Icon size={16} style={{ color: 'var(--accent-sky)' }} />
                    {step.title}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{step.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section className="mb-16">
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Core <span style={{ color: 'var(--accent-coral)' }}>Capabilities</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)' }} className="max-w-xl mx-auto">
            Built with Go, Python, OPA, and MongoDB — designed for real-world zero trust enforcement.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                custom={i} variants={fadeUp} initial="hidden" whileInView="visible"
                viewport={{ once: true }}
                className="card group"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: feat.bg }}
                >
                  <Icon size={20} style={{ color: feat.color }} />
                </div>
                <h3 className="font-semibold mb-2">{feat.title}</h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{feat.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══════════ ARCHITECTURE ═══════════ */}
      <section className="mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="card"
        >
          <h2 className="text-xl font-bold mb-6 text-center">
            System <span style={{ color: 'var(--accent-sky)' }}>Architecture</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { label: 'Client', sub: 'Browser / IoT', color: 'var(--text-secondary)', icon: Globe },
              { label: 'Proxy Gateway', sub: 'Go • :8080', color: 'var(--accent-teal)', icon: Layers },
              { label: 'Auth + MFA', sub: 'Go • :8081', color: 'var(--accent-violet)', icon: Lock },
              { label: 'ML Engine', sub: 'Python • :8082', color: 'var(--accent-coral)', icon: Bot },
              { label: 'OPA Policies', sub: 'Rego • :8181', color: 'var(--accent-amber)', icon: Shield },
            ].map((node, i) => {
              const Icon = node.icon;
              return (
                <div key={node.label} className="flex items-center gap-3">
                  {i > 0 && (
                    <div className="hidden md:block text-lg" style={{ color: 'var(--text-muted)' }}>→</div>
                  )}
                  <div
                    className="flex-1 rounded-xl p-4 text-center border"
                    style={{
                      background: `${node.color}08`,
                      borderColor: `${node.color}20`,
                    }}
                  >
                    <Icon size={20} className="mx-auto mb-2" style={{ color: node.color }} />
                    <p className="font-semibold text-sm">{node.label}</p>
                    <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{node.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ═══════════ SCENARIOS ═══════════ */}
      <section className="mb-16">
        <motion.div
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Real-World <span style={{ color: 'var(--accent-amber)' }}>Scenarios</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'Trusted Employee',
              desc: 'Sarah logs in from office, known device, business hours. Score: ~85 → ALLOW instantly.',
              badge: 'ALLOW', badgeClass: 'badge-allow',
              color: 'var(--accent-emerald)',
            },
            {
              title: 'Traveling Employee',
              desc: 'Raj logs in from new IP in Mumbai. Score: ~55 → CHALLENGE with TOTP MFA. Success → trust restored.',
              badge: 'CHALLENGE', badgeClass: 'badge-challenge',
              color: 'var(--accent-amber)',
            },
            {
              title: 'Stolen Credentials',
              desc: 'Hacker uses valid creds from Tor exit node at 3 AM, 5 failed logins. Score: ~6 → DENY immediately.',
              badge: 'DENY', badgeClass: 'badge-deny',
              color: 'var(--accent-rose)',
            },
            {
              title: 'IoT Anomaly',
              desc: 'Smart sensor sends 10x normal traffic burst. Behavioral rules detect anomaly → QUARANTINE device.',
              badge: 'QUARANTINE', badgeClass: 'badge-deny',
              color: 'var(--accent-coral)',
            },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              custom={i} variants={fadeUp} initial="hidden" whileInView="visible"
              viewport={{ once: true }}
              className="card"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ color: s.color }}>{s.title}</h3>
                <span className={`badge ${s.badgeClass}`}>{s.badge}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══════════ CTA ═══════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12 card py-12"
      >
        <h2 className="text-2xl font-bold mb-3">Ready to explore?</h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Open the dashboard to monitor services, run trust score simulations, and test the SDK live.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/dashboard" className="btn-primary flex items-center gap-2 px-8 py-3">
            Open Dashboard <ArrowRight size={16} />
          </Link>
          <Link href="/docs" className="btn-secondary flex items-center gap-2 px-8 py-3">
            Read SDK Docs
          </Link>
        </div>
      </motion.section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
        <div className="glow-line mb-4" />
        <p>Adaptive Zero Trust Firewall — PS001 · Hackathon 2026</p>
        <p className="mt-1">Go · Python · OPA · MongoDB Atlas · Next.js</p>
      </footer>
    </div>
  );
}
