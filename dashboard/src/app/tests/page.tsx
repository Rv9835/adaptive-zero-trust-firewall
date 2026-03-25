'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FlaskConical, Send, RotateCcw, CheckCircle2, XCircle,
    Globe, Lock, Bot, Shield, Fingerprint, Key, RefreshCcw
} from 'lucide-react';

const API = 'http://localhost';
const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

type TestResult = { status: 'idle' | 'running' | 'pass' | 'fail'; response?: unknown; latency?: number; error?: string };

const TESTS = [
    {
        id: 'health-proxy', group: 'Health Checks', name: 'Proxy Gateway Health',
        icon: Globe, color: 'var(--accent-teal)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8080/health`);
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'health-auth', group: 'Health Checks', name: 'Auth Service Health',
        icon: Lock, color: 'var(--accent-violet)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8081/health`);
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'health-ml', group: 'Health Checks', name: 'ML Engine Health',
        icon: Bot, color: 'var(--accent-coral)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8082/health`);
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'health-opa', group: 'Health Checks', name: 'Policy Engine Health',
        icon: Shield, color: 'var(--accent-amber)',
        run: async () => {
            const start = Date.now();
            const res = await fetch('/api/opa/health');
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'auth-login-ok', group: 'Authentication', name: 'Login — Valid Credentials',
        icon: Key, color: 'var(--accent-emerald)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8081/api/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'sarah.engineer', password: 'SecurePass123!' }),
            });
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'auth-login-fail', group: 'Authentication', name: 'Login — Invalid Credentials',
        icon: XCircle, color: 'var(--accent-rose)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8081/api/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'hacker', password: 'wrongpass' }),
            });
            const data = await res.json();
            return { data, latency: Date.now() - start, ok: res.status === 401 }; // 401 is expected
        },
    },
    {
        id: 'auth-admin', group: 'Authentication', name: 'Login — Admin User',
        icon: Key, color: 'var(--accent-sky)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8081/api/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'AdminPass789!' }),
            });
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'ml-trusted', group: 'ML Scoring', name: 'Score — Trusted Employee',
        icon: Fingerprint, color: 'var(--accent-emerald)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8082/api/ml/score`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 'sarah-001', ip_address: '10.0.1.50', user_agent: 'Chrome/120', target_resource: 'code-repo', time_utc: new Date().toISOString(), failed_logins_1h: 0, device_trusted: true }),
            });
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'ml-hacker', group: 'ML Scoring', name: 'Score — Stolen Credentials',
        icon: Fingerprint, color: 'var(--accent-rose)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8082/api/ml/score`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 'admin-003', ip_address: '185.220.101.1', user_agent: 'curl/7.0', target_resource: 'finance-db', time_utc: new Date().toISOString(), failed_logins_1h: 5, device_trusted: false }),
            });
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'ml-traveling', group: 'ML Scoring', name: 'Score — Traveling Employee',
        icon: Fingerprint, color: 'var(--accent-amber)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8082/api/ml/score`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: 'raj-002', ip_address: '203.45.67.89', user_agent: 'Safari/17', target_resource: 'crm', time_utc: new Date().toISOString(), failed_logins_1h: 1, device_trusted: false }),
            });
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
    {
        id: 'opa-allow', group: 'OPA Policy', name: 'Policy — High Trust → ALLOW',
        icon: Shield, color: 'var(--accent-emerald)',
        run: async () => {
            const start = Date.now();
            const res = await fetch('/api/opa/query', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: { trust_score: 90, device_trusted: true, ip_reputation: 'clean', account_locked: false } }),
            });
            const data = await res.json();
            return { data: data?.result || data, latency: Date.now() - start, ok: true };
        },
    },
    {
        id: 'opa-deny', group: 'OPA Policy', name: 'Policy — Low Trust → DENY',
        icon: Shield, color: 'var(--accent-rose)',
        run: async () => {
            const start = Date.now();
            const res = await fetch('/api/opa/query', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: { trust_score: 10, device_trusted: false, ip_reputation: 'malicious', account_locked: false } }),
            });
            const data = await res.json();
            return { data: data?.result || data, latency: Date.now() - start, ok: true };
        },
    },
    {
        id: 'proxy-upstream', group: 'Proxy', name: 'Proxy → Upstream Backend',
        icon: Globe, color: 'var(--accent-teal)',
        run: async () => {
            const start = Date.now();
            const res = await fetch(`${API}:8080/`);
            return { data: await res.json(), latency: Date.now() - start, ok: res.ok };
        },
    },
];

