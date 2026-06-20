# Rental City — Free Rental Value Report (RentCast lead magnet)

A single-page lead magnet that gives property owners an **instant rental estimate**
in exchange for their email. Real numbers come from the **RentCast API**, called
**server-side** so your API key is never exposed in the browser.

```
rentcast-replit/
├── public/
│   └── index.html        ← the lead magnet (single self-contained file)
├── server.js             ← tiny Express server + RentCast proxy
├── package.json
├── .replit               ← Replit run/deploy config
├── .env.example          ← which secrets to set
└── .gitignore
```

---

## Why a server (and not just one HTML file)?

RentCast requires a secret API key. If the browser called RentCast directly, anyone
could **View Source**, copy your key, and run up your bill — and RentCast blocks
browser (CORS) calls anyway. So the browser calls **your** server (`/api/estimate`),
and the server adds the key and calls RentCast. The key lives only in Replit Secrets.

> The page still works without a backend — if `/api/estimate` isn't reachable it shows
> a clearly-labeled **sample** estimate, so the lead magnet never looks broken in a preview.

---

## Step-by-step: deploy on Replit

### 1. Get a RentCast API key
1. Go to **https://app.rentcast.io/app/api** and create an account.
2. Create an API key. Copy it.
   - The long-term rent endpoint used here is `GET /v1/avm/rent/long-term`
     (docs: https://developers.rentcast.io/reference/value-estimate-long-term-rent).

### 2. Create the Repl
1. At **replit.com** → **Create Repl** → **Import**, or start a blank **Node.js** Repl.
2. Upload this whole `rentcast-replit/` folder (drag the files into the Repl's file tree),
   keeping `public/index.html` inside a `public/` folder.

### 3. Add your key as a Secret (NOT in code)
1. In the Repl, open the **Secrets** tool (the 🔒 lock icon in the left sidebar).
2. Add a secret:
   - **Key:** `RENTCAST_API_KEY`
   - **Value:** *(paste your RentCast key)*
3. (Optional) add `LEAD_WEBHOOK_URL` if you want every lead forwarded to HubSpot/Zapier/your CRM.

### 4. Run it
1. Press **Run**. Replit installs Express and starts the server.
2. The webview opens your page. Fill the form → you get a live RentCast estimate, and the
   lead is saved (see below).

### 5. Publish (get a public URL for your ads/funnel)
1. Click **Deploy** → choose **Autoscale** (cheapest for a form like this).
2. Replit gives you a public URL (e.g. `https://rental-value.<you>.replit.app`).
3. That URL is what you put behind your Meta/landing-page CTA.

---

## Where do the leads go?

Every successful estimate is captured two ways:

1. **`leads.ndjson`** — one JSON record per line, saved in the Repl. Download anytime.
   ```
   {"ts":"2026-…","email":"jane@…","address":"123 Main St…","rent":1850, …}
   ```
2. **Webhook (optional)** — if `LEAD_WEBHOOK_URL` is set, the same record is POSTed there
   so it lands in HubSpot/Zapier/Make/your CRM in real time, ready to trigger the
   email + SMS journey.

> To actually email the report to the owner, point `LEAD_WEBHOOK_URL` at an automation
> (e.g. a HubSpot workflow or Zapier zap) that sends the templated email. The server
> intentionally doesn't send mail itself, so you can use whatever ESP you already have.

---

## Customizing

- **Copy / brand:** edit `public/index.html` — it's the same file you reviewed, fully inline.
- **Comparable count / radius:** in `server.js`, change `qs.set('compCount', '12')` or add
  `qs.set('maxRadius', '1')` etc. (see RentCast docs for all params).
- **Fields sent to RentCast:** the form collects address, property type, beds, baths, sq ft.
  Address drives the estimate; the rest refine it.

## Local run (optional, outside Replit)

```bash
npm install
RENTCAST_API_KEY=your_key npm start
# open http://localhost:3000
```

---

© 2026 Rental City. Lead magnet built by Naked Development.
