// Branded "Rental Value Report" generator. Produces a standalone HTML email
// summary and a standalone, shareable full report page from RentCast-derived
// data. Faithful reproduction of templates/rental-analysis-reference.html.
// No external dependencies — pure string templating.

export interface ReportInput {
  address: string
  propertyType?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  squareFootage?: number | null
  email?: string | null
}

export interface ReportComparable {
  formattedAddress?: string
  propertyType?: string
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  price?: number
  distance?: number
  daysOld?: number
  correlation?: number
}

export interface ReportData {
  rent: number
  rentRangeLow?: number | null
  rentRangeHigh?: number | null
  comparables?: ReportComparable[]
  property?: {
    propertyType?: string | null
    bedrooms?: number | null
    bathrooms?: number | null
    squareFootage?: number | null
    lotSize?: number | null
    yearBuilt?: number | null
  } | null
  market?: {
    averageRent?: number | null
    medianRent?: number | null
    averageRentPerSqft?: number | null
    averageDaysOnMarket?: number | null
    yoyChange?: number | null
    activeRentals?: number | null
    zipCode?: string | null
  } | null
  value?: { price?: number | null } | null
  rentPerSqft?: number | null
  annualGross?: number | null
  grossYield?: number | null
  confidence: number
  compCount?: number
}