export default function TestsPage() {
    const [results, setResults] = useState<Record<string, TestResult>>({});
    const [runningAll, setRunningAll] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    /* ── SDK Try-It ── */
    const [sdkInput, setSdkInput] = useState(JSON.stringify({
        user_id: 'test-user-001', ip_address: '10.0.1.100', user_agent: 'Mozilla/5.0 Chrome/120',
        target_resource: 'api/data', failed_logins_1h: 0, device_trusted: true,
    }, null, 2));
    const [sdkResult, setSdkResult] = useState<unknown>(null);
    const [sdkRunning, setSdkRunning] = useState(false);

    const runTest = async (testId: string) => {
        setResults((prev) => ({ ...prev, [testId]: { status: 'running' } }));
        const test = TESTS.find((t) => t.id === testId);
        if (!test) return;
        try {
            const result = await test.run();
            setResults((prev) => ({ ...prev, [testId]: { status: result.ok ? 'pass' : 'fail', response: result.data, latency: result.latency } }));
        } catch (err) {
            setResults((prev) => ({ ...prev, [testId]: { status: 'fail', error: `${err}` } }));
        }
    };

    const runAll = async () => {
        setRunningAll(true);
        for (const test of TESTS) {
            await runTest(test.id);
            await new Promise((r) => setTimeout(r, 150)); // stagger for visual effect
        }
        setRunningAll(false);
    };

    const trySdk = async () => {
        setSdkRunning(true); setSdkResult(null);
        try {
            const input = JSON.parse(sdkInput);
            const res = await fetch(`${API}:8082/api/ml/score`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...input, time_utc: new Date().toISOString() }),
            });
            setSdkResult(await res.json());
        } catch (err) { setSdkResult({ error: `${err}` }); }
        setSdkRunning(false);
    };

    const groups = [...new Set(TESTS.map((t) => t.group))];
    const passCount = Object.values(results).filter((r) => r.status === 'pass').length;
    const failCount = Object.values(results).filter((r) => r.status === 'fail').length;

    return (
        <div className="max-w-[1400px] mx-auto pb-12">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }} className="mb-8">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2"><FlaskConical size={22} style={{ color: 'var(--accent-teal)' }} /> API Test Suite</h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Interactive tests for all ZTNA Firewall endpoints · Run individually or all at once</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {Object.keys(results).length > 0 && (
                            <div className="flex items-center gap-3 text-sm">
                                <span className="flex items-center gap-1" style={{ color: 'var(--accent-emerald)' }}><CheckCircle2 size={14} /> {passCount}</span>
                                <span className="flex items-center gap-1" style={{ color: 'var(--accent-rose)' }}><XCircle size={14} /> {failCount}</span>
                            </div>
                        )}
                        <button onClick={runAll} disabled={runningAll} className="btn-primary flex items-center gap-2">
                            {runningAll ? <RotateCcw size={14} className="animate-spin" /> : <Send size={14} />}
                            {runningAll ? 'Running...' : 'Run All Tests'}
                        </button>
                    </div>
                </div>
                <div className="glow-line mt-4" />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Test Groups ── */}
                <div className="lg:col-span-2 space-y-6">
                    {groups.map((group, gi) => (
                        <motion.section key={group} initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: gi * 0.1 }}>
                            <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{group}</h2>
                            <div className="space-y-2">
                                {TESTS.filter((t) => t.group === group).map((test) => {
                                    const r = results[test.id] || { status: 'idle' };
                                    const Icon = test.icon;
                                    const isExpanded = expandedId === test.id;

                                    return (
                                        <div key={test.id} className="card !p-0 overflow-hidden">
                                            <div className="flex items-center justify-between p-3.5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : test.id)}>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 rounded-md" style={{ background: `${test.color}15` }}>
                                                        <Icon size={14} style={{ color: test.color }} />
                                                    </div>
                                                    <span className="font-medium text-sm">{test.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {r.latency && <span className="text-[10px] mono" style={{ color: 'var(--text-muted)' }}>⚡ {r.latency}ms</span>}
                                                    {r.status === 'pass' && <CheckCircle2 size={16} style={{ color: 'var(--accent-emerald)' }} />}
                                                    {r.status === 'fail' && <XCircle size={16} style={{ color: 'var(--accent-rose)' }} />}
                                                    {r.status === 'running' && <RotateCcw size={14} className="animate-spin" style={{ color: 'var(--accent-sky)' }} />}
                                                    {r.status === 'idle' && <div className="w-4 h-4 rounded-full border" style={{ borderColor: 'var(--border)' }} />}
                                                    <button onClick={(e) => { e.stopPropagation(); runTest(test.id); }} className="btn-ghost text-xs !p-1.5">
                                                        <Send size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <AnimatePresence>
                                                {isExpanded && r.response && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                                                        <pre className="code-block !rounded-none !border-x-0 !border-b-0 text-[11px] max-h-48 overflow-auto">{JSON.stringify(r.response, null, 2)}</pre>
                                                    </motion.div>
                                                )}
                                                {isExpanded && r.error && (
                                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
                                                        <div className="p-3 text-sm" style={{ background: 'var(--accent-rose-dim)', color: 'var(--accent-rose)' }}>{r.error}</div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.section>
                    ))}
                </div>

                {/* ── SDK Try-It ── */}
                <motion.aside initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: 0.3 }}>
                    <div className="card sticky top-24">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <RefreshCcw size={14} style={{ color: 'var(--accent-teal)' }} /> SDK Try-It-Out
                        </h3>
                        <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>
                            Customize the JSON and send it to the ML Engine — simulates what the SDK does internally.
                        </p>

                        <textarea
                            className="input-field !h-48 !text-[11px] !leading-relaxed resize-none mb-3"
                            value={sdkInput}
                            onChange={(e) => setSdkInput(e.target.value)}
                        />

                        <button onClick={trySdk} disabled={sdkRunning} className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                            {sdkRunning ? <RotateCcw size={13} className="animate-spin" /> : <Send size={13} />}
                            {sdkRunning ? 'Scoring...' : 'Send to ML Engine'}
                        </button>

                        <AnimatePresence>
                            {sdkResult && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                                    <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--accent-teal)' }}>Response:</p>
                                    <pre className="code-block text-[11px] max-h-64 overflow-auto">{JSON.stringify(sdkResult, null, 2)}</pre>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-6">
                            <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Integration Code:</p>
                            <pre className="code-block text-[10px]">{`// Express.js middleware
const { ztnaMiddleware } = require('./ztna-sdk');

app.use(ztnaMiddleware({
  mlEngineUrl: 'http://localhost:8082',
  failMode: 'closed',
}));

// Access trust score on any route
app.get('/data', (req, res) => {
  console.log(req.ztna.trustScore);
  // 85.2 → ALLOW
});`}</pre>
                        </div>
                    </div>
                </motion.aside>
            </div>
        </div>
    );
}
