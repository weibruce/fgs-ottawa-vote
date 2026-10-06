# Deploying the Voting System on QNAP — English Step-by-Step

This guide deploys the whole system (database + backend + both web front-ends)
onto a QNAP NAS using **Container Station**, operated from **your own account**
(not `admin`).

The goal: after the one-time admin setup in Part A, you never need the `admin`
account again.

---

## What actually runs

Four containers, wired together on a private Docker network:

| Container | Image | Purpose |
|---|---|---|
| `fgs-db` | `postgres:18-alpine` | The database (members, candidates, votes) |
| `fgs-redis` | `redis:7-alpine` | Vote de-duplication / hot state |
| `fgs-api` | `fgs-api:latest` | FastAPI backend |
| `fgs-web` | `fgs-web:latest` | nginx — serves the voting site (:80) and admin console (:81) |

Only `fgs-web` is exposed to your network, on ports **8080** (voters) and
**8081** (admin). The database and Redis are never reachable from outside.

## What has already been tested

The exact stack definition in Part E was run end-to-end on a development
machine before writing this guide. Verified: all four containers start **in
under 7 seconds** with no build step on the NAS, both web front-ends return
200, `/api/health` reports postgres and redis OK, the member/candidate/vote
data imports automatically from the SQL dump, the admin login works, and the
data survives a full restart of the stack.

The QNAP-specific parts — the permission dialog labels, the Container Station
GUI steps, and your NAS architecture — cannot be tested from here. Those are
the parts to watch, and Part A3, Part D and Part G tell you what to check.

> **Correction (verified against the QTS 5.1 user guide):** app access is
> granted from **App Center → ⚙ → Display on**, *not* from
> Control Panel → Privilege → Applications. An earlier version of this guide
> said otherwise and that was wrong — Container Station does not appear in the
> Privilege → Applications list at all. Part A2 Grant 1 has been rewritten.

---

# Part A — One-time setup the `admin` must do

Log in as `admin` to do this part. It takes about 5 minutes, once.

## A1. Apps that must be installed

| App | Status | Why |
|---|---|---|
| **Container Station** | ✅ already installed | Runs all four containers |
| **Text Editor** | optional | Lets you edit `.env` in File Station. You can skip it — the deployment YAML in Part E carries its own settings. |

**That is the complete list.** No other QNAP app is required — no Web Station,
no Apache/PHP, no MariaDB, no Python/Node add-ons. Everything the system needs
is inside the two Docker images.

> If Container Station offers to install **Container Station 3** vs an older
> version, take the newest one.

## A2. Permissions to grant to YOUR account

There are **three** grants. All three are needed.

### Grant 1 — Make Container Station visible to your account

> ⚠️ **This is NOT done in Control Panel → Privilege → Applications.**
> Container Station never appears in that dialog. That dialog only covers a
> subset of apps; most apps (including Container Station) are controlled from
> **App Center** instead.
>
> This is the step that trips people up. QNAP's own words: *"QTS administrators
> can grant or deny user access to apps. The main menu of non-administrator
> users only displays the apps that they have access to."* The action lives in
> App Center, not in Control Panel.

1. Log in as **`admin`**
2. Open **App Center**
3. Find **Container Station** in the list of installed apps
4. Click the **⚙** (settings) icon on the Container Station tile
5. Hover over **Display on**
6. Select **Every user's main menu**
7. Log out, then log back in **as your own account**

### Grant 2 — Give your account read/write on the `Container` shared folder

Container Station stores applications under the `Container` shared folder, so
your account must be able to write there.

1. **Control Panel** → **Privilege** → **Shared Folders**
2. Select the **Container** shared folder
3. Click **Edit** (may be labelled *Edit Shared Folder Permissions* or
   *Access Permissions*)
4. Find **your account** in the list and set it to **Read/Write**
5. Click **Apply** / **OK**

> If you cannot see a `Container` shared folder at all, Container Station may
> still be finishing its first-time setup. Reopen Container Station, then
> reopen this dialog.

### Grant 3 — Read/write on the shared folder that will hold the project

You will upload the project files to a shared folder of your choice
(this guide uses the `Container` folder, so if you follow it exactly, Grant 2
already covers this).

If you prefer a different shared folder (e.g. `Public` or a new `fgs` share),
grant your account **Read/Write** on that one the same way as Grant 2.

### Optional Grant — SSH access

Skip this unless you want to use the command line.

QNAP restricts SSH to administrator accounts. If you want SSH, `admin` must:

1. **Control Panel** → **Network & File Services** → **Telnet / SSH**
2. Tick **Enable SSH**
3. **Apply**

⚠️ Even with SSH enabled, QNAP generally only accepts SSH logins for accounts
in the `administrators` group. This guide deliberately does **not** require SSH
— everything below is done through the GUI.

## A3. Confirm it worked

1. Log out of the NAS
2. Log back in **as your own account**
3. **Container Station** should now appear on the desktop / main menu

## A4. If App Center only offers "Administrator's main menu"

