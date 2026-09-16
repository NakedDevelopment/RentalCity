// One-off connectivity check against a non-production Equifax OneView
// environment using an Equifax CTEST consumer.
import { config } from 'dotenv'
config({ path: '.env.development.local' })
config({ path: '.env.local' })
config()

import {
  equifaxPdfEndpoint,
  getEquifaxToken,
  requestCreditReport,
} from '../server/equifax.ts'

const env = process.env.EQUIFAX_ENV?.toLowerCase()
if (env !== 'sandbox' && env !== 'uat') {
  throw new Error('This test can run only with EQUIFAX_ENV=sandbox or EQUIFAX_ENV=uat')
}
if (process.env.ALLOW_EQUIFAX_TEST_PULL !== 'true') {
  throw new Error('Set ALLOW_EQUIFAX_TEST_PULL=true to confirm this non-production CTEST report request')
}

const result = await requestCreditReport({
  firstName: 'KBJGCP',
  lastName: 'XSCNF',
  ssn: '666000001',
  houseNumber: '1886',
  streetName: 'VBPLDNRC',
  streetType: 'TRWY',
  city: 'TUSCALOOSA',
  state: 'AL',
  zip: '35425',
})

const token = await getEquifaxToken()
let pdfResponse: Response | null = null
for (let attempt = 1; attempt <= 15; attempt += 1) {
  pdfResponse = await fetch(equifaxPdfEndpoint(result.reportId), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (pdfResponse.ok || pdfResponse.status !== 409) break
  await new Promise((resolve) => setTimeout(resolve, 3_000))
}
if (!pdfResponse?.ok) {
  throw new Error(`Equifax CTEST PDF retrieval failed (${pdfResponse?.status ?? 'no response'})`)
}
const pdf = await pdfResponse.arrayBuffer()
if (pdf.byteLength === 0) {
  throw new Error('Equifax CTEST PDF retrieval returned an empty document')
}

console.log(`Equifax ${env.toUpperCase()} CTEST credit report and PDF succeeded`)
