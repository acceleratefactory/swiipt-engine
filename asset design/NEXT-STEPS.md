# Next Steps After VPS-Hestia Setup

**Date:** 2026-08-28
**For:** Swiipt platform owner
**Status:** Awaiting your confirmation that the VPS-Hestia steps worked (curl /health returned the JSON).

---

## What I need from you now

You said you ran the VPS-Hestia steps. Please paste back the output of this command (from the VPS):

```bash
curl -i http://renderer.swiipt.com/health
```

I'm expecting something like:

```
HTTP/1.1 200 OK
Content-Type: application/json

{"engine":"weasyprint","status":"ok"}
```

If you get that → great, the VPS side is working and I'll proceed to the cPanel side.

If you get a 404, a connection error, or the "Success!" default page → paste the output and I'll diagnose further.

---

## Once the VPS is confirmed working, the next steps are:

### Step 1: I update the cPanel to use the new hostname

You don't need to do anything here. I'll paste this into the Novamira `execute-php`:

```php
update_option( 'swt_render_endpoint', 'https://renderer.swiipt.com/render' );
// (the existing swt_render_api_key is correct, do NOT change it)
```

### Step 2: I verify the cPanel → VPS connection

I'll run a health check from the cPanel to confirm the full path works:

```php
$h = swt_eb2_remote_health();
// Expected: { "ok": true, "info": "weasyprint" }
```

### Step 3: I generate the V06 PDF through the full pipeline

```php
$pdf = swt_eb2_remote_pdf(null);
file_put_contents('uploads/swt-stage/ebook-pipeline/v06-ebook-from-vps.pdf', $pdf);
```

### Step 4: I verify the PDF matches the golden

- Count pages (must be 24)
- Rasterize with Ghostscript
- Compare against `golden-output/Every-Night-Just-Me-V06.pdf` page-by-page

### Step 5: I report the results

If it matches → the 7 F2 corrections are verified, Task #2 is complete, we wire the new renderer into the platform.

If it doesn't match → I show you the gaps and propose fixes.

---

## Total time estimate

Once the VPS /health is confirmed:
- cPanel update: 1 minute
- PDF generation: ~2 minutes
- Rasterize + compare: ~2 minutes
- Report: 5 minutes

So roughly 10 minutes of my work after you confirm the VPS is working.

---

## What to do right now

1. SSH into the VPS as root
2. Run: `curl -i http://renderer.swiipt.com/health`
3. Paste the output back to me

That's it. I'll do the rest.
