import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import { divIcon, latLngBounds, type Marker as LeafletMarker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { deriveListingPins, type ListingPin } from '../lib/listingMapPins'
import { MATCH_SCORE_BANDS, scoreBarColor } from '../lib/matchScoreColor'
import { useStreetViewFallback } from '../lib/streetViewFallback'
import './listingMap.css'

export type TenantMapCard = {
  id: string
  price: string
  pricePin: string
  priceMo: string
  bedsBaths: string
  bedsBathsPopup: string
  address: string
  photoUrl: string | null
  photoAlt: string
  photoAddress: string
  lat: number | null
  lng: number | null
  matchScore: number | null
  applied: boolean
  statusHref: string | null
  landlordHref: string | null
  landlordName: string | null
  title: string
  saved: boolean
}

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795]
const DEFAULT_ZOOM = 4

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function pinIcon(pin: ListingPin, selected: boolean) {
  const label = selected && pin.scoreKnown ? `${pin.priceLabel} ${pin.matchScore}%` : pin.priceLabel
  const width = Math.min(180, Math.max(78, Math.ceil(label.length * 7.2) + (selected ? 22 : 30)))
  const html = selected
    ? `<div class="listing-pin-pill is-selected">${escapeHtml(label)}</div>`
    : `<div class="listing-pin-pill"><span class="listing-pin-dot" style="background:${pin.color}"></span>${escapeHtml(pin.priceLabel)}</div>`
  return divIcon({
    className: 'listing-price-pin',
    html,
    iconSize: [width, 28],
    iconAnchor: [width / 2, 14],
  })
}

function FitPins({ pinsKey, positions }: { pinsKey: string; positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      return
    }
    if (positions.length === 1) {
      map.setView(positions[0], 13)
      return
    }
    map.fitBounds(latLngBounds(positions), { padding: [42, 42], maxZoom: 14 })
  }, [map, pinsKey, positions])
  return null
}

function InvalidateSize({ token }: { token: string }) {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 60)
    return () => window.clearTimeout(id)
  }, [map, token])
  return null
}

function LocateButton({ desktop }: { desktop: boolean }) {
  const map = useMap()
  return (
    <button
      type="button"
      aria-label="Show my location"
      onClick={() => {
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(
          (position) => {
            map.setView([position.coords.latitude, position.coords.longitude], 13)
          },
          () => {},
        )
      }}
      className={`absolute right-3 z-[400] flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 shadow ${desktop ? 'top-[4.75rem]' : 'top-3'}`}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  )
}

function PriceMarker({
  pin,
  card,
  selected,
  onSelect,
}: {
  pin: ListingPin
  card: TenantMapCard
  selected: boolean
  onSelect: (id: string) => void
}) {
  const markerRef = useRef<LeafletMarker | null>(null)
  const icon = useMemo(() => pinIcon(pin, selected), [pin, selected])

  useEffect(() => {
    const marker = markerRef.current
    if (!marker) return
    if (selected) marker.openPopup()
    else marker.closePopup()
  }, [selected])

  return (
    <Marker
      ref={markerRef}
      position={[pin.lat, pin.lng]}
      icon={icon}
      zIndexOffset={selected ? 800 : 0}
      eventHandlers={{ click: () => onSelect(pin.id) }}
    >
      <Popup className="listing-pin-popup" autoPan>
        <Link to={`/property/${card.id}?from=matches`} className="block">
          <CardPhoto url={card.photoUrl} alt={card.photoAlt} fallbackAddress={card.photoAddress} className="listing-popup-photo aspect-[16/9] w-full" />
          <div className="space-y-0.5 px-3 py-2.5">
            <p className="text-sm font-bold text-gray-900">{card.priceMo}</p>
            <p className="text-xs text-gray-700">{card.bedsBathsPopup}</p>
            <p className="text-xs text-gray-500">{card.address}</p>
            <p className="pt-1 text-xs font-semibold text-gray-900">
              {card.matchScore == null ? 'Match score' : `${card.matchScore} Match score`}
            </p>
          </div>
        </Link>
      </Popup>
    </Marker>
  )
}

function CardPhoto({
  url,
  alt,
  fallbackAddress,
  className,
}: {
  url: string | null
  alt: string
  fallbackAddress?: string
  className: string
}) {
  const [broken, setBroken] = useState(false)
  const show = Boolean(url) && !broken
  const streetViewUrl = useStreetViewFallback(show ? null : fallbackAddress || null)
  return (
    <div className={`overflow-hidden bg-gray-100 ${className}`}>
      {show ? (
        <img src={url as string} alt={alt} className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />
      ) : streetViewUrl ? (
        <div className="relative h-full w-full">
          <img src={streetViewUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
          <span className="absolute bottom-2 left-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
            Street View
          </span>
        </div>
      ) : (
        <div className="flex h-full min-h-[72px] w-full items-center justify-center">
          <span className="text-sm text-gray-500">No photos yet</span>
        </div>
      )}
    </div>
  )
}

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true,
  )
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = () => setDesktop(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return desktop
}

