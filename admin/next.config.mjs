/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      // NOTE: CORS for /api/* is handled dynamically in middleware.ts
      // (explicit ADMIN_ORIGIN allowlist, no wildcards). Do not set a static
      // Access-Control-Allow-Origin here — it cannot vary by request Origin.
      // ── All routes: security headers ───────────────────────────────
      {
        source: '/:path*',
        headers: [
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Prevent clickjacking (admin panel should never be iframed)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Enforce HTTPS in production
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Don't leak referrer data
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Prevent XSS (legacy header, still useful for old browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Basic CSP: self + inline styles (Next.js needs them)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self'",
              "frame-ancestors 'none'"
            ].join('; ')
          },
          // Opt out of FLoC / Topics API
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' }
        ]
      }
    ];
  }
};

export default nextConfig;
