'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    Shield, Activity, Zap, Clock, Globe, Fingerprint, Bot,
    Send, RotateCcw, Lock, ExternalLink, FlaskConical, ArrowRight
} from 'lucide-react';

/* ─── types ─── */
type ServiceHealth = {
    name: string; key: string; port: number;
    status: 'healthy' | 'unhealthy' | 'unreachable' | 'checking';
    latency: number; data?: Record<string, unknown>;
};
type TrustResult = {
    trust_score: number; anomaly_detected: boolean;
    anomaly_reason: string; recommended_action: string; scoring_mode: string;
};
type LogEntry = {
    id: string; time: string; user: string; ip: string;
    resource: string; score: number; action: string; reason: string;
};

const API = 'http://localhost';
const SVCS = [
    { key: 'proxy', name: 'Proxy Gateway', port: 8080, path: '/health', icon: Globe, color: 'var(--accent-teal)' },
    { key: 'auth', name: 'Auth Service', port: 8081, path: '/health', icon: Lock, color: 'var(--accent-violet)' },
    { key: 'ml', name: 'ML Engine', port: 8082, path: '/health', icon: Bot, color: 'var(--accent-coral)' },
    { key: 'opa', name: 'Policy Engine', port: 3000, path: '/api/opa/health', icon: Shield, color: 'var(--accent-amber)' },
];

const PRESETS: Record<string, { label: string; desc: string; user_id: string; ip_address: string; user_agent: string; target_resource: string; failed_logins_1h: number; device_trusted: boolean; geo_location: string }> = {
    trusted: { label: 'Trusted Employee', desc: 'Office login, known device, business hours', user_id: 'sarah-engineer-001', ip_address: '10.0.1.50', user_agent: 'Mozilla/5.0 Chrome/120', target_resource: 'code-repo', failed_logins_1h: 0, device_trusted: true, geo_location: 'New York, US' },
    traveling: { label: 'Traveling Employee', desc: 'New location → expects MFA challenge', user_id: 'raj-sales-002', ip_address: '203.45.67.89', user_agent: 'Mozilla/5.0 Safari/17', target_resource: 'crm', failed_logins_1h: 1, device_trusted: false, geo_location: 'Mumbai, IN' },
    hacker: { label: 'Stolen Credentials', desc: 'Tor exit node, 3AM, 5 failed logins', user_id: 'admin-003', ip_address: '185.220.101.1', user_agent: 'curl/7.0', target_resource: 'finance-db', failed_logins_1h: 5, device_trusted: false, geo_location: 'Unknown' },
    iot: { label: 'IoT Device', desc: 'Smart sensor with anomalous burst', user_id: 'iot-sensor-floor3', ip_address: '10.10.50.30', user_agent: 'IoTGateway/1.0', target_resource: 'sensor-api', failed_logins_1h: 0, device_trusted: true, geo_location: 'Office Building' },
};

const PRESET_ICONS: Record<string, string> = { trusted: '🟢', traveling: '🟡', hacker: '🔴', iot: '🤖' };

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

