# Agent Reach — Manual Setup Steps (Beginner Guide)

This guide covers the 3 manual steps needed to finish your Agent Reach installation.
Follow them in order. Everything else is already installed and working.

---

## Step 0: Restart your terminal

Close your current terminal / Command Prompt / VS Code window, then open a **new** one.
This makes your system pick up the new PATH entries (the folder that contains `agent-reach`,
`gh`, `yt-dlp`, etc.).

**Verify it worked.** In the new terminal run:

```
agent-reach version
```

You should see: `Agent Reach v1.5.0`
If it says "not recognized", restart again (or reboot Windows once).

---

## Step 1: Install the OpenCLI browser extension

The OpenCLI **app** is already installed on your computer. It needs one small browser
extension so it can securely talk to websites you're logged into (Reddit, Facebook,
Instagram, Bilibili subtitles, XiaoHongShu).

1. Open Google Chrome.
2. Go to this link (you can copy-paste it into the address bar):
   ```
   https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk
   ```
3. Click the blue **「添加至 Chrome / Add to Chrome」** button.
4. A popup appears asking to confirm — click **「添加扩展程序 / Add extension」**.
5. The icon shows **Added to Chrome**.

**Verify it works:** go back to your terminal and run:

```
opencli doctor
```

You want to see something like `Extension: connected`.

> If it says `Extension: disconnected` — Make sure Chrome is **still open and unlocked**,
> then run `opencli doctor` again. If Chrome isn't running at all, open it first.

> 💡 Keep Chrome open while you use OpenCLI. After this, you can search Reddit,
> Facebook, Instagram, and Bilibili subtitles just by asking your agent.

---

## Step 2: Log in to GitHub CLI (optional, recommended)

This unlocks private repos, issues, PRs, and forking for your agent. Skip this if you only
ever read open-source/public repos.

1. In your terminal, run:

   ```
   gh auth login
   ```

2. Follow the on-screen prompts:
   - **What account?** → GitHub.com
   - **Protocol?** → HTTPS (recommended)
   - **Authenticate using?** → Login with a web browser (recommended, easiest)
3. A one-time code appears (looks like `XXXX-XXXX`) with a browser tab opening.
   If the browser doesn't auto-open, press `Enter` to get the URL and open it manually.
4. Enter the code on the GitHub page, then click **Authorize**.
5. Confirm "✓ Logged in as **your-username**" in the terminal.

**Verify it works:**

```
gh auth status
```

You should see a `Logged in to github.com account your-username` line.

---

## Step 3: Optional extras you may want later

These are NOT required. Your agent can do them whenever you ask, but bookmarking the idea:

| Want this | Say this to your agent |
|---|---|
| Twitter/X tweet search | `帮我配 Twitter` |
| XiaoHongShu (小红书) | `帮我配小红书` |
| Reddit posts & comments | `帮我配 Reddit` |
| Facebook posts/groups | `帮我配 Facebook` |
| Instagram users/posts | `帮我配 Instagram` |
| Xueqiu (雪球 stock quotes) | `帮我配雪球` |
| Xiaoyuzhou podcast transcription | `帮我配小宇宙播客` (needs a free Groq key) |
| LinkedIn profiles/jobs | `帮我配 LinkedIn` |

> For cookie-based platforms (Twitter, Xiaohongshu, Reddit, Facebook, Instagram),
> it is strongly recommended to use a **secondary/dedicated account**, not your main one —
> automated access risks an account ban, and a cookie leak would only cost you a throwaway
> account.

---

## Step 4: Log in to cookie-based platforms (Twitter, Instagram, Facebook, Reddit, 小红书)

The OpenCLI **Browser Bridge** does NOT require you to paste cookies manually. It reuses
the sessions you are already logged into inside Chrome — the same Chrome where you installed
the extension (Step 1). So "logging in" just means logging into the website normally.

1. Confirm the extension shows `Extension: connected` (`opencli doctor`, Step 1).
2. Open a **normal Chrome tab** and log into the site the usual way:
   - Twitter/X → https://x.com
   - Instagram → https://instagram.com
   - Facebook → https://facebook.com
   - Reddit → https://reddit.com
   - 小红书 → https://xiaohongshu.com
3. **Stay logged in.** Keep the session active — do NOT log out, and don't clear cookies.
   The agent reads these live sessions on demand; no extra config needed.
4. That's it. Ask your agent e.g. `搜一下 Twitter 上关于 AI 的讨论` and OpenCLI will use
   your live Chrome login automatically.

> 🔐 **Strongly recommended: use a dedicated/secondary account**, not your main one.
> Automated access risks an account ban, and a leaked cookie would only cost you a throwaway
> account. See the note at the end of Step 3.

**Alternative — manual cookie export (only if the live session is blocked):**
If a site rejects the bridge or you want to pin a specific login, install the
[Cookie-Editor](https://chromewebstore.google.com/detail/cookie-editor) extension, log into
the site in Chrome, click Cookie-Editor → **Export** (JSON), and hand that JSON to your agent
to configure the channel. Prefer the live-session method above whenever possible.

**Verify it works:** with the site open and logged in, ask your agent to fetch something from
that platform. If it fails with "not logged in / extension not connected", re-run
`opencli doctor` and confirm Chrome is open and `Extension: connected`.

---

## Final verification checklist

After Steps 1–3, run this one command and confirm the checks:

```
agent-reach doctor
```

Target state:

| Channel | Status |
|---|---|
| YouTube / V2EX / RSS / B站 / 任意网页 | ✅ 可用 |
| GitHub | [!] or ✅ once logged in (Step 2) |
| 全网语义搜索 (Exa) | already configured & live-tested |
| Reddit / Facebook / Instagram / 小红书 | 🟢 once Chrome extension shows `connected` in `opencli doctor` (Step 1) |

---

## Troubleshooting

**`agent-reach` is not recognized**
→ You didn't start a fresh terminal (re-do Step 0), or you were on a Windows account without
   the `AppData\Roaming\Python\Python313\Scripts` folder in PATH yet.

**`gh` is not recognized** (but you did Step 2)
→ Restart terminal after installing. If still missing, reboot Windows.

**OpenCLI says Extension: disconnected**
→ Chrome must be **open** and unlocked. Reload the page you're on, then re-run `opencli doctor`.

**Slow downloads / pip timeouts** (only for future installs)
→ The machine has a slow network; use long timeouts:
   ```
   py -3 -m pip install <package> --timeout 600 --retries 10
   ```

**Something else broken?**
→ Run `agent-reach doctor` and paste the output to your agent — it prints the exact fix.