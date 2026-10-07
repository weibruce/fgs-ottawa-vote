# Making the Voting System Publicly Reachable

Goal: members vote from anywhere via a real URL like
`https://vote.yourdomain.org`, served from the NAS.

Two routes are described below. **Read the first one** — it needs no router
access and can be done entirely from home.

---

## FGS Ottawa — actual network (measured)

```
Internet
  Bell modem/router            192.168.0.1    static public IP 142.112.62.31
    |
    +-- Asus RT-AC3500         WAN 192.168.0.250  ->  LAN 192.168.2.1
    |
    +-- TP-Link (Office)       WAN 192.168.0.163  ->  LAN 192.168.1.1
          |
          +-- QNAP NAS         192.168.1.245   <- the voting system
```

**Two layers of NAT.** Any port must be forwarded **twice** — once on the Bell
modem, once on the TP-Link. The Asus and TP-Link networks are siblings: a
computer on `192.168.2.x` **cannot** reach `192.168.1.245`.

### What already exists

| Thing | Status |
|---|---|
| myQNAPcloud DDNS | ✅ configured — `fgsottawa.myqnapcloud.com` → `142.112.62.31`, **Synced** |
| Public IP | ✅ **static** (`ipagstaticip-…` in the Bell reverse DNS, so it will not drift) |
| Port forward, Bell | external `9003` → TP-Link `443` |
| Port forward, TP-Link | external `443` → NAS `443` |
| OpenVPN | external `9000` → TP-Link `1194` → NAS `1194` |
| SSL certificate | ❌ **Inactive** |
| External reachability | ❌ **broken** — see below |

### What that means

QNAP's own *Test whether your NAS can be accessed from the Internet* reports:

```
all IPv4 Status and IPv6 Status response failed
```

and an independent check from three overseas nodes to `142.112.62.31:9003` also
times out. The port-forward chain is configured but **not passing traffic** —
and the routers are at the temple while you are at home.

That is why the recommended route below avoids routers entirely.

---

## Which route? (cost vs. effort)

| Route | Cost | HTTPS | Router access needed | Reliability |
|---|---|---|---|---|
| **A. Tailscale Funnel** | **$0** | ✅ free, valid cert | ❌ none | ⚠️ beta; Container Station support for `cap_add`/`devices` unverified |
| **B. Cloudflare Tunnel** | domain ~US$10/yr | ✅ free, valid cert | ❌ none | ✅ mature, well-trodden |
| C. Cloudflare Quick Tunnel | $0 | ✅ | ❌ none | ❌ URL changes on every restart — unusable for an election |
| D. Fix port forwarding + Let's Encrypt | $0 | ✅ | ✅ **two routers, on site** | ⚠️ currently broken; needs a trip to the temple |

**QNAP's own myQNAPcloud SSL is a paid add-on** (~US$10–15/yr), so it is not a
free option — that is why it shows as *Inactive* and cannot simply be switched on.

**Recommendation:** try **A** first since it costs nothing. If the container
refuses to start (see the warning below), fall back to **B** — a domain at
~US$10/year is the reliable path and is a one-off cost for a professional URL.

---

## ROUTE A — Tailscale Funnel (free, no domain, no router)

Tailscale Funnel gives the NAS a public URL:

```
https://fgs-vote.<your-tailnet>.ts.net
```

with a **valid certificate issued automatically**, and relay servers that
**cannot decrypt** your traffic. It is available on **all plans including
free**, and needs no port forwarding — the NAS connects outward.

### Step A1 — Enable Funnel for your tailnet

Tailscale admin console → **Access Controls** → add:

```json
"nodeAttrs": [
  { "target": ["*"], "attr": ["funnel"] }
]
```

Save. (Funnel is refused without this attribute.)

### Step A2 — Create an auth key

Admin console → **Settings → Keys → Generate auth key** → copy it.
Reusable + pre-approved is fine for this.

### Step A3 — Prepare the serve config

`deploy/tailscale-serve.json` already exists in the project and proxies `/` to
`http://web:80`, with `AllowFunnel: true`. Upload it to the NAS at:

```
/share/Container/fgs-ottawa-vote/deploy/tailscale-serve.json
```

(It is inside `fgs-upload.zip`, so extracting the zip puts it there.)

### Step A4 — Use the Funnel compose file

Use **`deploy/qnap-application-tailscale.yml`** instead of
`qnap-application.yml`. The extra service is:

