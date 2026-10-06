import type { AnchorTab, RadioChoice } from './docusign'

type Applicant = {
  businessName: string
  businessPhone: string
  landlordName: string
  landlordEmail: string
}

/** Coordinates come from the PDF's actual widget rectangles. Both pages are
 * 584.5pt wide; page 1 is 998.1pt tall and page 2 is 664.2pt tall.
 * Business mailing address is intentionally NOT copied into its physical
 * address field; Equifax asks for the location where report data is accessed.
 */
export function equifaxApplicationTabs(applicant: Applicant): {
  tabs: AnchorTab[]
  radioChoices: RadioChoice[]
} {
  const text = (
    label: string, page: string, x: number, y: number, width: number,
    value = '', required = true, conditional = false,
  ): AnchorTab => ({
    type: 'text', documentId: '2', pageNumber: page,
    xPosition: String(x), yPosition: String(y), width: String(width),
    height: '14', fontSize: 'Size9', tabLabel: label, required,
    value, locked: false,
    ...(conditional ? { conditionalParentLabel: 'shared-office', conditionalParentValue: 'yes' } : {}),
  })
  const conditional = { conditionalParentLabel: 'shared-office', conditionalParentValue: 'yes' }

  return {
    // Coordinates include a small inset into the empty boxes. No SSN, DOB,
    // federal tax ID, or other optional sensitive field is requested.
    tabs: [
      text('Company name', '1', 124, 102, 171, applicant.businessName),
      text('Other business names or none', '1', 398, 102, 163),
      text('Physical business address', '1', 304, 122, 257),
      text('City', '1', 63, 146, 127),
      text('State', '1', 236, 146, 61),
      text('ZIP', '1', 343, 146, 48),
      text('Business telephone', '1', 450, 146, 61, applicant.businessPhone),
      text('Business email', '1', 398, 170, 162, applicant.landlordEmail),
      text('Business license or registration', '1', 145, 202, 151),
      text('Issuer or regulatory agency, or N/A if not applicable', '1', 419, 202, 142),
      text('Years in business', '1', 493, 261, 68),
      text('Type of ownership', '1', 125, 284, 171, '', false),
      text('License number, or N/A if not applicable', '1', 400, 284, 161),
      text('Industry and nature of business', '1', 113, 342, 442),
      text('Shared office company name', '1', 84, 462, 471, '', true, true),
      { ...text('Non-US operations locations', '1', 112, 519, 442), conditionalParentLabel: 'non-us-operations', conditionalParentValue: 'yes' },
      text('FCRA permissible purpose', '1', 118, 632, 438),
      text('Principal first name', '1', 123, 719, 152),
      text('Principal last name', '1', 381, 719, 180),
      text('Principal title', '1', 381, 740, 180),
      text('Recredentialing contact name', '1', 172, 842, 166, applicant.landlordName),
      text('Recredentialing contact title', '1', 380, 842, 180),
      text('Recredentialing contact email', '1', 172, 863, 166, applicant.landlordEmail),
      text('Recredentialing contact phone', '1', 421, 863, 140, applicant.businessPhone),
      text('Person completing application', '1', 172, 943, 166, applicant.landlordName),
      text('Applicant title', '1', 380, 943, 181),
      { type: 'sign', documentId: '2', pageNumber: '1', xPosition: '171', yPosition: '964', scaleValue: '0.35', tabLabel: 'Application signature' },
      { type: 'dateSigned', documentId: '2', pageNumber: '1', xPosition: '380', yPosition: '963', tabLabel: 'Application date' },
      text('Shared office applicant company', '2', 171, 376, 387, applicant.businessName, true, true),
      text('Shared office signer name', '2', 169, 397, 168, applicant.landlordName, true, true),
      text('Shared office signer title', '2', 378, 397, 182, '', true, true),
      { type: 'sign', documentId: '2', pageNumber: '2', xPosition: '170', yPosition: '418', scaleValue: '0.35', tabLabel: 'Shared office attestation signature', ...conditional },
      { type: 'dateSigned', documentId: '2', pageNumber: '2', xPosition: '378', yPosition: '418', tabLabel: 'Shared office attestation date', ...conditional },
    ],
    radioChoices: [
      { groupName: 'residential-address', pageNumber: '1', documentId: '2', yes: { x: '142', y: '415' }, no: { x: '175', y: '415' } },
      { groupName: 'shared-office', pageNumber: '1', documentId: '2', yes: { x: '285', y: '440' }, no: { x: '318', y: '440' } },
      { groupName: 'non-us-operations', pageNumber: '1', documentId: '2', yes: { x: '359', y: '496' }, no: { x: '394', y: '496' } },
      { groupName: 'consumer-report-use', pageNumber: '1', documentId: '2', yes: { x: '390', y: '579' }, no: { x: '424', y: '579' } },
    ],
  }
}
