# NXTTRACK — VPS deployment guide

End-to-end runbook to deploy this monorepo to a VPS via GitHub.

> Production target: **nxttrack.nl** (apex) + **\*.nxttrack.nl** (tenant subdomains)
> VPS arch: **x86_64** (Ubuntu 22.04/24.04 LTS)
> Mailprovider: **SendGrid (API)**
> Processes managed by: **PM2** on ports **6000** (web) and **6001** (api)

---

## 1. Eenmalige VPS-setup

```bash
# Update + tools
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git curl

# Node 20 LTS (NIET 24 — onze stack is op 20 getest)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # moet ≥ 20.6 zijn voor --env-file support

# pnpm + PM2
sudo npm install -g pnpm@latest pm2

# Nginx + TLS
sudo apt install -y nginx certbot python3-certbot-nginx

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2. Repo klonen

```bash
sudo mkdir -p /var/www/nxttrack
sudo chown $USER:$USER /var/www/nxttrack
cd /var/www/nxttrack

# Clone via SSH deploy key (aanbevolen) — niet HTTPS-PAT
git clone git@github.com:<jouw-user>/nxttrack.git .
```

## 3. Environment file

```bash
cp .env.example .env
nano .env   # vul ALLE echte waarden in
chmod 600 .env

# Next.js verwacht .env.production naast next.config.ts.
# Symlink zorgt dat we maar één bestand hoeven te onderhouden:
ln -sf ../../.env artifacts/nxttrack/.env.production
```

Waarden die je nodig hebt:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` van je **productie** Supabase project (de geüpgradede pro-instance — niet `nxt-dev`).
- `SENDGRID_API_KEY` (SendGrid dashboard → Settings → API Keys → "Mail Send: Full Access").
- `SESSION_SECRET` — genereer met `openssl rand -base64 48`.
- `APP_BASE_URL=https://nxttrack.nl`.

## 4. Install + build

```bash
cd /var/www/nxttrack
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm --filter @workspace/nxttrack run build
pnpm --filter @workspace/api-server run build
```

## 5. Database migraties

Je productie-Supabase project heeft een eigen schema. Draai (in volgorde) via Supabase SQL editor:

```
artifacts/nxttrack/supabase/schema.sql        (alleen als nieuw project)
artifacts/nxttrack/supabase/seed.sql          (alleen als nieuw project)
artifacts/nxttrack/supabase/sprint7.sql
artifacts/nxttrack/supabase/sprint8.sql
artifacts/nxttrack/supabase/sprint9.sql
artifacts/nxttrack/supabase/sprint9_ses.sql
artifacts/nxttrack/supabase/sprint10.sql
…  (alle sprint-bestanden t/m sprint20)
artifacts/nxttrack/supabase/sprint21_staff_invite_template.sql
artifacts/nxttrack/supabase/storage.sql
```

> ⚠️ Skip `sprint19_social_feed.sql` als je Sprint 19 nog niet wil uitrollen — de codebase heeft die feature nog niet geïntegreerd.

## 6. PM2 starten

```bash
mkdir -p /var/www/nxttrack/logs
pm2 start /var/www/nxttrack/ecosystem.config.cjs
pm2 save
pm2 startup systemd          # voer het sudo-commando uit dat hij terug geeft
pm2 status                   # beide processen 'online'
pm2 logs nxttrack-web --lines 30
pm2 logs nxttrack-api --lines 30
```

## 7. Nginx reverse proxy + HTTPS

Maak `/etc/nginx/sites-available/nxttrack`:

```nginx
server {
    server_name nxttrack.nl www.nxttrack.nl *.nxttrack.nl;

    client_max_body_size 25M;

    # API → Express op 6001
    location /api/ {
        proxy_pass http://127.0.0.1:6001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }

    # Alles anders → Next.js op 6000
    location / {
        proxy_pass http://127.0.0.1:6000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }

    listen 80;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/nxttrack /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# TLS — apex + www
sudo certbot --nginx -d nxttrack.nl -d www.nxttrack.nl

# Wildcard voor *.nxttrack.nl (tenant subdomains) — DNS-01 challenge
sudo certbot certonly --manual --preferred-challenges dns \
  -d '*.nxttrack.nl' -d nxttrack.nl
# Volg de prompts: DNS TXT record bij je provider zetten, dan Enter.
# Daarna nginx config aanvullen met ssl_certificate paths voor wildcard.
```

DNS records die moeten staan bij je registrar:
```
A      nxttrack.nl          → <VPS IP>
A      www.nxttrack.nl      → <VPS IP>
A      *.nxttrack.nl        → <VPS IP>     (wildcard voor tenant subdomains)
```

## 8. Verificatie checklist

- [ ] `pm2 status` toont beide processen online, géén restarts in laatste 5 min
- [ ] `curl -I https://nxttrack.nl` → `200 OK`
- [ ] Marketing site laadt op `https://nxttrack.nl`
- [ ] Tenant subdomain laadt: `https://<bestaande-slug>.nxttrack.nl`
- [ ] Login werkt (Supabase session cookies blijven hangen)
- [ ] Test-mail vanuit Platform → Email → "Send test" komt binnen
- [ ] Een staff/trainer-uitnodiging via Tenant → Leden → Lid toevoegen verstuurt zonder template-error (sprint 21 backfill)

## 9. Updates uitrollen

```bash
cd /var/www/nxttrack
git pull
pnpm install --frozen-lockfile
pnpm --filter @workspace/nxttrack run build
pnpm --filter @workspace/api-server run build
pm2 reload ecosystem.config.cjs   # zero-downtime restart
```

## 10. Troubleshooting

| Symptoom | Oplossing |
|---|---|
| `Error: NEXT_PUBLIC_SUPABASE_URL is undefined` | Symlink `artifacts/nxttrack/.env.production` ontbreekt of wijst naar leeg bestand. |
| Server Action geeft 403 / "origin not allowed" | Domein staat niet in `next.config.ts` `allowedOrigins`. Toevoegen + rebuild. |
| Mails komen niet aan | Check `pm2 logs nxttrack-web` op `SendGrid not configured` — dan ontbreekt `SENDGRID_API_KEY`. |
| Tenant subdomain → "tenant not found" | DNS wildcard `*.nxttrack.nl` ontbreekt of niet gepropageerd. |
| Invite-link wijst naar `localhost` | `APP_BASE_URL` ontbreekt in `.env`. |
| PM2 herstart loop | `pm2 logs <name> --err --lines 100` — meestal missende env var of build niet up-to-date. |
