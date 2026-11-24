# Deploy

How to run the API on a server in the local network, with Docker Compose and the image built on the server itself. Deploys are manual and use `main` (released code).

The API is for the local network only: do not expose it to the internet. `POST /seed/reset` is public and the default credentials are in this repository.

## First-time setup

Requires Docker with the Compose plugin and git.

```bash
git clone --branch main https://github.com/emanuel-ra/era-mock-api-rest.git
cd era-mock-api-rest
cp .env.example .env
openssl rand -hex 32     # use the output as JWT_SECRET
```

Edit `.env`: set `JWT_SECRET` (the example value is public, so anyone could sign tokens with it) and a `PORT` that is free on the server. Changing `JWT_SECRET` later invalidates every access token already issued. Give the server a fixed IP, e.g. with a DHCP reservation in the router, so clients keep working.

Then build and start it:

```bash
docker compose up -d --build --wait
```

`restart: unless-stopped` brings the container back after a server reboot.

## Deploy a new version

After a release reaches `main`, from the clone on the server:

```bash
docker tag era-mock-api-rest:local era-mock-api-rest:prev   # keeps the current image for a rollback
git fetch origin
git switch main
git pull --ff-only
docker compose up -d --build --wait
```

- `--build` is required: without it Compose reuses the existing image and the old version keeps running.
- `--wait` returns an error if the container does not become healthy.
- All data is in memory, so every deploy re-seeds it and drops the refresh tokens (users log in again when their access token expires). There are no migrations or backups.

## Check it

Replace `<server>` and `<port>` with the server's address and the `PORT` in `.env`. The first two commands run on the server, the rest from another machine.

```bash
docker compose ps                                   # healthy
ss -tln | grep <port>                               # 0.0.0.0 only, no [::]
curl http://<server>:<port>/seed/status             # record counts per module
curl -i http://<server>:<port>/stats/summary        # 401 without a token
curl -X POST http://<server>:<port>/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@mock.dev","password":"password123"}'
```

Open `http://<server>:<port>/api/docs` in a browser: the Swagger page must list the endpoints. Frontends use `http://<server>:<port>` as the base URL, with no `/api` prefix.

`GET /seed/status` suits an uptime monitor: it is public, and `MOCK_DELAY_MS` / `MOCK_ERROR_RATE` do not apply to it.

## Roll back

```bash
docker tag era-mock-api-rest:prev era-mock-api-rest:local
docker compose up -d --no-build --force-recreate --wait
```

Only the image goes back: the clone stays on the new commit, so the next `--build` deploys it again. To go further back, run `git switch --detach <commit>` and deploy with `--build`.