If, at step 5 of Grant 1, **Display on** offers *only*
**Administrator's main menu** — no *Every user's main menu* option — then QNAP
has classified Container Station as admin-only on your firmware. The QTS manual
notes that for such apps *"non-administrators cannot be granted access"*.

In that case you have two options:

| Option | Trade-off |
|---|---|
| **A4a — `admin` does Part D and Part E** (import images + create the application) | One-time, about 5 minutes. After that the stack runs by itself and you never need `admin` again for the NAS — you only use the voting system's own admin console on port 8081. **This is the recommended option.** |
| **A4b — `admin` adds your account to the `administrators` group** | Control Panel → Privilege → Users → your account → Edit → Group → tick `administrators`. ⚠️ This gives your account **full administrator rights over the entire NAS** — it can change every setting, read every file, and delete data. Only do this if you accept that. |

Tell me which happens and I will adjust the remaining steps accordingly.

---

# Part B — Prepare two files on your development machine

You are uploading **two** things. Keep both small — never upload
`node_modules` or `.venv`.

## B1. The source bundle (about 3 MB)

Open a terminal on the development machine where this project lives:

```bash
cd /path/to/fgs-ottawa-vote

# 1. Refresh the database export — the existing dump is out of date
bash deploy/export_current_db.sh

# 2. Package the source + the fresh dump
bash deploy/make_upload_zip.sh
```

Result: **`deploy/fgs-upload.zip`** (~3 MB). It contains the project source,
the candidate photos, and `deploy/db/init/01-fgs_vote.sql`.

> ⚠️ Never commit or email this zip — the SQL dump contains real member names,
> card numbers, and votes.

## B2. The Docker image bundle (about 142 MB)

We build the images here, on the development machine, instead of on the NAS.
A NAS CPU is slow; building on it takes 20–40 minutes and can fail on missing
tooling. Building here takes a few minutes and the NAS starts in seconds.

```bash
bash deploy/make_image_bundle.sh
```

Result: **`deploy/fgs-images.tar`** (~142 MB) containing `fgs-api:latest` and
`fgs-web:latest`. The script also prints a SHA-256 checksum so you can confirm
the file survived the upload.

> ⚠️ **Architecture must match.** The script prints `amd64` or `arm64`.
> Most QNAP x86 models (TS-4xx, TS-6xx, TVS-…) are `amd64`.
> ARM models (TS-133, TS-233, …) are `arm64`.
> If they differ, do not use this tar — tell me and I will give you the
> build-on-NAS route instead.

---

# Part C — Upload both files

Using **File Station** (this works from any account with write access).

1. In the left panel, click the **Container** shared folder
2. Create a folder named **`fgs-ottawa-vote`**
   (use the **+** / *Create folder* button in the toolbar)
3. Open that folder
4. Click **Upload** → **Upload – File**, and select **both**
   `fgs-upload.zip` and `fgs-images.tar`
   (upload the image tar first if you must do them one at a time — it is the
   big one, and you can carry on with Part D while you wait)
5. When `fgs-upload.zip` has finished, right-click it → **Extract** /
   **Extract to…** and extract it **into the current folder**

After extracting, verify the layout is exactly this — one level, no nesting:

```
/share/Container/fgs-ottawa-vote/docker-compose.yml
/share/Container/fgs-ottawa-vote/deploy/
/share/Container/fgs-ottawa-vote/backend/
/share/Container/fgs-ottawa-vote/frontend/
```

If you instead end up with
`/share/Container/fgs-ottawa-vote/fgs-ottawa-vote/...`, move the inner folder's
contents up one level — the application YAML in Part E expects the exact path
`/share/Container/fgs-ottawa-vote/deploy/db/init`.

---

# Part D — Import the two Docker images

In **Container Station**, using your own account:

1. Left menu → **Images**
2. Click **Import Image** — the *Import Image* window opens
3. Choose **Local QNAP Device** (the tar is already on the NAS; do **not**
   pick *Local Computer*)
4. Click the browse icon → in the *Select a source image file* window, pick
   `/share/Container/fgs-ottawa-vote/fgs-images.tar` → **Apply**
5. Click **Next**
6. **Do not** tick *Import and Create* — we want the images only; the
   Application in Part E creates the containers
7. Finish the import and wait — 142 MB takes a few minutes

When done, the image list must show both:

- **`fgs-api:latest`**
- **`fgs-web:latest`**

If only one appears, or a tag looks like `<none>`, the tar was truncated —
re-upload it and compare the SHA-256 checksum printed by
`make_image_bundle.sh`.

> ⚠️ The image architecture must match the NAS. Docker cannot run an `amd64`
> image on an `arm64` NAS or vice versa. If the import succeeds but containers
> fail to start with an *exec format error*, this is the cause — come back to me.

---

# Part E — Create the Application

1. In **Container Station**, left menu → **Applications**
2. Click **Create** — the *Create Application* window opens
3. **Application name**: enter `fgs`
   (valid characters are `a–z`, `0–9`, hyphen, underscore — `fgs` is fine)
4. Find the **Enter the Docker Compose YAML** field and delete any placeholder
   text in it
5. Open `deploy/qnap-application.yml` from the project (in File Station you can
   open it with **Text Editor** if you installed it) and **copy the entire
   contents** into that field
