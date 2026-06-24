import './_group.css'

const navItems = [
  { label: 'Matches', icon: 'home', active: true },
  { label: 'My Profile', icon: 'person', active: false },
  { label: 'Inbox', icon: 'envelope', active: false },
  { label: 'Settings', icon: 'settings', active: false },
]

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    person: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    envelope: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  }
  return icons[name] ?? null
}

const properties = [
  { title: 'Sunny 2BR in Mission District', price: '$3,200/mo', beds: '2 bd', baths: '1 ba', sqft: '950 sqft', score: 94, label: 'Excellent match', status: 'Accepted' },
  { title: 'Modern Loft Downtown', price: '$2,850/mo', beds: '1 bd', baths: '1 ba', sqft: '720 sqft', score: 88, label: 'Excellent match', status: null },
  { title: 'Cozy Studio near Park', price: '$2,100/mo', beds: 'Studio', baths: '1 ba', sqft: '480 sqft', score: 72, label: 'Good match', status: null },
  { title: 'Spacious 3BR Family Home', price: '$4,500/mo', beds: '3 bd', baths: '2 ba', sqft: '1,640 sqft', score: 91, label: 'Excellent match', status: null },
  { title: 'Renovated 1BR with Balcony', price: '$2,650/mo', beds: '1 bd', baths: '1 ba', sqft: '640 sqft', score: 67, label: 'Good match', status: 'Locked' },
  { title: 'Bright Corner Unit', price: '$3,000/mo', beds: '2 bd', baths: '2 ba', sqft: '1,020 sqft', score: 85, label: 'Excellent match', status: null },
]

function scoreColor(score: number) {
  return score >= 80 ? 'var(--color-score-excellent)' : 'var(--color-score-moderate)'
}

function PropertyCard({ p }: { p: typeof properties[number] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative flex items-center justify-center">
        <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: scoreColor(p.score) }}
        >
          {p.score}% {p.label}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">{p.title}</h3>
        </div>
        <div className="mt-1 text-base font-bold" style={{ color: 'var(--color-primary)' }}>{p.price}</div>
        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
          <span>{p.beds}</span><span>·</span><span>{p.baths}</span><span>·</span><span>{p.sqft}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          {p.status === 'Accepted' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--color-status-accepted-bg)', color: 'var(--color-status-accepted-text)' }}>Accepted</span>
          )}
          {p.status === 'Locked' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--color-status-locked-bg)', color: 'var(--color-status-locked-text)' }}>Locked</span>
          )}
          {!p.status && <span />}
          <button className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg gradient-primary">View</button>
        </div>
      </div>
    </div>
  )
}

export function Current() {
  return (
    <div className="tenant-app-scope min-h-screen flex flex-col bg-gray-50" style={{ background: '#F8F9FA' }}>
      <div className="flex flex-1 min-h-0 flex-col w-full max-w-[1600px] mx-auto pl-2 pr-4">
        {/* Header */}
        <header className="relative z-10 bg-white border-b shrink-0 -mx-4 pl-2 pr-4">
          <div className="flex items-center">
            <div className="flex items-center py-4">
              <span className="text-xl font-extrabold tracking-tight" style={{ background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Rental City</span>
            </div>
            <div className="w-56 shrink-0 mr-4" aria-hidden />
            <div className="flex-1 min-w-0 flex justify-end">
              <nav className="flex items-center gap-2 py-4">
                <button className="p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">JD</div>
              </nav>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 min-h-0 -ml-4 -mr-4">
          <aside className="relative z-10 w-56 shrink-0 mr-4 bg-white text-gray-900 flex flex-col border-r border-gray-100">
            <nav className="flex-1 p-4 space-y-1 pt-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer ${
                    item.active ? 'gradient-primary text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                  }`}
                  style={item.active ? {} : { color: 'var(--color-neutral-500)' }}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 overflow-auto min-w-0">
              <div className="w-full pt-4 pb-6 shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">Your Matches</h1>
                <p className="text-sm text-gray-500 mt-1">6 properties match your preferences</p>

                {/* Search + filters */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[240px] relative">
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Search neighborhoods..." />
                  </div>
                  <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600"><option>Any price</option></select>
                  <select className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600"><option>Any beds</option></select>
                  <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white gradient-primary">Filters</button>
                </div>

                {/* Grid */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {properties.map((p) => <PropertyCard key={p.title} p={p} />)}
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 bg-white border-t py-6 shrink-0 -mx-4 pl-2 pr-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-600">© 2026 Rental City. All rights reserved.</span>
            <div className="w-56 shrink-0 mr-4" aria-hidden />
            <div className="flex-1 min-w-0 flex justify-end">
              <nav className="flex items-center gap-6 text-sm text-gray-600">
                <a className="hover:text-gray-900 cursor-pointer">About</a>
                <a className="hover:text-gray-900 cursor-pointer">Privacy</a>
                <a className="hover:text-gray-900 cursor-pointer">Terms</a>
                <a className="hover:text-gray-900 cursor-pointer">Support</a>
              </nav>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
