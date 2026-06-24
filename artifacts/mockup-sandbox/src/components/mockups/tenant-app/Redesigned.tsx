import React from 'react';
import { User, Mail, Settings, Bell, Search, SlidersHorizontal, Bed, Bath, LayoutGrid, Building, ChevronDown, Check } from 'lucide-react';
import './_group.css';

const navItems = [
  { label: 'Matches', icon: LayoutGrid, active: true },
  { label: 'My Profile', icon: User, active: false },
  { label: 'Inbox', icon: Mail, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

type Dims = { affordability: number; stability: number; risk: number; lifestyle: number; policy: number };

const DIMENSIONS: { key: keyof Dims; emoji: string; label: string; max: number }[] = [
  { key: 'affordability', emoji: '💰', label: 'Affordability', max: 35 },
  { key: 'stability', emoji: '🏠', label: 'Stability', max: 25 },
  { key: 'risk', emoji: '🛡️', label: 'Risk fit', max: 20 },
  { key: 'lifestyle', emoji: '✨', label: 'Lifestyle', max: 10 },
  { key: 'policy', emoji: '📋', label: 'Policy', max: 10 },
];

const properties = [
  { title: 'Sunny 2BR in Mission District', price: '$3,200/mo', beds: '2 bd', baths: '1 ba', sqft: '950 sqft', score: 94, label: 'Excellent match', status: 'Accepted', dims: { affordability: 35, stability: 24, risk: 17, lifestyle: 9, policy: 9 } },
  { title: 'Modern Loft Downtown', price: '$2,850/mo', beds: '1 bd', baths: '1 ba', sqft: '720 sqft', score: 88, label: 'Excellent match', status: null, dims: { affordability: 33, stability: 22, risk: 16, lifestyle: 8, policy: 9 } },
  { title: 'Cozy Studio near Park', price: '$2,100/mo', beds: 'Studio', baths: '1 ba', sqft: '480 sqft', score: 72, label: 'Good match', status: null, dims: { affordability: 28, stability: 18, risk: 14, lifestyle: 7, policy: 5 } },
  { title: 'Spacious 3BR Family Home', price: '$4,500/mo', beds: '3 bd', baths: '2 ba', sqft: '1,640 sqft', score: 91, label: 'Excellent match', status: null, dims: { affordability: 34, stability: 23, risk: 17, lifestyle: 9, policy: 8 } },
  { title: 'Renovated 1BR with Balcony', price: '$2,650/mo', beds: '1 bd', baths: '1 ba', sqft: '640 sqft', score: 67, label: 'Good match', status: 'Locked', dims: { affordability: 25, stability: 17, risk: 13, lifestyle: 7, policy: 5 } },
  { title: 'Bright Corner Unit', price: '$3,000/mo', beds: '2 bd', baths: '2 ba', sqft: '1,020 sqft', score: 85, label: 'Excellent match', status: null, dims: { affordability: 32, stability: 21, risk: 16, lifestyle: 8, policy: 8 } },
];

// Brand Colors
// Primary gradient: linear-gradient(83.7338deg, #00BBFF 11.921%, #3A7AFE 90.638%)
// Ink: #0F1E3D
// Navy: #0A1733

function scoreColor(score: number) {
  if (score >= 90) return 'bg-[#3A7AFE] text-white'; // Deep blue
  if (score >= 80) return 'bg-[#00BBFF] text-white'; // Light blue
  return 'bg-[#EEF4FE] text-[#3A7AFE]'; // Soft blue
}

function statusPill(status: string | null) {
  if (status === 'Accepted') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#EEF4FE] text-[#3A7AFE] flex items-center gap-1"><Check className="w-3 h-3" /> Accepted</span>;
  }
  if (status === 'Locked') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Locked</span>;
  }
  return <span />;
}