6. **Before continuing**, replace the three placeholders in the pasted YAML:

   | Placeholder | Replace with |
   |---|---|
   | `CHANGE_ME_POSTGRES_PASSWORD` | a strong password you choose (**appears 2 times — must be the same value in both places**) |
   | `CHANGE_ME_REDIS_PASSWORD` | a strong password you choose (**appears 3 times — must be the same value in all three**) |
   | `CHANGE_ME_JWT_SECRET` | a long random string, at least 32 characters (appears once) |

   To generate the JWT secret on your development machine:
   ```bash
   openssl rand -hex 32
   ```

   Use letters, digits, hyphen and underscore only. Avoid `$`, backticks, and
   quotes — YAML would need escaping and it is easy to get wrong.

7. Click **Validate**. Wait for it to confirm the YAML is correct. If it
   highlights an error, the usual cause is a password containing a character
   that needs quoting — change the password rather than trying to escape it.
8. Optional — click **Advanced Settings** → **Default Web URL Port**, set the
   service to `web` and the port to `80`. Container Station will then add a
   clickable shortcut for the voting site.
9. Click **Create**

Container Station will pull `postgres:18-alpine` and `redis:7-alpine` from the
internet (a few minutes), then start everything. On first start the database
automatically imports `01-fgs_vote.sql`.

---

# Part F — Verify

First find the NAS IP address: **Control Panel → System → System Status**, or
look in your router's client list. It looks like `192.168.x.x`.

From a computer on the same Wi-Fi:

| What | URL |
|---|---|
| Voting site | `http://<NAS-IP>:8080` |
| Admin console | `http://<NAS-IP>:8081` — user `admin`, password `admin123` (change it on first login) |

Then check each of these:

1. Both pages load
2. `http://<NAS-IP>:8080/api/health` returns
   `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}`
3. In the admin console, open **Members** — you should see your real members
   (around 300). If the list is empty, the dump did not import (see below).
4. Log in to the admin console and **change the default password**
5. In Container Station, all four containers show as running

> ⚠️ **If you need members to vote from outside this Wi-Fi**, do not stop here.
> Plain `http://` would send names, card numbers and votes across the internet
> unencrypted. Tell me and we will set up HTTPS.

---

# Part G — Troubleshooting

### The database container keeps restarting

The most common cause is a wrong volume path. The YAML in Part E already uses
the correct PostgreSQL 18 path (`/var/lib/postgresql`). If you edited it, make
sure you did not change it back to `/var/lib/postgresql/data` — on
PostgreSQL 18 that path makes the container refuse to start with a message
about an *unused mount/volume*.

### The Members page is empty

The dump is only imported the **first** time the database volume is created.
If the database started before `01-fgs_vote.sql` was in place, the import was
skipped. To fix:

1. In Container Station, stop the `fgs` application
2. Delete the volumes `fgs_pgdata` and `fgs_redisdata`
   (Container Station → Volumes → select → Delete)
3. Confirm the file exists on the NAS at
   `/share/Container/fgs-ottawa-vote/deploy/db/init/01-fgs_vote.sql`
4. Start the application again

### The file permission is wrong

The file must be readable by the database container, which runs as uid 999.
In File Station: right-click the `.sql` file → **Properties** → **Permissions**
→ make sure **Read** is granted for everyone (`644`). If you have SSH, the
command is `chmod 644`.

### `fgs-api` / `fgs-web` cannot be found when the application starts

The images were not imported under the exact tags `fgs-api:latest` and
`fgs-web:latest`. Go back to Part D and confirm both tags appear in the
**Images** list.

### Port 8080 or 8081 is already in use

Another QNAP service is on that port. Change the two numbers in the `web`
service of the YAML (`"8080:80"` / `"8081:81"`) to free ports, e.g.
`"9080:80"` and `"9081:81"`, then redeploy.

### Container Station says access denied, or the icon is missing

Grant 1 in Part A was not applied, or you did not log out and back in
afterwards. Two things to check:

- Make sure you did it in **App Center → ⚙ → Display on → Every user's main
  menu**. Doing it in Control Panel → Privilege → Applications will **not**
  work — Container Station is not listed in that dialog.
- If App Center does not offer *Every user's main menu* for Container Station,
  see **Part A4** — QNAP has made it admin-only on your firmware.

### Everything looks fine but a page is blank

Reload with a hard refresh (`Ctrl`+`Shift`+`R`). If it persists, check the
`fgs-web` container log in Container Station.

---

# Reference: the files used in this guide

| File | Role |
|---|---|
| `deploy/qnap-application.yml` | The stack definition you paste into Container Station. Self-contained — all settings are inside it. |
| `deploy/make_upload_zip.sh` | Builds `deploy/fgs-upload.zip` (source + database dump) |
| `deploy/make_image_bundle.sh` | Builds `deploy/fgs-images.tar` (the two Docker images) |
| `deploy/export_current_db.sh` | Re-exports the live database to `deploy/db/init/01-fgs_vote.sql` |
| `deploy/README.md` | The full deployment manual, including the HTTPS / remote-voting setup |
