// Minimal ambient types for the parts of docusign-esign (v10) actually used in
// server/docusign.ts. The published @types/docusign-esign package targets an
// older API shape, so we declare only what we call against the real v10 SDK.
declare module 'docusign-esign' {
  export class ApiClient {
    setOAuthBasePath(basePath: string): void
    setBasePath(basePath: string): void
    addDefaultHeader(name: string, value: string): void
    requestJWTUserToken(
      clientId: string,
      userId: string,
      scopes: string[],
      privateKey: Buffer,
      expiresIn: number,
    ): Promise<{ body: { access_token: string; expires_in?: number } }>
  }

  export interface Document {
    documentBase64: string
    name: string
    fileExtension: string
    documentId: string
    transformPdfFields?: string
  }

  export interface TabBase {
    anchorString?: string
    anchorUnits?: string
    anchorXOffset?: string
    anchorYOffset?: string
    anchorIgnoreIfNotPresent?: string
    documentId?: string
    pageNumber?: string
    xPosition?: string
    yPosition?: string
    scaleValue?: string
    required?: string
    tabLabel?: string
    conditionalParentLabel?: string
    conditionalParentValue?: string
  }

  export type SignHere = TabBase
  export type InitialHere = TabBase
  export type Checkbox = TabBase
  export interface Text extends TabBase {
    value: string
    locked?: string
    width?: string
    height?: string
    fontSize?: string
    font?: string
    disableAutoSize?: string
  }
  export type DateSigned = TabBase
  export interface List extends TabBase {
    locked?: string
    width?: string
    height?: string
    fontSize?: string
    listItems: { text: string; value: string; selected?: string }[]
  }
  export interface Radio extends TabBase {
    value: string
    selected?: string
  }
  export interface RadioGroup {
    documentId: string
    groupName: string
    radios: Radio[]
  }

  export interface SignerTabs {
    signHereTabs?: SignHere[]
    initialHereTabs?: InitialHere[]
    textTabs?: Text[]
    listTabs?: List[]
    checkboxTabs?: Checkbox[]
    dateSignedTabs?: DateSigned[]
    radioGroupTabs?: RadioGroup[]
  }

  export interface Signer {
    email: string
    name: string
    recipientId: string
    clientUserId?: string
    requireIdLookup?: string
    tabs?: SignerTabs
  }

  export interface EnvelopeDefinition {
    emailSubject: string
    documents: Document[]
    recipients: { signers: Signer[] }
    status: string
  }

  export interface RecipientViewRequest {
    returnUrl: string
    authenticationMethod: string
    email: string
    userName: string
    clientUserId?: string
  }

  export interface EnvelopeSummary {
    envelopeId?: string
    status?: string
  }

  export interface EnvelopeInfo {
    status?: string
    completedDateTime?: string
  }

  export interface ViewUrl {
    url?: string
  }

  export class EnvelopesApi {
    constructor(apiClient: ApiClient)
    createEnvelope(accountId: string, opts: { envelopeDefinition: EnvelopeDefinition }): Promise<EnvelopeSummary>
    createRecipientView(
      accountId: string,
      envelopeId: string,
      opts: { recipientViewRequest: RecipientViewRequest },
    ): Promise<ViewUrl>
    getEnvelope(accountId: string, envelopeId: string): Promise<EnvelopeInfo>
    update(accountId: string, envelopeId: string, opts: { envelope: { status: string; voidedReason: string } }): Promise<EnvelopeInfo>
    getDocument(
      accountId: string,
      envelopeId: string,
      documentId: string,
      options: unknown,
    ): Promise<Buffer | string>
  }

  const _default: {
    ApiClient: typeof ApiClient
    EnvelopesApi: typeof EnvelopesApi
  }
  export default _default
}
