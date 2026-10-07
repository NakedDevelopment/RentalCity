import type { AnchorTab } from './docusign'
import { EQUIFAX_TITLE_OPTIONS } from './equifaxTitleOptions'

/** Fixed coordinates on the checksum-guarded, 20-page subscriber agreement. */
export function equifaxAgreementTabs(details: {
  businessName: string
  businessAddress: string
  businessPhone: string
  landlordName: string
}): AnchorTab[] {
  const { businessName, businessAddress, businessPhone, landlordName } = details
  return [
    { pageNumber: '1', xPosition: '84', yPosition: '581', type: 'initial' },
    { pageNumber: '2', xPosition: '259', yPosition: '74', type: 'initial' },
    { pageNumber: '6', xPosition: '170', yPosition: '193', type: 'text', value: businessName, width: '380', height: '15', fontSize: 'Size9' },
    { pageNumber: '6', xPosition: '170', yPosition: '209', type: 'text', value: businessAddress, width: '390', height: '18', fontSize: 'Size8' },
    { pageNumber: '6', xPosition: '170', yPosition: '230', scaleValue: '0.6', type: 'sign' },
    { pageNumber: '6', xPosition: '170', yPosition: '260', type: 'text', value: landlordName, width: '380', height: '15', fontSize: 'Size9' },
    { pageNumber: '6', xPosition: '170', yPosition: '276', type: 'dropdown', options: [...EQUIFAX_TITLE_OPTIONS],
      required: true, locked: false, width: '260', height: '15', fontSize: 'Size9', tabLabel: 'Subscriber title' },
    { pageNumber: '6', xPosition: '170', yPosition: '291', type: 'dateSigned' },
    { pageNumber: '6', xPosition: '56', yPosition: '321', type: 'text', value: `Business phone: ${businessPhone}`, width: '450', height: '18', fontSize: 'Size9' },
    { pageNumber: '9', xPosition: '51', yPosition: '198', type: 'initial' },
    { pageNumber: '9', xPosition: '51', yPosition: '354', type: 'initial' },
  ]
}
