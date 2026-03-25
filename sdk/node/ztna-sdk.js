/**
 * ZTNA Firewall — Injectable SDK
 * 
 * Drop this into ANY Node.js/Express project to integrate with
 * the Adaptive Zero Trust Firewall proxy.
 * 
 * Usage:
 *   const { ztnaMiddleware, ztnaProtect } = require('./ztna-sdk');
 *   app.use(ztnaMiddleware({ proxyUrl: 'http://localhost:8080' }));
 *   app.get('/sensitive', ztnaProtect({ minTrustScore: 80 }), handler);
 */

const http = require('http');
const https = require('https');

const DEFAULT_CONFIG = {
    proxyUrl: process.env.ZTNA_PROXY_URL || 'http://localhost:8080',
    mlEngineUrl: process.env.ZTNA_ML_URL || 'http://localhost:8082',
    authServiceUrl: process.env.ZTNA_AUTH_URL || 'http://localhost:8081',
    policyEngineUrl: process.env.ZTNA_OPA_URL || 'http://localhost:8181',
    enabled: process.env.ZTNA_ENABLED !== 'false',
    failMode: process.env.ZTNA_FAIL_MODE || 'closed', // 'closed' or 'open'
    defaultMinScore: 40,
    timeout: 3000, // ms
    logRequests: true,
};

/**
 * Make an HTTP request and return parsed JSON.
 */
function fetchJSON(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const lib = urlObj.protocol === 'https:' ? https : http;

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method,
            headers: { 'Content-Type': 'application/json' },
            timeout: DEFAULT_CONFIG.timeout,
        };

        const req = lib.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: { raw: data } });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

/**
 * Extract client IP from request.
 */
function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.ip ||
        '0.0.0.0'
    );
}

/**
 * Get trust score from ML engine.
 */
async function getTrustScore(req, config) {
    const payload = {
        user_id: req.headers['x-ztna-user-id'] || req.user?.id || 'anonymous',
        ip_address: getClientIP(req),
        user_agent: req.headers['user-agent'] || '',
        target_resource: req.originalUrl || req.url,
        time_utc: new Date().toISOString(),
        failed_logins_1h: parseInt(req.headers['x-ztna-failed-logins'] || '0'),
        device_trusted: req.headers['x-ztna-device-trusted'] === 'true',
        geo_location: req.headers['x-ztna-geo'] || '',
    };

    try {
        const result = await fetchJSON(`${config.mlEngineUrl}/api/ml/score`, 'POST', payload);
        return result.data;
    } catch (err) {
        console.error('[ZTNA] ML engine unreachable:', err.message);
        return {
            trust_score: config.failMode === 'open' ? 75 : 50,
            anomaly_detected: false,
            recommended_action: config.failMode === 'open' ? 'ALLOW' : 'CHALLENGE',
            scoring_mode: 'fallback',
        };
    }
}

/**
 * Middleware — attaches trust score to every request.
 * Access via req.ztna.trustScore, req.ztna.action, etc.
 */
function ztnaMiddleware(userConfig = {}) {
    const config = { ...DEFAULT_CONFIG, ...userConfig };

    return async (req, res, next) => {
        if (!config.enabled) return next();

        // Skip health checks
        if (req.url === '/health' || req.url === '/favicon.ico') return next();

        try {
            const score = await getTrustScore(req, config);

            // Attach ZTNA context to request
            req.ztna = {
                trustScore: score.trust_score,
                anomalyDetected: score.anomaly_detected,
                anomalyReason: score.anomaly_reason || '',
                action: score.recommended_action,
                scoringMode: score.scoring_mode || 'normal',
                timestamp: new Date().toISOString(),
                clientIP: getClientIP(req),
            };

            // Set response headers for transparency
            res.setHeader('X-ZTNA-Trust-Score', score.trust_score);
            res.setHeader('X-ZTNA-Action', score.recommended_action);
            res.setHeader('X-ZTNA-Scoring-Mode', score.scoring_mode || 'normal');

            if (config.logRequests) {
                const emoji = score.recommended_action === 'ALLOW' ? '✅' :
                    score.recommended_action === 'CHALLENGE' ? '⚠️' : '🚫';
                console.log(
                    `[ZTNA] ${emoji} ${req.method} ${req.url} | ` +
                    `Score: ${score.trust_score} | Action: ${score.recommended_action} | ` +
                    `IP: ${getClientIP(req)}`
                );
            }

            next();
        } catch (err) {
            console.error('[ZTNA] Middleware error:', err.message);
            req.ztna = { trustScore: 50, action: 'CHALLENGE', scoringMode: 'error' };
            next();
        }
    };
}

/**
 * Route-level protection — blocks/challenges requests below a threshold.
 */
function ztnaProtect(options = {}) {
    const minScore = options.minTrustScore || DEFAULT_CONFIG.defaultMinScore;
    const challengeUrl = options.challengeUrl || null;

    return (req, res, next) => {
        if (!req.ztna) return next(); // Middleware not applied

        const { trustScore, action } = req.ztna;

        if (trustScore >= minScore && action === 'ALLOW') {
            return next();
        }

        if (action === 'CHALLENGE') {
            if (challengeUrl) {
                return res.redirect(302, `${challengeUrl}?returnTo=${encodeURIComponent(req.originalUrl)}`);
            }
            return res.status(401).json({
                error: 'mfa_required',
                message: 'Step-up authentication required. Trust score too low.',
                trust_score: trustScore,
                action: 'CHALLENGE',
            });
        }

        // DENY
        return res.status(403).json({
            error: 'access_denied',
            message: 'Request denied by Zero Trust Firewall.',
            trust_score: trustScore,
            action: 'DENY',
        });
    };
}

/**
 * Health check helper — checks all ZTNA services.
 */
async function checkHealth(config = DEFAULT_CONFIG) {
    const services = [
        { name: 'proxy-gateway', url: `${config.proxyUrl}/health` },
        { name: 'auth-service', url: `${config.authServiceUrl}/health` },
        { name: 'ml-engine', url: `${config.mlEngineUrl}/health` },
    ];

    const results = await Promise.allSettled(
        services.map(async (svc) => {
            const start = Date.now();
            const result = await fetchJSON(svc.url);
            return {
                ...svc,
                status: result.status === 200 ? 'healthy' : 'unhealthy',
                latency: Date.now() - start,
                data: result.data,
            };
        })
    );

    return results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        return { ...services[i], status: 'unreachable', latency: -1, error: r.reason?.message };
    });
}

module.exports = {
    ztnaMiddleware,
    ztnaProtect,
    checkHealth,
    getTrustScore,
    getClientIP,
};
