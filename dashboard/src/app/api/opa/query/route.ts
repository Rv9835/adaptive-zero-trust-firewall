import { NextRequest, NextResponse } from 'next/server';

/**
 * API proxy for OPA policy queries — avoids CORS.
 * POST /api/opa/query with { input: {...} }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const res = await fetch('http://localhost:8181/v1/data/ztna/decision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown' },
            { status: 503 }
        );
    }
}
