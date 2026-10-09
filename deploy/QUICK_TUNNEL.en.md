# Cloudflare Quick Tunnel — temporary public URL

**Free. No domain. No Cloudflare account. No router changes.**

Best use: **testing the system from a real external network right now**, while
the port-forwarding fix (`FIX_PORT_FORWARDING.en.md`) is sorted out.

---

## ⚠️ Read this before using it for the election

| | |
|---|---|
| **The URL changes on every restart** | Including a NAS reboot or a power cut. Any QR code you have printed or shared becomes **dead**. |
| **No uptime guarantee** | Cloudflare's own log output says: *"these account-less Tunnels have no uptime guarantee… If you intend to use Tunnels in production you should use a pre-created named tunnel."* |
| **Subject to rate limits** | Not documented as suitable for hundreds of concurrent voters. |
| **Cloudflare sees the traffic** | TLS terminates at Cloudflare's edge. Member names, card numbers and votes pass through a third party in plaintext at that point. |

**Verdict:** perfect for a test today. **Do not run the real election on it.**
For the real vote, finish `FIX_PORT_FORWARDING.en.md` — same QNAP, free
certificate, and a URL that does not move.

---

## How it works

```
voter  ->  https://<random>.trycloudflare.com   (Cloudflare's certificate)
                        |
                   cloudflared container on the NAS
                        |  outbound only, no inbound port
                        v
                   web container (nginx)  ->  api  ->  postgres / redis
```

Nothing is opened on the routers. It works behind the temple's two layers of NAT.

## Setup

### 1. Use the quick-tunnel compose file

Use **`deploy/qnap-application-quicktunnel.yml`** instead of
`qnap-application.yml`. The only addition:

```yaml
  quicktunnel:
    image: cloudflare/cloudflared:latest
    container_name: fgs-quicktunnel
    restart: unless-stopped
    command: ["tunnel", "--no-autoupdate", "--url", "http://web:80"]
    depends_on: [web]
    networks: [fgs]
```

`http://web:80` is the nginx container on the Application's private network — no
IP address, no published port. The API is proxied by that same nginx, so
`/api/...` works from the tunnel automatically.

### 2. Deploy

Container Station → **Applications → fgs → Edit arrow → Recreate Application**
→ paste the YAML → **Update**.

### 3. Find your URL

Container Station → **Containers → `fgs-quicktunnel` → Logs**

Search the log for `trycloudflare.com`. You will see a line like:

```
INF |  Your quick Tunnel has been created! Visit it at:
INF |  https://vegas-relying-circuits-latex.trycloudflare.com
```

That URL is your public entry point.

### 4. Verify from outside

On a phone with **Wi-Fi off** (mobile data):

| Check | Expected |
|---|---|
| `https://<random>.trycloudflare.com` | voting entry page, valid padlock |
| `https://<random>.trycloudflare.com/api/health` | `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}` |

Then set the voting entry URL in the admin console → **Settings** to the tunnel
URL — but remember it will need changing after any restart.

---

## The admin console

The compose file starts **two** tunnels:

| Container | Exposes | For |
|---|---|---|
| `fgs-quicktunnel` | `http://web:80` | the voter site (members) |
| `fgs-quicktunnel-admin` | `http://web:81` | the admin console (you) |

Each gets its **own random URL**, so read both logs.

### Why `:9081` does not work

The published host ports (`9080`, `9081`) are for the **LAN only**. A tunnel
points at a single internal port, and Cloudflare's relay listens on **443 only**
— it does not forward extra port numbers. So:

```
https://<random>.trycloudflare.com:9081     <- never works
https://<other-random>.trycloudflare.com    <- the admin console
```

### ⚠️ Before using the admin tunnel

That console can list every member's name, card number, phone, email and address,
and export the lot.

1. **Change `admin123` the first time you log in.** The URL is random and
   unguessable, so the window is small — but do not leave the default password
   on a public URL.
2. **Delete the `quicktunnel-admin` service once testing is done.** For the real
   election, administer from the temple network at
   `http://192.168.1.245:9081`, reached over the port-forwarding setup in
   `FIX_PORT_FORWARDING.en.md`.

If you would rather not expose it at all right now, delete the
`quicktunnel-admin` block from the YAML and recreate the Application.

---

## Removing it

Delete the `quicktunnel` service from the YAML and recreate the Application.
The URL stops working immediately; nothing else is affected.

---

## What to do when you are done testing

Go back to `FIX_PORT_FORWARDING.en.md`. The end state there is:

```
https://fgsottawa.myqnapcloud.com:9005
```

— a fixed URL, a free Let's Encrypt certificate on your own NAS, QTS desktop
untouched on 443, and no third party in the path.
