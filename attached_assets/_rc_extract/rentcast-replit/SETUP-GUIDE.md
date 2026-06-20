# Rental City — Replit Setup Guide (Rental Value Report)

Step-by-step to get the lead magnet live on Replit with real RentCast data.
Total time: ~10 minutes.

---

## What you're deploying

A one-page lead magnet where a property owner enters their address and gets an
instant rental estimate in exchange for their email. The estimate is **real**
(RentCast API), called from a small server so your API key stays private. Every
submission is captured as a lead.

```
rentcast-replit/
├── public/
│   └── index.html      ← the page visitors see (single self-contained file)
├── server.js           ← server + RentCast proxy + lead capture
├── package.json        ← dependencies (Express)
├── .replit             ← tells Replit how to run/deploy
├── .env.example        ← which secrets to add (reference only)
└── .gitignore
```

---

## STEP 1 — Get a RentCast API key

1. Go to **https://app.rentcast.io/app/api** and sign up.
2. Create an API key and copy it somewhere safe.
3. Note the free tier limit (RentCast gives a monthly allotment of calls; each
   estimate = 1 call). Upgrade later if your ad traffic exceeds it.

---

## STEP 2 — Create the Repl

**Option A — upload the folder (simplest)**
1. At **replit.com**, click **Create Repl** → choose the **Node.js** template → Create.
2. In the file tree, delete the sample `index.js` if present.
3. Drag every file from `rentcast-replit/` into the Repl, keeping the structure —
   `index.html` must stay inside a **`public/`** folder.

**Option B — from GitHub**
1. Push `rentcast-replit/` to a GitHub repo.
2. In Replit: **Create Repl → Import from GitHub** → paste the repo URL.

---

## STEP 3 — Add your API key as a Secret

> Never paste the key into code. Replit Secrets are injected as environment
> variables at runtime and stay private.

1. In the Repl's left sidebar, open **Secrets** (the 🔒 lock icon).
2. Click **New Secret** and add:
   - **Key:** `RENTCAST_API_KEY`
   - **Value:** *(paste your RentCast key)*
3. (Optional) Add a second secret to forward leads to your CRM/automation:
   - **Key:** `LEAD_WEBHOOK_URL`
   - **Value:** *(a HubSpot/Zapier/Make webhook URL)*

---

## STEP 4 — Run it

1. Click **Run** at the top. Replit runs `npm install` then `npm start`.
2. When the webview opens, fill the form with a real address and submit.
   - You should get a live estimate and the button changes to a re-send state.
3. If you see a "Sample estimate" note in the result, the key isn't being read —
   re-check the Secret name is exactly `RENTCAST_API_KEY`, then Stop and Run again.

Quick health check: open `/api/health` on your Repl URL — it returns
`{"ok":true,"hasKey":true}` when the key is wired correctly.

---

## STEP 5 — Publish (public URL for your funnel)

1. Click **Deploy** (top right) → choose **Autoscale** (best for a form like this —
   you pay for usage, scales to zero when idle).
2. Accept the defaults; Replit builds and gives you a public URL like
   `https://rental-value.<your-name>.replit.app`.
3. Put that URL behind your Meta ad / landing-page CTA.

> Re-deploy whenever you edit the page or copy — Deploy again and the same URL updates.

---

## STEP 6 — Collect & route the leads

Every successful estimate is saved two ways:

1. **`leads.ndjson`** in the Repl — one lead per line. Open the file or download it.
2. **Webhook** (if `LEAD_WEBHOOK_URL` is set) — the same record is POSTed in real
   time, ready to trigger the **email + SMS journey** we built.

**To actually email the report to the owner:** point `LEAD_WEBHOOK_URL` at an
automation (HubSpot workflow, Zapier zap, etc.) that sends the templated email.
The server captures and forwards the lead; your ESP sends the mail — so you keep
whatever email tool you already use.

---

## Common fixes

| Symptom | Fix |
|---|---|
| Result shows "Sample estimate" | `RENTCAST_API_KEY` missing/misspelled in Secrets → fix, Stop, Run. |
| `/api/health` shows `hasKey:false` | Same as above. |
| 400 "missing_address" | Address field was empty/too short — it's required. |
| RentCast error in console | Address couldn't be matched, or monthly quota hit — check the RentCast dashboard. |
| Page loads but form does nothing | Make sure `index.html` is inside `public/` and you pressed Run (server must be up). |

---

## Editing later

- **Copy, brand, fields:** edit `public/index.html` (everything is inline).
- **Comps / radius / params:** in `server.js`, adjust the `qs.set(...)` lines
  (e.g. `compCount`, add `maxRadius`). See RentCast docs:
  https://developers.rentcast.io/reference/value-estimate-long-term-rent

---

© 2026 Rental City · Lead magnet by Naked Development
