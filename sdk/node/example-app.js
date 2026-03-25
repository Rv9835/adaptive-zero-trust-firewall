/**
 * ZTNA Firewall — Example Integration
 * 
 * This shows how to integrate the ZTNA SDK into an existing Express app.
 * Run: node example-app.js
 */

const express = require('express');
const { ztnaMiddleware, ztnaProtect, checkHealth } = require('./ztna-sdk');

const app = express();

// ── Step 1: Add ZTNA middleware to ALL routes ──────────────────
app.use(ztnaMiddleware({
    mlEngineUrl: 'http://localhost:8082',
    authServiceUrl: 'http://localhost:8081',
    proxyUrl: 'http://localhost:8080',
    enabled: true,
    failMode: 'closed',
}));

// ── Step 2: Public routes (scored but not blocked) ─────────────
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome! This is a public endpoint.',
        ztna: req.ztna, // Trust score is attached to every request
    });
});

// ── Step 3: Protected routes (blocked if score too low) ────────
app.get('/api/sensitive-data', ztnaProtect({ minTrustScore: 80 }), (req, res) => {
    res.json({
        message: 'You have access to sensitive data!',
        data: { secret: 'The answer is 42' },
        ztna: req.ztna,
    });
});

app.get('/api/admin', ztnaProtect({ minTrustScore: 90 }), (req, res) => {
    res.json({
        message: 'Admin panel access granted',
        ztna: req.ztna,
    });
});

// ── Step 4: ZTNA health check endpoint ─────────────────────────
app.get('/ztna/health', async (req, res) => {
    const health = await checkHealth();
    res.json({ services: health });
});

app.listen(3001, () => {
    console.log('🔒 Example app with ZTNA SDK running on http://localhost:3001');
    console.log('   GET /              — Public (scored)');
    console.log('   GET /api/sensitive-data — Protected (min score: 80)');
    console.log('   GET /api/admin     — Protected (min score: 90)');
    console.log('   GET /ztna/health   — Service health check');
});
