# Making the Voting System Publicly Reachable

Goal: members vote from anywhere via a real URL like
`https://vote.yourdomain.org`, served from the NAS.

Everything below is done in the **QNAP web interface** (Control Panel) plus your
**router**. No code changes are needed — the containers already run and listen
on the NAS.

---

## What you need

| # | Thing | Notes |
|---|---|---|
| 1 | A **public IP** that is not CGNAT | ✅ **Already confirmed:** `65.95.109.9` is a public IPv4 address |
| 2 | A way to reach the **router** that owns that public IP | You need its admin password |
| 3 | A **domain name** | ~US$10–15/year, or use QNAP's free `xxxx.myqnapcloud.com` |
| 4 | **Ports 80 and 443** forwarded to the NAS | 80 is needed only for the certificate |
| 5 | The QNAP **admin** account | Reverse proxy and certificates are admin-only |

---

## Step 0 — Confirm the NAS is on the network that owns the public IP

⚠️ **Do this first.** Your Ubuntu computer is on `192.168.2.x` and the NAS is on
`192.168.1.x` — two different networks. We must know which one the public IP
`65.95.109.9` belongs to. If the NAS sits behind a *different* internet
connection, forwarding ports on the wrong router will never work.

On the NAS: **Control Panel → Network & Virtual Switch → Overview**

Write down:

- the NAS's **IP address** on each interface
- the **gateway** for that interface (for `192.168.1.245` it is probably `192.168.1.1`)
- the **WAN / public IP** if the page shows one

Then log into the router at that gateway address. Its status page shows a
**WAN IP** or **Internet IP**. That value must be **`65.95.109.9`**.

| Result | Meaning |
|---|---|
| WAN IP = `65.95.109.9` | ✅ Same connection. Continue. |
| WAN IP is different | ⚠️ The NAS has its own internet line. Every step below must be done on **that** router instead, and you need **that** public IP. Tell me and I will adjust. |
| No router admin access | You cannot port-forward. Jump to **Alternative: Cloudflare Tunnel**. |

---

## Step 1 — Get a domain and point it at your public IP

### Option A — Buy your own domain (recommended)

Buy from any registrar (Cloudflare Registrar, Namecheap, Porkbun…). Then add a
DNS record:

| Type | Name | Value | TTL |
|---|---|---|---|
| `A` | `vote` | `65.95.109.9` | Auto / 300 |

That gives `vote.yourdomain.org`.

> **Home connections usually have a dynamic IP.** Your public IP *will* change
> eventually (a router reboot can do it). When it does, the domain silently
> stops working. Two ways to handle this:
>
> - Most registrars/DNS providers offer **DDNS** — a small updater keeps the A
>   record current. QNAP has DDNS built in (Step 2b).
> - Or set a long TTL and check the IP before election day.

### Option B — Use QNAP's free subdomain (no purchase)

**Control Panel → myQNAPcloud → My DDNS** → enable it. You get
`xxxxx.myqnapcloud.com`, kept up to date automatically, and QNAP issues a
matching certificate for free.

The URL is QNAP-branded, but it is free, needs no DNS work, and never breaks
from an IP change. Good enough to launch with; you can add your own domain
later.

---

## Step 2 — Get a certificate on the NAS

### 2a. Request a Let's Encrypt certificate

**Control Panel → System → Security → Certificate & Private Key**

1. Click **Add** / **Create**
2. Choose **Let's Encrypt**
3. Domain name: `vote.yourdomain.org`
4. Email: your address (for expiry warnings)
5. Apply

> Let's Encrypt validates by fetching `http://vote.yourdomain.org/.well-known/…`
> so **port 80 must already be forwarded** (do Step 4 first if this fails), and
> DNS must already resolve.
>
> Certificates expire every 90 days. QNAP renews automatically, but **test it a
> month before the election** — do not discover a renewal failure on voting day.

### 2b. Only if you used Option B

Use **myQNAPcloud → SSL Certificate** instead; QNAP issues and renews it for
`xxxxx.myqnapcloud.com` with no port-80 requirement.

---

## Step 3 — Create the reverse proxy rule on the NAS

This is what makes `https://vote.yourdomain.org` reach the container on port
8080. We use QNAP's own reverse proxy rather than running Caddy, because QNAP
already owns port 443 for its web interface — two things cannot share it.

**Control Panel → Network & File Services → Application → Reverse Proxy**

Click **Add** and fill in:

| Field | Value |
|---|---|
| Name | `fgs-vote` |
| Protocol (source) | **HTTPS** |
| Port (source) | **443** |
| Hostname (source) | `vote.yourdomain.org` |
| Destination protocol | **HTTP** |
| Destination hostname | `localhost` |
| Destination port | **8080** |
| Certificate | the one from Step 2 |

