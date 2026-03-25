import { NextRequest, NextResponse } from 'next/server';

/**
 * API proxy for OPA Policy Engine — avoids CORS issues since OPA
 * doesn't support CORS headers natively.
 * 
 * The dashboard calls /api/opa/health instead of localhost:8181/health
 * and Next.js forwards the request server-side.
 */
export async function GET() {
    try {
        const res = await fetch('http://localhost:8181/health', {
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (err: unknown) {
        return NextResponse.json(
            { status: 'unreachable', error: err instanceof Error ? err.message : 'Unknown' },
            { status: 503 }
        );
    }
}
