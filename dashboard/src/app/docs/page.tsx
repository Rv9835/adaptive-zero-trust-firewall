'use client';

import { motion } from 'framer-motion';
import { BookOpen, Code, Terminal, Copy, CheckCircle2, Shield, Zap, Layers, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

function CopyBlock({ code, lang = '' }: { code: string; lang?: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    return (
        <div className="relative group">
            <pre className="code-block text-[12px]">{code}</pre>
            <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
                {copied ? <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)' }} /> : <Copy size={13} style={{ color: 'var(--text-muted)' }} />}
            </button>
        </div>
    );
}

const SECTIONS = [
    {
        id: 'install',
        title: 'Installation',
        icon: Terminal,
        content: (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Copy the SDK file into your Node.js project. No npm install needed — zero external dependencies.
                </p>
                <CopyBlock code={`# Copy the SDK into your project
cp sdk/node/ztna-sdk.js ./your-project/

# Or if using the ZTNA container stack
docker cp ztna-firewall-proxy-gateway:/sdk ./your-project/ztna-sdk.js`} />
                <div className="p-3 rounded-lg" style={{ background: 'var(--accent-teal-dim)', border: '1px solid rgba(45,212,191,0.15)' }}>
                    <p className="text-xs" style={{ color: 'var(--accent-teal)' }}>
                        <strong>Zero Dependencies:</strong> The SDK uses only Node.js built-in http/https modules. No npm packages required.
                    </p>
                </div>
            </div>
        ),
    },
    {
        id: 'quickstart',
        title: 'Quick Start',
        icon: Zap,
        content: (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Add 3 lines to your Express app to get trust scoring on every request:
                </p>
                <CopyBlock code={`const express = require('express');
const { ztnaMiddleware, ztnaProtect } = require('./ztna-sdk');

const app = express();

// Step 1: Add ZTNA middleware (scores every request)
app.use(ztnaMiddleware({
  mlEngineUrl: 'http://localhost:8082',
  authServiceUrl: 'http://localhost:8081',
  enabled: true,
  failMode: 'closed', // 'closed' = deny on ML failure
}));

// Step 2: Access trust data on any route
app.get('/api/data', (req, res) => {
  console.log(req.ztna.trustScore);  // 85.2
  console.log(req.ztna.action);       // "ALLOW"
  res.json({ data: 'sensitive info' });
});

// Step 3: Protect sensitive routes
app.get('/api/admin', ztnaProtect({
  minTrustScore: 90,
  challengeUrl: '/auth/mfa',
}), (req, res) => {
  res.json({ admin: true });
});

app.listen(3001);`} />
            </div>
        ),
    },
    {
        id: 'middleware',
        title: 'ztnaMiddleware(config)',
        icon: Layers,
        content: (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Express middleware that scores every request via the ML Engine and attaches trust data to <code className="mono text-xs" style={{ color: 'var(--accent-teal)' }}>req.ztna</code>.
                </p>

                <h4 className="text-sm font-semibold mt-4">Configuration Options:</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>
                                <th className="text-left pb-2">Option</th><th className="text-left pb-2">Default</th><th className="text-left pb-2">Description</th>
                            </tr>
                        </thead>
                        <tbody className="text-[12px] mono">
                            {[
                                ['mlEngineUrl', 'http://localhost:8082', 'ML Engine endpoint for scoring'],
                                ['authServiceUrl', 'http://localhost:8081', 'Auth Service for token validation'],
                                ['proxyUrl', 'http://localhost:8080', 'Proxy Gateway URL'],
                                ['enabled', 'true', 'Toggle SDK on/off without removing code'],
                                ['failMode', '"closed"', '"closed" = deny on failure, "open" = allow'],
                                ['timeout', '3000', 'HTTP timeout in ms for ML requests'],
                                ['logRequests', 'true', 'Log trust scores to console'],
                                ['defaultMinScore', '40', 'Default minimum score for ztnaProtect'],
                            ].map(([opt, def, desc]) => (
                                <tr key={opt} className="border-t" style={{ borderColor: 'var(--border)' }}>
                                    <td className="py-2" style={{ color: 'var(--accent-teal)' }}>{opt}</td>
                                    <td className="py-2" style={{ color: 'var(--text-muted)' }}>{def}</td>
                                    <td className="py-2 font-sans text-[12px]" style={{ color: 'var(--text-secondary)' }}>{desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <h4 className="text-sm font-semibold mt-4">req.ztna Object:</h4>
                <CopyBlock code={`// Available on every request after middleware
req.ztna = {
  trustScore: 85.2,          // 0-100
  anomalyDetected: false,    // boolean
  anomalyReason: "",         // string (if anomaly)
  action: "ALLOW",           // "ALLOW" | "CHALLENGE" | "DENY"
  scoringMode: "normal",     // "normal" | "fallback" | "error"
  timestamp: "2026-02...",   // ISO timestamp
  clientIP: "10.0.1.50",    // Extracted client IP
};`} />

                <h4 className="text-sm font-semibold mt-4">Response Headers Added:</h4>
                <CopyBlock code={`X-ZTNA-Trust-Score: 85.2
X-ZTNA-Action: ALLOW
X-ZTNA-Scoring-Mode: normal`} />
            </div>
        ),
    },
    {
        id: 'protect',
        title: 'ztnaProtect(options)',
        icon: Shield,
        content: (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Route-level middleware that blocks or challenges requests below a trust threshold.
                </p>
                <CopyBlock code={`// Require high trust for admin routes
app.get('/admin', ztnaProtect({ minTrustScore: 90 }), handler);

// Redirect to MFA on challenge
app.get('/settings', ztnaProtect({
  minTrustScore: 70,
  challengeUrl: '/auth/totp',
}), handler);`} />

                <h4 className="text-sm font-semibold mt-4">Responses:</h4>
                <div className="space-y-2">
                    <div className="p-3 rounded-lg" style={{ background: 'var(--accent-emerald-dim)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--accent-emerald)' }}>ALLOW (score ≥ threshold)</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>→ next() — request proceeds normally</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: 'var(--accent-amber-dim)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--accent-amber)' }}>CHALLENGE</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>→ 401 with <code className="mono">mfa_required</code> or redirect to challengeUrl</p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ background: 'var(--accent-rose-dim)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--accent-rose)' }}>DENY</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>→ 403 with <code className="mono">access_denied</code></p>
                    </div>
                </div>
            </div>
        ),
    },
    {
        id: 'health',
        title: 'checkHealth()',
        icon: Code,
        content: (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Check the health of all ZTNA services from your app:</p>
                <CopyBlock code={`const { checkHealth } = require('./ztna-sdk');

app.get('/ztna/status', async (req, res) => {
  const health = await checkHealth();
  res.json({ services: health });
});

// Returns:
// [
//   { name: "proxy-gateway",  status: "healthy", latency: 12 },
//   { name: "auth-service",   status: "healthy", latency: 19 },
//   { name: "ml-engine",      status: "healthy", latency: 18 },
// ]`} />
            </div>
        ),
    },
    {
        id: 'env',
        title: 'Environment Variables',
        icon: Terminal,
        content: (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    All SDK configuration can also be set via environment variables:
                </p>
                <CopyBlock code={`# .env file
ZTNA_PROXY_URL=http://proxy:8080
ZTNA_ML_URL=http://ml-engine:8082
ZTNA_AUTH_URL=http://auth:8081
ZTNA_ENABLED=true
ZTNA_FAIL_MODE=closed`} />
                <div className="p-3 rounded-lg" style={{ background: 'var(--accent-amber-dim)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <p className="text-xs" style={{ color: 'var(--accent-amber)' }}>
                        <strong>Production Tip:</strong> Set <code className="mono">ZTNA_FAIL_MODE=closed</code> to deny requests when the ML engine is unreachable. Use <code className="mono">open</code> only for development.
                    </p>
                </div>
            </div>
        ),
    },
    {
        id: 'docker',
        title: 'Docker Integration',
        icon: Layers,
        content: (
            <div className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Add your app to the ZTNA docker-compose stack:</p>
                <CopyBlock code={`# docker-compose.yml — add your service
services:
  your-app:
    build: ./your-app
    environment:
      - ZTNA_PROXY_URL=http://proxy-gateway:8080
      - ZTNA_ML_URL=http://ml-engine:8082
      - ZTNA_AUTH_URL=http://auth-service:8081
      - ZTNA_ENABLED=true
    depends_on:
      - proxy-gateway
      - ml-engine
      - auth-service
    networks:
      - ztna-network`} />
            </div>
        ),
    },
];

export default function DocsPage() {
    const [activeSection, setActiveSection] = useState('quickstart');

    return (
        <div className="max-w-[1400px] mx-auto pb-12">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }} className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={22} style={{ color: 'var(--accent-coral)' }} /> SDK Documentation</h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Integrate Zero Trust protection into any Node.js application in minutes</p>
                    </div>
                    <Link href="/tests" className="btn-primary flex items-center gap-2 text-sm">
                        Try It Live <ArrowRight size={14} />
                    </Link>
                </div>
                <div className="glow-line mt-4" />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* ── Sidebar Nav ── */}
                <motion.aside initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
                    <div className="card sticky top-24">
                        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Contents</h3>
                        <nav className="space-y-0.5">
                            {SECTIONS.map((s) => {
                                const Icon = s.icon;
                                return (
                                    <button key={s.id} onClick={() => setActiveSection(s.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${activeSection === s.id ? 'font-semibold' : ''}`}
                                        style={activeSection === s.id ? { background: 'var(--accent-teal-dim)', color: 'var(--accent-teal)' } : { color: 'var(--text-secondary)' }}
                                    >
                                        <Icon size={13} /> {s.title}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </motion.aside>

                {/* ── Content ── */}
                <div className="lg:col-span-3 space-y-6">
                    {SECTIONS.map((section, i) => (
                        <motion.section key={section.id} id={section.id} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }}
                            variants={fadeUp} transition={{ duration: 0.5, delay: i * 0.05 }}
                        >
                            <div className="card">
                                <div className="flex items-center gap-2 mb-4">
                                    {(() => { const Icon = section.icon; return <Icon size={18} style={{ color: 'var(--accent-teal)' }} />; })()}
                                    <h2 className="text-lg font-bold">{section.title}</h2>
                                </div>
                                {section.content}
                            </div>
                        </motion.section>
                    ))}
                </div>
            </div>
        </div>
    );
}
