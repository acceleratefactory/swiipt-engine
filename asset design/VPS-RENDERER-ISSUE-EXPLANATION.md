# What's Happening: Why the PDF Renderer Isn't Working

**Date:** 2026-08-28
**For:** Swiipt platform owner
**Goal:** explain the problem in plain English, so you can understand it before running any fix.

---

## The Big Picture (in one paragraph)

We have **two separate computers** on the internet. Computer A (the cPanel) is your main website where customers visit. Computer B (the VPS) is a small helper computer that turns HTML into PDF files using a tool called WeasyPrint. The two computers need to talk to each other. We told Computer A to ask Computer B for PDFs. But Computer B isn't answering properly — it's showing a "Success! Your new web server is ready to use" page instead of the PDF-making service. So Computer A can't get PDFs.

---

## What Each Computer Does

### Computer A — cPanel (your main website)

- **IP address:** 185.146.167.204
- **What it runs:** WordPress + the Swiipt platform (where customers buy products)
- **What it needs:** When a customer buys a product, it needs to generate a PDF ebook to give them
- **How it does it now:** It builds the HTML for the ebook in PHP, then needs to send that HTML somewhere to be turned into a PDF

### Computer B — VPS (the PDF helper)

- **IP address:** 202.61.236.135
- **What it runs:** A small program (WeasyPrint) that converts HTML into PDF files
- **What it needs to do:** Receive HTML from Computer A, convert it to PDF, send the PDF back
- **How it works:**
  1. A program called **gunicorn** runs the PDF service on port 8765 (but ONLY listens to requests from itself, i.e. `127.0.0.1` — like a conversation only with itself)
  2. A program called **nginx** sits in front of gunicorn like a receptionist — it receives requests from the public internet on port 80, and forwards them to gunicorn on port 8765
  3. So: public request on port 80 → nginx (receptionist) → gunicorn (the worker) on 127.0.0.1:8765 → PDF back

---

## The Current Problem

When Computer A (cPanel) tries to call Computer B (VPS) at `http://202.61.236.135/render`, it gets back:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Success!</title>
  </head>
  <body>
    <h1>Success!</h1>
    <p>Your new web server is ready to use.</p>
  </body>
</html>
```

**This is the default "welcome" page that nginx shows when it has no website configured.** It means nginx is running, but it doesn't know it should forward PDF requests to gunicorn. Instead, it's just showing its built-in "hello" page.

So the receptionist (nginx) is at the desk, but when Computer A asks for a PDF, the receptionist just hands over a "hello, I'm here!" page instead of forwarding the request to the worker (gunicorn) who can actually make PDFs.

---

## What's Happening Behind the Scenes (technical)

When we set up Computer B (the VPS), the setup script was supposed to:

1. Install Python + WeasyPrint + Flask
2. Create a program called `app.py` that listens for PDF requests
3. Start that program using `gunicorn` on `127.0.0.1:8765`
4. Configure `nginx` to forward public requests on port 80 to gunicorn

Steps 1-3 appear to have worked — gunicorn is running and would answer if we asked it directly on `127.0.0.1:8765`.

But **step 4 didn't take effect** — the nginx configuration that forwards port 80 → port 8765 was never enabled. So nginx just shows its default page.

The exact fix the script makes:

1. Confirms gunicorn is running (starts it if not)
2. Writes a tiny nginx config file (15 lines) that says: "any request on port 80, forward to http://127.0.0.1:8765"
3. Removes the default nginx page
4. Enables our new config
5. Tests it works
6. Tries a real PDF request to confirm everything is good

---

## What Happens After the Fix

Once the script runs successfully:

1. You visit `http://202.61.236.135/health` in a browser → it shows `{"engine":"weasyprint","status":"ok"}`
2. Computer A (cPanel) can call `http://202.61.236.135/render` and get a real PDF back
3. We generate the V06 ebook PDF (24 pages, matching the golden)
4. We compare it page-by-page with the golden PDF
5. We wire it into the platform so every product gets a perfect PDF

---

## Why the Setup Script Didn't Work Originally

When the VPS was first set up, the nginx part of the setup either:

- Was skipped (the script was run partially)
- Failed silently (an error that didn't stop the script)
- Was reverted (something restored the default site after the script ran)

We don't know exactly which. The fix script handles all three cases: it re-writes the config, removes the default, and reloads nginx.

---

## What the Fix Script Does (step by step, in plain English)

The script (`fix-vps-nginx.sh`) runs 6 steps:

| Step | What it does | Why |
|---|---|---|
| 1 | Checks if gunicorn is running and starts it if not | Make sure the PDF-making program is alive |
| 2 | Lists what nginx sites are currently active | See what the problem is (default page is active) |
| 3 | Writes a small nginx config file | Tell nginx "forward all requests to gunicorn" |
| 4 | Removes the default site, enables our new site, reloads nginx | Apply the new config |
| 5 | Tests from the public IP that /health returns OK | Verify the receptionist is forwarding properly |
| 6 | Sends a real PDF request to confirm it works | End-to-end test |

**The script is safe to run** — it doesn't uninstall anything, doesn't change the Flask app, doesn't change the gunicorn setup. It only writes one config file and reloads nginx. If anything goes wrong, running it again resets things to the same state.

---

## What I Need From You

1. **Read this explanation** so you understand what we're doing
2. **Confirm you're comfortable** with the fix (it only touches nginx, not the PDF service itself)
3. **Run the script on the VPS** as root (you'll SSH into the VPS and paste the script)
4. **Paste the output of step 5** (the line that says "Testing http://202.61.236.135/health") so I can verify

After that, I take over: I re-run the cPanel-side test, then generate the V06 PDF, then compare it with the golden, page by page.

---

## Glossary (for reference)

- **VPS** = Virtual Private Server = a small rented computer that runs 24/7 in a data center
- **cPanel** = a web hosting control panel; your main website is hosted on a server managed through cPanel
- **nginx** = a popular web server (like Apache, but lighter) — handles incoming internet requests
- **gunicorn** = a Python application server — runs Python web apps (like our Flask PDF service)
- **Flask** = a simple Python web framework — our PDF API is a Flask app
- **WeasyPrint** = a Python library that converts HTML to PDF (handles flexbox, CSS variables, etc.)
- **proxy** = when one server (nginx) forwards a request to another server (gunicorn) and returns the response
- **port 80** = the standard port for unencrypted HTTP web traffic
- **port 8765** = the arbitrary port we chose for gunicorn (not standard, internal use only)
- **127.0.0.1** = "localhost" = the computer itself (gunicorn only accepts requests from the same computer)
- **default_server** = in nginx, means "this site handles requests that don't match any other site name"