export default function DashboardPage() {
    const [services, setServices] = useState<ServiceHealth[]>(SVCS.map((s) => ({ ...s, status: 'checking' as const, latency: 0 })));
    const [result, setResult] = useState<TrustResult | null>(null);
    const [opaResult, setOpaResult] = useState<Record<string, unknown> | null>(null);
    const [authResult, setAuthResult] = useState<Record<string, unknown> | null>(null);
    const [scoring, setScoring] = useState(false);
    const [preset, setPreset] = useState('trusted');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [tab, setTab] = useState<'presets' | 'custom'>('presets');
    const [custom, setCustom] = useState(PRESETS.trusted);

    const checkHealth = useCallback(async () => {
        const results = await Promise.all(SVCS.map(async (svc) => {
            const start = Date.now();
            try {
                const res = await fetch(`${API}:${svc.port}${svc.path}`, { signal: AbortSignal.timeout(3000) });
                const data = await res.json();
                return { ...svc, status: (res.ok ? 'healthy' : 'unhealthy') as const, latency: Date.now() - start, data };
            } catch { return { ...svc, status: 'unreachable' as const, latency: Date.now() - start }; }
        }));
        setServices(results);
    }, []);

    useEffect(() => { checkHealth(); const i = setInterval(checkHealth, 6000); return () => clearInterval(i); }, [checkHealth]);

    const runScore = async (key?: string) => {
        setScoring(true); setResult(null); setOpaResult(null);
        const input = key ? PRESETS[key] : custom;
        try {
            const res = await fetch(`${API}:8082/api/ml/score`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...input, time_utc: new Date().toISOString(), access_count_1h: 1 }),
            });
            const data: TrustResult = await res.json();
            setResult(data);
            setLogs((prev) => [{ id: crypto.randomUUID(), time: new Date().toLocaleTimeString(), user: input.user_id, ip: input.ip_address, resource: input.target_resource, score: data.trust_score, action: data.recommended_action, reason: data.anomaly_reason || '' }, ...prev].slice(0, 50));
            try {
                const opa = await fetch('/api/opa/query', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: { trust_score: data.trust_score, device_trusted: input.device_trusted, ip_reputation: data.anomaly_detected ? 'suspicious' : 'clean', account_locked: false } }),
                });
                setOpaResult((await opa.json())?.result || null);
            } catch { /* optional */ }
        } catch (err) { setResult({ trust_score: -1, anomaly_detected: false, anomaly_reason: `${err}`, recommended_action: 'ERROR', scoring_mode: 'error' }); }
        setScoring(false);
    };

    const testAuth = async (user: string, pass: string) => {
        try {
            const res = await fetch(`${API}:8081/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
            setAuthResult(await res.json());
        } catch (err) { setAuthResult({ error: `${err}` }); }
    };

    const healthyCount = services.filter((s) => s.status === 'healthy').length;
    const scoreColor = (s: number) => s >= 80 ? 'var(--accent-emerald)' : s >= 40 ? 'var(--accent-amber)' : 'var(--accent-rose)';
    const actionBadge = (a: string) => a === 'ALLOW' ? 'badge-allow' : a === 'CHALLENGE' ? 'badge-challenge' : 'badge-deny';

    return (
        <div className="max-w-[1400px] mx-auto pb-12">
            {/* ── Header ── */}
            <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }} className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Monitoring Dashboard</h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Real-time service health · Trust score analysis · Access decisions</p>
                    </div>
                    <Link href="/tests" className="btn-secondary flex items-center gap-2 text-sm">
                        <FlaskConical size={14} /> Full Test Suite <ArrowRight size={14} />
                    </Link>
                </div>
                <div className="glow-line mt-4" />
            </motion.div>

            {/* ── Health ── */}
            <motion.section initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: 0.1 }} className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold flex items-center gap-2">
                        <Activity size={16} style={{ color: 'var(--accent-teal)' }} /> Service Health
                        <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{healthyCount}/{SVCS.length} online</span>
                    </h2>
                    <button onClick={checkHealth} className="btn-ghost text-xs flex items-center gap-1"><RotateCcw size={12} /> Refresh</button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {services.map((svc) => {
                        const cfg = SVCS.find((s) => s.key === svc.key)!;
                        const Icon = cfg.icon;
                        return (
                            <motion.div key={svc.key} whileHover={{ scale: 1.01 }} className="card !p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-md" style={{ background: `${cfg.color}15` }}>
                                            <Icon size={14} style={{ color: cfg.color }} />
                                        </div>
                                        <span className="font-medium text-sm">{svc.name}</span>
                                    </div>
                                    <div className={`pulse-dot ${svc.status === 'healthy' ? 'bg-emerald-400' : svc.status === 'checking' ? 'bg-sky-400' : 'bg-rose-400'}`} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className={`badge badge-${svc.status === 'checking' ? 'healthy' : svc.status}`}>
                                        {svc.status === 'checking' ? '...' : svc.status}
                                    </span>
                                    {svc.latency > 0 && <span className="text-[10px] mono" style={{ color: 'var(--text-muted)' }}>⚡ {svc.latency}ms</span>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </motion.section>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* ── Trust Scorer ── */}
                <motion.section initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: 0.2 }} className="lg:col-span-3">
                    <div className="card">
                        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <Fingerprint size={16} style={{ color: 'var(--accent-violet)' }} /> Trust Score Simulator
                        </h2>
                        <div className="flex gap-2 mb-4">
                            {(['presets', 'custom'] as const).map((t) => (
                                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t ? 'text-[var(--accent-teal)]' : ''}`}
                                    style={tab === t ? { background: 'var(--accent-teal-dim)', border: '1px solid rgba(45,212,191,0.25)' } : { border: '1px solid transparent' }}
                                >{t === 'presets' ? 'Scenarios' : 'Custom'}</button>
                            ))}
                        </div>

                        {tab === 'presets' ? (
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {Object.entries(PRESETS).map(([k, p]) => (
                                    <button key={k} onClick={() => { setPreset(k); setCustom(p); }}
                                        className={`p-3 rounded-xl text-left transition-all border ${preset === k ? 'border-[var(--accent-teal)]' : 'border-transparent hover:border-[var(--border-hover)]'}`}
                                        style={preset === k ? { background: 'var(--accent-teal-dim)' } : {}}
                                    >
                                        <p className="font-medium text-sm">{PRESET_ICONS[k]} {p.label}</p>
                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.desc}</p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                {[
                                    { label: 'User ID', key: 'user_id' }, { label: 'IP Address', key: 'ip_address' },
                                    { label: 'Resource', key: 'target_resource' }, { label: 'Geo Location', key: 'geo_location' },
                                ].map((f) => (
                                    <div key={f.key}>
                                        <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                                        <input className="input-field" value={(custom as Record<string, unknown>)[f.key] as string} onChange={(e) => setCustom({ ...custom, [f.key]: e.target.value })} />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Failed Logins</label>
                                    <input className="input-field" type="number" value={custom.failed_logins_1h} onChange={(e) => setCustom({ ...custom, failed_logins_1h: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div>
                                    <label className="text-[11px] mb-1 block" style={{ color: 'var(--text-muted)' }}>Device Trusted</label>
                                    <select className="input-field" value={custom.device_trusted ? 'yes' : 'no'} onChange={(e) => setCustom({ ...custom, device_trusted: e.target.value === 'yes' })}>
                                        <option value="yes">Yes</option><option value="no">No</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        <button onClick={() => runScore(tab === 'presets' ? preset : undefined)} disabled={scoring} className="btn-primary w-full flex items-center justify-center gap-2">
                            {scoring ? <RotateCcw size={14} className="animate-spin" /> : <Send size={14} />}
                            {scoring ? 'Analyzing...' : 'Run Trust Score Analysis'}
                        </button>

                        <AnimatePresence>
                            {result && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }}
                                    className="mt-5 p-5 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-semibold">Result</span>
                                        <span className={`badge ${actionBadge(result.recommended_action)}`}>{result.recommended_action}</span>
                                    </div>
                                    <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-end gap-2 mb-3">
                                        <span className="text-5xl font-black mono" style={{ color: scoreColor(result.trust_score) }}>{result.trust_score}</span>
                                        <span className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>/ 100</span>
                                    </motion.div>
                                    <div className="trust-meter mb-4">
                                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, result.trust_score)}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                                            className="trust-meter-fill" style={{ background: `linear-gradient(90deg, ${scoreColor(result.trust_score)}, ${scoreColor(result.trust_score)}88)` }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Anomaly</p>
                                            <p className="font-medium" style={{ color: result.anomaly_detected ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{result.anomaly_detected ? 'Yes ⚠️' : 'No ✓'}</p>
                                        </div>
                                        <div className="p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Mode</p>
                                            <p className="font-medium mono text-sm">{result.scoring_mode}</p>
                                        </div>
                                    </div>
                                    {result.anomaly_reason && (
                                        <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--accent-rose-dim)', border: '1px solid rgba(244,63,94,0.2)' }}>
                                            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-rose)' }}>⚠ Anomaly Reason</p>
                                            <p className="text-sm" style={{ color: 'var(--accent-coral)' }}>{result.anomaly_reason}</p>
                                        </div>
                                    )}
                                    {opaResult && (
                                        <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--accent-amber-dim)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-amber)' }}>🏛 OPA Decision</p>
                                            <pre className="text-xs mono" style={{ color: 'var(--accent-amber)' }}>{JSON.stringify(opaResult, null, 2)}</pre>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.section>

                {/* ── Sidebar ── */}
                <motion.aside initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: 0.3 }} className="lg:col-span-2 space-y-5">
                    {/* Auth Test */}
                    <div className="card">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Lock size={14} style={{ color: 'var(--accent-violet)' }} /> Auth + MFA Test
                        </h3>
                        <div className="space-y-1.5 mb-3">
                            {[
                                { user: 'sarah.engineer', pass: 'SecurePass123!', label: 'Sarah', badge: 'Engineer' },
                                { user: 'admin', pass: 'AdminPass789!', label: 'Admin', badge: 'Admin' },
                                { user: 'hacker', pass: 'wrongpass', label: 'Wrong Creds', badge: 'Fail' },
                            ].map((c) => (
                                <button key={c.user} onClick={() => testAuth(c.user, c.pass)}
                                    className="w-full p-2 rounded-lg text-left text-sm transition-all hover:bg-white/[0.03] flex items-center justify-between"
                                >
                                    <span className="font-medium">{c.label} <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.user}</span></span>
                                    <span className="badge badge-allow text-[9px]">{c.badge}</span>
                                </button>
                            ))}
                        </div>
                        <AnimatePresence>
                            {authResult && (
                                <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="code-block text-[11px] max-h-36 overflow-auto">
                                    {JSON.stringify(authResult, null, 2)}
                                </motion.pre>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Quick Links */}
                    <div className="card">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Zap size={14} style={{ color: 'var(--accent-sky)' }} /> Quick Links
                        </h3>
                        <div className="space-y-1.5">
                            <Link href="/tests" className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.03] transition-all text-sm">
                                <span className="flex items-center gap-2"><FlaskConical size={13} style={{ color: 'var(--accent-teal)' }} /> Full API Test Suite</span>
                                <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                            </Link>
                            <Link href="/docs" className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.03] transition-all text-sm">
                                <span className="flex items-center gap-2"><ExternalLink size={13} style={{ color: 'var(--accent-coral)' }} /> SDK Documentation</span>
                                <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                            </Link>
                        </div>
                    </div>

                    {/* SDK Snippet */}
                    <div className="card">
                        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <ExternalLink size={14} style={{ color: 'var(--accent-emerald)' }} /> SDK Integration
                        </h3>
                        <pre className="code-block text-[11px]">{`const { ztnaMiddleware } = require('./ztna-sdk');

app.use(ztnaMiddleware({
  mlEngineUrl: 'http://localhost:8082',
}));`}</pre>
                    </div>
                </motion.aside>
            </div>

            {/* ── Access Log ── */}
            <motion.section initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5, delay: 0.4 }} className="mt-6">
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <Clock size={16} style={{ color: 'var(--accent-amber)' }} /> Access Log
                            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{logs.length} entries</span>
                        </h2>
                        {logs.length > 0 && <button onClick={() => setLogs([])} className="btn-ghost text-xs">Clear</button>}
                    </div>
                    {logs.length === 0 ? (
                        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                            <Activity size={28} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">Run a Trust Score analysis to populate the log.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                        <th className="text-left pb-2 pl-2">Time</th><th className="text-left pb-2">User</th><th className="text-left pb-2">IP</th>
                                        <th className="text-left pb-2">Resource</th><th className="text-right pb-2">Score</th><th className="text-center pb-2">Decision</th><th className="text-left pb-2 pr-2">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <motion.tr key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="border-t hover:bg-white/[0.01]" style={{ borderColor: 'var(--border)' }}>
                                            <td className="py-2.5 pl-2 mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{log.time}</td>
                                            <td className="py-2.5 font-medium text-sm">{log.user}</td>
                                            <td className="py-2.5 mono text-[11px]">{log.ip}</td>
                                            <td className="py-2.5 mono text-[11px]">{log.resource}</td>
                                            <td className="py-2.5 text-right mono font-bold" style={{ color: scoreColor(log.score) }}>{log.score}</td>
                                            <td className="py-2.5 text-center"><span className={`badge ${actionBadge(log.action)}`}>{log.action}</span></td>
                                            <td className="py-2.5 pr-2 text-[11px] max-w-[180px] truncate" style={{ color: 'var(--text-muted)' }}>{log.reason || '—'}</td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.section>
        </div>
    );
}