Apply.

Then add a **second rule** for the admin console:

| Field | Value |
|---|---|
| Name | `fgs-admin` |
| Protocol (source) | **HTTPS** |
| Port (source) | **443** |
| Hostname (source) | `admin.yourdomain.org` |
| Destination protocol | **HTTP** |
| Destination hostname | `localhost` |
| Destination port | **8081** |

⚠️ **Read Step 6 before exposing the admin console.** It gives you the whole
member database. Consider not publishing it at all — you can administer from
inside the network instead.

---

## Step 4 — Forward the ports on the router

Log into the router (the gateway from Step 0) and find **Port Forwarding** /
**Virtual Server** / **NAT**.

| Service | External port | Internal IP | Internal port | Protocol |
|---|---|---|---|---|
| HTTP (certificate) | **80** | `192.168.1.245` | **80** | TCP |
| HTTPS (voting) | **443** | `192.168.1.245` | **443** | TCP |

> Port 80 is only needed for certificate issuance and renewal. You can close it
> the rest of the time — but you must reopen it every ~60 days for auto-renewal,
> which is easy to forget. Leaving it open is acceptable for this use.
>
> If the QNAP's own web interface already occupies 80/443 on the router, that is
> fine — the reverse proxy shares 443 by hostname.

---

## Step 5 — Test from outside

**Do not test from inside your own network** — that can succeed or fail for
unrelated reasons and tells you nothing.

1. Turn **Wi-Fi off** on your phone (use mobile data)
2. Open `https://vote.yourdomain.org`
3. It must load, with a **valid padlock** (no certificate warning)
4. Open `https://vote.yourdomain.org/api/health` →
   `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}`

Then set the URL inside the voting system: admin console → **Settings** → set
the **voting entry URL** to `https://vote.yourdomain.org`. The QR code uses this
value, so members scanning it land on the right place.

---

## Step 6 — Lock down the admin console

Once the system is on the public internet, the admin console on `8081` is the
single most valuable target: it lists every member's name, card number, phone,
email and address, and can export everything.

Do at least these:

1. **Change the default password.** `admin` / `admin123` must not survive
   contact with the internet. Do it before Step 5 if possible.
2. **Do not create the `admin.yourdomain.org` reverse proxy rule at all** unless
   you need it. Administer the election from a computer inside the network via
   `http://192.168.1.245:8081`. This is the safest option and costs you nothing.
3. If you do publish it, restrict the **source IP** in the reverse proxy rule
   (QNAP lets you allow specific networks), or add a second password layer using
   the Caddy `basic_auth` block from `deploy/Caddyfile`.
4. **Do not publish port 8081 on the router** — only 80 and 443.

---

## Alternative: Cloudflare Tunnel (no port forwarding)

Use this if you cannot get router admin access, if the ISP blocks inbound 80/443,
or if Step 0 shows a different public IP that you cannot forward.

A `cloudflared` container makes an **outbound** connection to Cloudflare, so
nothing needs to be exposed on the router and a changing IP does not matter.

**Requirements:** a domain whose DNS is managed by Cloudflare (free plan is
fine). The domain must be on Cloudflare before this works.

Rough shape:

1. In Cloudflare: create a tunnel, get the token
2. Add a service to the tunnel: `vote.yourdomain.org` → `http://web:80`
   (or `http://192.168.1.245:8080`)
3. Add a `cloudflared` service to the Application YAML:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: fgs-tunnel
    restart: unless-stopped
    command: ["tunnel", "--no-autoupdate", "run", "--token", "PASTE_TOKEN_HERE"]
    networks: [fgs]
```

4. Cloudflare terminates HTTPS with its own certificate — no Let's Encrypt
   needed, and port 443 on your router stays closed

Trade-off: traffic passes through Cloudflare (a third party) in plaintext at
their edge. For member personal data that is a real consideration.

---

## Security checklist before the election

- [ ] `admin123` changed to a strong password
- [ ] Certificate valid and **auto-renewal verified** (check 30 days out)
- [ ] Admin console **not** published to the internet (or IP-restricted)
- [ ] Port 8081 **not** forwarded on the router
- [ ] Voting entry URL set in Settings so the QR code is correct
- [ ] Backups running — confirm fresh `.sql.gz` files in
      `/share/Container/fgs-ottawa-vote/backups/`
- [ ] A **test vote from mobile data** (not Wi-Fi) succeeds and a repeat vote is
      refused
- [ ] Round reset to draft, test votes cleared
- [ ] Public IP is stable, or DDNS is keeping the record current
- [ ] You know what to do if the NAS reboots: nothing — containers restart
      automatically
