# VPS — Add renderer.swiipt.com via Hestia (step by step)

**Date:** 2026-08-28

## What we know from diagnostics

- ✅ Renderer is healthy locally: `curl http://127.0.0.1:8765/health` returns OK
- ❌ The VPS default nginx server is showing a "Success!" page (not proxying to gunicorn)
- ✅ Hestia is running on this VPS (5 users: admin, DOAKL, Grolink, numero1, tenderhidigital1)
- ✅ Many other customer sites run through Apache2 + nginx
- ✅ You own `swiipt.com` and can add a DNS A-record for `renderer.swiipt.com`

## The plan (3 steps)

1. **DNS** — add A-record for `renderer.swiipt.com` → `202.61.236.135`
2. **Hestia** — add `renderer.swiipt.com` as a web domain, with custom nginx config that proxies /health and /render to gunicorn
3. **Test** — `curl https://renderer.swiipt.com/health` should return OK, then update cPanel wp_options

This approach is safe because:
- Hestia manages nginx per-domain (no touching the default server)
- Gunicorn stays on `127.0.0.1:8765` (not exposed directly)
- Other customer sites are completely unaffected

---

## Step 1: DNS

In your DNS provider for `swiipt.com`, add:

```
Type:  A
Name:  renderer
Value: 202.61.236.135
TTL:   300 (or default)
```

This makes `renderer.swiipt.com` resolve to the VPS. (TLS/HTTPS is optional for now; HTTP works fine and the API key provides the auth.)

## Step 2: Hestia — add the domain

SSH into the VPS as root and run these commands. I've split them so you can paste the whole block at once.

```bash
# 2a. Add the web domain to Hestia (using the 'admin' user, no mail/db)
v-add-web-domain admin renderer.swiipt.com

# 2b. Confirm the domain was added
v-list-web-domain admin renderer.swiipt.com
```

You should see the domain listed with `IP: 202.61.236.135` and `ALIAS: www.renderer.swiipt.com`.

## Step 3: Hestia — add the proxy config

Hestia stores per-domain custom nginx directives in a file. The standard path for a domain owned by user `admin` is:

```
/home/admin/conf/web/renderer.swiipt.com/nginx.conf_custom
```

Write the following to that file (this adds the proxy to gunicorn, leaving everything else Hestia-managed):

```bash
cat > /home/admin/conf/web/renderer.swiipt.com/nginx.conf_custom <<'EOF'
# Swiipt PDF Renderer — proxy /health and /render to gunicorn on 127.0.0.1:8765
location / {
    proxy_pass http://127.0.0.1:8765;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 10M;
}
EOF
```

## Step 4: Rebuild + restart nginx

```bash
v-rebuild-web-domains admin
systemctl restart nginx
sleep 2
```

## Step 5: Test

```bash
# From the VPS itself:
curl -i http://renderer.swiipt.com/health
# Expected:
#   HTTP/1.1 200 OK
#   Content-Type: application/json
#   {"engine":"weasyprint","status":"ok"}

# From the VPS itself (with the API key):
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

If `curl http://renderer.swiipt.com/health` returns `{"engine":"weasyprint","status":"ok"}` with HTTP 200 — we're done with the VPS side.

## Step 6: Update cPanel wp_options

Paste this into the Novamira `execute-php`:

```php
update_option( 'swt_render_endpoint', 'https://renderer.swiipt.com/render' );
// (the existing swt_render_api_key is correct, do NOT change it)
```

Then tell me, and I'll:
1. Re-run the cPanel health check (`swt_eb2_remote_health()`)
2. Generate the V06 PDF through the full pipeline
3. Rasterize + compare against the golden page-by-page

---

## If Hestia domain-add fails or the nginx config doesn't take effect

Hestia rebuilds nginx from templates. If the custom config isn't being picked up, check:

```bash
# Where did Hestia put the final config?
grep -rn renderer.swiipt.com /etc/nginx/ 2>/dev/null | head -20
grep -rn renderer.swiipt.com /home/admin/conf/web/ 2>/dev/null

# Check the per-domain config file
cat /home/admin/conf/web/renderer.swiipt.com/nginx.conf_custom
cat /home/admin/conf/web/renderer.swiipt.com/nginx.conf 2>/dev/null | head -40

# Was the domain actually added to the IP?
v-list-web-domain admin renderer.swiipt.com
```

Paste the output and I'll diagnose further.

## What NOT to do

- ❌ Do NOT change the default nginx server (other customers' sites depend on it)
- ❌ Do NOT change gunicorn's bind address from `127.0.0.1:8765` to `0.0.0.0`
- ❌ Do NOT install a separate nginx or modify the Hestia templates
- ❌ Do NOT touch the `/etc/swiipt-render.env` API key (it's correct)
