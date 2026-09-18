// One-off connectivity check against a non-production Equifax OneView
// environment using an Equifax CTEST consumer.
import { config } from 'dotenv'
config({ path: '.env.development.local' })
config({ path: '.env.local' })
config()

import {
  equifaxPdfEndpoint,
  getEquifaxToken,
  getInternalTestEnv,
  requestCreditReport,
} from '../server/equifax.ts'

// This script exercises Rental City's own reseller test credentials — the
// account Equifax will only ever promote as far as sandbox/UAT. Real
// per-landlord production credentials are entered by an admin per-landlord
// and exercised through the app's own /api/equifax/credit-check endpoint,
// not this script.
const env = getInternalTestEnv()
if (process.env.ALLOW_EQUIFAX_TEST_PULL !== 'true') {
  throw new Error('Set ALLOW_EQUIFAX_TEST_PULL=true to confirm this non-production CTEST report request')
}

const memberNumber = process.env.EQUIFAX_MEMBER_NUMBER
const securityCode = process.env.EQUIFAX_SECURITY_CODE
const customerCode = process.env.EQUIFAX_CUSTOMER_CODE
if (!memberNumber || !securityCode || !customerCode) {
  throw new Error('EQUIFAX_MEMBER_NUMBER / EQUIFAX_SECURITY_CODE / EQUIFAX_CUSTOMER_CODE must be set (Rental City\'s own reseller test credentials) to run this script')
}

const result = await requestCreditReport(
  {
    firstName: 'KBJGCP',
    lastName: 'XSCNF',
    ssn: '666000001',
    houseNumber: '1886',
    streetName: 'VBPLDNRC',
    streetType: 'TRWY',
    city: 'TUSCALOOSA',
    state: 'AL',
    zip: '35425',
  },
  { memberNumber, securityCode, customerCode },
  env,
)

const token = await getEquifaxToken(env)
let pdfResponse: Response | null = null
for (let attempt = 1; attempt <= 15; attempt += 1) {
  pdfResponse = await fetch(equifaxPdfEndpoint(result.reportId, env), {
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