export function TenantMatchesMap({
  cards,
  onApply,
  onToggleSaved,
  renderScore,
}: {
  cards: TenantMapCard[]
  onApply: (id: string) => void
  onToggleSaved: (id: string) => void
  renderScore: (id: string) => ReactNode
}) {
  const desktop = useIsDesktop()
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mapShare, setMapShare] = useState(0.5)
  const splitRef = useRef<HTMLDivElement>(null)
  const dragOrigin = useRef<{ y: number; share: number } | null>(null)

  const pins = useMemo(
    () => deriveListingPins(cards.map((card) => ({
      id: card.id,
      lat: card.lat,
      lng: card.lng,
      matchScore: card.matchScore,
      priceLabel: card.pricePin,
    }))),
    [cards],
  )
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const pinsKey = pins.map((pin) => `${pin.id}:${pin.lat}:${pin.lng}`).join('|')
  const positions = useMemo(() => pins.map((pin) => [pin.lat, pin.lng] as [number, number]), [pins])

  useEffect(() => {
    if (!selectedId) return
    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(`match-card-${selectedId}`)
      const scroller = card?.closest('[data-match-scroller]')
      if (!(card instanceof HTMLElement) || !(scroller instanceof HTMLElement)) return
      const cardRect = card.getBoundingClientRect()
      const scrollerRect = scroller.getBoundingClientRect()
      if (cardRect.top < scrollerRect.top || cardRect.bottom > scrollerRect.bottom) {
        scroller.scrollBy({ top: cardRect.top - scrollerRect.top - 8, behavior: 'smooth' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedId, mobileView])

  const showMap = desktop || mobileView === 'map'
  const mapHeight = !desktop && mobileView === 'map' ? `${Math.round(mapShare * 100)}%` : undefined
  const sheetHeight = !desktop && mobileView === 'map' ? `${Math.round((1 - mapShare) * 100)}%` : undefined

  function onDragStart(event: PointerEvent<HTMLButtonElement>) {
    if (desktop || mobileView !== 'map') return
    dragOrigin.current = { y: event.clientY, share: mapShare }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onDragMove(event: PointerEvent<HTMLButtonElement>) {
    const origin = dragOrigin.current
    const height = splitRef.current?.clientHeight ?? 0
    if (!origin || height <= 0) return
    const next = origin.share + (event.clientY - origin.y) / height
    setMapShare(Math.min(0.72, Math.max(0.28, next)))
  }

  function onDragEnd() {
    dragOrigin.current = null
  }

  return (
    <div className="relative h-full">
      <div
        ref={splitRef}
        className={`flex h-full overflow-hidden rounded-2xl border border-gray-200 bg-white ${
          !desktop && mobileView === 'list' ? 'min-h-[calc(100dvh-8rem)] flex-col' : 'h-[calc(100dvh-8rem)] flex-col'
        } md:h-full md:min-h-0 md:flex-row`}
      >
        {showMap ? (
          <div className="relative min-h-0 md:h-full md:w-[60%]" style={mapHeight ? { height: mapHeight } : undefined}>
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              zoomControl={false}
              className="listing-map-root h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ZoomControl position="topright" />
              <FitPins pinsKey={pinsKey} positions={positions} />
              <InvalidateSize token={`${desktop}-${mobileView}-${mapShare.toFixed(2)}-${pinsKey}`} />
              <LocateButton desktop={desktop} />
              {pins.map((pin) => {
                const card = cardById.get(pin.id)
                if (!card) return null
                return (
                  <PriceMarker
                    key={pin.id}
                    pin={pin}
                    card={card}
                    selected={selectedId === pin.id}
                    onSelect={setSelectedId}
                  />
                )
              })}
            </MapContainer>
            <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-[11px] text-gray-700 shadow">
              <p className="mb-1 font-semibold text-gray-800">Pin color · match score</p>
              <ul className="space-y-1">
                {MATCH_SCORE_BANDS.map((band) => (
                  <li key={band.label} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: band.hex }} />
                    <span>{band.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <section
          className={`flex min-h-0 flex-col md:h-full md:w-[40%] ${showMap ? '' : 'flex-1'}`}
          style={sheetHeight ? { height: sheetHeight } : undefined}
        >
          {!desktop && mobileView === 'map' ? (
            <button
              type="button"
              aria-label="Drag to resize the list"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="flex w-full cursor-ns-resize touch-none justify-center bg-white py-2.5"
            >
              <span className="h-1.5 w-12 rounded-full bg-gray-300" />
            </button>
          ) : (
            <div className="h-2 md:hidden" />
          )}
          <div className="px-4 pb-2">
            <h2 className="text-lg font-bold text-gray-900">{cards.length} matches</h2>
            <p className="text-xs text-gray-500">Based on your preferences and compatibility.</p>
          </div>
          <div data-match-scroller className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 md:pb-4">
            {cards.length === 0 ? (
              <p className="px-1 py-8 text-sm text-gray-500">No matches in this view.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {cards.map((card) => {
                  const selected = selectedId === card.id
                  const score = card.matchScore
                  const bar = scoreBarColor(score ?? 0)
                  const showScore = score != null
                  return (
                    <article
                      id={`match-card-${card.id}`}
                      key={card.id}
                      className={`overflow-hidden rounded-xl border bg-white ${
                        selected ? 'border-[#3A7AFE] ring-2 ring-[#3A7AFE]/30' : 'border-gray-200'
                      }`}
                    >
                      <div className="relative">
                        <Link to={`/property/${card.id}?from=matches`} className="block">
                          <CardPhoto
                            url={card.photoUrl}
                            alt={card.photoAlt}
                            fallbackAddress={card.photoAddress}
                            className="aspect-[4/3] w-full"
                          />
                          {showScore ? (
                            <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-900 shadow">
                              {score}% match
                            </span>
                          ) : null}
                        </Link>
                        <button
                          type="button"
                          onClick={() => onToggleSaved(card.id)}
                          className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-gray-400 shadow hover:text-gray-700"
                          aria-label={card.saved ? 'Unsave' : 'Save'}
                        >
                          {card.saved ? (
                            <svg className="h-5 w-5 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 21s-6.716-4.535-9.193-8.12C.99 10.257 1.37 6.84 4.127 4.963c2.168-1.476 5.02-1.05 6.873 1.027 1.853-2.076 4.705-2.503 6.873-1.027 2.757 1.877 3.137 5.294 1.32 7.917C18.716 16.465 12 21 12 21z" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <Link to={`/property/${card.id}?from=matches`} className="block space-y-1 px-3 pt-2.5">
                        <p className="truncate text-sm font-semibold text-gray-900">{card.title}</p>
                        <p className="text-sm font-bold text-gray-900">{card.price}</p>
                        <p className="text-xs text-gray-600">{card.bedsBaths}</p>
                        <p className="truncate text-xs text-gray-500">{card.address}</p>
                      </Link>
                      {card.landlordHref ? (
                        <p className="px-3 pt-1 text-xs text-gray-600">
                          Listed by{' '}
                          <Link to={card.landlordHref} className="font-medium text-gray-900 underline">
                            {card.landlordName?.trim() || 'View landlord profile'}
                          </Link>
                        </p>
                      ) : null}
                      <div className="space-y-2 px-3 py-2">
                        {renderScore(card.id)}
                        {showScore ? (
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
                              <span>Match</span>
                              <span>{score}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                              <div className={`h-full rounded-full ${bar.bg}`} style={{ width: `${score}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="px-3 pb-3">
                        {card.applied ? (
                          <span className="flex items-center justify-center gap-2 rounded-lg bg-[#3A7AFE] px-4 py-2.5 text-sm font-medium text-white">
                            Applied
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onApply(card.id)}
                            className="w-full rounded-lg bg-[#3A7AFE] px-4 py-2.5 text-sm font-medium text-white"
                          >
                            Apply Now
                          </button>
                        )}
                        {card.statusHref ? (
                          <Link
                            to={card.statusHref}
                            className="mt-2 block text-center text-sm font-medium text-gray-900 underline"
                          >
                            Application status
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 md:hidden">
        <div className="flex rounded-full bg-[#0F1E3D] p-1 text-sm font-semibold text-white shadow-lg">
          <button
            type="button"
            onClick={() => setMobileView('map')}
            className={`rounded-full px-4 py-1.5 ${mobileView === 'map' ? 'bg-white text-[#0F1E3D]' : ''}`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setMobileView('list')}
            className={`rounded-full px-4 py-1.5 ${mobileView === 'list' ? 'bg-white text-[#0F1E3D]' : ''}`}
          >
            List
          </button>
        </div>
      </div>
    </div>
  )
}
