const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
// Preserve the reviewed pre-paint sidebar preference without allowing arbitrary inline scripts.
const dashboard = fs.readFileSync(path.join(__dirname, 'public/dashboard.html'), 'utf8');
const hashes = [...dashboard.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => "'sha256-" + crypto.createHash('sha256').update(match[1]).digest('base64') + "'");
const csp = ["default-src 'self'", "script-src 'self' " + hashes.join(' '),
  "style-src 'self' 'unsafe-inline'", "font-src 'self'",
  "img-src 'self' data:", "connect-src 'self'", "object-src 'none'", "base-uri 'none'",
  "frame-ancestors 'none'", "form-action 'self'"].join('; ');
function securityHeaders(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.set({
    'X-Request-ID': req.requestId, 'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-origin'
  });
  if (process.env.NODE_ENV === 'production') res.set('Strict-Transport-Security', 'max-age=31536000');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
}
function trustProxy(value = process.env.TRUST_PROXY) {
  if (!value) return false;
  // No hop counts or blanket trust: enumerate actual trusted network ranges.
  if (/^(true|false|\d+)$/i.test(value.trim())) throw new Error('TRUST_PROXY must list trusted proxy IPs/subnets.');
  return value.split(',').map(part => part.trim()).filter(Boolean);
}
// Bounded single-process defense. Distributed ingress throttling remains a release gate.
function rateLimit({limit, windowMs, maxKeys = 10000, now = Date.now}) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.reset <= time) {
      if (buckets.size >= maxKeys) {
        for (const [id, value] of buckets) if (value.reset <= time) buckets.delete(id);
        // Saturation fails closed instead of evicting live buckets and enabling a bypass.
        if (!buckets.has(key) && buckets.size >= maxKeys) {
          res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
          return res.status(429).json({message: 'Too many requests. Try again later.'});
        }
      }
      bucket = {count: 0, reset: time + windowMs}; buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.reset - time) / 1000))));
      return res.status(429).json({message: 'Too many requests. Try again later.'});
    }
    next();
  };
}
function safeError(err, req, res, next) {
  if (res.headersSent) return next(err);
  const schemaMismatch=['42703','42P01','42883','PGRST202','PGRST204','PGRST205'].includes(err.code);
  const status = schemaMismatch?503:err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500;
  console.error(JSON.stringify({event: 'request.failed', requestId: req.requestId, status}));
  if(schemaMismatch)return res.status(503).json({code:'SCHEMA_NOT_READY',message:'Database schema is not ready for this application version. The operator must review and install the required migrations in the approved target.',requestId:req.requestId});
  res.status(status).json({message: status === 413 ? 'Request body is too large.' :
    status === 400 ? 'Request body must be valid JSON.' : 'Server error. Contact support with the request ID.', requestId: req.requestId});
}
module.exports = {securityHeaders, trustProxy, rateLimit, safeError};
