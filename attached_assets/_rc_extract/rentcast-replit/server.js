/*
 * Rental City — Rental Value Report  ·  RentCast proxy server
 * ----------------------------------------------------------------
 * Serves the single-file lead magnet (public/index.html) and exposes
 * ONE endpoint, POST /api/estimate, which calls RentCast server-side
 * so your API key is never exposed to the browser.
 *
 * Node 18+ (Replit default is fine). No build step.
 */

var express = require('express');
var path = require('path');
var fs = require('fs');

var app = express();
var PORT = process.env.PORT || 3000;

var RENTCAST_API_KEY = process.env.RENTCAST_API_KEY || '';
var LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL || ''; // optional: HubSpot/Zapier/etc.

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---- helper: append the lead to a local file (simple, durable on Replit) ---- */
function captureLead(input, result) {
  var record = {
    ts: new Date().toISOString(),
    email: input.email || '',
    address: input.address || '',
    propertyType: input.propertyType || '',
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    squareFootage: input.squareFootage,
    rent: result ? result.rent : null,
    rentRangeLow: result ? result.rentRangeLow : null,
    rentRangeHigh: result ? result.rentRangeHigh : null
  };

  // 1) durable local log — one JSON object per line
  try {
    fs.appendFileSync(path.join(__dirname, 'leads.ndjson'), JSON.stringify(record) + '\n');
  } catch (e) {
    console.error('lead log error:', e.message);
  }

  // 2) optional webhook (HubSpot, Zapier, Make, your CRM…)
  if (LEAD_WEBHOOK_URL) {
    fetch(LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(function (e) { console.error('webhook error:', e.message); });
  }
}

/* ---- POST /api/estimate ---- */
app.post('/api/estimate', function (req, res) {
  var b = req.body || {};

  if (!RENTCAST_API_KEY) {
    return res.status(500).json({ error: 'missing_api_key', message: 'Set RENTCAST_API_KEY in Replit Secrets.' });
  }
  if (!b.address) {
    return res.status(400).json({ error: 'missing_address' });
  }

  // RentCast long-term rent estimate (AVM)
  // Docs: https://developers.rentcast.io/reference/value-estimate-long-term-rent
  var qs = new URLSearchParams();
  qs.set('address', b.address);
  if (b.propertyType)  qs.set('propertyType', b.propertyType);
  if (b.bedrooms != null)  qs.set('bedrooms', String(b.bedrooms));
  if (b.bathrooms != null) qs.set('bathrooms', String(b.bathrooms));
  if (b.squareFootage)     qs.set('squareFootage', String(b.squareFootage));
  qs.set('compCount', '12'); // up to 25

  var url = 'https://api.rentcast.io/v1/avm/rent/long-term?' + qs.toString();

  fetch(url, {
    method: 'GET',
    headers: { 'X-Api-Key': RENTCAST_API_KEY, 'Accept': 'application/json' }
  })
    .then(function (r) {
      return r.json().then(function (json) { return { ok: r.ok, status: r.status, json: json }; });
    })
    .then(function (out) {
      if (!out.ok) {
        console.error('RentCast error', out.status, out.json);
        return res.status(out.status).json({ error: 'rentcast_error', detail: out.json });
      }
      // RentCast returns: { rent, rentRangeLow, rentRangeHigh, latitude, longitude, comparables: [...] }
      captureLead(b, out.json);
      res.json(out.json);
    })
    .catch(function (err) {
      console.error('upstream failure', err);
      res.status(502).json({ error: 'upstream_failure', message: String(err) });
    });
});

/* ---- health check ---- */
app.get('/api/health', function (req, res) {
  res.json({ ok: true, hasKey: !!RENTCAST_API_KEY });
});

app.listen(PORT, function () {
  console.log('Rental City rental-value app listening on port ' + PORT);
  if (!RENTCAST_API_KEY) console.log('⚠  RENTCAST_API_KEY not set — /api/estimate will return 500 until you add it.');
});
