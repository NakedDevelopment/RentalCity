/**
 * DocuSign eSignature client — JWT Grant auth (server-to-server, no user login),
 * embedded signing (landlord signs inside the app, no redirect to docusign.com),
 * and envelope/document retrieval for the two landlord agreements:
 *   - Equifax Broker Subscriber Agreement (requires Equifax's manual approval after signing)
 *   - Plaid End Client Consent (self-serve — stored on our end, no external approval)
 */

import docusignPkg from 'docusign-esign'
import { createPrivateKey } from 'node:crypto'
import type {
  ApiClient as DsApiClient,
  EnvelopesApi as DsEnvelopesApi,
  Document as DsDocument,
  SignHere as DsSignHere,
  InitialHere as DsInitialHere,
  Text as DsText,
  Checkbox as DsCheckbox,
  Signer as DsSigner,
  EnvelopeDefinition as DsEnvelopeDefinition,
  RecipientViewRequest as DsRecipientViewRequest,
} from 'docusign-esign'

const { ApiClient, EnvelopesApi } = docusignPkg

function getBasePath(): string {
  const basePath = process.env.DOCUSIGN_BASE_PATH
  if (!basePath) throw new Error('DOCUSIGN_BASE_PATH not configured')
  return basePath
}

function getAuthServer(): string {
  // Sandbox (demo) and production use different OAuth hosts than the API base path.
  return getBasePath().includes('demo') ? 'account-d.docusign.com' : 'account.docusign.com'
}

// ─── JWT auth (in-process token cache) ───────────────────────────────────────

type TokenCache = { token: string; expiresAt: number }
let tokenCache: TokenCache | null = null

function normalizedPrivateKeyBuffer(rawValue: string): Buffer {
  let value = rawValue.trim()

  // Replit Secrets may contain a JSON-quoted PEM or a PEM whose newlines were
  // pasted as literal "\n" characters.
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'string') value = parsed
    } catch {
      // Continue with the original value so validation below returns a safe,
      // actionable configuration error.
    }
  } else if (value.startsWith("'") && value.endsWith("'")) {
    value = value.slice(1, -1)
  }
  value = value.replace(/\\r/g, '').replace(/\\n/g, '\n').trim()

  // Some secret stores flatten multiline values completely, leaving the PEM
  // header, base64 body, and footer on one line. Restore the standard PEM
  // wrapping before passing it to Node's key decoder.
  const pemMatch = value.match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/)
  if (pemMatch && pemMatch[1].includes('PRIVATE KEY')) {
    const body = pemMatch[2].replace(/\s/g, '')
    const wrappedBody = body.match(/.{1,64}/g)?.join('\n') ?? ''
    value = `-----BEGIN ${pemMatch[1]}-----\n${wrappedBody}\n-----END ${pemMatch[1]}-----`
  }

  // Also accept a base64-encoded PEM, which is a common way to store multiline
  // private keys in deployment secret stores.
  if (!value.includes('PRIVATE KEY')) {
    try {
      const decoded = Buffer.from(value.replace(/\s/g, ''), 'base64').toString('utf8').trim()
      if (decoded.includes('PRIVATE KEY')) value = decoded
    } catch {
      // Validation below handles malformed values without exposing the secret.
    }
  }

  try {
    const key = createPrivateKey({ key: value, format: 'pem' })
    if (key.asymmetricKeyType !== 'rsa' && key.asymmetricKeyType !== 'rsa-pss') {
      throw new Error('DocuSign JWT requires an RSA private key')
    }
    // Export a canonical PKCS#8 PEM so jsonwebtoken always receives asymmetric
    // key material even if the original secret used PKCS#1 formatting.
    return key.export({ type: 'pkcs8', format: 'pem' }) as Buffer
  } catch {
    throw new Error(
      'DOCUSIGN_PRIVATE_KEY is not a valid RSA private key. Use the private key generated for the DocuSign integration key.',
    )
  }
}

export async function getDocusignAccessToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token

  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY
  const userId = process.env.DOCUSIGN_USER_ID
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY || ''
  if (!integrationKey || !userId || !privateKey.trim()) {
    throw new Error('DocuSign credentials not configured (DOCUSIGN_INTEGRATION_KEY / DOCUSIGN_USER_ID / DOCUSIGN_PRIVATE_KEY)')
  }
  const privateKeyBuffer = normalizedPrivateKeyBuffer(privateKey)

  const apiClient = new ApiClient()
  apiClient.setOAuthBasePath(getAuthServer())
  const results = await apiClient.requestJWTUserToken(
    integrationKey,
    userId,
    ['signature', 'impersonation'],
    privateKeyBuffer,
    3600,
  )

  const accessToken = results.body.access_token as string
  const expiresIn = (results.body.expires_in as number) ?? 3600
  tokenCache = { token: accessToken, expiresAt: now + expiresIn * 1000 }
  return accessToken
}

