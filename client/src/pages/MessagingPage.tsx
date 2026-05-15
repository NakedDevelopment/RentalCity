import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { safeInternalPath } from '../lib/safeInternalPath'
import { supabase } from '../lib/supabase'

type ProfileRole = 'tenant' | 'landlord'

type Conversation = {
  id: string
  tenantId: string
  landlordId: string
  counterpartId: string
  name: string
  /** Latest listing focus on the thread (optional). */
  focusPropertyId: string | null
  property: string
  propertyAddress: string
  propertyPrice: string
  preview: string
  timeAgo: string
}

type MatchListingOption = {
  applicationId: string
  propertyId: string
  label: string
  address: string
  rent: string
  status: string
}

type Message = {
  id: string
  from: 'incoming' | 'outgoing'
  body: string
  time: string
  sender: string
  roleLabel?: string
}

type ThreadRow = {
  id: string
  tenant_id: string
  landlord_id: string
  updated_at: string
  property_id: string | null
  property: {
    title: string | null
    address_line1: string
    city: string
    state: string | null
    monthly_rent_cents: number | null
  } | null
  tenant: { display_name: string | null } | null
  landlord: { display_name: string | null } | null
}

type MessageRow = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
  sender: { display_name: string | null } | null
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900">
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9.5c.4-.9 1.2-1.5 2.1-1.5h3.8c1 0 1.8.6 2.1 1.5M9 15c1 .7 1.9 1 3 1s2-.3 3-1M10 11h.01M14 11h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3c3.2 0 5.8 2.6 5.8 5.8v1.5c0 .8.3 1.6.8 2.3l.8 1c.5.6.1 1.4-.6 1.4H5.2c-.7 0-1.1-.8-.6-1.4l.8-1c.5-.7.8-1.5.8-2.3V8.8C6.2 5.6 8.8 3 12 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.5 6.5c.8-.4 1.6-.5 2.5-.5s1.7.1 2.5.5" />
      </svg>
      <span className="sr-only">{name}</span>
    </div>
  )
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return ''

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function applicationStatusLabel(status: string) {
  const s = status.toLowerCase()
  if (s === 'pending') return 'Pending'
  if (s === 'approved') return 'Accepted'
  if (s === 'rejected') return 'Declined'
  if (s === 'withdrawn') return 'Withdrawn'
  return status
}

/** Messages for a thread can be scoped by listing (property_id); null = general / untagged only. */
function messagesQueryForListing(
  threadId: string,
  listingPropertyId: string | null,
) {
  let q = supabase
    .from('messages')
    .select('id, thread_id, sender_id, body, created_at, sender:sender_id(display_name)')
    .eq('thread_id', threadId)

  if (listingPropertyId === null) {
    q = q.is('property_id', null)
  } else {
    q = q.eq('property_id', listingPropertyId)
  }

  return q.order('created_at', { ascending: true })
}

