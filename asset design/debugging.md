The six-command diagnostic confirms that the PDF renderer itself is healthy and must NOT be modified.

### What is confirmed working

Gunicorn is listening correctly:

`127.0.0.1:8765`

The renderer service is active:

`swiipt-render.service = active (running)`

Direct renderer health check works:

`curl http://127.0.0.1:8765/health`

returns:

`{"engine":"weasyprint","status":"ok"}`

The direct `/render` test also works:

HTTP 200
Content-Type: application/pdf
Valid PDF generated

Therefore DO NOT change Flask/app.py, WeasyPrint, Gunicorn, the systemd service, port 8765, or the renderer environment.

### Actual problem

The VPS is running HestiaCP-managed nginx, not a simple standalone nginx installation.

nginx is listening publicly on:

`202.61.236.135:80`

and:

`202.61.236.135:443`

while Gunicorn is correctly listening internally on:

`127.0.0.1:8765`

The nginx configuration dump shows the default server:

`listen 202.61.236.135:80 default_server;`
`server_name _;`

but there is NO renderer route containing:

`proxy_pass http://127.0.0.1:8765`

Therefore:

`Computer A → http://202.61.236.135/health → nginx → no renderer route → 404`

This is why the cPanel platform cannot reach the PDF renderer.

### Important correction

Do NOT assume `/etc/nginx/sites-enabled/` exists or that this is a conventional Ubuntu nginx sites-enabled/sites-available setup.

It does not exist:

`ls: cannot access '/etc/nginx/sites-enabled/': No such file or directory`

This VPS is Hestia-managed, and the nginx configuration is clearly generated around Hestia's domain configuration.

Do NOT blindly delete the Hestia default server or replace the entire nginx configuration.

### Required next step

Find the correct Hestia-compatible location for adding a dedicated renderer route.

The desired architecture is:

`PUBLIC INTERNET`
`      ↓`
`202.61.236.135:80`
`      ↓`
`Hestia/nginx`
`      ↓`
`location /health and /render`
`      ↓`
`proxy_pass http://127.0.0.1:8765`
`      ↓`
`Gunicorn`
`      ↓`
`Swiipt renderer / WeasyPrint`

The renderer should remain bound to `127.0.0.1:8765`. We do NOT need to expose port 8765 directly to the Internet.

### Before changing anything

Please inspect the Hestia nginx configuration/template structure and determine the safest Hestia-compatible way to create a dedicated public endpoint for this renderer.

Specifically investigate:

1. Which Hestia nginx configuration/template controls the default server on `202.61.236.135:80`.
2. Whether a dedicated hostname/subdomain can be created for the renderer.
3. Whether Hestia supports a custom nginx template/include for this purpose.
4. Whether a dedicated renderer hostname is preferable to modifying the global default server.
5. Where Hestia will preserve the configuration across rebuilds/restarts.

Do not modify existing customer websites.

### Preferred production architecture

I would prefer a dedicated hostname such as:

`renderer.swiipt.com`

or another dedicated Swiipt-controlled hostname, if DNS/SSL can be configured.

Then:

`https://renderer.swiipt.com/health`
→ nginx
→ `127.0.0.1:8765/health`

and:

`https://renderer.swiipt.com/render`
→ nginx
→ `127.0.0.1:8765/render`

The cPanel platform should then call the HTTPS hostname rather than the raw VPS IP.

This is preferable to putting `/health` and `/render` on the Hestia default server because this VPS already hosts many unrelated websites.

### Security requirement

The renderer API already uses `X-API-Key`.

Keep that authentication.

Do NOT expose an unauthenticated public `/render` endpoint.

Also do not expose port 8765 directly to the Internet.

### Required diagnostic output before making changes

Please first identify the relevant Hestia nginx configuration/template and show the exact file/path that would be modified.

Then propose the smallest safe change.

After the change, test:

`curl -i http://202.61.236.135/health`

and ideally, once HTTPS hostname is configured:

`curl -i https://renderer.swiipt.com/health`

Then test `/render` with the existing API key.

The goal is NOT merely to make the current 404 disappear. The goal is to create a durable, Hestia-compatible, authenticated public endpoint to the already-working renderer without disturbing the existing websites on this VPS.
