import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { confirmDocusignCompletion } from '../lib/docusignApi'

/**
 * Loaded inside the embedded-signing iframe once DocuSign redirects back after
 * the ceremony ends (signed, declined, or canceled). Confirms the real status
 * with our server, then notifies the parent window (LandlordAgreementsModal)
 * via postMessage so it can close the iframe and refresh.
 */
export function DocusignReturnPage() {
  const [searchParams] = useSearchParams()
  const [message, setMessage] = useState('Finishing up…')

  useEffect(() => {
    let cancelled = false

    async function run() {
      const type = searchParams.get('type')
      const envelopeId = searchParams.get('envelopeId')
      const event = searchParams.get('event')

      if (type !== 'equifax' && type !== 'plaid' && type !== 'lease' || !envelopeId) {
        setMessage('Missing information — you can close this window.')
        return
      }

      if (event && event !== 'signing_complete' && type !== 'lease') {
        window.parent?.postMessage({ source: 'docusign-return', type, completed: false, event }, window.location.origin)
        setMessage('Signing was not completed. You can close this window.')
        return
      }

      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setMessage('Please sign in again.')
        return
      }

      try {
        const result = await confirmDocusignCompletion(token, envelopeId, type)
        if (cancelled) return
        window.parent?.postMessage(
          { source: 'docusign-return', type, completed: result.completed },
          window.location.origin,
        )
        if (result.completed) setMessage('Done! You can close this window.')
        else if (type === 'lease') setMessage('Signing was not completed. You can close this window.')
        else setMessage('Still processing…')
      } catch {
        if (!cancelled) setMessage('Could not confirm signing — you can close this window.')
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  )
}