export function MessagingPage() {
  const { user } = useAuth()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [searchParams] = useSearchParams()
  const threadParam = searchParams.get('thread')
  const tenantOrLandlordParam = searchParams.get('tenant')
  const returnToProfile = safeInternalPath(searchParams.get('returnTo'))
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)
  const [selectedReason, setSelectedReason] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [matchOptions, setMatchOptions] = useState<MatchListingOption[]>([])
  const [loadingMatchOptions, setLoadingMatchOptions] = useState(false)
  const [selectedMatchPropertyId, setSelectedMatchPropertyId] = useState<string | null>(null)
  const [savingMatchContext, setSavingMatchContext] = useState(false)
  const reportReasons = [
    'Fraudulent Activity',
    'Inappropriate Conduct',
    'Hate Speech',
    'Unresponsive',
    'Other',
  ]

  useEffect(() => {
    async function loadConversations() {
      if (!user) {
        setLoadingConversations(false)
        return
      }

      setLoadingConversations(true)
      setError(null)

      const { data: threadData, error: threadError } = await supabase
        .from('message_threads')
        .select(
          'id, tenant_id, landlord_id, updated_at, property_id, property:property_id(title, address_line1, city, state, monthly_rent_cents), tenant:tenant_id(display_name), landlord:landlord_id(display_name)',
        )
        .order('updated_at', { ascending: false })

      if (threadError) {
        setLoadingConversations(false)
        setError(threadError.message)
        return
      }

      const threads = (threadData ?? []) as unknown as ThreadRow[]
      const threadIds = threads.map((thread) => thread.id)
      let latestByThread = new Map<string, { body: string; created_at: string }>()

      if (threadIds.length > 0) {
        const { data: latestMessages, error: latestError } = await supabase
          .from('messages')
          .select('thread_id, body, created_at')
          .in('thread_id', threadIds)
          .order('created_at', { ascending: false })

        if (latestError) {
          setLoadingConversations(false)
          setError(latestError.message)
          return
        }

        for (const message of latestMessages ?? []) {
          if (!latestByThread.has(message.thread_id)) {
            latestByThread.set(message.thread_id, {
              body: message.body,
              created_at: message.created_at,
            })
          }
        }
      }

      const mapped = threads.map((thread) => {
        const counterpartIsLandlord = profileRole === 'tenant'
        const counterpartId = counterpartIsLandlord ? thread.landlord_id : thread.tenant_id
        const latest = latestByThread.get(thread.id)
        const propertyLabel =
          thread.property?.title || thread.property?.address_line1 || (thread.property_id ? 'Listing' : '')
        const propertyAddress = [thread.property?.address_line1, thread.property?.city, thread.property?.state]
          .filter(Boolean)
          .join(', ')

        return {
          id: thread.id,
          tenantId: thread.tenant_id,
          landlordId: thread.landlord_id,
          counterpartId,
          name:
            (counterpartIsLandlord ? thread.landlord?.display_name : thread.tenant?.display_name) ||
            (counterpartIsLandlord ? 'Landlord' : 'Tenant'),
          focusPropertyId: thread.property_id ?? null,
          property: propertyLabel,
          propertyAddress,
          propertyPrice: formatCurrency(thread.property?.monthly_rent_cents),
          preview: latest?.body || 'No messages yet.',
          timeAgo: formatRelativeTime(latest?.created_at || thread.updated_at),
        } satisfies Conversation
      })

      setConversations(mapped)
      setSelectedConversationId((current) => {
        if (threadParam && mapped.some((c) => c.id === threadParam)) return threadParam
        if (tenantOrLandlordParam) {
          const byCounterpart = mapped.find((c) => c.counterpartId === tenantOrLandlordParam)
          if (byCounterpart) return byCounterpart.id
        }
        if (current && mapped.some((conversation) => conversation.id === current)) return current
        return mapped[0]?.id ?? ''
      })
      setLoadingConversations(false)
    }

    loadConversations()
  }, [profileRole, user, threadParam, tenantOrLandlordParam])

  useEffect(() => {
    async function loadMessages() {
      if (!user || !selectedConversationId) {
        setMessages([])
        setLoadingMessages(false)
        return
      }

      setLoadingMessages(true)

      const { data, error } = await messagesQueryForListing(selectedConversationId, selectedMatchPropertyId)

      setLoadingMessages(false)

      if (error) {
        setError(error.message)
        return
      }

      const mapped = ((data ?? []) as unknown as MessageRow[]).map((message) => ({
        id: message.id,
        from: message.sender_id === user.id ? 'outgoing' : 'incoming',
        body: message.body,
        time: formatMessageTime(message.created_at),
        sender:
          message.sender_id === user.id
            ? 'You'
            : message.sender?.display_name || (profileRole === 'landlord' ? 'Tenant' : 'Landlord'),
        roleLabel:
          message.sender_id === user.id
            ? profileRole === 'landlord'
              ? 'Landlord'
              : 'Tenant'
            : profileRole === 'landlord'
              ? 'Tenant'
              : 'Landlord',
      }))

      setMessages(mapped)
    }

    loadMessages()
  }, [profileRole, selectedConversationId, selectedMatchPropertyId, user])

  const filteredConversations = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return conversations

    return conversations.filter((conversation) => {
      return (
        conversation.name.toLowerCase().includes(normalized) ||
        (conversation.property || '').toLowerCase().includes(normalized) ||
        conversation.preview.toLowerCase().includes(normalized)
      )
    })
  }, [conversations, searchQuery])

  const activeConversation =
    filteredConversations.find((conversation) => conversation.id === selectedConversationId) ??
    conversations.find((conversation) => conversation.id === selectedConversationId) ??
    filteredConversations[0] ??
    conversations[0] ??
    null

  useEffect(() => {
    async function loadMatchListings() {
      if (!user || !selectedConversationId) {
        setMatchOptions([])
        setSelectedMatchPropertyId(null)
        return
      }

      const conv = conversations.find((c) => c.id === selectedConversationId)
      if (!conv) {
        setMatchOptions([])
        setSelectedMatchPropertyId(null)
        return
      }

      const threadIdWhenStarted = selectedConversationId

      // Avoid showing the previous thread’s listing filter while options load.
      setSelectedMatchPropertyId(conv.focusPropertyId ?? null)

      setLoadingMatchOptions(true)
      setError(null)

      type AppRow = {
        id: string
        status: string
        property_id: string
        property: {
          id: string
          landlord_id: string
          title: string | null
          address_line1: string
          city: string
          state: string | null
          monthly_rent_cents: number | null
        } | null
      }

      const { data, error: appError } = await supabase
        .from('applications')
        .select(
          'id, status, property_id, property:property_id(id, landlord_id, title, address_line1, city, state, monthly_rent_cents)',
        )
        .eq('tenant_id', conv.tenantId)
        .neq('status', 'withdrawn')

      if (appError) {
        setLoadingMatchOptions(false)
        setError(appError.message)
        setMatchOptions([])
        setSelectedMatchPropertyId(null)
        return
      }

      if (threadIdWhenStarted !== selectedConversationId) {
        setLoadingMatchOptions(false)
        return
      }

      const rows = ((data ?? []) as unknown as AppRow[]).filter(
        (r) => r.property?.landlord_id === conv.landlordId,
      )

      const opts: MatchListingOption[] = rows.map((r) => {
        const p = r.property!
        const label = p.title?.trim() || p.address_line1
        const address = [p.address_line1, p.city, p.state].filter(Boolean).join(', ')
        return {
          applicationId: r.id,
          propertyId: r.property_id,
          label,
          address,
          rent: formatCurrency(p.monthly_rent_cents),
          status: r.status,
        }
      })

      setMatchOptions(opts)

      const focus = conv.focusPropertyId
      const focusOk = focus != null && opts.some((o) => o.propertyId === focus)
      // When thread context is general (null), keep general — do not default to first listing
      // or choosing "General" in the UI snaps back to a property.
      setSelectedMatchPropertyId(focusOk ? focus : null)

      setLoadingMatchOptions(false)
    }

    loadMatchListings()
  }, [user, selectedConversationId, conversations])

  const selectedListing = useMemo(() => {
    if (selectedMatchPropertyId == null) return null
    return matchOptions.find((o) => o.propertyId === selectedMatchPropertyId) ?? null
  }, [matchOptions, selectedMatchPropertyId])

  async function handleMatchListingChange(propertyId: string | null) {
    if (!user || !selectedConversationId) return

    setSavingMatchContext(true)
    setError(null)

    const { error: upErr } = await supabase
      .from('message_threads')
      .update({ property_id: propertyId })
      .eq('id', selectedConversationId)

    setSavingMatchContext(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setSelectedMatchPropertyId(propertyId)

    const opt = propertyId ? matchOptions.find((o) => o.propertyId === propertyId) : null
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== selectedConversationId) return c
        return {
          ...c,
          focusPropertyId: propertyId,
          property: opt?.label ?? '',
          propertyAddress: opt?.address ?? '',
          propertyPrice: opt?.rent ?? '',
        }
      }),
    )
  }

  async function handleSendMessage() {
    if (!user || !selectedConversationId || !messageInput.trim()) return

    setSendingMessage(true)
    setError(null)
    setStatusMessage(null)

    const { error } = await supabase.from('messages').insert({
      thread_id: selectedConversationId,
      sender_id: user.id,
      body: messageInput.trim(),
      property_id: selectedMatchPropertyId,
    })

    setSendingMessage(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessageInput('')
    setStatusMessage('Message sent')

    const { data } = await messagesQueryForListing(selectedConversationId, selectedMatchPropertyId)

    setMessages(
      ((data ?? []) as unknown as MessageRow[]).map((message) => ({
        id: message.id,
        from: message.sender_id === user.id ? 'outgoing' : 'incoming',
        body: message.body,
        time: formatMessageTime(message.created_at),
        sender:
          message.sender_id === user.id
            ? 'You'
            : message.sender?.display_name || (profileRole === 'landlord' ? 'Tenant' : 'Landlord'),
        roleLabel:
          message.sender_id === user.id
            ? profileRole === 'landlord'
              ? 'Landlord'
              : 'Tenant'
            : profileRole === 'landlord'
              ? 'Tenant'
              : 'Landlord',
      })),
    )

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              preview: messageInput.trim(),
              timeAgo: 'Just now',
            }
          : conversation,
      ),
    )
  }

  async function handleSubmitReport() {
    if (!user || !activeConversation || !selectedReason) return

    setSubmittingReport(true)
    setError(null)
    setStatusMessage(null)

    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_user_id: activeConversation.counterpartId,
      reason: selectedReason,
      details: reportNote.trim() || null,
    })

    setSubmittingReport(false)

    if (error) {
      const msg = error.message.toLowerCase()
      setError(
        msg.includes('row-level security') || msg.includes('violates row-level security')
          ? 'You can only report someone from this conversation. For anything else, use Support under Account settings.'
          : error.message,
      )
      return
    }

    setReportModalOpen(false)
    setSelectedReason('')
    setReportNote('')
    setStatusMessage('Report submitted successfully.')
  }

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex min-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
        {returnToProfile ? (
          <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-2.5">
            <Link
              to={returnToProfile}
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to tenant profile
            </Link>
          </div>
        ) : null}
        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] overflow-hidden">
          <div className="border-r border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-3 py-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-9 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {loadingConversations ? (
              <div className="px-4 py-6 text-sm text-gray-500">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">No conversations yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredConversations.map((conversation) => {
                  const isActive = conversation.id === activeConversation?.id

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`flex w-full items-start gap-3 px-3 py-4 text-left ${
                        isActive ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <Avatar name={conversation.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-gray-900">{conversation.name}</p>
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-500" />
                        </div>
                        {conversation.property ? (
                          <p className="mt-1 truncate text-xs text-gray-500">{conversation.property}</p>
                        ) : (
                          <p className="mt-1 truncate text-xs text-gray-400">Direct messages</p>
                        )}
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-700">{conversation.preview}</p>
                        <p className="mt-1 text-xs text-gray-400">{conversation.timeAgo}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex min-h-full flex-col bg-white">
            {activeConversation ? (
              <>
                <div className="border-b border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <Avatar name={activeConversation.name} />
                        <div className="min-w-0 flex-1">
                          <h1 className="truncate text-[1.35rem] font-medium text-gray-900">
                            {activeConversation.name}
                          </h1>
                          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                            Match / listing context
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <label htmlFor="match-listing-select" className="sr-only">
                              Choose listing to discuss
                            </label>
                            <select
                              id="match-listing-select"
                              value={selectedMatchPropertyId ?? ''}
                              disabled={loadingMatchOptions || savingMatchContext}
                              onChange={(e) => {
                                const v = e.target.value
                                handleMatchListingChange(v === '' ? null : v)
                              }}
                              className="max-w-full min-w-0 flex-1 rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-800 focus:border-gray-300 focus:outline-none disabled:opacity-60"
                            >
                              <option value="">
                                {loadingMatchOptions
                                  ? 'Loading listings…'
                                  : 'General — not about a specific listing'}
                              </option>
                              {matchOptions.map((o) => (
                                <option key={o.propertyId} value={o.propertyId}>
                                  {o.label}
                                  {o.rent ? ` · ${o.rent}` : ''} ({applicationStatusLabel(o.status)})
                                </option>
                              ))}
                            </select>
                            {savingMatchContext ? (
                              <span className="text-xs text-gray-400">Saving…</span>
                            ) : null}
                          </div>
                          {selectedListing ? (
                            <p className="mt-2 text-sm text-gray-600">{selectedListing.address}</p>
                          ) : selectedMatchPropertyId == null && !loadingMatchOptions ? (
                            <p className="mt-2 text-sm text-gray-500">
                              Pick a listing to tie messages to an application, or stay general.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(true)}
                      className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label="Conversation options"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-7 overflow-y-auto px-4 py-4">
                  {loadingMessages ? (
                    <p className="text-sm text-gray-500">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {selectedMatchPropertyId
                        ? 'No messages for this listing yet. Start the thread below.'
                        : 'No general messages yet. Pick a listing above for listing-specific chat, or start below.'}
                    </p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.from === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.from === 'incoming' ? (
                          <div className="max-w-[63%]">
                            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                              <Avatar name={message.sender} />
                              <span className="font-medium text-gray-800">{message.sender}</span>
                              {message.roleLabel ? <span>{message.roleLabel}</span> : null}
                              <span>{message.time}</span>
                            </div>
                            <div className="rounded-md bg-gray-100 px-4 py-3 text-sm leading-7 text-gray-800">
                              {message.body}
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-[57%]">
                            <div className="mb-2 flex items-center justify-end gap-2 text-xs text-gray-500">
                              <span>{message.time}</span>
                              {message.roleLabel ? <span>{message.roleLabel}</span> : null}
                              <span className="font-medium text-gray-800">{message.sender}</span>
                              <Avatar name={message.sender} />
                            </div>
                            <div className="rounded-md bg-gray-900 px-4 py-3 text-sm leading-7 text-white shadow-sm">
                              {message.body}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {statusMessage ? (
                  <div className="flex justify-center border-t border-gray-100 bg-white px-4 py-3">
                    <div className="inline-flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {statusMessage}
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-gray-200 bg-white px-4 py-3">
                  {selectedListing ? (
                    <p className="mb-2 text-xs text-gray-500">
                      Sending in context of:{' '}
                      <span className="font-medium text-gray-700">{selectedListing.label}</span>
                    </p>
                  ) : null}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(event) => setMessageInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' || event.shiftKey) return
                        event.preventDefault()
                        if (sendingMessage || !messageInput.trim()) return
                        void handleSendMessage()
                      }}
                      placeholder="Type your message..."
                      className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={sendingMessage || !messageInput.trim()}
                      onClick={handleSendMessage}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
                      aria-label="Send message"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-8 text-center">
                <div>
                  <h2 className="text-[1.4rem] font-medium text-gray-900">No conversations yet</h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-gray-600">
                    Messages will appear here once you start a conversation with a tenant or landlord.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {reportModalOpen && activeConversation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-[364px] rounded-xl bg-white p-4 shadow-2xl">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close report modal"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-1 pb-1">
              <h2 className="text-center text-[1.55rem] font-medium text-gray-900">Report user</h2>
              <p className="mx-auto mt-3 max-w-[280px] text-center text-sm leading-6 text-gray-600">
                This sends a report to Rental City staff about <span className="font-medium text-gray-800">the person you are
                messaging here</span>—not someone else. Misuse may affect your account.
              </p>
              <p className="mx-auto mt-2 max-w-[280px] text-center text-xs leading-5 text-gray-500">
                For billing, bugs, or general help, use Support in Account settings instead.
              </p>

              <div className="mt-5 space-y-3.5">
                {reportReasons.map((reason) => {
                  const checked = selectedReason === reason

                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className="flex w-full items-center gap-4 text-left text-sm text-gray-700"
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${checked ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-white'}`}>
                        {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
                      </span>
                      <span>{reason}</span>
                    </button>
                  )
                })}
              </div>

              <textarea
                value={reportNote}
                onChange={(event) => setReportNote(event.target.value)}
                placeholder="Add a note..."
                rows={5}
                className="mt-5 w-full rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />

              <button
                type="button"
                disabled={submittingReport || !selectedReason}
                onClick={handleSubmitReport}
                className="mt-5 w-full rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {submittingReport ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
