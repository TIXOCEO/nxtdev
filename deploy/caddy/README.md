# Caddy install op de NXTTRACK VPS

Eenmalige migratie van nginx+certbot naar Caddy met automatische TLS.
Daarna voeg je nieuwe tenant-domeinen toe via de platform-admin UI;
geen VPS-actie meer nodig.

## 1. Caddy installeren (Ubuntu 24.04)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 2. Caddyfile + environment plaatsen

```bash
# Vanaf de repo root op de VPS:
sudo cp deploy/caddy/Caddyfile /etc/caddy/Caddyfile

# Environment voor caddy.service:
sudo tee /etc/default/caddy >/dev/null <<'EOF'
ACME_EMAIL=info@nxttrack.nl
APEX_DOMAIN=nxttrack.nl
APP_PORT=8080
API_PORT=8081
EOF
```

Pas `/etc/systemd/system/caddy.service.d/override.conf` aan zodat de env
wordt geladen:

```bash
sudo systemctl edit caddy
```

Plak in de editor:

```ini
[Service]
EnvironmentFile=/etc/default/caddy
```

## 3. Nginx uitschakelen, Caddy starten

```bash
# Stop nginx (poort 80/443 vrijmaken).
sudo systemctl stop nginx
sudo systemctl disable nginx

# Caddy starten.
sudo systemctl enable --now caddy
sudo systemctl status caddy
```

Caddy luistert nu op poort 80 + 443 en proxyt naar PM2-poorten 8080/8081.
Bestaande certs hoeven niet gemigreerd; Caddy haalt nieuwe op bij eerste
HTTPS-request per host.

## 4. Verifiëren

```bash
# Apex blijft werken.
curl -I https://nxttrack.nl

# Een bestaand tenant subdomein blijft werken.
curl -I https://demo.nxttrack.nl

# tls-check endpoint moet bereikbaar zijn (gebruikt door Caddy).
curl 'https://nxttrack.nl/api/tls-check?domain=nxttrack.nl'
# Verwacht: {"ok":true,"domain":"nxttrack.nl","kind":"apex"}

curl -i 'https://nxttrack.nl/api/tls-check?domain=onbekend.example'
# Verwacht: HTTP 404 met JSON body
```

## 5. Hoe je een nieuwe tenant met custom domein toevoegt (zonder VPS!)

1. **Platform admin → Tenants → Edit tenant** → vul `Domain` in
   (bv. `voetbalschool-houtrust.nl`) en sla op.
2. **DNS bij Cloudflare** (de instructies staan op de tenant-detail
   pagina, met copy-knoppen):
   - `A @   178.251.232.12  (Proxied)`
   - `A www 178.251.232.12  (Proxied)`
   - SSL/TLS-modus: **Full (strict)**
   - Voor allereerste cert-aanvraag: tijdelijk **DNS only** (grijze wolk)
     ~30 sec, dan terug op Proxied.
3. Klaar. Caddy fetcht het cert, middleware routeert de host naar de
   juiste tenant. Geen redeploy, geen pm2 restart, geen Caddyfile-edit.

## 6. Troubleshooting

| Symptoom | Oplossing |
| -------- | --------- |
| Browser krijgt cert-fout op nieuw domein | Cloudflare staat op Proxied terwijl cert nog niet uitgegeven is. Tijdelijk op DNS only zetten. |
| `caddy: tls: TLSALPN-01 challenge failed` | Caddy bereikt zichzelf niet op poort 443; check firewall (`sudo ufw status`). |
| Caddy weigert cert ("ask returned 4xx") | tls-check zegt onbekend domein → in DB staat `tenants.domain` nog niet ingevuld of klopt niet. |
| 502 Bad Gateway na proxy | Next.js draait niet op `APP_PORT`. Check `pm2 status`. |

## 7. Rollback naar nginx

```bash
sudo systemctl stop caddy
sudo systemctl disable caddy
sudo systemctl enable --now nginx
```

Nginx-config is niet aangepast door deze migratie en blijft werken.
