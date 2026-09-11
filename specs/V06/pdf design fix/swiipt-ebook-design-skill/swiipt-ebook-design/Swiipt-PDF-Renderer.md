# Swiipt PDF Renderer — Current VPS Architecture & Agent Debugging Context

## 1. What has been installed

Swiipt now has a dedicated PDF rendering service running separately from the main application.

The renderer uses:

* **Python 3.10**
* **WeasyPrint 69.0** — HTML → PDF engine
* **Flask** — HTTP API
* **Gunicorn 26.2.0** — production WSGI server
* **systemd** — process/service manager

The service runs under a dedicated Linux user:

```text
swiipt-render
```

The application lives at:

```text
/opt/swiipt-render
```

The Python virtual environment is:

```text
/opt/swiipt-render/venv
```

The main Flask application is:

```text
/opt/swiipt-render/app.py
```

Do NOT assume the renderer is running inside WordPress, PHP, Node.js, or the main Swiipt application.

---

# 2. Renderer service

The systemd service is:

```text
swiipt-render.service
```

Its unit file is:

```text
/etc/systemd/system/swiipt-render.service
```

Environment/secrets are stored in:

```text
/etc/swiipt-render.env
```

The environment file is intentionally protected:

```text
-rw------- root root /etc/swiipt-render.env
```

The service runs as:

```text
User=swiipt-render
Group=swiipt-render
```

The production Gunicorn command is effectively:

```bash
/opt/swiipt-render/venv/bin/gunicorn \
  --workers 2 \
  --bind 127.0.0.1:8765 \
  --timeout 60 \
  app:app
```

Therefore the renderer listens ONLY on:

```text
127.0.0.1:8765
```

It is not directly exposed to the public internet.

---

# 3. IMPORTANT: the renderer has already been proven to work

Do not waste time reinstalling WeasyPrint, Flask, Gunicorn, or rebuilding the Python environment.

The service was successfully started through systemd.

This command returned:

```bash
systemctl status swiipt-render --no-pager -l
```

with:

```text
Active: active (running)
```

Gunicorn showed:

```text
Listening at: http://127.0.0.1:8765
```

and two workers booted successfully.

The health endpoint was successfully tested directly on the VPS:

```bash
curl -sS http://127.0.0.1:8765/health
```

and returned:

```json
{"engine":"weasyprint","status":"ok"}
```

Therefore:

**127.0.0.1:8765/health is NOT returning 404 when accessed directly on the VPS.**

---

# 4. The actual render endpoint has also been proven to work

The API requires:

```text
X-API-Key
```

The API key is loaded from:

```text
/etc/swiipt-render.env
```

The successful test was:

```bash
set -a
source /etc/swiipt-render.env
set +a

curl -sS \
  -X POST \
  -H "X-API-Key: $SWIIPT_API_KEY" \
  -H "Content-Type: text/html" \
  --data '<html><body><h1>Swiipt Test</h1><p>PDF rendering works.</p></body></html>' \
  http://127.0.0.1:8765/render \
  -o /tmp/swiipt-test.pdf \
  -w '\nHTTP_STATUS=%{http_code}\nCONTENT_TYPE=%{content_type}\nSIZE=%{size_download}\n'
```

Result:

```text
HTTP_STATUS=200
CONTENT_TYPE=application/pdf
SIZE=5533
```

The resulting file was:

```text
/tmp/swiipt-test.pdf: PDF document, version 1.7
```

So the complete pipeline:

```text
HTML
 ↓
Flask
 ↓
WeasyPrint
 ↓
PDF
```

is working.

---

# 5. Current Flask routes

The application in:

```text
/opt/swiipt-render/app.py
```

currently defines these routes:

```text
GET  /health
POST /render
```

`/health` does NOT require the API key.

`/render` DOES require:

```text
X-API-Key: <configured key>
```

The health route is:

```python
@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok", "engine": "weasyprint"}
```

The render route is:

```python
@app.route("/render", methods=["POST"])
```

---

# 6. VERY IMPORTANT: distinguish these two situations

If the agent says:

> `/health` returns 404

DO NOT immediately modify `app.py`.

First determine WHERE the request is going.

### Direct VPS test

Run:

```bash
curl -i http://127.0.0.1:8765/health
```

This is the canonical renderer test.

Expected:

```text
HTTP/1.1 200 OK
Content-Type: application/json
```

with:

```json
{"engine":"weasyprint","status":"ok"}
```

If this works, the renderer itself is healthy.

---

# 7. If the application receives 404

If the main Swiipt application is calling something like:

```text
https://example.com/health
```

or:

```text
https://example.com/render
```

that is NOT automatically the same thing as:

```text
http://127.0.0.1:8765/health
```

The renderer is bound to localhost.

Therefore inspect the application's renderer configuration.

Search the codebase for:

```text
8765
```

```text
swiipt-render
```

```text
/health
```

```text
/render
```

```text
SWIIPT_API_KEY
```

and any renderer/base URL configuration such as:

```text
RENDERER_URL
PDF_RENDERER_URL
SWIIPT_RENDER_URL
PDF_SERVICE_URL
```

The application should ultimately be configured to communicate with:

```text
http://127.0.0.1:8765
```

when the application and renderer are on the same VPS.

For example:

```text
GET http://127.0.0.1:8765/health
```

and:

```text
POST http://127.0.0.1:8765/render
```

---

