# Deploying Hilly Quiz on Ubuntu Server (behind HAProxy / OPNsense)

## Architecture

Everything runs as **one Node process**:

- Express serves the REST API (`/api/...`)
- Socket.io serves the realtime game (`/socket.io/...`) on the **same HTTP server/port**
- Express also serves the built React client (static files from `client/dist`) and falls back to `index.html` for client-side routes

This means OPNsense/HAProxy only needs **one backend target**: `<ubuntu-ip>:3000`. No path-based routing is required — websocket upgrades, API calls, and page loads all go to the same port.

SQLite data lives in `server/hilly-quiz.db` (created automatically on first run).

---

## 1. Prepare the Ubuntu server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential python3 git curl

# Node.js 20.x LTS (better-sqlite3 needs to compile a native module)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node -v   # v20.x
npm -v

sudo npm install -g pm2
```

---

## 2. Get the code onto the server

**Option A — Git (recommended, makes updates a `git pull`):**

Push this project to a private GitHub/GitLab repo from your Windows machine, then on the Ubuntu box:

```bash
sudo mkdir -p /opt/hilly-quiz
sudo chown $USER:$USER /opt/hilly-quiz
git clone <your-repo-url> /opt/hilly-quiz
cd /opt/hilly-quiz
```

**Option B — copy directly from Windows (no git remote needed):**

From PowerShell on your Windows machine (excluding `node_modules`):

```powershell
robocopy "C:\Users\cjbra\Desktop\Hilly Quiz" hilly-quiz-deploy /E /XD node_modules .git client\node_modules client\dist
scp -r hilly-quiz-deploy <user>@<ubuntu-ip>:/opt/hilly-quiz
```

---

## 3. Install dependencies & build the client

```bash
cd /opt/hilly-quiz
npm install
npm run build    # installs client deps + builds client/dist
```

`npm run build` produces `client/dist`, which the Express server serves automatically.

---

## 4. Set the port (optional)

Default is `3000`. To change it, export `PORT` for the process — easiest is to set it directly in the PM2 start command (step 5). The `.env.example` file is just a reminder; the app reads `process.env.PORT` directly (no dotenv loader), so values must come from the environment / PM2 / systemd, not a `.env` file.

---

## 5. Run with PM2

```bash
cd /opt/hilly-quiz
pm2 start npm --name hilly-quiz -- start
pm2 save
```

Enable PM2 on boot:

```bash
pm2 startup
# run the sudo command it prints, then:
pm2 save
```

Useful commands:

```bash
pm2 status
pm2 logs hilly-quiz
pm2 restart hilly-quiz
```

---

## 6. Firewall (ufw)

Only the OPNsense box needs to reach port 3000 — lock it down to that IP:

```bash
sudo ufw allow OpenSSH
sudo ufw allow from <opnsense-lan-ip> to any port 3000 proto tcp
sudo ufw enable
sudo ufw status
```

---

## 7. HAProxy on OPNsense

You only need to add **one backend pool** + **one real server**, then route your quiz domain to it from your existing HTTPS frontend.

### 7.1 Real Server
*Services → HAProxy → Real Servers → +*

- **Name:** `hilly_quiz_srv`
- **FQDN or IP:** `<ubuntu-server-lan-ip>`
- **Port:** `3000`
- **Mode:** Active

### 7.2 Backend Pool
*Services → HAProxy → Backend Pools → +*

- **Name:** `hilly_quiz_be`
- **Mode:** HTTP
- **Servers:** `hilly_quiz_srv`
- **Health checking:** Enable, type **HTTP**, method `GET`, URI `/api/health`, expected status 200
- **Timeouts (advanced settings):** bump `connect`, `server`, and `client` timeouts to at least **60s** (Socket.io's default ping interval is 25s with a 20s ping-timeout, so the defaults are usually fine, but a higher value avoids HAProxy killing idle connections if a player leaves their phone idle). HAProxy automatically tunnels the connection once it sees the `101 Switching Protocols` response for the websocket upgrade — no special websocket flag needed.

### 7.3 Route your domain to it
*Services → HAProxy → Settings → Frontends* (edit your existing HTTPS frontend on port 443):

- Under **Rules/Conditions**, add a condition: `Host` **ends with**/**is** `quiz.yourdomain.com` (your chosen domain)
- Add an **Action**: "Use Backend" → `hilly_quiz_be`, linked to that condition

If this is your *first* site on this HAProxy instance, instead create a new frontend:

- **Listen address:** `*:443`
- **Type:** HTTP, with SSL offloading enabled
- **SSL certificate:** issue one via the OPNsense ACME (Let's Encrypt) plugin for `quiz.yourdomain.com`
- **Default backend:** `hilly_quiz_be`

---

## 8. DNS

Point `quiz.yourdomain.com` at your public IP (the one forwarding to OPNsense's WAN on 443). No port forwarding for 3000 is needed externally — only HAProxy talks to it, over the LAN.

---

## 9. Test

```bash
# From the Ubuntu box itself:
curl http://localhost:3000/api/health

# From OPNsense / another LAN host:
curl http://<ubuntu-ip>:3000/api/health
```

Then browse to `https://quiz.yourdomain.com` — confirm the lobby loads, a player can join via PIN, and questions/answers/reveals flow correctly (this exercises the websocket path end-to-end).

---

## 10. Updating after code changes

```bash
cd /opt/hilly-quiz
git pull              # or re-copy via scp as in step 2
npm install           # only if dependencies changed
npm run build         # rebuild client
pm2 restart hilly-quiz
```

---

## 11. Backups

The SQLite DB (`server/hilly-quiz.db`, plus `-wal`/`-shm` files in WAL mode) holds categories, questions, nicknames, and the leaderboard. A simple cron job for a safe online backup:

```bash
0 3 * * * sqlite3 /opt/hilly-quiz/server/hilly-quiz.db ".backup '/opt/hilly-quiz-backups/hilly-quiz-$(date +%F).db'"
```
