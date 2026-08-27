import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { trackMetaEvent } from '../lib/metaPixel'

/**
 * Fires a Meta Pixel PageView on every client-side route change.
 * The initial page load PageView is fired by the snippet in index.html.
 */
export function MetaPixelTracker() {
  const location = useLocation()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    trackMetaEvent('PageView')
  }, [location.pathname])

  return null
}
