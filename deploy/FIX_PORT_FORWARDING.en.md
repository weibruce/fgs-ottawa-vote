# Port Forwarding Runbook — FGS Ottawa

**Audience:** the person with access to the Bell modem and the TP-Link.
**Goal:** members reach the voting system from the internet, QTS desktop stays
reachable, and the certificate is free and valid.

---

## Target architecture

```
Internet
  |
Bell modem/router  192.168.0.1   WAN 142.112.62.31 (static)
  |--- :80    -> TP-Link :80
  |--- :443   -> TP-Link :443        (QTS desktop)
  |--- :9005  -> TP-Link :9005       (voting system)
  |
TP-Link (Office)   WAN 192.168.0.163   LAN 192.168.1.1
  |--- :80    -> 192.168.1.245:80
  |--- :443   -> 192.168.1.245:443
  |--- :9005  -> 192.168.1.245:9005
  |
QNAP NAS  192.168.1.245
  |--- QTS desktop        :443
  |--- QNAP reverse proxy :9005  ->  localhost:9080
  |--- voting container   :9080
```

Resulting URLs:

| What | URL |
|---|---|
| QTS desktop | `https://fgsottawa.myqnapcloud.com` |
| Voting system | `https://fgsottawa.myqnapcloud.com:9005` |

Both use **one certificate** for `fgsottawa.myqnapcloud.com`, so a single free
Let's Encrypt certificate covers both.

**Why a separate port (9005) instead of putting the voting site on 443?**
QNAP's reverse proxy routes by *hostname*, and you only have one hostname. A
separate port keeps the QTS desktop on 443 untouched.

---

## Step 0 — Verify the current state FIRST

Do not change anything until these four are known.

### 0.1 The Bell modem's actual WAN IP

Log into `192.168.0.1`, find the WAN/Internet IP. It must be **142.112.62.31**.

If it is something else, every forward below must be redone against the real IP,
and the DDNS record needs to catch up.

### 0.2 Which ports QTS itself uses  ⚠️ already resolved

**Control Panel → General Settings → System Administration → System Port**

QTS defaults are HTTP `8080`, HTTPS `443`, Web Server `80`, Secure Web Server
`8081`. On this NAS that is confirmed in practice: the voting container was
published on 8080/8081 and **never started** — it stayed in `Created`.

**This has been fixed.** The compose files now publish the voter site on
**9080** and the admin console on **9081**, which do not collide with QTS.
No action is needed here; just confirm `fgs-web` is `Running` after deploying.

### 0.3 Which ports the containers actually publish

Container Station → Containers. `fgs-web` must be **Running** and show
`9080->80` and `9081->81`.

**If it says `Created`, it has never started** — that is the exact symptom of a
port collision with QTS. Using the ports above is the fix; anything that depends
on `web` (for example `fgs-quicktunnel`) will also sit in `Created` until it runs.

### 0.4 Whether the existing forwards work at all

In QNAP: **myQNAPcloud → DDNS → Port Forwarding → Test**.

This currently reports **every service as failed**, and an external check of
`142.112.62.31:443`, `:80` and `:9003` from three continents times out. So the
existing rules on the Bell modem are either missing or not effective. Expect to
re-enter them.

---

## Step 1 — Bell modem: port forwarding rules

Log into **192.168.0.1** → Port Forwarding / Virtual Server / NAT.

Add (or fix) these rules. **All target the TP-Link's WAN address
`192.168.0.163`.**

| Service name | External port | Internal IP | Internal port | Protocol |
|---|---|---|---|---|
| QTS desktop HTTP | 80 | 192.168.0.163 | 80 | TCP |
| QTS desktop HTTPS | 443 | 192.168.0.163 | 443 | TCP |
| Voting system | 9005 | 192.168.0.163 | 9005 | TCP |

Notes:

- The existing rule `9003 -> 443` may be left alone if it works; otherwise remove
  it to avoid confusion.
- **Port 80 is required** for the free Let's Encrypt certificate. It can be
  closed again afterwards, but must be reopened for each renewal (~60 days),
  which is easy to forget — leaving it open is acceptable here.
- Do not forward 9080/9081. The voting system is reached through 9005.

## Step 2 — TP-Link: port forwarding rules

Log into **192.168.1.1** → Forwarding / Virtual Servers.

