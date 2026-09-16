// One-off connectivity check against Equifax OneView sandbox using a CTEST
// test consumer. Run: npx tsx scripts/test-equifax-sandbox.ts
import { config } from 'dotenv'
config()

import { requestCreditReport } from '../server/equifax.ts'

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

console.log('Sandbox credit report OK, reportId:', result.reportId)