function MatchBreakdown({ score, dims }: { score: number; dims: Dims }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-50">
      {/* Overall match score */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-xs font-bold text-[#0F1E3D]">Match score</span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#3A7AFE] text-xs font-extrabold text-[#0F1E3D] shrink-0">
          {score}
        </span>
        <div className="flex-1 h-2 rounded-full bg-[#EEF4FE] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#00BBFF] to-[#3A7AFE]" style={{ width: `${score}%` }} />
        </div>
      </div>

      {/* Per-dimension contribution bars */}
      <div className="space-y-2">
        {DIMENSIONS.map((d) => {
          const val = dims[d.key];
          const pct = Math.min(100, Math.max(0, (val / d.max) * 100));
          return (
            <div key={d.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-4 text-center shrink-0">{d.emoji}</span>
              <span className="text-gray-600 font-medium w-[5.25rem] shrink-0">{d.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#EEF4FE] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#00BBFF] to-[#3A7AFE]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-gray-400 font-semibold w-[3.25rem] text-right shrink-0 tabular-nums">{val} / {d.max}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-400 mt-2.5">Bars show weighted contribution to total score.</p>
    </div>
  );
}

function PropertyCard({ p }: { p: typeof properties[number] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden shadow-[0_14px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col group">
      <div className="h-44 bg-gradient-to-br from-[#F8FAFD] to-[#EEF4FE] relative flex items-center justify-center border-b border-gray-50 overflow-hidden">
        {/* Soft decorative background shapes */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#00BBFF]/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-[#3A7AFE]/10 rounded-full blur-xl"></div>
        <Building className="w-10 h-10 text-[#3A7AFE]/30 relative z-10" />

        <div
          className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm z-20 ${scoreColor(p.score)}`}
        >
          {p.score}% {p.label}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-extrabold text-[#0F1E3D] text-base leading-snug group-hover:text-[#3A7AFE] transition-colors">{p.title}</h3>
        </div>
        <div className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#00BBFF] to-[#3A7AFE] tracking-tight">{p.price}</div>
        <div className="mt-2.5 flex items-center gap-3 text-xs font-medium text-gray-500">
          <span className="flex items-center gap-1.5"><Bed className="w-3.5 h-3.5" />{p.beds}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span className="flex items-center gap-1.5"><Bath className="w-3.5 h-3.5" />{p.baths}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span className="flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" />{p.sqft}</span>
        </div>

        {/* Match score + weighted breakdown */}
        <MatchBreakdown score={p.score} dims={p.dims} />

        <div className="mt-5 flex items-center justify-between pt-4 border-t border-gray-50">
          {statusPill(p.status)}
          <button className="text-sm font-bold text-[#3A7AFE] hover:text-[#0F1E3D] transition-colors ml-auto flex items-center gap-1">
            View details
          </button>
        </div>
      </div>
    </div>
  );
}

export function Redesigned() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFD] text-gray-600 font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200/60 sticky top-0 z-30 h-16 flex items-center shadow-sm">
        <div className="w-64 shrink-0 flex items-center px-6 border-r border-gray-200/60 h-full">
          <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-[#00BBFF] to-[#3A7AFE]">Rental City</span>
        </div>
        <div className="flex-1 flex justify-end items-center px-6">
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-[#0F1E3D] transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#3A7AFE] border-2 border-white"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00BBFF] to-[#3A7AFE] flex items-center justify-center text-sm font-bold text-white shadow-md cursor-pointer hover:opacity-90 transition-opacity">
              JD
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Fixed Left Sidebar */}
        <aside className="w-64 shrink-0 bg-white border-r border-gray-200/60 flex flex-col hidden md:flex">
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold text-sm ${
                    item.active
                      ? 'bg-[#EEF4FE] text-[#3A7AFE]'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-[#0F1E3D]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${item.active ? 'text-[#3A7AFE]' : 'text-gray-400 group-hover:text-[#0F1E3D]'}`} strokeWidth={item.active ? 2.5 : 2} />
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Help / Bottom Section */}
          <div className="p-6 mt-auto">
            <div className="bg-[#F8FAFD] rounded-xl p-4 border border-gray-100">
              <h4 className="text-sm font-bold text-[#0F1E3D] mb-1">Need help?</h4>
              <p className="text-xs text-gray-500 mb-3">Our support team is here for you.</p>
              <button className="text-xs font-bold text-[#3A7AFE] hover:text-[#0F1E3D] transition-colors">Contact Support</button>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-[#F8FAFD]">
          <div className="max-w-6xl mx-auto p-6 lg:p-10">
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-[#0F1E3D]">Your Matches</h1>
              <p className="text-[15px] font-medium text-gray-500 mt-2">6 properties match your preferences perfectly.</p>
            </div>

            {/* Controls Bar */}
            <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-wrap items-center gap-2 mb-8">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full pl-11 pr-4 py-3 bg-transparent text-sm font-medium text-[#0F1E3D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A7AFE]/20 rounded-xl transition-shadow"
                  placeholder="Search neighborhoods or cities..."
                />
              </div>

              <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>

              <div className="relative shrink-0">
                <select className="appearance-none pl-4 pr-10 py-3 bg-transparent text-sm font-bold text-[#0F1E3D] focus:outline-none cursor-pointer">
                  <option>Any price</option>
                  <option>Under $2k</option>
                  <option>$2k - $3k</option>
                  <option>$3k+</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>

              <div className="relative shrink-0">
                <select className="appearance-none pl-4 pr-10 py-3 bg-transparent text-sm font-bold text-[#0F1E3D] focus:outline-none cursor-pointer">
                  <option>Any beds</option>
                  <option>Studio</option>
                  <option>1+ Beds</option>
                  <option>2+ Beds</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>

              <button className="px-5 py-3 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
                More Filters
              </button>
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((p, idx) => (
                <PropertyCard key={idx} p={p} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
