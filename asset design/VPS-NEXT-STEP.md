# VPS Renderer — Next Diagnostic Step

**Date:** 2026-08-28
**Context:** The renderer is working locally on the VPS (Gunicorn on 127.0.0.1:8765, /health returns OK). The problem is that the public internet can't reach it because the VPS runs HestiaCP (a hosting control panel), which manages nginx per-domain. There is no `/etc/nginx/sites-enabled/` directory and the default server has no `proxy_pass` to gunicorn. The preferred fix is a dedicated hostname (e.g. `renderer.swiipt.com`) rather than touching the default server.

---

## What I need from you (the owner)

### Question 1 — Domain

Do you have a domain you can point at this VPS?

- Ideal: you own `swiipt.com` and can add a DNS A-record for `renderer.swiipt.com` → `202.61.236.135`
- Alternative: any other domain you control where you can add an A-record
- Fallback: if no domain is available, we can use a raw IP path with a custom `location` block

If you don't have a domain ready, tell me what you DO have.

---

### Question 2 — Hestia investigation

Run these commands on the VPS via SSH (as root) and paste the output:

```bash
# 1. Hestia user structure
ls /usr/local/hestia/data/users/

# 2. Existing web domains (so we don't collide with any)
ls /usr/local/hestia/data/users/*/web/ 2>/dev/null

# 3. Hestia version
/usr/local/hestia/bin/v-list-sys-web-status 2>/dev/null || dpkg -l hestia 2>/dev/null | tail -3

# 4. Hestia nginx conf directories
ls -la /usr/local/hestia/data/users/*/web.conf 2>/dev/null | head -20
ls /etc/nginx/conf.d/ 2>/dev/null

# 5. The default server config (what's actually answering on port 80 today)
cat /etc/nginx/conf.d/*.conf 2>/dev/null | head -40
# also try:
cat /usr/local/hestia/data/users/*/web.conf 2>/dev/null | head -40

# 6. Confirm gunicorn still healthy
systemctl is-active swiipt-render
curl -s http://127.0.0.1:8765/health
```

---

## What I'll do with the output

Once I see the output, I can give you a small, Hestia-safe nginx include that:

- Adds a dedicated route for the renderer (either on a new hostname or via the Hestia web UI)
- Does NOT touch the default server or any existing website
- Survives Hestia rebuilds
- Adds the proxy_pass for /health and /render only

---

## Why this approach (per the debugging doc)

The doc explicitly says:

1. **"Do not blindly delete the Hestia default server or replace the entire nginx configuration."** — there are other customer websites on this VPS.
2. **"The preferred production architecture is a dedicated hostname such as `renderer.swiipt.com`"** — so the renderer is isolated from other sites.
3. **"Do NOT expose port 8765 directly to the Internet."** — keep gunicorn bound to 127.0.0.1, only expose via nginx.
4. **"Do NOT make configuration changes until the failing layer is identified."** — that's why we ran diagnostics first.

---

## Once the public endpoint works

1. You'll confirm `https://renderer.swiipt.com/health` returns `{"engine":"weasyprint","status":"ok"}` with HTTP 200
2. I'll update the cPanel wp_options to use the new hostname:
   ```php
   update_option('swt_render_endpoint', 'https://renderer.swiipt.com/render');
   ```
3. I'll re-run the cPanel-side health check (`swt_eb2_remote_health()`)
4. Then I'll generate the V06 PDF through the full pipeline and compare it page-by-page against the golden

---

## What to paste back to me

1. **Answer to question 1** (domain: yes/no/which)
2. **Output of the 5 Hestia investigation commands** above

Once I have both, I can give you the exact, minimal, Hestia-safe configuration to add.
