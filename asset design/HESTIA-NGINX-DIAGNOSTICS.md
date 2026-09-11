# Hestia nginx diagnostics for renderer.swiipt.com

**Date:** 2026-08-28
**For:** Swiipt platform owner
**Purpose:** Find out exactly how Hestia generated the nginx config for `renderer.swiipt.com`, so we can add the proxy to gunicorn without breaking anything.

---

## How Hestia manages nginx

Hestia does NOT use `/etc/nginx/sites-enabled/`. Instead, for each web domain it generates config files under `/home/{user}/conf/web/{domain}/` and includes them into nginx.

For user `admin`, domain `renderer.swiipt.com`, the files are at:

```
/home/admin/conf/web/renderer.swiipt.com/
```

The main generated files:
- `nginx.conf` — the HTTP (port 80) server block
- `nginx.ssl.conf` — the HTTPS (port 443) server block
- `nginx.conf_custom` — the file you wrote (custom directives)
- `apache2.conf` — the backend Apache block (Hestia runs nginx → Apache)

Hestia copies these into `/etc/nginx/conf.d/` (or references them via include).

---

## Run these commands on the VPS (as root) and paste the output

```bash
echo "===== 1. List the domain config folder ====="
ls -la /home/admin/conf/web/renderer.swiipt.com/

echo ""
echo "===== 2. The nginx.conf_custom file you wrote ====="
cat /home/admin/conf/web/renderer.swiipt.com/nginx.conf_custom

echo ""
echo "===== 3. The generated HTTP nginx.conf ====="
cat /home/admin/conf/web/renderer.swiipt.com/nginx.conf

echo ""
echo "===== 4. The generated HTTPS nginx.ssl.conf ====="
cat /home/admin/conf/web/renderer.swiipt.com/nginx.ssl.conf

echo ""
echo "===== 5. Where does nginx include Hestia configs? ====="
grep -rn "renderer.swiipt.com" /etc/nginx/ 2>/dev/null | head -20

echo ""
echo "===== 6. What's actually in /etc/nginx/conf.d/ ====="
ls -la /etc/nginx/conf.d/
grep -rln "renderer.swiipt.com" /etc/nginx/conf.d/ 2>/dev/null

echo ""
echo "===== 7. Verify domain in Hestia ====="
v-list-web-domain admin renderer.swiipt.com

echo ""
echo "===== 8. Test nginx config syntax (do not reload) ====="
nginx -t
```

---

## What I'm looking for

The key question: **does Hestia include `nginx.conf_custom` into the generated server block?**

Two possible outcomes:

### Outcome A — nginx.conf_custom is NOT included
The generated `nginx.conf` / `nginx.ssl.conf` won't contain your `location / { proxy_pass ... }` block. That's why we get 404.

**Fix:** Hestia only includes `nginx.conf_custom` when the domain uses the "default" web template AND the file exists BEFORE `v-rebuild-web-domains`. We need to confirm the file was written before the last rebuild. If the file exists but rebuild didn't pick it up, re-run: `v-rebuild-web-domains admin`.

### Outcome B — nginx.conf_custom IS included, but conflicts with Hestia's `location /`
Hestia's generated config already has a `location / { ... }` block (for serving static files / proxying to Apache). nginx does not allow two `location /` blocks in one server — this would make `nginx -t` fail, or the custom block is silently ignored.

**Fix:** Instead of `location /`, use exact-match locations that don't conflict:
```nginx
location = /health {
    proxy_pass http://127.0.0.1:8765;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
location = /render {
    proxy_pass http://127.0.0.1:8765;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
location /render/ {
    proxy_pass http://127.0.0.1:8765;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```

Exact-match (`location = /health`) and prefix-match (`location /render/`) locations take priority over Hestia's `location /`, so they won't conflict. Everything else stays on Hestia's normal handling.

---

## The rule I'm following (from the report)

> "Do NOT replace the nginx default server and do NOT alter existing websites."
> "Once you identify the correct Hestia-compatible configuration/template, show me the proposed change before making it."

So: I will NOT propose the final config until I see the diagnostic output (especially items 2, 3, 4, 6, 8). Then I'll show you the exact file change and get your OK before applying it.

---

## Paste back to me

- Output of items 1–8 above
- (Especially important: items 3, 4, and 8 — the generated nginx configs and the `nginx -t` result)
