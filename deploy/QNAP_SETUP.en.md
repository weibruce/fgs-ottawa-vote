# Deploying the Voting System on QNAP — English Step-by-Step

This deploys the full system (database + backend + both web front-ends) onto
your QNAP NAS using **Container Station**.

## The one thing that shapes everything else

**Container Station can only be used by the `admin` account on this NAS.** We
confirmed this: in App Center → Container Station → ⚙ → **Display on**, the
*Every user's main menu* option is greyed out. That is a QNAP restriction, not
something we can configure around. (Details in the Reference section at the
end.)

So the work splits into exactly two jobs:

| | Your **admin** | **You** |
|---|---|---|
| Runs Container Station | ✅ | ❌ |
| Grants folder permissions | ✅ | ❌ |
| Uploads the project files | ❌ | ✅ (File Station works normally) |
| Runs the election | ❌ | ✅ (voting system's own admin console) |

**Your admin's entire involvement is 3 tasks, done once, about 10 minutes
total.** After that you never need them again — the containers restart
themselves automatically after a reboot or power cut.

---

# WHO DOES WHAT — read this table first

Do these in order. Each row depends on the one above it.

| # | Step | Who | Where | Time |
|---|---|---|---|---|
| 1 | Grant your account read/write on the `Container` shared folder | **admin** | Control Panel | 2 min |
| 2 | Upload the 2 files and extract the zip | **you** | File Station | 10–20 min (the 141 MB upload is the slow part) |
| 3 | ~~Check the SQL file's permissions~~ — **no longer needed** (see PART 2, Step 3) | — | — | 0 |
| 4 | Import the 2 Docker images | **admin** | Container Station | 3 min |
| 5 | Create the Application | **admin** | Container Station | 3 min |
| 6 | Verify everything works | **you** | Browser | 5 min |
| 7 | Change the default admin password | **you** | Voting system | 1 min |

**Steps 1, 4 and 5 are the admin's only involvement.** Give them Part 1 below.

Steps 2, 3, 6 and 7 are yours. They are in Part 2.

> **Practical tip:** do step 1 first, then step 2, then hand Part 1's steps 4
> and 5 to your admin. If you ask your admin to do everything at the end, they
> have to wait through your 141 MB upload.

---

# What actually runs

Four containers on a private Docker network:

| Container | Image | Purpose |
|---|---|---|
| `fgs-db` | `postgres:18-alpine` | The database (members, candidates, votes) |
| `fgs-redis` | `redis:7-alpine` | Vote de-duplication / hot state |
| `fgs-api` | `fgs-api:latest` | FastAPI backend |
| `fgs-web` | `fgs-web:latest` | nginx — voting site (`:80`) and admin console (`:81`) |

Only `fgs-web` is exposed, on ports **8080** (voters) and **8081** (admin). The
database and Redis are never reachable from outside.

## What has been tested

The exact stack definition used below was run end-to-end on the development
machine: all four containers start **in under 7 seconds** with no build step,
both web front-ends return 200, `/api/health` reports postgres and redis OK,
the member/candidate/vote data imports automatically from the SQL dump, the
admin login works, and the data survives a full restart of the stack.

The QNAP-specific parts — permission dialogs, Container Station menus, your NAS
architecture — cannot be tested from here. Those are the parts to watch, and
the checks below tell you what to look for.

---

# PART 1 — YOUR ADMIN'S JOB (one-time, ~10 minutes)

> Hand this whole part to your admin. It has three tasks. **Task 1 must be done
> first** — the other two happen after the files have been uploaded.

## Task 1 — Grant your account read/write on the `Container` shared folder

Container Station stores applications under the `Container` shared folder, and
you need to upload the project there.

1. **Control Panel** → **Privilege** → **Shared Folders**
2. Select the **`Container`** shared folder
3. Click **Edit** (may be labelled *Edit Shared Folder Permissions* or
   *Access Permissions*)
4. Find the user's account and set it to **Read/Write**
5. **Apply**

> If there is no `Container` shared folder yet, open Container Station once —
> it creates the folder on first run.

**Done with Task 1?** Tell the user, so they can upload the files (Part 2,
steps 2–3). Then continue with Tasks 2 and 3.

## Task 2 — Import the two Docker images

The two images were built in advance. Importing them takes seconds; building
them on the NAS would take 20–40 minutes.

> **The file must be the `.tar.gz` produced by `make_image_bundle.sh`.**
> A plain `docker save` tar from a modern Docker will be rejected with
> *"Invalid File Format — The selected file cannot be imported because the file
> format is not supported."* Newer Docker versions write an OCI-format archive
> that Container Station cannot read. `make_image_bundle.sh` converts it to the
> classic format Container Station expects and packs it as `.tar.gz`.

1. Open **Container Station**
2. Left menu → **Images**
3. Click **Import Image** — the *Import Image* window opens
4. Choose **Local QNAP Device**
   (the file is already on the NAS — do **not** pick *Local Computer*)
5. Click the browse icon → in the *Select a source image file* window pick
   `/share/Container/fgs-ottawa-vote/fgs-images.tar.gz` → **Apply**
6. Click **Next**
7. **Do not** tick *Import and Create* — we only want the images; Task 3
   creates the containers
8. Finish the import and wait — 141 MB takes a few minutes

When done, the image list must show both:

- **`fgs-api:latest`**
- **`fgs-web:latest`**

## Task 3 — Create the Application

1. Left menu → **Applications**
2. Click **Create** — the *Create Application* window opens
3. **Application name**: `fgs`
4. Find the **Enter the Docker Compose YAML** field and clear any placeholder
   text
5. Open `/share/Container/fgs-ottawa-vote/deploy/qnap-application.yml`
   (File Station → right-click → **Text Editor**, or any text editor) and copy
   its **entire contents** into that field
6. Replace the three placeholders with strong passwords of your own choosing:

   | Placeholder | Appears | Note |
   |---|---|---|
   | `CHANGE_ME_POSTGRES_PASSWORD` | 2 times | must be the **same value** in both places |
   | `CHANGE_ME_REDIS_PASSWORD` | 3 times | must be the **same value** in all three |
   | `CHANGE_ME_JWT_SECRET` | 1 time | any random string, **at least 32 characters** |

   Use only letters, digits, `-` and `_`. Avoid `$`, backticks and quotes —
   YAML would need escaping and it is easy to get wrong.

   Keep these passwords somewhere safe (a password manager). **The user does
   not need them** — they only need the voting system's own login.

7. Click **Validate**. Wait for it to confirm the YAML is correct. If it flags
   an error, the usual cause is a password containing a character that needs
   quoting — change the password rather than trying to escape it.
8. Optional — **Advanced Settings** → **Default Web URL Port** → service `web`,
   port `80`. This adds a clickable shortcut to the voting site.
9. Click **Create**

Container Station pulls `postgres:18-alpine` and `redis:7-alpine` from the
internet (a few minutes), then starts everything. On first start the database
automatically imports `01-fgs_vote.sql`.

---

# PART 2 — YOUR JOB

## Step 2 — Upload the two files

> ### ⚠️ Upload TWO FILES — never the folder
>
> The project folder is **840 MB across 20,293 files**, almost all of it
> `node_modules`, `.venv` and `.git`. Uploading those is pointless (they are
> already inside the Docker images), would take hours through a browser, and
> some paths are long enough to break File Station.
>
> `fgs-upload.zip` **already contains the entire project** — all 264 real
> source files, the candidate photos, the config, and the database dump.
>
> | Upload this | Size | Files |
> |---|---|---|
> | ✅ `fgs-upload.zip` | 3.3 MB | 264 (packed inside) |
> | ✅ `fgs-images.tar.gz` | 141 MB | the 2 Docker images |
> | ❌ the `fgs-ottawa-vote` folder | 840 MB | 20,293 — **do not** |

### Where the files are

Both files **already exist** — nobody has to run any commands. They were built
on this computer, in the project folder:

| File | Full path on this computer | Size |
|---|---|---|
| Source + database | `/home/bruce/Documents/workspace/fgs-ottawa-vote/deploy/fgs-upload.zip` | 3.3 MB |
| Docker images | `/home/bruce/Documents/workspace/fgs-ottawa-vote/deploy/fgs-images.tar.gz` | 141 MB |

> "This computer" means the machine running this session — the same one whose
> browser is showing you this at `127.0.0.1:3080`. You do **not** need to open
> a terminal. Those commands existed only to create the two files, and that is
> already done.

### Uploading, click by click

1. Log in to the QNAP web interface and open **File Station**
2. In the left panel click the **`Container`** shared folder
3. Click **+** / *Create folder* in the toolbar, name it **`fgs-ottawa-vote`**,
   and confirm
4. Open the new `fgs-ottawa-vote` folder
5. Click **Upload** → **Upload – File**
6. A file-picker window opens. Navigate to the folder
   `/home/bruce/Documents/workspace/fgs-ottawa-vote/deploy/` — go **into**
   `deploy`, do not select the folder above it
7. Select **`fgs-upload.zip`**, then Ctrl+click (Cmd+click on Mac)
   **`fgs-images.tar.gz`** so both are selected, and confirm the upload.
   Start with the zip if your picker only allows one at a time — it is small
   and you can extract it while the big file is still going.
8. Wait for `fgs-upload.zip` to finish, then **right-click it → Extract** (or
   *Extract to…*) and extract it **into the current folder**.
   This recreates the whole project inside `fgs-ottawa-vote/`.
9. Leave `fgs-images.tar.gz` alone — it stays as a file for your admin to import
   in Part 1, Task 2.

### Check the resulting layout

The zip has **no wrapper folder**, so extracting it *inside*
`fgs-ottawa-vote/` gives exactly the right structure:

```
/share/Container/fgs-ottawa-vote/docker-compose.yml
/share/Container/fgs-ottawa-vote/deploy/qnap-application.yml
/share/Container/fgs-ottawa-vote/deploy/db/init/01-fgs_vote.sql
/share/Container/fgs-ottawa-vote/deploy/
/share/Container/fgs-ottawa-vote/backend/
/share/Container/fgs-ottawa-vote/frontend/
```

Open `fgs-ottawa-vote/` and confirm you can see `docker-compose.yml` and a
`deploy` folder directly inside it.

- If you instead see a single folder named `fgs-ottawa-vote` inside, you
  extracted one level too high — move the inner folder's contents up one level,
  or just move the inner folder to `/share/Container/` and rename it.
- If File Station offered to extract into a folder named after the zip
  (`fgs-upload/`), move that folder's contents into `fgs-ottawa-vote/`.

Either way, the target is: `deploy/qnap-application.yml` must exist at exactly
`/share/Container/fgs-ottawa-vote/deploy/qnap-application.yml`.

## Step 3 — Nothing to do (file permissions are handled automatically)

Earlier versions of this guide asked you to set the `01-fgs_vote.sql`
permissions manually through File Station. **That is no longer necessary, and
you may not even have the option.** Skip this step.

Two reasons it changed:

1. The database container now fixes the permission itself on every start
   (its entrypoint runs `chmod 644` on the SQL file before handing over to
   PostgreSQL). Verified: the import succeeds even when the file is `600`.
2. Even if you wanted to set it manually, File Station only shows a
   **Permissions** tab when QNAP's *Advanced Folder Permissions* is enabled —
   which it is not by default. So the old instruction could not be followed on
   a standard setup.

If the Members page is empty in Step 6, the cause is something else — see
Troubleshooting.

**Now tell your admin that step 2 is done**, so they can do Part 1's Tasks 2
and 3.

## Steps 4 and 5 — your admin does these

These are **Part 1, Tasks 2 and 3** (import the images, create the
Application). Wait until your admin confirms the application is running, then
continue with step 6 below.

## Step 6 — Verify

Find the NAS IP address: **Control Panel → System → System Status**, or your
router's client list. It looks like `192.168.x.x`.

From a computer on the same Wi-Fi:

| What | URL |
|---|---|
| Voting site | `http://<NAS-IP>:8080` |
| Admin console | `http://<NAS-IP>:8081` — user `admin`, password `admin123` |

Check each of these:

1. Both pages load
2. `http://<NAS-IP>:8080/api/health` returns
   `{"status":"ok","checks":{"api":"ok","postgres":"ok","redis":"ok"}}`
3. In the admin console, open **Members** — you should see your real members
   (around 300). **If the list is empty, the dump did not import** — see
   Troubleshooting.
4. In Container Station, all four containers show as running
   (ask your admin to confirm, or just rely on the URL working)

## Step 7 — Change the default admin password

Log in to the admin console at `http://<NAS-IP>:8081` with `admin` /
`admin123`, then change the password immediately.

> ⚠️ **If members will vote from outside this Wi-Fi**, do not stop here. Plain
> `http://` would send names, card numbers and votes across the internet
> unencrypted. See `deploy/README.md` section 五 for the HTTPS setup — your
> admin can do that in the same sitting, so you only need them once.

---

# PART 3 — UPDATING THE SYSTEM LATER

Sooner or later you will change the code and want the NAS to run the new
version. This is safe **if** you follow the rule below. It is destructive if
you don't.

## The one rule that must never be broken

> **After go-live, the NAS database is the only real copy of your member and
> vote data.**
>
> The copy on your development computer is a snapshot taken *before* go-live.
> The moment anyone votes or you edit a member on the NAS, that copy is stale.
>
> Therefore, from go-live onward:
>
> - ❌ **Never** re-import the database dump (`01-fgs_vote.sql`)
> - ❌ **Never** delete the `fgs_pgdata` or `fgs_redisdata` volumes
> - ❌ **Never** click **Remove** in Container Station — that deletes the
>   application, and volumes can go with it
>
> An update replaces **software only**. The data is not touched.

## What an update changes, and what it doesn't

| | Where it lives | Replaced by an update? |
|---|---|---|
| Members, candidates, votes | `fgs_pgdata` volume on the NAS | ❌ **Never touched** |
| Active voting state | `fgs_redisdata` volume | ❌ **Never touched** |
| Backend + front-end code | the `fgs-api` / `fgs-web` images | ✅ This is what changes |

## Step 1 — Build the new images (on your development computer)

```bash
cd /home/bruce/Documents/workspace/fgs-ottawa-vote
git pull                      # or however you bring in the new code
bash deploy/make_image_bundle.sh
```

This produces a new `deploy/fgs-images.tar.gz` and prints:

- a **version tag** (like `20261006-a1b2c3d`) — note it down, you will use it
  to confirm the update landed
- a **SHA-256 checksum** of the tar

> ⚠️ **Do not run `export_current_db.sh`** as part of an update. That re-exports
> your *development* database, which is stale and must never reach the NAS.

## Step 2 — Upload the new image bundle (you)

In File Station, go to `/share/Container/fgs-ottawa-vote/` and upload the new
`fgs-images.tar.gz`, **overwriting** the existing one.

## Step 3 — Import and recreate (admin)

1. **Container Station** → **Images** → **Import Image** → **Local QNAP
   Device** → select `/share/Container/fgs-ottawa-vote/fgs-images.tar.gz` →
   **Apply** → **Next**
2. Do **not** tick *Import and Create*
3. Confirm the Images list now shows **both** `latest` **and** the new version
   tag from Step 1. If the version tag is missing, the import did not take —
   retry it. **Do not continue until you see it.**
4. Go to **Applications**, click the application **`fgs`**
5. Next to the **Edit** button, click the small **arrow** → the menu opens
6. Choose **Recreate Application** — ⚠️ **not** *Remove*
7. The *Recreate Application* window opens with the YAML. Leave it as-is and
   click **Update**

Container Station stops the old containers and starts new ones from the new
images. The volumes, and therefore all your data, are left alone.

## Step 4 — Verify (you)

1. The voting site and admin console load
2. `http://<NAS-IP>:8080/api/health` returns `"status":"ok"`
3. **Open the Members page — the count should be unchanged.** This is the
   important check. If it dropped to zero, something deleted the volume; stop
   and restore from a backup (below) before doing anything else.
4. **Check the vote count is unchanged** on the Tally page

## Automatic backups

The stack includes a `fgs-backup` container that dumps the whole database
**once a day** into a folder you can reach from File Station:

```
/share/Container/fgs-ottawa-vote/backups/fgs-YYYY-MM-DD-HHMM.sql.gz
```

The most recent 30 days are kept; older files are deleted automatically.

**Before any update**, download the newest backup from File Station and keep it
somewhere safe. That way, even if an update goes badly wrong, you lose minutes
rather than the election.

To change the frequency or retention, edit these two values in the YAML
(`Applications` → `fgs` → Edit arrow → Recreate Application):

| Setting | Default | Meaning |
|---|---|---|
| `BACKUP_INTERVAL_SECONDS` | `86400` | `3600` = hourly, `86400` = daily |
| `BACKUP_KEEP_DAYS` | `30` | how many days to keep |

## Restoring from a backup

A disaster recovery step — you should never need it, but know it exists.

1. On your computer, unzip the `.sql.gz` backup so you have a plain `.sql` file
   (`gunzip fgs-2026-10-06-1035.sql.gz`)
2. Rename it to `01-fgs_vote.sql`
3. In File Station, replace
   `/share/Container/fgs-ottawa-vote/deploy/db/init/01-fgs_vote.sql` with it
4. Have your admin: **stop** the `fgs` application, delete the volumes
   `fgs_pgdata` and `fgs_redisdata` (Container Station → Volumes), then
   **start** the application again

The database is recreated and the backup is imported on first start.

> ⚠️ Steps 4 and 5 wipe the current database before restoring. Only do this
> when the current data is already lost or wrong.

## Replacing the data with your real database

If the system is currently running on test data and you want to switch it to
your real member list, read this carefully — there is a trap.

### Why you cannot just "drop the file in"

PostgreSQL executes `01-fgs_vote.sql` **only when it creates the data directory
for the very first time** (i.e. when the volume is empty). Once the database
exists, replacing the file in `deploy/db/init/` does **nothing at all**. The
system keeps running the old data and looks perfectly healthy.

So there are exactly two ways.

### Option A — deploy with the real data from the start (RECOMMENDED)

Do this **before** your admin creates the Application in Part 1 Task 3.

1. On your development computer, point the export at the real database. It
   reads the connection string from `backend/.env`:
   ```
   DATABASE_URL=postgresql+psycopg2://user:password@host:port/fgs_vote
   ```
2. Run:
   ```bash
   bash deploy/export_current_db.sh
   bash deploy/make_upload_zip.sh
   ```
3. Upload the new `fgs-upload.zip` and extract it over the existing folder
4. Have your admin create the Application

The very first start imports your real data.

### Option B — replace the data on a system that is already running

Use this only if the Application already exists.

1. Update `deploy/db/init/01-fgs_vote.sql` on the NAS with the real dump
   (export it, upload it, extract, check permissions)
2. Have your admin:
   - **stop** the `fgs` application
   - delete the volumes **`fgs_pgdata`** and **`fgs_redisdata`**
     (Container Station → Volumes)
   - **start** the application again
3. The database is recreated empty and the new file is imported

> ⚠️ **Option B destroys every vote currently in the database.** Only ever do
> this before voting opens. After voting starts, the data in the volume IS the
> election result — there is no way to re-import without losing it.

### The general rule, once and for all

| | |
|---|---|
| Software (code) | Replace any time — safe, data untouched |
| Data (`01-fgs_vote.sql`) | Only at first creation, or by wiping volumes |
| After voting opens | **Never** wipe volumes. Back up instead. |

---

# REFERENCE

## Why Container Station can't be granted to your account

We confirmed on this NAS that App Center → Container Station → ⚙ → **Display
on** offers only *Administrator's main menu*; *Every user's main menu* is greyed
out. QNAP's QTS 5.x manual says of such apps:

> *"This is the only available option for many built-in system utilities, which
> non-administrators cannot be granted access to."*

Two related things that **do not work** — don't spend time on them:

- **Control Panel → Privilege → Users → (your account) → Edit Application
  Privileges.** This is the right per-user dialog, but it can only grant apps
  that already allow *Every user's main menu*. Container Station will never
  appear in it.
- **Control Panel → Privilege → Delegated Administration.** No delegated role
  covers Container Station. The *System Management* role's app list excludes
  it, and the *Application Management* role is documented as being *"unable to
  open apps that are only accessible to administrators"*.

**Do not add your personal account to the `administrators` group.** It would
work, but it grants full control of the entire NAS — every setting, every
shared folder, every user's data, SSH, and factory reset — to solve a 10-minute
one-time task. If you ever need a permanent container-managing account, create
a *dedicated* one for that purpose.

## Troubleshooting

### The Members page is empty

Two possible causes. **Check the `fgs-db` container log first** — it names the
cause directly.

**Cause 1 — the import was skipped.** The dump is imported only the **first**
time the database volume is created. If the database started before
`01-fgs_vote.sql` was in place, nothing is imported later.

**Cause 2 — the SQL file could not be read.** The log will say
`Permission denied`. The container fixes this itself on every start, so if you
see it, the file is probably not where the YAML expects:

```
/share/Container/fgs-ottawa-vote/deploy/db/init/01-fgs_vote.sql
```

Check that path exists exactly (watch for a nested `fgs-ottawa-vote` folder).

Either way, the fix is the same:

1. In Container Station, stop the `fgs` application
2. Delete the volumes `fgs_pgdata` and `fgs_redisdata`
   (Container Station → Volumes → select → Delete)
3. Confirm the SQL file is at the path above
4. Start the application again

### The database container keeps restarting

The most common cause is a wrong volume path. The YAML already uses the correct
PostgreSQL 18 path (`/var/lib/postgresql`). If it was edited, make sure it was
not changed back to `/var/lib/postgresql/data` — on PostgreSQL 18 that path
makes the container refuse to start with a message about an *unused
mount/volume*.

### `fgs-api` / `fgs-web` cannot be found when the application starts

The images were not imported under the exact tags `fgs-api:latest` and
`fgs-web:latest`. Re-check Task 2.

### Port 8080 or 8081 is already in use

Another QNAP service is on that port. Change the two numbers under the `web`
service in the YAML (`"8080:80"` / `"8081:81"`) to free ports — e.g.
`"9080:80"` and `"9081:81"` — then redeploy.

### An image imports but containers fail with "exec format error"

The image architecture does not match the NAS. Docker cannot run an `amd64`
image on an `arm64` NAS or vice versa.

### A page is blank

Hard refresh with `Ctrl`+`Shift`+`R`. If it persists, ask your admin to check
the `fgs-web` container log in Container Station.

## Rebuilding the two files (only needed if the data changed)

If members have been added or edited since the files were built, regenerate
them. On the computer where the project lives:

```bash
cd /home/bruce/Documents/workspace/fgs-ottawa-vote

bash deploy/export_current_db.sh    # re-export the live database
bash deploy/make_upload_zip.sh      # rebuild deploy/fgs-upload.zip
```

`deploy/make_image_bundle.sh` rebuilds the image tar — only needed if the
**software** changed, not the data. It prints the image architecture, which
must match your NAS.

## Files used in this guide

| File | Role |
|---|---|
| `deploy/qnap-application.yml` | The stack definition pasted into Container Station. Self-contained — every setting is inside it. |
| `deploy/make_upload_zip.sh` | Builds `deploy/fgs-upload.zip` (source + database dump) |
| `deploy/make_image_bundle.sh` | Builds `deploy/fgs-images.tar.gz` (the two Docker images) |
| `deploy/export_current_db.sh` | Re-exports the live database to `deploy/db/init/01-fgs_vote.sql` |
| `deploy/README.md` | Full deployment manual, including the HTTPS / remote-voting setup |
