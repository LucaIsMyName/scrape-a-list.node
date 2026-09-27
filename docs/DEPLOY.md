# Deploy scrape-a-list to the Hetzner VPS

The public site is [https://scrape-a-list.lucamack.at](https://scrape-a-list.lucamack.at).

Apache is the only process on the public internet. It asks for a username and password, then proxies to the Node GUI on `127.0.0.1:3000`. The Node process is not reachable from outside the VPS.

The GUI is a prebuilt React bundle (`gui/web/dist`). Tailwind is compiled into that bundle. **Geist fonts** still load from Google Fonts in the browser. Scraping runs on the VPS.

```text
Browser
  -> Cloudflare DNS (A record, DNS only, not proxied)
  -> Apache on the VPS, ports 80 and 443, basic auth
  -> Node GUI on 127.0.0.1:3000
```

## Server facts

| Item | Value |
| --- | --- |
| Host | `root@178.104.0.32` |
| SSH key on the Mac | `~/.ssh/id_ed25519_hetzner` |
| OS | Ubuntu 26.04 |
| App directory | `/opt/scrape-a-list` |
| App user | `scrape` (systemd only, no login shell) |
| systemd service | `scrape-a-list` |
| Public URL | `https://scrape-a-list.lucamack.at` |
| Password file | `/etc/apache2/scrape-a-list.htpasswd` |
| Apache site | `/etc/apache2/sites-available/scrape-a-list.conf` |
| TLS certificate | `/etc/letsencrypt/live/scrape-a-list.lucamack.at/` |

These defaults live in [`scripts/server.sh`](../scripts/server.sh). Override them for one run by setting the matching environment variable, for example `DEPLOY_HOST=root@1.2.3.4 ./scripts/deploy.sh`.

## Redeploy from the Mac

From the project root:

```bash
./scripts/deploy.sh
```

or:

```bash
npm run deploy
```

That command:

1. Builds the React GUI locally (`npm run gui:build` → `gui/web/dist`).
2. Copies the repo to `/opt/scrape-a-list` with `rsync` (includes the built `gui/web/dist`).
3. Runs `npm ci --omit=dev` on the server (Express/scraper only; no Vite).
4. Restarts the `scrape-a-list` systemd service.
5. Checks that `http://127.0.0.1:3000/` answers on the VPS.

It does not touch Apache, the TLS certificate, the password file, or CSV files already in `/opt/scrape-a-list/output/`. `node_modules`, `output/`, and `.git` are not uploaded. The VPS does not run a frontend build.

A running scrape is cancelled by the restart, and its in-memory job is gone. Finished CSV files on disk stay.

## Basic auth

Passwords are stored only in Apache's htpasswd file on the server. The scripts prompt for the password in the terminal and do not write it into this repo.

Add a user:

```bash
./scripts/auth.sh add USERNAME
```

Change a password:

```bash
./scripts/auth.sh passwd USERNAME
```

Each command asks for the new password twice, writes `/etc/apache2/scrape-a-list.htpasswd`, and reloads Apache. Existing users are left in place. `add` refuses a name that already exists. `passwd` refuses a name that does not exist.

Usernames are limited to letters, numbers, `.`, `_`, and `-`.

The first user, `luca`, was created during the initial install. To rotate that password:

```bash
./scripts/auth.sh passwd luca
```

## What is already installed

The VPS was prepared once. `./scripts/deploy.sh` assumes this layout is still there.

- Node.js 22 is installed under `/usr/local` (`node` and `npm`).
- The `scrape` system user owns `/opt/scrape-a-list`.
- systemd runs `/usr/local/bin/node gui/server.js` as `scrape`, with `GUI_HOST=127.0.0.1` and `PORT=3000`, and restarts it if it crashes.
- Apache listens on ports 80 and 443. Port 80 redirects to HTTPS, except `/.well-known/acme-challenge/`, which Let's Encrypt uses for renewal. Port 443 requires basic auth and proxies to Node with `ProxyTimeout 3600` so a long scrape's progress stream is not cut off.
- `ufw` allows 22, 80, and 443 on IPv4 and IPv6. Port 3000 is not in that list, and Node binds to localhost only.
- Certbot obtained a certificate for `scrape-a-list.lucamack.at` and renews it with its systemd timer. The Cloudflare record is **DNS only** (grey cloud), so the A record is `178.104.0.32`. An orange-cloud proxy would sit in front of Apache and can hold back the live progress stream.

`scrape.defaults.json` is part of the rsync, so a redeploy publishes whatever is in the local file.

## Logs and a manual restart

On the VPS:

```bash
ssh -i ~/.ssh/id_ed25519_hetzner root@178.104.0.32
systemctl status scrape-a-list
journalctl -u scrape-a-list -n 100 --no-pager
systemctl restart scrape-a-list
```

Apache:

```bash
apache2ctl configtest
systemctl reload apache2
journalctl -u apache2 -n 50 --no-pager
```

## Security and SSRF

The Node app is an **HTTP fetch proxy** for whoever can reach it:

- Production: only Apache (basic auth) can reach Node on `127.0.0.1:3000`.
- Authenticated users can trigger scrapes of **public** `http`/`https` URLs from the VPS egress IP.

Recommended production env for the `scrape-a-list` systemd unit:

| Variable | Recommended |
| --- | --- |
| `ALLOW_PRIVATE_NETWORK_TARGETS` | `false` (default) — blocks scraping internal/metadata URLs |
| `GUI_HOST` | `127.0.0.1` |
| `MAX_CONCURRENT_JOBS` | `2` (or lower on small VPS) |
| `OUTPUT_MAX_BYTES` | `2147483648` (2 GiB). Oldest CSVs in `output/` are deleted when the folder exceeds this. |

Do not expose port 3000 on the firewall. Treat basic-auth credentials as **trusted operator** access, not public multi-tenant use.

## If the site does not come back

- `./scripts/deploy.sh` prints `SSH key not found` when `~/.ssh/id_ed25519_hetzner` is missing. Point `DEPLOY_SSH_KEY` at the private key that Hetzner installed for `root`.
- `Permission denied (publickey)` means the server does not have that public key in `/root/.ssh/authorized_keys`.
- The script fails after `npm ci` if the service does not answer on port 3000. Read `journalctl -u scrape-a-list -n 100 --no-pager` on the server.
- A browser password prompt with no page after login usually means Apache is up and Node is not. Check the service status above.
- Certificate renewal needs port 80 reachable and the DNS A record still pointing at `178.104.0.32` without the Cloudflare proxy. Check the timer with `systemctl status certbot.timer`.