# 8. If 127.0.0.1:8765/health works but the application's health check returns 404

This strongly indicates that the application's request is NOT reaching the Flask renderer directly.

Investigate:

1. Reverse proxy configuration
2. Nginx configuration
3. Apache configuration
4. CloudPanel/Hestia routing
5. Application-level proxy routes
6. Environment variables
7. Docker/container networking, if applicable
8. Whether the application is using `localhost` incorrectly from another container/process
9. Whether `/health` is being requested against the main website rather than port 8765

Do NOT assume the Flask route is missing.

The direct test already proved that `/health` exists.

---

# 9. Check the actual listener

Use:

```bash
ss -ltnp | grep ':8765'
```

Expected to show Gunicorn listening on:

```text
127.0.0.1:8765
```

The service should be owned by the systemd service.

Check:

```bash
systemctl status swiipt-render --no-pager -l
```

and:

```bash
systemctl is-active swiipt-render
```

Expected:

```text
active
```

---

# 10. Check service logs

Use:

```bash
journalctl -u swiipt-render -n 100 --no-pager
```

For live debugging:

```bash
journalctl -u swiipt-render -f
```

Do not restart the service repeatedly unless necessary.

---

# 11. Important previous problem that has already been fixed

Earlier, systemd could not start because another manually launched Gunicorn process was already using:

```text
127.0.0.1:8765
```

The old Gunicorn process was killed.

The systemd service now owns the port.

Do not manually launch another Gunicorn process on port 8765.

Do NOT run:

```bash
gunicorn --bind 127.0.0.1:8765 ...
```

manually while the systemd service is running.

Use:

```bash
systemctl restart swiipt-render
```

if a restart is required.

---

# 12. Known non-blocking Gunicorn warning

Gunicorn currently logs:

```text
Control server error: [Errno 13] Permission denied: '/home/swiipt-render'
```

Despite this warning:

* Gunicorn starts
* workers boot
* `/health` returns 200
* `/render` returns 200
* WeasyPrint generates valid PDFs

Therefore this warning is NOT the explanation for a `/health` 404.

It can be cleaned up separately.

Do not break the working renderer trying to fix this warning unless specifically investigating Gunicorn configuration.

---

# 13. Correct debugging sequence

If the agent reports:

```text
GET /health → 404
```

follow this exact sequence.

### Step A

Run:

```bash
curl -i http://127.0.0.1:8765/health
```

### Step B

If that returns 200, the renderer is healthy.

Then inspect what URL the application is actually calling.

### Step C

Search application configuration:

```bash
grep -RniE '8765|swiipt-render|/health|/render|RENDERER|PDF_RENDER' /path/to/application
```

Adjust the path as appropriate.

### Step D

Inspect environment variables relevant to the renderer.

### Step E

If the application is using a public hostname instead of localhost, determine why.

### Step F

If a reverse proxy is intentionally being used, inspect its routing configuration and verify that the route is actually forwarding to:

```text
127.0.0.1:8765
```

---

# 14. Architecture to keep in mind

The intended architecture is:

```text
                    SAME VPS
┌───────────────────────────────────────────────┐
│                                               │
│  Swiipt Main Application                     │
│                                               │
│       │                                       │
│       │ HTTP POST /render                     │
│       │ X-API-Key                             │
│       ▼                                       │
│                                               │
│  http://127.0.0.1:8765                       │
│              │                                │
│              ▼                                │
│       swiipt-render.service                  │
│              │                                │
│              ▼                                │
│           Gunicorn                            │
│              │                                │
│              ▼                                │
│          Flask app.py                         │
│              │                                │
│              ▼                                │
│         WeasyPrint 69                         │
│              │                                │
│              ▼                                │
│             PDF                               │
│                                               │
└───────────────────────────────────────────────┘
```

The renderer is intentionally isolated from the main application.

The main application should treat it as an internal PDF rendering service.

---

# 15. Do not make these incorrect assumptions

Do NOT assume:

* `/health` is a public website route
* the renderer is running on port 80/443
* the renderer is running through WordPress
* the renderer is running through PHP
* the renderer is running through Node.js
* the renderer needs to be exposed publicly
* WeasyPrint needs to be reinstalled
* Flask needs to be reinstalled
* Gunicorn needs to be reinstalled
* systemd needs to be recreated
* the `/health` Flask route is missing

The direct VPS test has already established that:

```text
http://127.0.0.1:8765/health
```

works.

Therefore a 404 observed elsewhere should first be treated as a **routing/configuration problem**, not a renderer installation problem.

---

# 16. First diagnostic commands

If taking over this system, run these first:

```bash
systemctl is-active swiipt-render
```

```bash
ss -ltnp | grep ':8765'
```

```bash
curl -i http://127.0.0.1:8765/health
```

```bash
systemctl status swiipt-render --no-pager -l
```

```bash
journalctl -u swiipt-render -n 50 --no-pager
```

Only after these checks should you investigate the main application's renderer integration.

## Bottom line

**The PDF renderer itself is already working.**

The canonical endpoint is:

```text
http://127.0.0.1:8765
```

Health:

```text
GET /health
```

Render:

```text
POST /render
```

Authentication:

```text
X-API-Key
```

If an agent sees `404 /health`, its first job is to determine whether it is actually calling:

```text
http://127.0.0.1:8765/health
```

or some other URL.

Do not modify the renderer blindly until that is established.
