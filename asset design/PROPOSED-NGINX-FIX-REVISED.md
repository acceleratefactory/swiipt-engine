# Proposed fix (REVISED) — proxy /health and /render to gunicorn

**Date:** 2026-08-28
**Status:** Proposed for your review — do NOT apply until you approve.

---

## Corrections incorporated from your report

1. **Two separate custom files** — Hestia includes them into DIFFERENT server blocks:
   - `nginx.conf_custom` → included in the **HTTP** server block only
   - `nginx.ssl.conf_custom` → included in the **HTTPS** server block only
   
   Both files are needed because our primary test is `https://renderer.swiipt.com/health`.

2. **Remove `location /render/`** — query strings don't need a separate location. Only exact matches for `/health` and `/render`.

3. **Plain `proxy_pass http://127.0.0.1:8765;`** — no Markdown link syntax in the nginx file.

4. **Safer workflow** — do NOT run `v-rebuild-web-domains` blindly. The custom include mechanism is already in the generated config (`include .../nginx.conf_*` and `include .../nginx.ssl.conf_*`), so once the files exist we can test with just a reload:
   
   `write custom files → inspect generated config → nginx -t → reload → curl`

---

## File 1 — HTTP server block

**Path:** `/home/tenderhidigital1/conf/web/renderer.swiipt.com/nginx.conf_custom`

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
```

---

## File 2 — HTTPS server block

**Path:** `/home/tenderhidigital1/conf/web/renderer.swiipt.com/nginx.ssl.conf_custom`

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
```

---

## The exact commands to run (safe workflow)

```bash
# 1. Write the HTTP custom file
cat > /home/tenderhidigital1/conf/web/renderer.swiipt.com/nginx.conf_custom <<'EOF'
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
EOF

# 2. Write the HTTPS custom file
cat > /home/tenderhidigital1/conf/web/renderer.swiipt.com/nginx.ssl.conf_custom <<'EOF'
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
EOF

# 3. Inspect the generated config — verify both custom locations appear in BOTH server blocks
echo "=== HTTP generated config ==="
cat /etc/nginx/conf.d/domains/renderer.swiipt.com.conf 2>/dev/null | grep -A 12 "location = /health" | head -30
grep -n "nginx.conf_custom" /etc/nginx/conf.d/domains/renderer.swiipt.com.conf 2>/dev/null
echo ""
echo "=== HTTPS generated config ==="
cat /etc/nginx/conf.d/domains/renderer.swiipt.com.ssl.conf 2>/dev/null | grep -A 12 "location = /health" | head -30
grep -n "nginx.ssl.conf_custom" /etc/nginx/conf.d/domains/renderer.swiipt.com.ssl.conf 2>/dev/null

# 4. Test nginx config
nginx -t

# 5. If nginx -t says OK, reload nginx
systemctl reload nginx
sleep 2

# 6. Test both endpoints
echo "=== HTTP test ==="
curl -i http://renderer.swiipt.com/health
echo ""
echo "=== HTTPS test ==="
curl -i https://renderer.swiipt.com/health
```

---

## Expected results

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

Then test the render endpoint:
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

## Safety notes

- Only `/health` and `/render` route to gunicorn via exact-match (`=`) — highest priority, no conflict with Hestia's `location /`
- Nothing else on the VPS is affected
- Hestia won't overwrite the custom files (they're persistent)
- We verify the generated config contains both blocks BEFORE reloading
- We do NOT run `v-rebuild-web-domains` (avoids rebuilding all of tenderhidigital1's domains)
- If `nginx -t` fails, we stop and diagnose — no harm done

---

## The target architecture

```
                    renderer.swiipt.com
                           │
                      Hestia Nginx
                           │
              ┌─────────────┴─────────────┐
              │                           │
           /health                     /render
              │                           │
              └──────────┬────────────────┘
                         ▼
                  127.0.0.1:8765
                         │
                      Gunicorn
                         │
                     WeasyPrint
```

---

## What I need from you

1. **Approve** the revised configuration (both files)
2. Run the commands on the VPS
3. Paste the output of the inspection (step 3), `nginx -t` (step 4), and both curl tests (step 6)

Then I'll proceed to the cPanel side (update `swt_render_endpoint`, run the health check, generate the PDF).
