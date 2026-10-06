/**
 * Explicitly authorized production DocuSign QA, isolated from app profiles,
 * approvals, screening requests and all Equifax/email submission handlers.
 * Run only after explicit authorization:
 * tsx scripts/qa-equifax-production.ts --allow-production
 * The local-only bridge creates one clearly marked embedded test envelope.
 */
import 'dotenv/config'
import express from 'express'
import fs from 'node:fs'
import {
  createEmbeddedEnvelope, createEmbeddedSigningUrl, getEnvelopeStatus,
  getDocusignAccessToken, voidEnvelope,
} from '../server/docusign'
import { loadEquifaxAgreementDocument, loadEquifaxApplicationDocument } from '../server/documents'
import { equifaxApplicationTabs } from '../server/equifaxApplicationTabs'
import { equifaxAgreementTabs } from '../server/equifaxAgreementTabs'

const base = process.env.DOCUSIGN_BASE_PATH
const account = process.env.DOCUSIGN_ACCOUNT_ID
if (!process.argv.includes('--allow-production')) {
  throw new Error('Production QA requires explicit authorization and the --allow-production flag')
}
if (!base || !account) throw new Error('Existing DocuSign connection is missing')
const apiBase = `${base.replace(/\/$/, '')}/restapi/v2.1/accounts/${account}`
const app = express()
app.use(express.json())
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
const recordPath = '.local/qa/equifax-production-envelope.json'
let envelopeId: string | null = null
if (fs.existsSync(recordPath)) envelopeId = JSON.parse(fs.readFileSync(recordPath, 'utf8')).envelopeId
const signer = {
  name: 'PRODUCTION QA TEST ONLY',
  email: 'rental-city-production-qa@example.com',
  clientUserId: 'equifax-isolated-production-qa',
}
const details = {
  businessName: 'TEST ONLY - DO NOT PROCESS',
  businessPhone: '4155550100',
  businessAddress: '123 TEST ONLY Lane, Testville, CA 94105',
  landlordName: signer.name,
  landlordEmail: signer.email,
}
async function api(path: string, method = 'GET', body?: unknown) {
  const token = await getDocusignAccessToken()
  const response = await fetch(`${apiBase}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { errorCode?: string; message?: string }
    throw new Error(`${error.errorCode ?? response.status}: ${error.message ?? 'DocuSign request failed'}`)
  }
  return response
}

app.get('/', (_req, res) => res.type('html').send(`<!doctype html><html><head>
<title>Isolated production DocuSign QA</title></head><body style="font:16px Arial;margin:16px">
<h1>TEST ONLY — production DocuSign</h1>
<p>No Equifax submission. No landlord profile or approval changes.</p>
<button id="start">Open test signing session</button> <button id="status">Check status</button>
<pre id="result"></pre><iframe id="signing" title="DocuSign production test" style="width:100%;height:850px;border:1px solid #aaa"></iframe>
<script>
const result=document.getElementById('result');
document.getElementById('start').onclick=async()=>{
const r=await fetch('/start',{method:'POST'}); const data=await r.json();
if(!r.ok){result.textContent=data.error;return}document.getElementById('signing').src=data.url;
result.textContent='Test session opened. No external application submission.';};
document.getElementById('status').onclick=async()=>{result.textContent=JSON.stringify(await(await fetch('/status')).json(),null,2)};
</script></body></html>`))

app.post('/start', async (_req, res) => {
  try {
    if (!envelopeId) {
      // Read-only credential/account check before creating the production QA envelope.
      await api('')
      const agreement = loadEquifaxAgreementDocument()
      const application = await loadEquifaxApplicationDocument()
      const fields = equifaxApplicationTabs(details)
      const tabs = [...equifaxAgreementTabs(details), ...fields.tabs]
      if (process.argv.includes('--prefill')) {
        const priorValues = JSON.parse(fs.readFileSync('.local/qa/equifax-qa-field-values.json', 'utf8')) as Record<string, string>
        for (const tab of tabs) {
          if (tab.type === 'text' && !tab.value && tab.tabLabel && priorValues[tab.tabLabel]) tab.value = priorValues[tab.tabLabel]
        }
      }
      envelopeId = await createEmbeddedEnvelope({
        documentBase64: agreement.base64, documentName: 'TEST ONLY - Subscriber Agreement.docx',
        fileExtension: agreement.fileExtension, signer,
        emailSubject: 'TEST ONLY - Rental City production QA - NOT AN APPLICATION',
        tabs,
        radioChoices: fields.radioChoices,
        additionalDocument: { documentBase64: application.base64, documentName: 'TEST ONLY - Application.pdf', fileExtension: 'pdf' },
        returnUrl: 'http://127.0.0.1:3002/result',
      })
      fs.mkdirSync('.local/qa', { recursive: true })
      fs.writeFileSync(recordPath, JSON.stringify({ envelopeId, testOnly: true }))
      console.log('Created one isolated TEST ONLY production envelope')
    }
    const url = await createEmbeddedSigningUrl(envelopeId, signer, 'http://127.0.0.1:3002/result')
    res.json({ url })
  } catch (error) {
    const body = (error as { response?: { body?: { errorCode?: string; message?: string } } }).response?.body
    res.status(502).json({ error: body ? `${body.errorCode}: ${body.message}` : (error as Error).message })
  }
})
app.get('/result', (req, res) => {
  res.type('html').send(`<h1>Test signing returned</h1><p id="event">${String(req.query.event ?? '').replace(/[^a-z_]/gi, '')}</p><p>No Equifax submission or approval changes.</p>`)
})
app.get('/status', async (_req, res) => {
  if (!envelopeId) return res.json({ status: 'not-created' })
  try {
    const status = await getEnvelopeStatus(envelopeId)
    const documents = await (await api(`/envelopes/${envelopeId}/documents`)).json()
    const tabs = await (await api(`/envelopes/${envelopeId}/recipients/1/tabs`)).json()
    res.json({ ...status, documents: documents.envelopeDocuments?.map((d: { documentId: string; name: string; pages?: unknown[] }) => ({ id: d.documentId, name: d.name, pages: d.pages?.length })),
      tabs: { texts: tabs.textTabs?.map((t: { tabLabel?: string; value?: string; conditionalParentLabel?: string; required?: string }) => ({ label: t.tabLabel, value: t.value, parent: t.conditionalParentLabel, required: t.required })),
        signatures: tabs.signHereTabs?.map((t: { documentId?: string; pageNumber?: string; conditionalParentLabel?: string }) => ({ document: t.documentId, page: t.pageNumber, parent: t.conditionalParentLabel })),
        radios: tabs.radioGroupTabs } })
  } catch (error) { res.status(502).json({ error: (error as Error).message }) }
})
app.post('/download', async (_req, res) => {
  if (!envelopeId) return res.status(400).json({ error: 'No test envelope' })
  try {
    const response = await api(`/envelopes/${envelopeId}/documents/2`)
    fs.writeFileSync('.local/qa/equifax-application-completed.pdf', Buffer.from(await response.arrayBuffer()))
    res.json({ saved: true })
  } catch (error) { res.status(502).json({ error: (error as Error).message }) }
})
app.post('/cleanup', async (_req, res) => {
  if (!envelopeId) return res.json({ cleaned: true })
  try {
    const status = await getEnvelopeStatus(envelopeId)
    if (status.status !== 'completed' && status.status !== 'voided') await voidEnvelope(envelopeId)
    await api('/folders/recyclebin', 'PUT', { envelopeIds: [envelopeId] })
    fs.unlinkSync(recordPath)
    envelopeId = null
    res.json({ cleaned: true })
  } catch (error) { res.status(502).json({ error: (error as Error).message }) }
})
app.listen(3002, '127.0.0.1', () => console.log('Isolated production QA bridge listening on port 3002'))
