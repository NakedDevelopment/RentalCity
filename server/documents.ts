/** Loaders for the two landlord agreement documents sent through DocuSign. */

import fs from 'fs'
import path from 'path'
import { createHash } from 'node:crypto'

const PLAID_CONSENT_TEMPLATE_PATH = path.join(process.cwd(), 'server/documents/plaid-end-client-consent.html')
const EQUIFAX_AGREEMENT_PATH = path.join(
  process.cwd(),
  'attached_assets/RENTAL_CITY_INC_-_Broker_Subcriber_Agreement_(Execution_7.10._1784841668421.docx',
)

export type LandlordSignerInfo = {
  name: string
  businessName: string
}

export function loadPlaidConsentDocument(landlord: LandlordSignerInfo): { base64: string; fileExtension: 'html' } {
  let html = fs.readFileSync(PLAID_CONSENT_TEMPLATE_PATH, 'utf8')
  html = html
    .replace(/\{\{END_CLIENT_NAME\}\}/g, escapeHtml(landlord.name))
    .replace(/\{\{END_CLIENT_BUSINESS_NAME\}\}/g, escapeHtml(landlord.businessName || landlord.name))
  return { base64: Buffer.from(html, 'utf8').toString('base64'), fileExtension: 'html' }
}

export function loadEquifaxAgreementDocument(): { base64: string; fileExtension: 'docx' } {
  const buf = fs.readFileSync(EQUIFAX_AGREEMENT_PATH)
  // Signing tabs use fixed page coordinates. A source DOCX change must be
  // reviewed against a fresh rendered PDF before it can be sent.
  const expectedSha256 = '1cd5baa02cc682da689a63899a776d81c59417ac000c703404ae3fce975732b6'
  if (createHash('sha256').update(buf).digest('hex') !== expectedSha256) {
    throw new Error('Equifax agreement template changed; review signature placement before sending.')
  }
  return { base64: buf.toString('base64'), fileExtension: 'docx' }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
