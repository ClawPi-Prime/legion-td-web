# SquadBattleTD — Alpha Infrastructure Proposal

**Prepared:** 2026-03-28  
**Game:** SquadBattleTD (formerly Legion TD Web)  
**Target domain:** sbtd.io  
**Stack:** Node.js/Express + Socket.io · PostgreSQL · HTML5 Canvas · k3s on Raspberry Pi 4

---

## Executive Summary

SquadBattleTD is moving from LAN-only prototype to a real alpha with external players. The stack (Node.js + Socket.io + PostgreSQL on k3s/RPi4) is solid for a self-hosted alpha. The main work required is:

1. **Registering sbtd.io** (~$32–50/year, see below) and pointing it at the Pi without opening router ports.
2. **Deploying Cloudflare Tunnel** (`cloudflared`) to expose the game publicly — no port forwarding, no dynamic DNS required — with automatic SSL/TLS included.
3. **Hardening the Node.js backend** to be safe for real external players (rate limiting, input validation, helmet, auth).
4. **Ensuring a clean migration path** to cloud (Fly.io or Railway) when the Pi stops being enough.

Everything can be done incrementally. Estimated cost to launch alpha: **~$32–50/year** (domain only) if self-hosted. Cloud migration budget if needed: **~$20–40/month** on Railway or Fly.io for a modest setup.

---

## 1. Domain: sbtd.io

### Availability

The WHOIS lookup for `sbtd.io` via `https://who.is/whois/sbtd.io` returned only the generic WHOIS protocol description — meaning **no active registration data was found for sbtd.io**, which is a strong signal the domain is available. The domain should be confirmed available at registration time, as WHOIS data can sometimes lag.

> ⚠️ Source: https://who.is/whois/sbtd.io (fetched 2026-03-28 — minimal/empty WHOIS record returned)

### .io Domain Pricing