```yaml
  tailscale:
    image: tailscale/tailscale:latest
    container_name: fgs-tailscale
    hostname: fgs-vote
    restart: unless-stopped
    environment:
      TS_AUTHKEY: PASTE_YOUR_TAILSCALE_AUTH_KEY
      TS_STATE_DIR: /var/lib/tailscale
      TS_SERVE_CONFIG: /config/serve.json
      TS_USERSPACE: "false"
      TS_AUTH_ONCE: "true"
    volumes:
      - fgs_tsstate:/var/lib/tailscale
      - /share/Container/fgs-ottawa-vote/deploy/tailscale-serve.json:/config/serve.json:ro
    devices:
      - /dev/net/tun:/dev/net/tun
    cap_add:
      - net_admin
    depends_on: [web]
    networks: [fgs]
```

Replace `PASTE_YOUR_TAILSCALE_AUTH_KEY` **inside Container Station's editor**,
not in the project file.

### Step A5 — Deploy and find your URL

Applications → `fgs` → **Edit arrow → Recreate Application** → paste → **Update**.

Then look at the tailnet's machine list: the device `fgs-vote` will show its
Funnel URL. Check the `fgs-tailscale` container log for errors.

### ⚠️ Known risk with Route A

Container Station must honour `cap_add: net_admin` and
`devices: /dev/net/tun`. This has **not been tested** — QNAP's UI is built
mainly around privileged mode. If `fgs-tailscale` fails to start or its log
shows permission errors, Route A is not viable on this NAS; use Route B.

---

## ROUTE B — Cloudflare Tunnel (needs a domain)

```
cloudflared container on the NAS
      |  connects OUT to Cloudflare (no inbound port needed)
      v
Cloudflare edge  -->  members reach https://vote.yourdomain.org
```

| | Port forwarding | Cloudflare Tunnel |
|---|---|---|
| Router changes | two routers | **none** |
| Two layers of NAT | must handle | **irrelevant** |
| Someone must be on site | yes | **no — all remote** |
| HTTPS certificate | separate work | **automatic** |
| Public IP changes | needs DDNS | **irrelevant** |
| Cost | 0 | 0 (a domain is ~US$10/year) |

### What you need

- A **domain** managed by Cloudflare (free plan is enough). Buy one through
  Cloudflare, or buy elsewhere and change its nameservers to the two Cloudflare
  gives you.
- QNAP admin access to reach Container Station — you already have this remotely
  through myQNAPcloud.

### Step B1 — Create the tunnel in Cloudflare

1. Log in at <https://one.dash.cloudflare.com>
2. **Networks → Tunnels → Create a tunnel**
3. Connector type: **Cloudflared**
4. Name it `fgs-vote`
5. Cloudflare shows an install command containing a long token. **Copy the
   token** — it is the string after `--token`.
6. Add a **Public Hostname**:

   | Field | Value |
   |---|---|
   | Subdomain | `vote` |
   | Domain | your domain |
   | Service type | **HTTP** |
   | URL | **`web:80`** |

   `web` is the container name inside the Application's private network, so no
   IP address and no published port is involved. Cloudflare terminates HTTPS for
   `https://vote.yourdomain.org` with its own certificate.

### Step B2 — Add the tunnel container to the Application

Use **`deploy/qnap-application-tunnel.yml`** instead of
`deploy/qnap-application.yml`. It is identical apart from one extra service:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: fgs-tunnel
    restart: unless-stopped
    command: ["tunnel", "--no-autoupdate", "run", "--token", "PASTE_YOUR_TUNNEL_TOKEN_HERE"]
    depends_on:
      - web
    networks: [fgs]
```

Replace `PASTE_YOUR_TUNNEL_TOKEN_HERE` with the token from Step 1.

⚠️ **Do not save the token into the `.yml` file in the project** — that file is
tracked by git. Replace it inside Container Station's editor, exactly like the
passwords.

### Step B3 — Deploy

In Container Station: **Applications → fgs → Edit arrow → Recreate
Application** → paste the updated YAML with your token → **Update**.

A new container `fgs-tunnel` starts. Check its log — a healthy tunnel prints
lines mentioning `Registered tunnel connection`.

### Step B4 — Test from outside

On your phone with **Wi-Fi turned off** (mobile data):

1. Open `https://vote.yourdomain.org`
2. It must load with a **valid padlock** (Cloudflare's certificate)
3. `https://vote.yourdomain.org/api/health` must return
   `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}`

Then set that URL inside the voting system: admin console → **Settings** →
voting entry URL. The QR code uses this value.

### Step B5 — Keep the admin console off the internet

Do **not** create a public hostname for port 8081. It exposes every member's
name, card number, phone, email and address, plus bulk export.

Administer from inside the temple network instead:
`http://192.168.1.245:8081`. The LAN ports stay published by the compose file,
so on-site access is unaffected by the tunnel.

If you truly need remote admin, put a Cloudflare **Access** policy in front of
that hostname (email one-time PIN) rather than leaving it open.

### Notes

- On-site members on the temple Wi-Fi can keep using
  `http://192.168.1.245:8080`; the tunnel and LAN access coexist.
- Traffic passes through Cloudflare, which terminates TLS at its edge. That is
  a third party in the path — acceptable for most organisations, but a
  deliberate choice you should be aware of.
- The free plan has no uptime SLA. For a one-off election that is normally fine.
- **Rollback:** delete the `cloudflared` service from the YAML and recreate the
  Application. The voting system itself is untouched.

---

## ALTERNATIVE (needs a site visit): fix the port forwarding

Only attempt this if someone can physically reach the temple routers, or if you
later confirm the forward chain works. Use QNAP's **Test** button (myQNAPcloud →
DDNS → *Port Forwarding: Test*) as the gate: **do not build anything on top
until that test passes.**

