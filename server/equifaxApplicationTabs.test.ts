import assert from 'node:assert/strict'
import test from 'node:test'
import { equifaxApplicationTabs } from './equifaxApplicationTabs'
import { loadEquifaxAgreementDocument, loadEquifaxApplicationDocument } from './documents'
import { buildEmbeddedEnvelopeDefinition } from './docusign'
import { PDFDocument } from 'pdf-lib'

const permissiblePurpose = 'In connection with a credit transaction involving the consumer and the extension of credit to, or collection of an account of, the consumer, including Mortgage'

test('pinned application PDF and required tabs belong to the second document', async () => {
  const { base64, fileExtension } = await loadEquifaxApplicationDocument()
  assert.equal(fileExtension, 'pdf')
  assert.ok(Buffer.from(base64, 'base64').length > 200_000)
  const prepared = await PDFDocument.load(Buffer.from(base64, 'base64'))
  assert.equal(prepared.getPageCount(), 2)
  assert.equal(prepared.getForm().getFields().length, 0, 'native form widgets must not print underneath DocuSign answers')

  const { tabs, radioChoices } = equifaxApplicationTabs({
    businessName: 'Sample LLC',
    businessPhone: '4155551234',
    landlordName: 'Test Landlord',
    landlordEmail: 'test@example.com',
  })
  assert.ok(tabs.length >= 25)
  assert.equal(tabs.filter((tab) => tab.type === 'sign').length, 2)
  assert.equal(radioChoices.length, 4)
  assert.ok(tabs.every((tab) => tab.documentId === '2'))
  assert.ok(radioChoices.every((group) => group.documentId === '2'))
  for (const tab of tabs) {
    const maxY = tab.pageNumber === '2' ? 664 : 998
    assert.ok(Number(tab.xPosition) < 585 && Number(tab.yPosition) < maxY,
      `${tab.tabLabel} is outside page ${tab.pageNumber}`)
  }
  const attestation = tabs.find((tab) => tab.tabLabel === 'Shared office attestation signature')
  assert.equal(attestation?.conditionalParentLabel, 'shared-office')
  assert.equal(attestation?.conditionalParentValue, 'yes')
  assert.equal(tabs.find((tab) => tab.tabLabel === 'Physical business address')?.value, '')
  const industry = tabs.find((tab) => tab.tabLabel === 'Industry and nature of business')
  assert.equal(industry?.value, 'Real Estate Sales & Rentals')
  assert.equal(industry?.locked, false)
  assert.equal(industry?.required, true)
  const purpose = tabs.find((tab) => tab.tabLabel === 'FCRA permissible purpose')
  assert.equal(purpose?.value, permissiblePurpose)
  assert.equal(purpose?.required, true)
  assert.equal(purpose?.locked, false)
  assert.equal(purpose?.font, 'ArialNarrow')
  assert.equal(purpose?.fontSize, 'Size7')
  assert.equal(tabs.find((tab) => tab.tabLabel === 'Business email')?.fontSize, 'Size7')
  assert.ok(tabs.filter((tab) => tab.type === 'text').every((tab) => tab.disableAutoSize))
})

test('one signer receives both documents and conditional application tabs without changing Plaid', async () => {
  const application = await loadEquifaxApplicationDocument()
  const agreement = loadEquifaxAgreementDocument()
  const applicant = { businessName: 'Sample LLC', businessPhone: '4155551234', landlordName: 'Test Landlord', landlordEmail: 'test@example.com' }
  const fields = equifaxApplicationTabs(applicant)
  const args = {
    documentBase64: agreement.base64, documentName: 'Agreement.docx',
    fileExtension: agreement.fileExtension, emailSubject: 'Application',
    signer: { name: applicant.landlordName, email: applicant.landlordEmail, clientUserId: 'test-signer' },
    returnUrl: 'https://example.com/return',
    tabs: [{ type: 'sign' as const, pageNumber: '6', xPosition: '170', yPosition: '230' }],
  }
  const plaidEquivalent = buildEmbeddedEnvelopeDefinition(args)
  assert.equal(plaidEquivalent.documents.length, 1)
  assert.equal(plaidEquivalent.recipients.signers[0].tabs?.signHereTabs?.[0].documentId, '1')
  const envelope = buildEmbeddedEnvelopeDefinition({
    ...args, tabs: [...args.tabs, ...fields.tabs], radioChoices: fields.radioChoices,
    additionalDocument: { documentBase64: application.base64, documentName: 'Application.pdf', fileExtension: 'pdf' },
  })
  assert.equal(envelope.documents.length, 2)
  assert.equal(envelope.recipients.signers.length, 1)
  assert.equal(envelope.documents[1].transformPdfFields, 'false')
  const tabs = envelope.recipients.signers[0].tabs
  const industry = tabs?.textTabs?.find((tab) => tab.tabLabel === 'Industry and nature of business')
  assert.equal(industry?.value, 'Real Estate Sales & Rentals')
  assert.equal(industry?.locked, 'false')
  const purpose = tabs?.textTabs?.find((tab) => tab.tabLabel === 'FCRA permissible purpose')
  assert.equal(purpose?.value, permissiblePurpose)
  assert.equal(purpose?.locked, 'false')
  assert.equal(purpose?.required, 'true')
  assert.equal(purpose?.font, 'ArialNarrow')
  assert.equal(purpose?.fontSize, 'Size7')
  assert.equal(tabs?.radioGroupTabs?.length, 4)
  assert.equal(tabs?.signHereTabs?.[2].conditionalParentLabel, 'shared-office')
})
