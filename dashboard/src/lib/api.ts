const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost';

export const SERVICES = {
    proxy: { name: 'Proxy Gateway', port: 8080, healthPath: '/health', color: '#3b82f6' },
    auth: { name: 'Auth Service', port: 8081, healthPath: '/health', color: '#8b5cf6' },
    ml: { name: 'ML Engine', port: 8082, healthPath: '/health', color: '#10b981' },
    opa: { name: 'Policy Engine', port: 8181, healthPath: '/health', color: '#f59e0b' },
};

export type ServiceHealth = {
    name: string;
    status: 'healthy' | 'unhealthy' | 'unreachable';
    latency: number;
    data?: Record<string, unknown>;
    error?: string;
};

export type TrustScoreResult = {
    trust_score: number;
    anomaly_detected: boolean;
    anomaly_reason: string;
    recommended_action: 'ALLOW' | 'CHALLENGE' | 'DENY';
    scoring_mode: string;
};

export type AccessLogEntry = {
    id: string;
    timestamp: string;
    user: string;
    ip: string;
    resource: string;
    trustScore: number;
    action: string;
    anomaly: boolean;
    reason: string;
};

export async function checkServiceHealth(serviceKey: string): Promise<ServiceHealth> {
    const svc = SERVICES[serviceKey as keyof typeof SERVICES];
    if (!svc) return { name: serviceKey, status: 'unreachable', latency: -1 };

    const start = Date.now();
    try {
        const res = await fetch(`${API_BASE}:${svc.port}${svc.healthPath}`, {
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        return {
            name: svc.name,
            status: res.ok ? 'healthy' : 'unhealthy',
            latency: Date.now() - start,
            data,
        };
    } catch (err: unknown) {
        return {
            name: svc.name,
            status: 'unreachable',
            latency: Date.now() - start,
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
}

export async function checkAllHealth(): Promise<ServiceHealth[]> {
    return Promise.all(Object.keys(SERVICES).map(checkServiceHealth));
}

export async function calculateTrustScore(params: {
    user_id: string;
    ip_address: string;
    user_agent: string;
    target_resource: string;
    failed_logins_1h: number;
    device_trusted: boolean;
    geo_location: string;
}): Promise<TrustScoreResult> {
    const res = await fetch(`${API_BASE}:8082/api/ml/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...params,
            time_utc: new Date().toISOString(),
            access_count_1h: 1,
        }),
    });

    if (!res.ok) throw new Error(`ML Engine error: ${res.statusText}`);
    return res.json();
}

export async function loginUser(username: string, password: string) {
    const res = await fetch(`${API_BASE}:8081/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    return res.json();
}

export async function queryOPA(input: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}:8181/v1/data/ztna/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
    });
    return res.json();
}
