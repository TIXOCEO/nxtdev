/**
 * PM2 ecosystem for NXTTRACK production VPS.
 *
 * Two processes (mockup-sandbox is dev-only and NOT deployed):
 *   nxttrack-web  → Next.js, port 8080
 *   nxttrack-api  → Express,  port 8081
 *
 * NB: poorten 6000-6010 zijn door browsers/Next.js geblokkeerd (X11-range),
 * vandaar 8080/8081.
 *
 * Env loading strategy:
 *   - Single `.env` at /var/www/nxttrack/.env (root of repo, gitignored)
 *   - Web: Next.js auto-loads `.env.production` from artifacts/nxttrack/.
 *          Symlink it to the root .env once during deploy:
 *            ln -sf ../../.env artifacts/nxttrack/.env.production
 *   - API: loaded natively via `node --env-file=...` (Node 20.6+).
 *
 * PM2 only sets PORT + NODE_ENV here. Everything else (Supabase, SendGrid,
 * SESSION_SECRET, …) lives in /var/www/nxttrack/.env — never commit that file.
 */
module.exports = {
  apps: [
    {
      name: "nxttrack-web",
      cwd: "/var/www/nxttrack/artifacts/nxttrack",
      script: "node_modules/next/dist/bin/next",
      args: "start --port 8080 --hostname 127.0.0.1",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "8080",
      },
      error_file: "/var/www/nxttrack/logs/web-error.log",
      out_file: "/var/www/nxttrack/logs/web-out.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "nxttrack-api",
      cwd: "/var/www/nxttrack",
      script: "node",
      args: "--env-file=/var/www/nxttrack/.env --enable-source-maps artifacts/api-server/dist/index.mjs",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "8081",
      },
      error_file: "/var/www/nxttrack/logs/api-error.log",
      out_file: "/var/www/nxttrack/logs/api-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