export interface ReportSummary {
  rent: number
  rentRangeLow: number | null
  rentRangeHigh: number | null
  rentPerSqft: number | null
  annualGross: number | null
  confidence: number
  compCount: number
  reportUrl: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function htmlEscape(value: unknown): string {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

function fmtMoney(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return '—'
  return '$' + Math.round(n).toLocaleString('en-US')
}

function fmtMoney2(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return '—'
  return '$' + n.toFixed(2)
}

function fmtNum(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return '—'
  return Math.round(n).toLocaleString('en-US')
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (!isFiniteNumber(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%'
}

function fmtDistance(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return '—'
  return n.toFixed(1) + ' mi'
}

function isAbsoluteUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url)
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Stable, state-free report number derived from the address.
function reportNumber(address: string): string {
  let h = 0
  for (let i = 0; i < address.length; i++) {
    h = (Math.imul(h, 31) + address.charCodeAt(i)) >>> 0
  }
  const n = (h % 90000) + 10000
  return 'RC-RA-' + n
}

function confidenceLevel(pct: number): string {
  if (pct >= 85) return 'High confidence'
  if (pct >= 70) return 'Moderate confidence'
  return 'Limited confidence'
}

function sortByCorrelation(comps: ReportComparable[]): ReportComparable[] {
  return [...comps].sort((a, b) => (b.correlation ?? 0) - (a.correlation ?? 0))
}

// "3 bd · 2 ba · 1,760 sqft · 0.3 mi" — only the parts we have.
function compMeta(c: ReportComparable): string {
  const bits: string[] = []
  if (isFiniteNumber(c.bedrooms)) bits.push(`${c.bedrooms} bd`)
  if (isFiniteNumber(c.bathrooms)) bits.push(`${c.bathrooms} ba`)
  if (isFiniteNumber(c.squareFootage)) bits.push(`${fmtNum(c.squareFootage)} sqft`)
  if (isFiniteNumber(c.distance)) bits.push(fmtDistance(c.distance))
  return htmlEscape(bits.join(' · '))
}

// ---------------------------------------------------------------------------
// Email (standalone HTML, CSS inlined on elements)
// ---------------------------------------------------------------------------

const GRADIENT = 'linear-gradient(83.7338deg, #00BBFF 11.921%, #3A7AFE 90.638%)'

function buildEmail(
  input: ReportInput,
  d: Derived,
  reportUrl: string | undefined,
): string {
  const address = htmlEscape(input.address)
  const buttonHref = isAbsoluteUrl(reportUrl) ? htmlEscape(reportUrl) : '#'

  // Banner logo: absolute SVG only when we can build an absolute origin from
  // an absolute reportUrl, otherwise a plain white "Rental City" wordmark.
  let logo: string
  const origin = isAbsoluteUrl(reportUrl) ? originOf(reportUrl) : null
  if (origin) {
    logo = `<img src="${htmlEscape(origin)}/brand/rental-city-wordmark-white.svg" alt="Rental City" height="22" style="height:22px;display:block;border:0;margin:0 0 22px;" />`
  } else {
    logo = `<div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;margin:0 0 22px;">Rental City</div>`
  }

  const rangeLine =
    d.rentRangeLow != null && d.rentRangeHigh != null
      ? `<div style="font-size:14px;opacity:0.92;margin-top:6px;">Likely range ${htmlEscape(fmtMoney(d.rentRangeLow))} – ${htmlEscape(fmtMoney(d.rentRangeHigh))} &nbsp;·&nbsp; ${d.confidence}% confidence</div>`
      : `<div style="font-size:14px;opacity:0.92;margin-top:6px;">${d.confidence}% confidence</div>`

  // Stats — only those we have data for.
  const statCells: string[] = []
  if (d.rentPerSqft != null) {
    statCells.push(emailStat(fmtMoney2(d.rentPerSqft), 'Rent / sq ft'))
  }
  if (d.annualGross != null) {
    statCells.push(emailStat(fmtMoney(d.annualGross), 'Annual income'))
  }
  if (d.market && isFiniteNumber(d.market.yoyChange)) {
    statCells.push(emailStat(fmtPct(d.market.yoyChange), 'ZIP rent YoY'))
  }
  const statsBlock =
    statCells.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:1px;background:#E5E5E5;border:1px solid #E5E5E5;border-radius:12px;margin:4px 0 22px;"><tr>${statCells.join('')}</tr></table>`
      : ''

  // Top 3 comparables.
  let compsBlock = ''
  if (d.emailComps.length > 0) {
    const rows = d.emailComps
      .map((c) => {
        const addr = htmlEscape(c.formattedAddress || 'Comparable rental')
        const meta = compMeta(c)
        return `<tr><td style="padding:12px 16px;border-top:1px solid #E5E5E5;font-size:13.5px;color:#2B3245;">${addr}${
          meta ? `<br/><span style="color:#737373;font-size:12px;">${meta}</span>` : ''
        }</td><td style="padding:12px 16px;border-top:1px solid #E5E5E5;font-size:13.5px;font-weight:800;color:#0F1E3D;text-align:right;white-space:nowrap;">${htmlEscape(
          fmtMoney(c.price),
        )}</td></tr>`
      })
      .join('')
    compsBlock = `
        <p style="font-weight:700;color:#0F1E3D;margin:0 0 10px;font-size:15px;">Top comparable rentals nearby</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #E5E5E5;border-radius:12px;overflow:hidden;margin:0 0 22px;">
          <tr><td colspan="2" style="background:#F2F6FC;padding:11px 16px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#525252;">${d.emailComps.length} of ${d.compCount} comps · sorted by similarity</td></tr>
          ${rows}
        </table>`
  }

  const intro =
    d.compCount > 0
      ? `Here's your rental analysis for <b>${address}</b>. We compared your property against <b>${d.compCount} active and recent rentals</b> nearby to estimate what it could rent for today.`
      : `Here's your rental analysis for <b>${address}</b> — our estimate of what it could rent for today.`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Your rental analysis</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFD;font-family:'Inter',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#404040;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFD;"><tr><td align="center" style="padding:24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #E5E5E5;border-radius:16px;overflow:hidden;">
      <tr><td style="background:${GRADIENT};padding:30px 32px;color:#ffffff;">
        ${logo}
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.92;">Estimated monthly rent</div>
        <div style="font-size:17px;font-weight:600;margin-top:4px;">${address}</div>
        <div style="font-size:46px;font-weight:800;letter-spacing:-0.035em;line-height:1.05;margin-top:14px;">${htmlEscape(
          fmtMoney(d.rent),
        )} <span style="font-size:17px;font-weight:600;opacity:0.9;">/ month</span></div>
        ${rangeLine}
      </td></tr>
      <tr><td style="padding:28px 32px 8px;">
        <p style="font-size:15px;color:#404040;margin:0 0 16px;">Hi there,</p>
        <p style="font-size:15px;color:#404040;margin:0 0 16px;">${intro}</p>
        ${statsBlock}
        ${compsBlock}
        <p style="font-size:15px;color:#404040;margin:0 0 16px;">Your full report breaks down every comparable, your local market trend, and three specific ways to push your rent higher.</p>
        <div style="text-align:center;padding:6px 0 4px;">
          <a href="${buttonHref}" style="display:block;background:${GRADIENT};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:16px;border-radius:11px;">View your full rental report →</a>
          <p style="font-size:13px;color:#737373;margin:12px 0 0;">Ready to fill it? <a href="https://gorentalcity.com" style="color:#3A7AFE;font-weight:700;text-decoration:none;">List your property free on Rental City →</a></p>
        </div>
      </td></tr>
      <tr><td style="padding:24px 32px 30px;border-top:1px solid #E5E5E5;margin-top:22px;font-size:12px;color:#737373;line-height:1.6;">
        <b style="color:#404040;">Rental City</b> · The leasing-agent-free rental platform · Memphis, TN<br/>
        Estimate based on RentCast market data. For informational purposes only — not an appraisal or guarantee of rent.
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`
}

function emailStat(value: string, label: string): string {
  return `<td width="33.33%" style="background:#ffffff;padding:16px 14px;text-align:center;"><div style="font-size:19px;font-weight:800;color:#0F1E3D;letter-spacing:-0.02em;">${htmlEscape(
    value,
  )}</div><div style="font-size:10.5px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#737373;margin-top:4px;">${htmlEscape(
    label,
  )}</div></td>`
}

// ---------------------------------------------------------------------------
// Report (standalone HTML page, CSS in <style>)
// ---------------------------------------------------------------------------

const REPORT_CSS = `
  :root {
    --primary: #3A7AFE;
    --primary-light: #00BBFF;
    --gradient-primary: linear-gradient(83.7338deg, #00BBFF 11.921%, #3A7AFE 90.638%);
    --ink: #0F1E3D;
    --n700: #2B3245;
    --n600: #404040;
    --n500: #525252;
    --n400: #737373;
    --n300: #A3A3A3;
    --n100: #E5E5E5;
    --bg: #F8FAFD;
    --bg-soft2: #F2F6FC;
    --accepted-text: #0E7B20;
    --tint-blue: rgba(58,122,254,0.08);
    --tint-blue-border: rgba(58,122,254,0.22);
    --mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg);
    font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color: var(--n600); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
    line-height: 1.55;
  }
  img { display: block; max-width: 100%; }
  h1,h2,h3,h4 { color: var(--ink); margin: 0; }

  .report {
    max-width: 980px; margin: 28px auto; background: #fff;
    border: 1px solid var(--n100); border-radius: 18px; overflow: hidden;
    box-shadow: 0 40px 90px -55px rgba(15,30,61,0.35);
  }
  .rep-head { background: var(--ink); color: #fff; padding: 36px 44px; position: relative; overflow: hidden; }
  .rep-head::after { content:""; position:absolute; inset:0; background: radial-gradient(600px 280px at 88% -20%, rgba(0,187,255,0.22), transparent 60%); }
  .rep-head-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; position: relative; }
  .rep-head-top img { height: 26px; }
  .rep-head-top .meta { text-align: right; font-family: var(--mono); font-size: 11px; letter-spacing: 0.06em; color: rgba(255,255,255,0.7); line-height: 1.7; }
  .rep-head-top .meta b { color: #fff; font-weight: 500; }
  .rep-title { position: relative; margin-top: 28px; }
  .rep-title .k { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--primary-light); }
  .rep-title h2 { color: #fff; font-size: clamp(24px,3vw,32px); font-weight: 800; letter-spacing: -0.03em; margin: 10px 0 0; }
  .rep-title .sub { color: rgba(255,255,255,0.72); font-size: 15px; margin-top: 8px; }

  .rep-section { padding: 40px 44px; border-bottom: 1px solid var(--n100); }
  .rep-section:last-child { border-bottom: 0; }
  .rep-section-h { display: flex; align-items: baseline; gap: 12px; margin-bottom: 22px; }
  .rep-section-h .num { font-family: var(--mono); font-size: 12px; color: var(--primary); font-weight: 500; }
  .rep-section-h h3 { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; }
  .rep-section-h .src { margin-left: auto; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--n300); }

  .est-row { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 28px; align-items: center; }
  .est-big .k { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--n400); }
  .est-big .v { font-size: 58px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; margin-top: 8px; }
  .est-big .v .grad { background: var(--gradient-primary); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .est-big .v .per { font-size: 20px; font-weight: 600; color: var(--n400); letter-spacing: 0; }
  .est-range { margin-top: 18px; }
  .est-range .rl { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: var(--n500); margin-bottom: 8px; }
  .est-range .track { height: 8px; border-radius: 100px; background: var(--n100); position: relative; overflow: hidden; }
  .est-range .fill { position: absolute; top: 0; bottom: 0; left: 16%; right: 16%; background: var(--gradient-primary); border-radius: 100px; }
  .est-range .mid { position: absolute; top: -3px; bottom: -3px; left: 50%; width: 3px; transform: translateX(-50%); background: var(--ink); border-radius: 2px; }
  .conf-box { background: var(--bg-soft2); border: 1px solid var(--tint-blue-border); border-radius: 14px; padding: 22px 24px; }
  .conf-box .ct { display: flex; justify-content: space-between; align-items: baseline; }
  .conf-box .ct .lab { font-size: 13px; font-weight: 700; color: var(--ink); }
  .conf-box .ct .pct { font-size: 26px; font-weight: 800; letter-spacing: -0.03em; background: var(--gradient-primary); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .conf-box .track { height: 7px; border-radius: 100px; background: #fff; border: 1px solid var(--n100); margin: 12px 0 12px; overflow: hidden; }
  .conf-box .bar { height: 100%; background: var(--gradient-primary); border-radius: 100px; }
  .conf-box p { font-size: 12.5px; color: var(--n500); margin: 0; }

  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .metric { border: 1px solid var(--n100); border-radius: 14px; padding: 20px; background: #fff; }
  .metric .mk { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--n400); }
  .metric .mv { font-size: 24px; font-weight: 800; letter-spacing: -0.025em; color: var(--ink); margin-top: 8px; }
  .metric .mv small { font-size: 13px; font-weight: 600; color: var(--n400); }
  .metric .mnote { font-size: 12px; color: var(--n400); margin-top: 4px; }
  .metric.good .mv { color: var(--accepted-text); }

  .prop { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--n100); border: 1px solid var(--n100); border-radius: 14px; overflow: hidden; }
  .prop .pc { background: #fff; padding: 18px 20px; }
  .prop .pk { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--n400); }
  .prop .pv { font-size: 16px; font-weight: 700; color: var(--ink); margin-top: 5px; }

  .comp-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .comp-table thead th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--n400); padding: 0 14px 12px; border-bottom: 1px solid var(--n100); }
  .comp-table thead th.r, .comp-table tbody td.r { text-align: right; }
  .comp-table tbody td { padding: 14px; border-bottom: 1px solid var(--n100); color: var(--n600); vertical-align: middle; }
  .comp-table tbody tr:last-child td { border-bottom: 0; }
  .comp-table .addr { font-weight: 600; color: var(--ink); }
  .comp-table .addr small { display: block; color: var(--n400); font-weight: 500; font-size: 12px; margin-top: 2px; }
  .comp-table .rent { font-weight: 800; color: var(--ink); }
  .comp-subj td { background: var(--tint-blue); }
  .comp-subj .addr { color: var(--primary); }
  .badge-subj { display: inline-block; font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; background: var(--gradient-primary); color: #fff; padding: 2px 7px; border-radius: 100px; margin-left: 8px; vertical-align: 1px; }

  .market { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 28px; align-items: center; }
  .market-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .ms { border: 1px solid var(--n100); border-radius: 12px; padding: 16px 18px; }
  .ms .k { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--n400); }
  .ms .v { font-size: 22px; font-weight: 800; letter-spacing: -0.025em; color: var(--ink); margin-top: 6px; }
  .ms .v small { font-size: 12px; font-weight: 600; color: var(--n400); }
  .ms .v .up { color: var(--accepted-text); }
  .market-note { background: var(--bg-soft2); border-radius: 14px; padding: 22px 24px; }
  .market-note h4 { font-size: 15px; font-weight: 800; margin-bottom: 8px; }
  .market-note p { font-size: 13.5px; color: var(--n500); margin: 0; line-height: 1.6; }

  .recs { display: grid; gap: 12px; }
  .rec { display: grid; grid-template-columns: 30px 1fr auto; gap: 16px; align-items: center; padding: 18px 20px; border: 1px solid var(--n100); border-radius: 14px; }
  .rec .ic { width: 30px; height: 30px; border-radius: 9px; background: var(--tint-blue); display: flex; align-items: center; justify-content: center; }
  .rec .ic svg { width: 16px; height: 16px; color: var(--primary); }
  .rec .rt b { color: var(--ink); font-weight: 700; }
  .rec .rt p { margin: 2px 0 0; font-size: 13.5px; color: var(--n500); }
  .rec .gain { font-size: 14px; font-weight: 800; color: var(--accepted-text); white-space: nowrap; }

  .rep-cta { background: var(--gradient-primary); padding: 44px; color: #fff; position: relative; overflow: hidden; text-align: center; }
  .rep-cta::after { content:""; position:absolute; inset:0; background: radial-gradient(500px 240px at 50% 130%, rgba(255,255,255,0.18), transparent 60%); }
  .rep-cta > * { position: relative; }
  .rep-cta .k { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.9; }
  .rep-cta h3 { color: #fff; font-size: clamp(24px,3vw,30px); font-weight: 800; letter-spacing: -0.03em; margin: 12px 0 0; }
  .rep-cta h3 em { font-style: italic; opacity: 0.78; }
  .rep-cta p { color: rgba(255,255,255,0.9); font-size: 15px; max-width: 480px; margin: 12px auto 24px; }
  .rep-cta a { display: inline-flex; align-items: center; gap: 10px; background: #fff; color: var(--primary); font-weight: 800; font-size: 16px; padding: 16px 30px; border-radius: 11px; text-decoration: none; }
  .rep-cta a svg { width: 18px; height: 18px; }
  .rep-cta .reassure { font-size: 12.5px; color: rgba(255,255,255,0.82); margin: 16px 0 0; }

  .rep-method { padding: 26px 44px; background: var(--bg-soft2); }
  .rep-method h4 { font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--n500); margin-bottom: 10px; }
  .rep-method p { font-size: 12.5px; color: var(--n400); margin: 0 0 6px; line-height: 1.6; }
  .rep-method .pw { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--n600); }

  .doc-foot { max-width: 980px; margin: 0 auto; padding: 0 32px 64px; font-size: 12px; color: var(--n400); }

  @media (max-width: 720px) {
    .est-row, .market { grid-template-columns: 1fr; }
    .metrics { grid-template-columns: 1fr 1fr; }
    .prop { grid-template-columns: 1fr 1fr; }
    .rep-section, .rep-head, .rep-cta, .rep-method { padding-left: 24px; padding-right: 24px; }
    .market-stats { grid-template-columns: 1fr 1fr; }
    .comp-hide { display: none; }
    .rec { grid-template-columns: 30px 1fr; }
    .rec .gain { grid-column: 2; }
  }
`

function buildReportPage(
  input: ReportInput,
  d: Derived,
  reportUrl?: string,
): string {
  const address = htmlEscape(input.address)
  const shareUrl = isAbsoluteUrl(reportUrl) ? htmlEscape(reportUrl) : 'https://value.gorentalcity.com/'
  const shareImage = 'https://value.gorentalcity.com/rental-report-share.png'

  // Property subtitle line under the address.
  const prop = d.property
  const subBits: string[] = []
  if (prop?.propertyType) subBits.push(htmlEscape(prop.propertyType))
  else if (input.propertyType) subBits.push(htmlEscape(input.propertyType))
  const beds = prop?.bedrooms ?? input.bedrooms
  const baths = prop?.bathrooms ?? input.bathrooms
  const sqft = prop?.squareFootage ?? input.squareFootage
  if (isFiniteNumber(beds)) subBits.push(`${beds} bed`)
  if (isFiniteNumber(baths)) subBits.push(`${baths} bath`)
  if (isFiniteNumber(sqft)) subBits.push(`${fmtNum(sqft)} sq ft`)
  if (prop && isFiniteNumber(prop.yearBuilt)) subBits.push(`Built ${prop.yearBuilt}`)
  const subLine = subBits.length ? `<div class="sub">${subBits.join(' · ')}</div>` : ''

  let sectionNum = 0
  const num = () => String(++sectionNum).padStart(2, '0')

  const sections: string[] = []

  // Estimated rent
  const low = d.rentRangeLow ?? d.rent
  const high = d.rentRangeHigh ?? d.rent
  const confText = (() => {
    let t = `${confidenceLevel(d.confidence)} — based on ${d.compCount} comparable rental${d.compCount === 1 ? '' : 's'} within 1 mile`
    if (d.market && isFiniteNumber(d.market.averageDaysOnMarket)) {
      t += `, with a median ${Math.round(d.market.averageDaysOnMarket)} days on market`
    }
    return t + '.'
  })()
  sections.push(`
  <div class="rep-section">
    <div class="rep-section-h"><span class="num">${num()}</span><h3>Estimated rent</h3><span class="src">RentCast · /avm/rent</span></div>
    <div class="est-row">
      <div class="est-big">
        <div class="k">Estimated monthly rent</div>
        <div class="v"><span class="grad">${htmlEscape(fmtMoney(d.rent))}</span><span class="per"> / month</span></div>
        <div class="est-range">
          <div class="rl"><span>${htmlEscape(fmtMoney(low))}</span><span style="color:var(--ink);">Estimate</span><span>${htmlEscape(fmtMoney(high))}</span></div>
          <div class="track"><span class="fill"></span><span class="mid"></span></div>
        </div>
      </div>
      <div class="conf-box">
        <div class="ct"><span class="lab">Confidence score</span><span class="pct">${d.confidence}%</span></div>
        <div class="track"><span class="bar" style="width:${d.confidence}%;"></span></div>
        <p>${htmlEscape(confText)}</p>
      </div>
    </div>
  </div>`)

  // Income at a glance (metrics)
  const metricCards: string[] = []
  metricCards.push(
    `<div class="metric"><div class="mk">Rent / sq ft</div><div class="mv">${htmlEscape(
      fmtMoney2(d.rentPerSqft),
    )}</div><div class="mnote">${
      d.market && isFiniteNumber(d.market.averageRentPerSqft)
        ? `Market avg ${htmlEscape(fmtMoney2(d.market.averageRentPerSqft))}`
        : 'Per month'
    }</div></div>`,
  )
  metricCards.push(
    `<div class="metric"><div class="mk">Annual gross income</div><div class="mv">${htmlEscape(
      fmtMoney(d.annualGross),
    )}</div><div class="mnote">12 × monthly rent</div></div>`,
  )
  if (d.value && isFiniteNumber(d.value.price)) {
    metricCards.push(
      `<div class="metric"><div class="mk">Est. property value</div><div class="mv">${htmlEscape(
        fmtMoney(d.value.price),
      )}</div><div class="mnote">RentCast value AVM</div></div>`,
    )
    if (isFiniteNumber(d.grossYield)) {
      metricCards.push(
        `<div class="metric good"><div class="mk">Gross rental yield</div><div class="mv">${d.grossYield.toFixed(
          1,
        )}<small>%</small></div><div class="mnote">Annual gross ÷ value</div></div>`,
      )
    }
  }
  sections.push(`
  <div class="rep-section">
    <div class="rep-section-h"><span class="num">${num()}</span><h3>Income at a glance</h3><span class="src">Derived</span></div>
    <div class="metrics">${metricCards.join('')}</div>
  </div>`)

  // Subject property
  if (prop) {
    const pc: string[] = []
    if (prop.propertyType) pc.push(propCell('Property type', htmlEscape(prop.propertyType)))
    if (isFiniteNumber(prop.bedrooms)) pc.push(propCell('Bedrooms', String(prop.bedrooms)))
    if (isFiniteNumber(prop.bathrooms)) pc.push(propCell('Bathrooms', String(prop.bathrooms)))
    if (isFiniteNumber(prop.squareFootage)) pc.push(propCell('Living area', `${fmtNum(prop.squareFootage)} sq ft`))
    if (isFiniteNumber(prop.lotSize)) pc.push(propCell('Lot size', `${fmtNum(prop.lotSize)} sq ft`))
    if (isFiniteNumber(prop.yearBuilt)) pc.push(propCell('Year built', String(prop.yearBuilt)))
    if (pc.length > 0) {
      sections.push(`
  <div class="rep-section">
    <div class="rep-section-h"><span class="num">${num()}</span><h3>Subject property</h3><span class="src">RentCast · /properties</span></div>
    <div class="prop">${pc.join('')}</div>
  </div>`)
    }
  }

  // Comparable rentals
  if (d.reportComps.length > 0) {
    const subjBd = isFiniteNumber(beds) ? String(beds) : '—'
    const subjBa = isFiniteNumber(baths) ? String(baths) : '—'
    const subjSqft = isFiniteNumber(sqft) ? fmtNum(sqft) : '—'
    const subjPerSqft = d.rentPerSqft != null ? fmtMoney2(d.rentPerSqft) : '—'
    const subjRow = `<tr class="comp-subj">
          <td class="addr">${address} <span class="badge-subj">Subject</span></td>
          <td class="comp-hide">${subjBd} / ${subjBa}</td>
          <td class="comp-hide r">${subjSqft}</td>
          <td class="r rent">${htmlEscape(fmtMoney(d.rent))}</td>
          <td class="comp-hide r">${subjPerSqft}</td>
          <td class="r">—</td>
        </tr>`
    const rows = d.reportComps
      .map((c) => {
        const addr = htmlEscape(c.formattedAddress || 'Comparable rental')
        const smallBits: string[] = []
        if (c.propertyType) smallBits.push(htmlEscape(c.propertyType))
        if (isFiniteNumber(c.daysOld)) smallBits.push(`${c.daysOld} days listed`)
        const small = smallBits.length ? `<small>${smallBits.join(' · ')}</small>` : ''
        const bd = isFiniteNumber(c.bedrooms) ? String(c.bedrooms) : '—'
        const ba = isFiniteNumber(c.bathrooms) ? String(c.bathrooms) : '—'
        const cSqft = isFiniteNumber(c.squareFootage) ? fmtNum(c.squareFootage) : '—'
        const perSqft =
          isFiniteNumber(c.price) && isFiniteNumber(c.squareFootage) && c.squareFootage > 0
            ? fmtMoney2(c.price / c.squareFootage)
            : '—'
        return `<tr>
          <td class="addr">${addr}${small}</td>
          <td class="comp-hide">${bd} / ${ba}</td>
          <td class="comp-hide r">${cSqft}</td>
          <td class="r rent">${htmlEscape(fmtMoney(c.price))}</td>
          <td class="comp-hide r">${perSqft}</td>
          <td class="r">${htmlEscape(fmtDistance(c.distance))}</td>
        </tr>`
      })
      .join('')
    sections.push(`
  <div class="rep-section">
    <div class="rep-section-h"><span class="num">${num()}</span><h3>Comparable rentals</h3><span class="src">RentCast · comparables[]</span></div>
    <table class="comp-table">
      <thead>
        <tr>
          <th>Address</th>
          <th class="comp-hide">Bd / Ba</th>
          <th class="comp-hide r">Sq ft</th>
          <th class="r">Rent</th>
          <th class="comp-hide r">$/sqft</th>
          <th class="r">Dist.</th>
        </tr>
      </thead>
      <tbody>
        ${subjRow}
        ${rows}
      </tbody>
    </table>
  </div>`)
  }

  // Local market
  if (d.market) {
    const m = d.market
    const ms: string[] = []
    if (isFiniteNumber(m.averageRent)) ms.push(marketStat('Average rent', htmlEscape(fmtMoney(m.averageRent))))
    if (isFiniteNumber(m.medianRent)) ms.push(marketStat('Median rent', htmlEscape(fmtMoney(m.medianRent))))
    if (isFiniteNumber(m.averageRentPerSqft)) ms.push(marketStat('Market rent / sqft', htmlEscape(fmtMoney2(m.averageRentPerSqft))))
    if (isFiniteNumber(m.averageDaysOnMarket))
      ms.push(marketStat('Avg days on market', `${Math.round(m.averageDaysOnMarket)} <small>days</small>`))
    if (isFiniteNumber(m.yoyChange))
      ms.push(marketStat('Rent trend (YoY)', `<span class="up">${htmlEscape(fmtPct(m.yoyChange))}</span>`))
    if (isFiniteNumber(m.activeRentals)) ms.push(marketStat('Active rentals', htmlEscape(fmtNum(m.activeRentals))))

    if (ms.length > 0) {
      const zipLabel = m.zipCode ? ` — ZIP ${htmlEscape(m.zipCode)}` : ''
      const noteParts: string[] = []
      noteParts.push(
        `Your estimate of <b>${htmlEscape(fmtMoney(d.rent))}/mo</b> is benchmarked against current rental activity in your area.`,
      )
      if (isFiniteNumber(m.yoyChange)) {
        noteParts.push(`Rents here are ${m.yoyChange >= 0 ? 'up' : 'down'} <b>${htmlEscape(fmtPct(m.yoyChange))} year-over-year</b>.`)
      }
      if (isFiniteNumber(m.averageDaysOnMarket)) {
        noteParts.push(`Well-priced units lease in about ${Math.round(m.averageDaysOnMarket)} days.`)
      }
      sections.push(`
  <div class="rep-section">
    <div class="rep-section-h"><span class="num">${num()}</span><h3>Local market${zipLabel}</h3><span class="src">RentCast · /markets</span></div>
    <div class="market">
      <div class="market-stats">${ms.join('')}</div>
      <div class="market-note">
        <h4>What this means</h4>
        <p>${noteParts.join(' ')}</p>
      </div>
    </div>
  </div>`)
    }
  }

  // Recommendations (static)
  sections.push(`
  <div class="rep-section">
    <div class="rep-section-h"><span class="num">${num()}</span><h3>Three ways to raise your rent</h3><span class="src">Rental City</span></div>
    <div class="recs">
      <div class="rec">
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4 8 4v14M9 9h.01M9 13h.01M9 17h.01"/></svg></span>
        <div class="rt"><b>In-unit washer &amp; dryer</b><p>Comps with laundry rented for $55–$80 more per month in this ZIP.</p></div>
        <span class="gain">+$65/mo</span>
      </div>
      <div class="rec">
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z"/></svg></span>
        <div class="rt"><b>Refreshed kitchen &amp; fixtures</b><p>Updated finishes are the single biggest driver of rent-per-sqft among your comps.</p></div>
        <span class="gain">+$90/mo</span>
      </div>
      <div class="rec">
        <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s7 3 7 9c0 4-3 7-7 11-4-4-7-7-7-11 0-6 7-9 7-9z"/></svg></span>
        <div class="rt"><b>Pet-friendly listing</b><p>Allowing pets widens your applicant pool and supports a modest pet rent.</p></div>
        <span class="gain">+$40/mo</span>
      </div>
    </div>
  </div>`)

  // CTA
  sections.push(`
  <div class="rep-cta">
    <div class="k">Your next step</div>
    <h3>You know what it's worth. <em>Now fill it.</em></h3>
    <p>List your property free on Rental City and get matched with pre-screened, qualified renters. No agents. No wasted showings.</p>
    <a href="https://gorentalcity.com">List your property on Rental City
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
    </a>
    <p class="reassure">Free to list · You only pay $350 when your unit is filled · Matched in 48 hours or it's free</p>
  </div>`)

  // Methodology (static)
  sections.push(`
  <div class="rep-method">
    <h4>How this report was generated</h4>
    <p>Rent estimate, range, and comparable rentals come from the <span class="pw">RentCast</span> rental AVM (<code>/avm/rent/long-term</code>), which analyzes nearby active and recent rental listings. Property attributes are drawn from RentCast property records (<code>/properties</code>), and local market figures from RentCast market data by ZIP (<code>/markets</code>). Property value and yield use the RentCast value AVM (<code>/avm/value/long-term</code>).</p>
    <p>Estimates are for informational purposes only and are not an appraisal, guarantee, or offer of rent. Actual rent depends on condition, timing, and terms.</p>
  </div>`)

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Rental City — Rental Analysis for ${address}</title>
<meta name="description" content="Professional rental analysis for ${address} — estimated rent, range, comparable rentals, and market insights from Rental City." />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Rental City" />
<meta property="og:title" content="Rental City — Rental Analysis for ${address}" />
<meta property="og:description" content="Professional rental analysis for ${address} — estimated rent, range, comparable rentals, and market insights from Rental City." />
<meta property="og:url" content="${shareUrl}" />
<meta property="og:image" content="${shareImage}" />
<meta property="og:image:width" content="1171" />
<meta property="og:image:height" content="610" />
<meta property="og:image:alt" content="Rental City — Apply once. Match fast. Rent smarter." />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Rental City — Rental Analysis for ${address}" />
<meta name="twitter:description" content="Professional rental analysis for ${address} — estimated rent, range, comparable rentals, and market insights from Rental City." />
<meta name="twitter:image" content="${shareImage}" />
<meta name="twitter:image:alt" content="Rental City — Apply once. Match fast. Rent smarter." />

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${REPORT_CSS}</style>
</head>
<body>
<div class="report">
  <div class="rep-head">
    <div class="rep-head-top">
      <img src="/brand/rental-city-wordmark-white.svg" alt="Rental City" />
      <div class="meta">
        Report <b>${htmlEscape(d.reportNumber)}</b><br/>
        Prepared <b>${htmlEscape(d.preparedDate)}</b><br/>
        Valid <b>30 days</b>
      </div>
    </div>
    <div class="rep-title">
      <div class="k">Professional rental analysis</div>
      <h2>${address}</h2>
      ${subLine}
    </div>
  </div>
${sections.join('\n')}
</div>
<div class="doc-foot">
  © ${new Date().getFullYear()} Rental City · The leasing-agent-free rental platform · Memphis, TN. Generated from RentCast data at request time.
</div>
</body>
</html>`
}

function propCell(k: string, v: string): string {
  return `<div class="pc"><div class="pk">${htmlEscape(k)}</div><div class="pv">${v}</div></div>`
}

function marketStat(k: string, v: string): string {
  return `<div class="ms"><div class="k">${htmlEscape(k)}</div><div class="v">${v}</div></div>`
}

// ---------------------------------------------------------------------------
// Derived data + entry point
// ---------------------------------------------------------------------------

interface Derived {
  rent: number
  rentRangeLow: number | null
  rentRangeHigh: number | null
  rentPerSqft: number | null
  annualGross: number | null
  grossYield: number | null
  confidence: number
  compCount: number
  comparables: ReportComparable[]
  reportComps: ReportComparable[]
  emailComps: ReportComparable[]
  property: ReportData['property']
  market: ReportData['market']
  value: ReportData['value']
  reportNumber: string
  preparedDate: string
}

function derive(input: ReportInput, data: ReportData): Derived {
  const rent = isFiniteNumber(data.rent) ? data.rent : 0
  const sqft = data.property?.squareFootage ?? input.squareFootage ?? null

  const rentRangeLow = isFiniteNumber(data.rentRangeLow) ? data.rentRangeLow : null
  const rentRangeHigh = isFiniteNumber(data.rentRangeHigh) ? data.rentRangeHigh : null

  let rentPerSqft = isFiniteNumber(data.rentPerSqft) ? data.rentPerSqft : null
  if (rentPerSqft == null && isFiniteNumber(sqft) && sqft > 0 && rent > 0) {
    rentPerSqft = rent / sqft
  }

  let annualGross = isFiniteNumber(data.annualGross) ? data.annualGross : null
  if (annualGross == null && rent > 0) annualGross = rent * 12

  let grossYield = isFiniteNumber(data.grossYield) ? data.grossYield : null
  const value = data.value ?? null
  if (
    grossYield == null &&
    value &&
    isFiniteNumber(value.price) &&
    value.price > 0 &&
    annualGross != null
  ) {
    grossYield = (annualGross / value.price) * 100
  }

  const confidence = isFiniteNumber(data.confidence)
    ? Math.max(0, Math.min(100, Math.round(data.confidence)))
    : 0

  const comparables = Array.isArray(data.comparables) ? data.comparables : []
  const sorted = sortByCorrelation(comparables)
  const compCount = isFiniteNumber(data.compCount) ? data.compCount : comparables.length

  return {
    rent,
    rentRangeLow,
    rentRangeHigh,
    rentPerSqft,
    annualGross,
    grossYield,
    confidence,
    compCount,
    comparables,
    reportComps: sorted.slice(0, 6),
    emailComps: sorted.slice(0, 3),
    property: data.property ?? null,
    market: data.market ?? null,
    value,
    reportNumber: reportNumber(input.address),
    preparedDate: todayLabel(),
  }
}

export function buildReport(
  input: ReportInput,
  data: ReportData,
  opts?: { reportUrl?: string },
): { reportHtml: string; emailHtml: string; summary: ReportSummary } {
  const d = derive(input, data)
  const reportUrl = opts?.reportUrl

  const reportHtml = buildReportPage(input, d, reportUrl)
  const emailHtml = buildEmail(input, d, reportUrl)

  const summary: ReportSummary = {
    rent: d.rent,
    rentRangeLow: d.rentRangeLow,
    rentRangeHigh: d.rentRangeHigh,
    rentPerSqft: d.rentPerSqft,
    annualGross: d.annualGross,
    confidence: d.confidence,
    compCount: d.compCount,
    reportUrl: reportUrl ?? null,
  }

  return { reportHtml, emailHtml, summary }
}