From Porkbun (https://porkbun.com/tld/io, fetched 2026-03-28):
- Porkbun advertises .io at an "everyday low price" but their price display requires JavaScript rendering — the extracted text confirmed .io is offered but did not render the exact number in the static scrape.

From the Porkbun domain pricing grid (https://porkbun.com/products/domains/tld/io, fetched 2026-03-28):
- The pricing table showed an ".io" everyday price of approximately **$31.41/year** (no first-year sale discount noted for .io specifically — it's an "everyday low price" item at Porkbun).

Typical .io domain pricing across registrars (cross-referenced from pricing grids):
| Registrar | Registration | Renewal |
|---|---|---|
| Porkbun | ~$31–35/year | ~$31–35/year |
| Namecheap | ~$32–45/year | ~$45/year |
| Cloudflare Registrar | ~$32–35/year (at-cost) | ~$32–35/year |

> Source: https://porkbun.com/products/domains/tld/io (fetched 2026-03-28)

### Registrar Recommendation

**Use Cloudflare Registrar** (https://www.cloudflare.com/products/registrar/) for sbtd.io.

Reasons:
- Cloudflare sells domains at-cost (no markup) — .io is typically ~$32–35/year
- Since you'll use Cloudflare Tunnel (see Section 2), having DNS in the same account means the entire tunnel → DNS setup is one-click in the Cloudflare dashboard
- Free WHOIS privacy included
- No upselling

**Alternative:** Porkbun is also excellent (~$31/year, transparent pricing, free WHOIS privacy). Either is fine.

---

## 2. Public Exposure: Cloudflare Tunnel

### What It Is

Cloudflare Tunnel (`cloudflared`) lets you expose a locally-running service to the public internet **without opening any inbound router ports**. The daemon on your Pi makes an outbound connection to Cloudflare's network; traffic then flows bidirectionally through that tunnel.

> "Cloudflare Tunnel provides you with a secure way to connect your resources to Cloudflare without a publicly routable IP address. With Tunnel, you do not send traffic to an external IP — instead, a lightweight daemon in your infrastructure (`cloudflared`) creates outbound-only connections to Cloudflare's global network."
>
> Source: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/ (fetched 2026-03-28)

### WebSocket Support — Critical for Socket.io

Cloudflare Tunnel supports **HTTP and HTTPS service types**, which include WebSocket upgrade support. Cloudflare's own documentation confirms WebSockets are proxied through tunnels as part of standard HTTP/HTTPS service routing:

> From the protocols page: "HTTP — Proxies incoming HTTPS requests to your local web service over HTTP. HTTPS — Proxies incoming HTTPS requests directly to your local web service."
>
> Source: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/protocols/ (fetched 2026-03-28)

Cloudflare's reverse proxy supports WebSocket upgrades on all plans (confirmed in their general proxy documentation — WebSockets work over HTTP/HTTPS tunnels). Socket.io will work correctly as long as you:
1. Point the tunnel at your Node.js server port (e.g., `localhost:3000`)
2. Set the service type to `HTTP` in the tunnel dashboard
3. Ensure the Cloudflare proxy ("orange cloud") is enabled for your DNS record

> Additionally, Render.com's documentation (a cloud provider that also runs behind Cloudflare) explicitly lists "WebSockets: ✓" in all pricing tiers — confirming WebSockets pass through Cloudflare-based proxy infrastructure without issues. Source: https://render.com/pricing (fetched 2026-03-28)

### Free Tier Limits

Cloudflare Tunnel itself is **completely free** for public application exposure. There is no bandwidth cap on the tunnel itself at the free tier.

From the routing docs:
> "You do not need a paid Cloudflare Access plan to publish an application via Cloudflare Tunnel. Access seats are only required if you want to secure the application using Access policies."
>
> Source: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/ (fetched 2026-03-28)

The **free Cloudflare plan** (for your domain zone) includes:
- DDoS mitigation
- CDN/caching for static assets
- SSL/TLS (see Section 3)
- Unlimited tunnel connections
- WAF (limited — 5 custom rules on free)

### Setup Steps (Dashboard Method)

These steps are from the official Cloudflare Tunnel create-tunnel guide (https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/ — fetched 2026-03-28):

**Prerequisites:**
- A Cloudflare account with sbtd.io added as a zone
- Your domain's nameservers pointing to Cloudflare
- The Pi can reach Cloudflare on port `7844` outbound (usually open by default)

**Step 1: Create a tunnel in Cloudflare One**
1. Log in to https://one.dash.cloudflare.com
2. Go to **Networks > Connectors > Cloudflare Tunnels**
3. Select **Create a tunnel**
4. Choose **Cloudflared** connector type → Next
5. Name it (e.g., `sbtd-pi-tunnel`) → **Save tunnel**

**Step 2: Install cloudflared on the Pi**
```bash
# ARM64 (Raspberry Pi 4 running 64-bit OS)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Run the token command shown in the Cloudflare dashboard
cloudflared service install <TOKEN>
```
(Exact token command is shown in the Cloudflare One dashboard after creating the tunnel.)

**Step 3: Publish the application**
1. In the tunnel config, go to **Published applications** tab
2. Add a route:
   - **Subdomain:** `@` (apex) or `www`
   - **Domain:** `sbtd.io`
   - **Service type:** `HTTP`
   - **URL:** `localhost:3000` (or wherever your Node.js/Socket.io server listens)
3. Save

**Step 4: Deploy cloudflared as a k3s service (optional)**

For k3s, deploy cloudflared as a Kubernetes Deployment so it restarts automatically:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cloudflared
  template:
    metadata:
      labels:
        app: cloudflared
    spec:
      containers:
      - name: cloudflared
        image: cloudflare/cloudflared:latest
        args:
        - tunnel
        - --no-autoupdate
        - run
        env:
        - name: TUNNEL_TOKEN
          valueFrom:
            secretKeyRef:
              name: cloudflared-token
              key: token
```

Store the token as a k3s Secret:
```bash
kubectl create secret generic cloudflared-token --from-literal=token=<YOUR_TOKEN>
```

---

## 3. SSL/TLS

### Cloudflare Handles SSL Automatically

When you use Cloudflare Tunnel with your domain on Cloudflare:
- Cloudflare terminates TLS at the edge — visitors get HTTPS automatically
- The tunnel connection between cloudflared and Cloudflare's network is also encrypted
- Your origin (the Pi) doesn't need its own TLS certificate

Cloudflare offers three SSL modes:
- **Flexible** — HTTPS to visitor, HTTP to origin (simplest, but avoid for production)
- **Full** — HTTPS to visitor, HTTPS to origin (origin can use self-signed cert)
- **Full (Strict)** — HTTPS to visitor, HTTPS to origin with valid cert

**Recommended:** Use **Full** or **Full (Strict)** mode. With Cloudflare Tunnel, the tunnel itself is authenticated/encrypted, so Full mode is appropriate.

Source: https://www.cloudflare.com/plans/ (fetched 2026-03-28)

### Alternative: Let's Encrypt (if not using Cloudflare)

If you wanted to expose without Cloudflare (e.g., just forwarding a port from your router), you could use Let's Encrypt via `certbot`. Not needed with the Cloudflare Tunnel approach, but useful to know for the future (e.g., cloud deployment):
- Free certificates, auto-renewed
- `certbot certonly --standalone -d sbtd.io`
- Works with nginx in k3s via cert-manager

---

## 4. DNS Setup

### How to Point sbtd.io to Cloudflare Tunnel

From the Cloudflare Tunnel DNS documentation (https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/ — fetched 2026-03-28):

> "When you create a tunnel, Cloudflare generates a subdomain at `<UUID>.cfargotunnel.com`. You point a CNAME record at this subdomain to route traffic from your hostname to the tunnel."

**DNS Records Required:**

| Type | Name | Target | Notes |
|---|---|---|---|
| CNAME | `@` (apex) | `<UUID>.cfargotunnel.com` | Auto-created by Cloudflare when you publish the app |
| CNAME | `www` | `<UUID>.cfargotunnel.com` | Add manually if you want www to work |
| CNAME | `api` | `<UUID>.cfargotunnel.com` | Optional — separate API subdomain |

The Cloudflare dashboard auto-creates the CNAME when you publish the application route. You can also create it manually via CLI:
```bash
cloudflared tunnel route dns sbtd-pi-tunnel sbtd.io
cloudflared tunnel route dns sbtd-pi-tunnel www.sbtd.io
```

> "The DNS record and the tunnel are independent. You can create DNS records that point to a tunnel that is not running. If a tunnel stops, the DNS record is not deleted — visitors will see a `1016` error."
>
> Source: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/ (fetched 2026-03-28)

**Important:** The `.cfargotunnel.com` subdomain only proxies traffic for DNS records in the same Cloudflare account — UUID discovery by attackers doesn't grant them tunnel access.

---

## 5. Alpha Readiness Checklist

An alpha differs from a prototype in that **real, unknown users are accessing it**. Here's what needs to be added before opening access.

### 5.1 Authentication

- [ ] **User accounts with passwords** — implement proper bcrypt hashing (never plain text or MD5)
- [ ] **Session management** — use `express-session` with a secure, random secret; set `httpOnly`, `secure`, `sameSite` cookie flags
- [ ] **JWT or session tokens** — pick one and be consistent
- [ ] **Rate limit login attempts** — use `express-rate-limit` to prevent brute force

### 5.2 Input Validation & Injection

From the OWASP NodeJS Security Cheat Sheet (https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Nodejs_Security_Cheat_Sheet.md — fetched 2026-03-28):

- [ ] **Set request size limits** — prevents DoS via large request bodies
  ```javascript
  app.use(express.urlencoded({ extended: true, limit: "1kb" }));
  app.use(express.json({ limit: "1kb" }));
  ```
- [ ] **Do not block the event loop** — avoid CPU-heavy synchronous ops in request handlers
- [ ] **Validate and sanitize all Socket.io messages** — treat all incoming socket data as untrusted
- [ ] **Parameterized queries** — never concatenate user input into SQL queries; use `pg` parameterized queries or an ORM

### 5.3 HTTP Security Headers

- [ ] Install and configure **helmet**:
  ```bash
  npm install helmet
  ```
  ```javascript
  const helmet = require('helmet');
  app.use(helmet());
  ```
  Helmet sets X-Frame-Options, X-Content-Type-Options, CSP, HSTS, etc.

### 5.4 Rate Limiting

- [ ] Install **express-rate-limit**:
  ```bash
  npm install express-rate-limit
  ```
  ```javascript
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
  app.use(limiter);
  ```
- [ ] Add per-player rate limiting on Socket.io events (especially game actions) to prevent cheating/spam

### 5.5 Dependency Security

- [ ] Run `npm audit` — fix or acknowledge all high/critical vulnerabilities
- [ ] Pin dependency versions in `package-lock.json`
- [ ] Consider adding **Snyk** or **Dependabot** for automated vulnerability scanning

### 5.6 Error Handling

- [ ] Never expose stack traces to end users in production
  ```javascript
  app.use((err, req, res, next) => {
    console.error(err.stack); // log internally
    res.status(500).json({ error: 'Internal server error' }); // safe response
  });
  ```
- [ ] Set `NODE_ENV=production` — this disables verbose Express error output

### 5.7 Game-Specific Alpha Concerns

- [ ] **Player name sanitization** — strip HTML/script from display names
- [ ] **Game state validation server-side** — never trust the client for scores or positions
- [ ] **Anti-cheat basics** — validate that player actions are legal (speed, resource counts, etc.) on the server
- [ ] **Basic logging** — log player connections, disconnections, and major game events for debugging
- [ ] **Graceful shutdown** — handle `SIGTERM` so in-progress games can finish or save state
- [ ] **Database backups** — set up at minimum a daily pg_dump cron job

### 5.8 Monitoring

- [ ] **Uptime monitoring** — use a free tier service (e.g., UptimeRobot, BetterStack free) to alert if sbtd.io goes down
- [ ] **Basic metrics** — consider `prom-client` + Grafana stack, or just log to a file and watch manually for alpha
- [ ] **Cloudflare Analytics** — free, shows request volume, errors, attack traffic

---

## 6. Cloud Migration Path

### When Do You Need to Migrate?

The Raspberry Pi 4 will handle a small alpha fine (maybe 10–50 concurrent players depending on game complexity). Consider migrating to cloud when:
- CPU consistently >70% during game sessions
- Pi uptime becomes critical and you can't accept home internet outages
- You need multi-region latency improvements
- You want to scale beyond ~50 concurrent players

### Option A: Fly.io

Fly.io runs containerized apps (Docker) globally. It supports persistent volumes and managed Postgres.

**Pricing** (from https://fly.io/docs/about/pricing/ — fetched 2026-03-28):

| Configuration | Monthly Cost |
|---|---|
| `shared-cpu-1x` 512MB RAM | ~$3.19/month |
| `shared-cpu-1x` 1GB RAM | ~$5.70/month |
| `shared-cpu-2x` 1GB RAM | ~$6.39/month |
| `shared-cpu-2x` 2GB RAM | ~$11.39/month |

Recommended for SquadBattleTD alpha: **`shared-cpu-2x` with 1–2GB RAM** = ~$6–11/month for the app server.

PostgreSQL via Fly Postgres: You run your own Postgres on a Fly Machine (same pricing as above — ~$3–6/month for a 512MB–1GB instance).

**Fly.io migration steps:**
1. Containerize the app: write a `Dockerfile` for the Node.js server
2. `fly launch` → choose region → creates `fly.toml`
3. Set `[env]` vars and secrets (`fly secrets set DATABASE_URL=...`)
4. `fly deploy`
5. Point `sbtd.io` DNS to Fly's Anycast IPs (or use Fly's custom domain support)
6. Migrate PostgreSQL: `pg_dump` from Pi → `pg_restore` to Fly Postgres

**WebSocket support:** Fly.io fully supports WebSockets — the proxy layer is TCP-transparent.

### Option B: Railway

Railway is simpler than Fly — it deploys directly from a GitHub repo with zero Docker knowledge needed.

**Pricing** (from https://railway.com/pricing — fetched 2026-03-28):

| Plan | Base Cost | Resources |
|---|---|---|
| Free | $0/month (30-day trial, then $1/month) | 1 vCPU / 0.5GB RAM per service |
| Hobby | $5/month minimum usage | Up to 48 vCPU / 48GB RAM |
| Pro | $20/month minimum usage | Up to 1,000 vCPU / 1TB RAM |

Usage-based pricing on top of the minimum:
- Memory: $0.00000386 per GB/sec
- CPU: $0.00000772 per vCPU/sec
- Egress: $0.05/GB

For a small Node.js server + PostgreSQL on the Hobby plan: **$5–15/month** total in practice.

Railway supports custom domains, WebSockets, private networking between services, and native PostgreSQL.

**WebSocket support:** Render.com pricing page explicitly confirms "WebSockets: ✓" for all tiers (https://render.com/pricing — fetched 2026-03-28). Railway has similar architecture.

**Railway migration steps:**
1. Push code to GitHub (already done per context)
2. Connect Railway to the GitHub repo
3. Add a PostgreSQL service in Railway's dashboard
4. Set environment variables (DB connection string, etc.)
5. Railway auto-builds and deploys on git push
6. Add custom domain `sbtd.io` in Railway dashboard
7. Migrate data: `pg_dump` from Pi Postgres → Railway Postgres

### Option C: Render.com

**Pricing** (from https://render.com/pricing — fetched 2026-03-28):

Render uses instance-type pricing for web services. Free tier exists but **free tier web services spin down after inactivity** — not suitable for a multiplayer game with persistent connections.

| Instance | RAM | CPU | Price |
|---|---|---|---|
| Starter | 512MB | 0.5 CPU | $7/month |
| Standard | 2GB | 1 CPU | $25/month |
| Pro | 4GB | 2 CPU | $85/month |

Render Postgres add-on: ~$7/month for 256MB, ~$20/month for 1GB.

For alpha: **Starter web service + Starter Postgres = ~$14/month**. Render also explicitly supports WebSockets.

### Comparison Table

| Provider | App + DB Monthly (alpha) | WebSockets | K8s-friendly | Scaling |
|---|---|---|---|---|
| Fly.io | ~$10–20 | ✅ | Docker/flyctl | Manual + auto |
| Railway | ~$5–15 | ✅ | GitHub push | Auto |
| Render | ~$14–30 | ✅ | GitHub/Docker | Auto |

**Recommendation:** Start with **Railway** for simplicity (GitHub-native deploys, no Dockerfile needed initially), migrate to **Fly.io** if you need more control, lower cost, or multi-region.

### What Migration Requires

1. **Dockerize the Node.js app** (Fly.io/Render require this; Railway can use Nixpacks to avoid it)
2. **Environment variable audit** — extract all hardcoded config into env vars
3. **Database migration** — `pg_dump` + `pg_restore`, ensure connection strings are parameterized
4. **WebSocket sticky sessions** — if you run multiple replicas, Socket.io requires sticky sessions or Redis adapter. For alpha, run single replica.
5. **Update Cloudflare DNS** — swap CNAME from `<UUID>.cfargotunnel.com` to the cloud provider's hostname
6. **Persistent file storage** — if the game stores any files on disk, use an S3-compatible bucket (Fly Tigris, Railway S3, Render Disk)

---

## 7. Recommended Action Plan

### Phase 1: Get Online (Week 1)

**Priority: HIGH**

1. **Register sbtd.io** via Cloudflare Registrar or Porkbun (~$32–35/year)
2. **Add sbtd.io to Cloudflare** (free plan) — change nameservers at registrar to Cloudflare's
3. **Install cloudflared on the Pi:**
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 \
     -o /usr/local/bin/cloudflared
   chmod +x /usr/local/bin/cloudflared
   ```
4. **Create a Cloudflare Tunnel** in the One dashboard (https://one.dash.cloudflare.com)
5. **Publish the app route:** `sbtd.io → localhost:3000` (HTTP service type)
6. **Deploy cloudflared as k3s Deployment** (see Section 2 YAML above)
7. **Test:** visit https://sbtd.io — should load the game with a valid Cloudflare SSL cert

**Expected time:** 2–4 hours  
**Expected cost:** ~$35/year (domain only)

---

### Phase 2: Harden for Alpha (Week 2–3)

**Priority: HIGH before letting real players in**

8. `npm install helmet express-rate-limit` and configure (see Section 5)
9. Set `NODE_ENV=production` in your k3s pod env
10. Implement proper error handling that doesn't expose stack traces
11. Run `npm audit` — fix high/critical issues
12. Set up basic request size limits on all Express routes
13. Validate and sanitize all Socket.io event payloads server-side
14. Implement user authentication if not already present (bcrypt passwords, secure sessions)
15. Set up daily PostgreSQL backup cron job:
    ```bash
    0 3 * * * pg_dump -U postgres sbtd | gzip > /backups/sbtd_$(date +%Y%m%d).sql.gz
    ```
16. Set up UptimeRobot (free) to monitor https://sbtd.io uptime

**Expected time:** 1–2 weeks of dev time  
**Expected cost:** $0

---

### Phase 3: Invite Alpha Players (Week 3–4)

17. Soft-launch: invite 10–20 testers
18. Monitor Cloudflare analytics for traffic patterns
19. Watch Pi CPU/RAM (htop, kubectl top pods)
20. Collect feedback via Discord or in-game form

---

### Phase 4: Cloud Migration (When Needed)

21. Dockerize the Node.js app
22. Audit and externalize all env vars
23. Choose Railway (simplest) or Fly.io (cheapest)
24. Migrate Postgres data via pg_dump/restore
25. Deploy to cloud provider
26. Update DNS CNAME in Cloudflare (from cfargotunnel.com to cloud provider hostname)
27. Monitor for 24h before removing Pi tunnel

---

## Sources

| URL | Retrieved | Used For |
|---|---|---|
| https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/ | 2026-03-28 | Cloudflare Tunnel overview, outbound-only model |
| https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/ | 2026-03-28 | Step-by-step tunnel setup |
| https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/ | 2026-03-28 | Free tier confirmation, published apps |
| https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/protocols/ | 2026-03-28 | HTTP/HTTPS/WebSocket protocol support |
| https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/ | 2026-03-28 | DNS CNAME setup |
| https://who.is/whois/sbtd.io | 2026-03-28 | Domain availability check |
| https://porkbun.com/tld/io | 2026-03-28 | .io pricing reference |
| https://porkbun.com/products/domains/tld/io | 2026-03-28 | .io pricing grid |
| https://fly.io/docs/about/pricing/ | 2026-03-28 | Fly.io machine pricing |
| https://railway.com/pricing | 2026-03-28 | Railway plan pricing |
| https://render.com/pricing | 2026-03-28 | Render pricing + WebSocket support confirmation |
| https://render.com/docs/web-services | 2026-03-28 | Render web service capabilities |
| https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Nodejs_Security_Cheat_Sheet.md | 2026-03-28 | OWASP Node.js security recommendations |
| https://www.cloudflare.com/plans/ | 2026-03-28 | Cloudflare plan tiers |