async function getEnvelopesApi(): Promise<{ api: DsEnvelopesApi; accountId: string }> {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID
  if (!accountId) throw new Error('DOCUSIGN_ACCOUNT_ID not configured')

  const token = await getDocusignAccessToken()
  const apiClient = new ApiClient()
  apiClient.setBasePath(`${getBasePath()}/restapi`)
  apiClient.addDefaultHeader('Authorization', `Bearer ${token}`)

  const api = new EnvelopesApi(apiClient)
  return { api, accountId }
}

// ─── Envelope creation (embedded signing) ────────────────────────────────────

export type AnchorTab = {
  anchorString: string
  type: 'sign' | 'initial' | 'text' | 'checkbox'
  /** Pre-filled value for type 'text'. Omit for a blank field the signer fills in themselves. */
  value?: string
  /** type 'text' only — false leaves the field editable by the signer instead of pre-filled/locked. Defaults to true. */
  locked?: boolean
  xOffset?: string
  yOffset?: string
}

export type EmbeddedSigner = {
  name: string
  email: string
  /** Any stable, unique-per-signer identifier (we use the landlord's profile id). */
  clientUserId: string
}

export type CreateEmbeddedEnvelopeArgs = {
  documentBase64: string
  documentName: string
  fileExtension: 'html' | 'docx' | 'pdf'
  emailSubject: string
  signer: EmbeddedSigner
  tabs: AnchorTab[]
  /** Where DocuSign redirects the browser after the signing ceremony completes. */
  returnUrl: string
}

function buildTabs(tabs: AnchorTab[]) {
  const signHereTabs: DsSignHere[] = []
  const initialHereTabs: DsInitialHere[] = []
  const textTabs: DsText[] = []
  const checkboxTabs: DsCheckbox[] = []

  for (const t of tabs) {
    const base = {
      anchorString: t.anchorString,
      anchorUnits: 'pixels',
      anchorXOffset: t.xOffset ?? '0',
      anchorYOffset: t.yOffset ?? '0',
      anchorIgnoreIfNotPresent: 'true',
    }
    if (t.type === 'sign') signHereTabs.push(base as DsSignHere)
    else if (t.type === 'initial') initialHereTabs.push(base as DsInitialHere)
    else if (t.type === 'checkbox') checkboxTabs.push(base as DsCheckbox)
    else textTabs.push({ ...base, value: t.value ?? '', locked: t.locked === false ? 'false' : 'true' } as DsText)
  }

  return { signHereTabs, initialHereTabs, textTabs, checkboxTabs }
}

/** Creates and sends an envelope configured for embedded signing, returns the envelope id. */
export async function createEmbeddedEnvelope(args: CreateEmbeddedEnvelopeArgs): Promise<string> {
  const { api, accountId } = await getEnvelopesApi()

  const document: DsDocument = {
    documentBase64: args.documentBase64,
    name: args.documentName,
    fileExtension: args.fileExtension,
    documentId: '1',
  }

  const signer: DsSigner = {
    email: args.signer.email,
    name: args.signer.name,
    recipientId: '1',
    clientUserId: args.signer.clientUserId,
    // These agreements are intended to be signed by the already-authenticated
    // landlord in the embedded ceremony. Explicitly disable DocuSign recipient
    // ID lookup so an account-level SMS/phone-auth default is not inherited.
    requireIdLookup: 'false',
    tabs: buildTabs(args.tabs),
  }

  const envelopeDefinition: DsEnvelopeDefinition = {
    emailSubject: args.emailSubject,
    documents: [document],
    recipients: { signers: [signer] },
    status: 'sent',
  }

  const results = await api.createEnvelope(accountId, { envelopeDefinition })
  if (!results.envelopeId) throw new Error('DocuSign did not return an envelopeId')
  return results.envelopeId
}

/** Returns the URL to embed (iframe) so the signer can complete the ceremony in-app. */
export async function createEmbeddedSigningUrl(
  envelopeId: string,
  signer: EmbeddedSigner,
  returnUrl: string,
): Promise<string> {
  const { api, accountId } = await getEnvelopesApi()

  const viewRequest: DsRecipientViewRequest = {
    returnUrl,
    authenticationMethod: 'none',
    email: signer.email,
    userName: signer.name,
    clientUserId: signer.clientUserId,
  }

  const results = await api.createRecipientView(accountId, envelopeId, { recipientViewRequest: viewRequest })
  if (!results.url) throw new Error('DocuSign did not return a signing URL')
  return results.url
}

export type EnvelopeStatus = {
  status: string
  completedAt?: string
}

export async function getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
  const { api, accountId } = await getEnvelopesApi()
  const envelope = await api.getEnvelope(accountId, envelopeId)
  return { status: envelope.status ?? 'unknown', completedAt: envelope.completedDateTime }
}

/** Downloads the completed, executed document (combined PDF) — used to store our copy and, for Equifax, forward to their compliance inbox. */
export async function downloadCompletedDocument(envelopeId: string): Promise<Buffer> {
  const { api, accountId } = await getEnvelopesApi()
  const result = await api.getDocument(accountId, envelopeId, 'combined', null)
  return Buffer.isBuffer(result) ? result : Buffer.from(result as unknown as string, 'binary')
}
