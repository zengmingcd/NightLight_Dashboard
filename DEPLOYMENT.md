# Server deployment

Run all commands below from the repository root (the directory containing
`Dockerfile`). The server needs Docker installed and running, permission to run
Docker commands, and internet access to download build images and dependencies.
Node and Python do not need to be installed on the server host.

The frontend and backend run together in **one container**. The Docker build
compiles the frontend and installs the backend dependencies. FastAPI serves the
dashboard and API on port 8000.

## First deployment

Copy or clone the project onto the server, then build the image:

```sh
docker build -t nightlight-dashboard:latest .
```

After the build succeeds, start the application in the background:

```sh
docker run -d \
  --name nightlight-dashboard \
  --restart unless-stopped \
  -p 8000:8000 \
  nightlight-dashboard:latest
```

Open `http://<server-ip>:8000` on the iPad or another device. Allow inbound TCP
port 8000 through the server firewall for the intended clients. The port mapping
above listens on all host interfaces. For access only through a reverse proxy
on the same server, use `-p 127.0.0.1:8000:8000` instead.

The restart policy starts the container after a Docker/server restart, provided
Docker starts on boot. A container stopped manually stays stopped until started
again.

## Deploy code changes

Update the project files on the server to the desired revision. If deploying
from Git, switch to or pull the intended revision before building.

Build a new image while the existing container continues running:

```sh
docker build -t nightlight-dashboard:latest .
```

**Continue only if the build succeeds.** Replace the running container to use
the new image:

```sh
docker stop nightlight-dashboard
docker rm nightlight-dashboard
docker run -d \
  --name nightlight-dashboard \
  --restart unless-stopped \
  -p 8000:8000 \
  nightlight-dashboard:latest
```

Use the same port mapping and any runtime options chosen for the first
deployment. Replacement causes a brief interruption. Frontend, backend, and
dependency changes all require rebuilding the image and replacing the container;
`docker restart` alone does not load changed source files or a newly built image.
Reload the dashboard in Safari after deployment to load the new frontend assets.

## Check the application

```sh
docker ps --filter name=nightlight-dashboard
docker logs --tail 100 nightlight-dashboard
curl --fail --show-error http://127.0.0.1:8000/api/widgets/status
```

The Status endpoint should return `{"status":"ok"}`. Also open the dashboard
and confirm the widgets load. To follow application logs, run:

```sh
docker logs --follow --tail 100 nightlight-dashboard
```

Press Ctrl+C to stop following logs; the application keeps running. If the
container exits unexpectedly, inspect it with `docker ps -a` and `docker logs`.

Weather requires outbound HTTPS access to Open-Meteo. Its cache is held in memory
and resets when the container restarts; no database or persistent volume is
currently required. A working Status endpoint does not verify the weather
provider or target-iPad compatibility.

## Stop, start, or restart the existing container

Stop the application:

```sh
docker stop nightlight-dashboard
```

Start it again with its existing image and settings:

```sh
docker start nightlight-dashboard
```

Restart it without deploying code changes:

```sh
docker restart nightlight-dashboard
```

## Configuration and secrets

The current application needs no API credentials. Keep any future credentials
in backend runtime configuration; never put them in frontend code or frontend
build variables, which are delivered to the browser.