### What that route needs

| # | Thing | Notes |
|---|---|---|
| 1 | A public IP that is not CGNAT | ✅ confirmed — `142.112.62.31` is static and public |
| 2 | Access to the **Bell modem** and the **TP-Link** | both must be changed |
| 3 | A **domain**, or QNAP's free `xxxx.myqnapcloud.com` | |
| 4 | Ports **80 and 443** forwarded through both routers | 80 only for the certificate |
| 5 | The QNAP **admin** account | reverse proxy and certificates are admin-only |

### Step 0 — Confirm the chain

Log into the Bell modem (`192.168.0.1`) and check that its WAN/Internet IP is
`142.112.62.31`. Then verify on **both** routers that the forward rules still
exist — a modem reset silently drops them.

### Step 1 — Get a domain and point it at the public IP

**Option A — buy your own domain.** Add a DNS record:

| Type | Name | Value |
|---|---|---|
| `A` | `vote` | `142.112.62.31` |

Because the IP is static, no DDNS updater is needed.

**Option B — use QNAP's free subdomain.** **Control Panel → myQNAPcloud → My
DDNS** gives `xxxxx.myqnapcloud.com`, kept current automatically, with a
QNAP-issued certificate. Branded, but free and needs no DNS work.

### Step 2 — Get a certificate on the NAS

**Control Panel → System → Security → Certificate & Private Key → Add →
Let's Encrypt**, domain `vote.yourdomain.org`. Port 80 must already be
forwarded, and DNS must already resolve.

Certificates expire every 90 days. QNAP renews automatically — **verify the
renewal a month before the election**, not on voting day.

### Step 3 — Reverse proxy rule on the NAS

Use QNAP's own reverse proxy, not Caddy: QNAP already owns port 443 for its web
interface, and two things cannot share it.

**Control Panel → Network & File Services → Application → Reverse Proxy → Add**

| Field | Value |
|---|---|
| Name | `fgs-vote` |
| Source protocol / port | **HTTPS** / **443** |
| Source hostname | `vote.yourdomain.org` |
| Destination protocol | **HTTP** |
| Destination hostname | `localhost` |
| Destination port | **8080** |
| Certificate | the one from Step 2 |

Do **not** add a second rule for port 8081 — see Step B5 for why.

### Step 4 — Forward the ports

On **both** the Bell modem and the TP-Link:

| Service | External port | Internal IP | Internal port |
|---|---|---|---|
| HTTP (certificate) | **80** | next hop | **80** |
| HTTPS (voting) | **443** | next hop | **443** |

Bell forwards to `192.168.0.163` (the TP-Link); the TP-Link forwards to
`192.168.1.245` (the NAS).

> ⚠️ Port 443 on the Bell side is not currently forwarded — only `9003` is. You
> must either add `443`, or reuse the existing `9003` and make the reverse proxy
> listen on 9003 instead.

### Step 5 — Test from outside

Turn **Wi-Fi off** on your phone and open
`https://vote.yourdomain.org`. It must load with a valid padlock.

### Step 6 — Lock down the admin console

Change the default `admin123` password **before** exposing anything, and
administer from inside the network rather than publishing port 8081.

---

## Security checklist before the election

- [ ] `admin123` changed to a strong password
- [ ] Admin console **not** published to the internet (or behind Cloudflare
      Access / IP restriction)
- [ ] Certificate valid — padlock with no warning
- [ ] Voting entry URL set in Settings so the QR code is correct
- [ ] Backups running — fresh `.sql.gz` files in
      `/share/Container/fgs-ottawa-vote/backups/`
- [ ] A **test vote from mobile data** (not Wi-Fi) succeeds, and a repeat vote
      from the same member is refused
- [ ] Round reset to draft and test votes cleared
- [ ] You know what happens if the NAS reboots: nothing — containers restart
      automatically