| Service name | External port | Internal IP | Internal port | Protocol |
|---|---|---|---|---|
| QTS desktop HTTP | 80 | 192.168.1.245 | 80 | TCP |
| QTS desktop HTTPS | 443 | 192.168.1.245 | 443 | TCP |
| Voting system | 9005 | 192.168.1.245 | 9005 | TCP |

> **Two hops are required.** The Bell modem cannot see `192.168.1.245` — it only
> knows the TP-Link at `192.168.0.163`. Both routers must carry every rule.

## Step 3 — Verify the forwards before touching the NAS

**QNAP → myQNAPcloud → DDNS → Port Forwarding → Test.** It must pass now.

Then from a phone with **Wi-Fi off** (mobile data):

```
https://fgsottawa.myqnapcloud.com        -> QTS login page
```

Do not continue until this works. Everything after this depends on it.

## Step 4 — Free Let's Encrypt certificate

**Control Panel → System → Security → Certificate & Private Key → Add →
Get from Let's Encrypt**

| Field | Value |
|---|---|
| Domain name | `fgsottawa.myqnapcloud.com` |
| Email | a monitored address |

QNAP recommends port **80 or 443** for validation — both are now forwarded.

When it succeeds, set this certificate as the **default** so QTS uses it too.

> Certificates expire every 90 days and QNAP renews automatically. **Verify the
> renewal a month before the election**, not on voting day. If renewal fails the
> site shows a full-page browser warning to every voter.

## Step 5 — QNAP reverse proxy rule

**Control Panel → Network & File Services → Network Access → Reverse Proxy →
Add**

| Field | Value |
|---|---|
| Rule name | `fgs-vote` |
| Protocol | **HTTPS** |
| Domain name | `fgsottawa.myqnapcloud.com` |
| Port number | **9005** |
| Destination protocol | **HTTP** |
| Destination hostname | `localhost` |
| Destination port | **9080** |

Do **not** add a rule for the admin console port (9081). It exposes every
member's name, card number, phone, email and address. Administer from inside the
temple network at `http://192.168.1.245:9081`.

### Step 5b — Port collision with QTS (already applied)

QTS itself listens on **8080** (Web Administration) and **8081** (Secure Web
Server). The voting container originally published those same ports, so it was
created but could never start — Container Station showed it as `Created` with an
empty log, indefinitely.

The compose files now use:

```yaml
    ports:
      - "9080:80"   # voter
      - "9081:81"   # admin
```

Consequences for every other document and for the reverse proxy rule:

| Thing | Old | New |
|---|---|---|
| Voter site on the LAN | `http://192.168.1.245:8080` | `http://192.168.1.245:9080` |
| Admin console on the LAN | `http://192.168.1.245:8081` | `http://192.168.1.245:9081` |
| Reverse proxy destination | `localhost:8080` | `localhost:9080` |

## Step 6 — Test end to end from outside

From a phone with **Wi-Fi off**:

| Check | Expected |
|---|---|
| `https://fgsottawa.myqnapcloud.com` | QTS login, valid padlock |
| `https://fgsottawa.myqnapcloud.com:9005` | voting entry page, valid padlock |
| `https://fgsottawa.myqnapcloud.com:9005/api/health` | `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}` |

Then set the voting entry URL in the admin console → **Settings** so the QR code
points at `https://fgsottawa.myqnapcloud.com:9005`.

---

## Troubleshooting

**Test still fails after adding the rules**
- Confirm the Bell WAN IP is really `142.112.62.31`.
- Confirm both routers carry the rule. A rule on one router alone does nothing.
- Check the Bell modem is not in bridge mode with another device doing NAT.
- Some Bell firmware blocks 80/443 inbound on residential profiles. If 443 is
  blocked, use a single high port for both (e.g. forward `9005 -> 9005` and give
  the voting system its own certificate).

**The reverse proxy page loads but shows QTS instead**
The rule's source port or hostname does not match what you typed. It must be
`9005` and `fgsottawa.myqnapcloud.com` exactly.

**Certificate warning in the browser**
The certificate does not cover the hostname, or issuance failed. Re-run Step 4
and confirm the certificate is set as default.

---

## Rollback

Everything here is reversible and the voting system is never at risk:

- Delete the reverse proxy rule → the port simply stops serving the site.
- Remove the port forward rules → external access stops.
- The containers, volumes and all data are untouched by any step above.
