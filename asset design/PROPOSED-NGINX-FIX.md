# Proposed fix: proxy /health and /render to gunicorn

**File to modify:** `/home/tenderhidigital1/conf/web/renderer.swiipt.com/nginx.conf_custom`

**Status:** Proposed — do NOT apply yet. Review first.

---

## Problem

The current `nginx.conf_custom` probably has `location / { proxy_pass ... }` which conflicts with Hestia's generated `location / { proxy_pass http://IP:8080; }` (which proxies to Apache). Two `location /` blocks in one server block either conflict or are silently ignored.

## Fix

Use **exact-match** locations (`=`) instead of `/`. These are more specific than `location /`, so nginx prefers them — they never conflict with Hestia's `location /`.

---

## Proposed content for `nginx.conf_custom`

Write this to `/home/tenderhidigital1/conf/web/renderer.swiipt.com/nginx.conf_custom`:

```nginx
# Swiipt PDF Renderer — proxy /health and /render to gunicorn on 127.0.0.1:8765
# Exact-match locations take priority over Hestia's location /, so no conflict.
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
    client_max_body_size 10M;
}

# Also match /render/ with sub-path (for any future query params)
location /render/ {
    proxy_pass http://127.0.0.1:8765;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 10M;
}
```

---

## Why this is safe

- **Exact-match `=`** means only the literal path `/health` matches — not `/healthsomething`, not `/health/anything`
- **Exact-match takes highest priority** in nginx, so it overrides Hestia's `location /` for just these two paths
- **Everything else** (all other paths on `renderer.swiipt.com`) still goes through Hestia's normal Apache proxy — no disruption
- **The custom file** is included in both HTTP and HTTPS server blocks, so one change covers both
- **Hestia won't overwrite it** — `nginx.conf_custom` is persistent across rebuilds

---

## How to apply

If you approve, run these commands on the VPS:

```bash
# 1. Write the custom config
cat > /home/tenderhidigital1/conf/web/renderer.swiipt.com/nginx.conf_custom <<'EOF'
# Swiipt PDF Renderer — proxy /health and /render to gunicorn on 127.0.0.1:8765
# Exact-match locations take priority over Hestia's location /, so no conflict.
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
    client_max_body_size 10M;
}

location /render/ {
    proxy_pass http://127.0.0.1:8765;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 10M;
}
EOF

# 2. Rebuild Hestia domains so it picks up the custom file
v-rebuild-web-domains tenderhidigital1

# 3. Test nginx config
nginx -t

# 4. If nginx -t says OK, reload nginx
systemctl reload nginx

# 5. Test the public endpoint
curl -i https://renderer.swiipt.com/health
```

---

## Expected result

After the fix:

```bash
curl -i https://renderer.swiipt.com/health
```

Should return:
```
HTTP/1.1 200 OK
Content-Type: application/json

{"engine":"weasyprint","status":"ok"}
```

Then you can test the render endpoint:
```bash
API_KEY=$(grep SWIIPT_API_KEY /etc/swiipt-render.env | cut -d= -f2)
curl -s -X POST \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: text/html" \
  --data '<html><body><h1>Test</h1></body></html>' \
  -o /tmp/renderer-test.pdf \
  -w "HTTP %{http_code} | %{size_download} bytes\n" \
  https://renderer.swiipt.com/render
file /tmp/renderer-test.pdf
```

Should return `HTTP 200 | 5000+ bytes` and `PDF document`.

---

## After you approve

Say "approve" and I'll give you the exact commands to paste (or you can use the ones above). Then I'll wait for your test output and proceed to the cPanel side.