import React from 'react';
import { Home, User, Mail, Settings, Bell, Search, Bed, Bath, LayoutGrid, Building2, ChevronDown, Check, Users, MapPin, Plus, SlidersHorizontal } from 'lucide-react';
import './_group.css';

const navItems = [
  { label: 'Matches', icon: Home, active: false },
  { label: 'Properties', icon: Building2, active: true },
  { label: 'Inbox', icon: Mail, active: false },
  { label: 'My Profile', icon: User, active: false },
  { label: 'Settings', icon: Settings, active: false },
];

const properties = [
  { title: 'Sunny 2BR in Mission District', address: '1234 Valencia St, San Francisco, CA 94110', price: '$3,200/month', beds: '2 bd', baths: '1 ba', sqft: '950 sqft', status: 'Active', applicants: 12 },
  { title: 'Modern Loft Downtown', address: '88 Market St, San Francisco, CA 94105', price: '$2,850/month', beds: '1 bd', baths: '1 ba', sqft: '720 sqft', status: 'Active', applicants: 8 },
  { title: 'Cozy Studio near Park', address: '410 Stanyan St, San Francisco, CA 94117', price: '$2,100/month', beds: 'Studio', baths: '1 ba', sqft: '480 sqft', status: 'Draft', applicants: 0 },
  { title: 'Spacious 3BR Family Home', address: '27 Noe St, San Francisco, CA 94114', price: '$4,500/month', beds: '3 bd', baths: '2 ba', sqft: '1,640 sqft', status: 'Leased', applicants: 24 },
  { title: 'Renovated 1BR with Balcony', address: '555 Hayes St, San Francisco, CA 94102', price: '$2,650/month', beds: '1 bd', baths: '1 ba', sqft: '640 sqft', status: 'Inactive', applicants: 3 },
  { title: 'Bright Corner Unit', address: '900 Folsom St, San Francisco, CA 94107', price: '$3,000/month', beds: '2 bd', baths: '2 ba', sqft: '1,020 sqft', status: 'Active', applicants: 15 },
];

function statusPill(status: string) {
  if (status === 'Active') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#EEF4FE] text-[#3A7AFE] flex items-center gap-1 shadow-sm"><Check className="w-3 h-3" /> Active</span>;
  }
  if (status === 'Draft') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white text-gray-500 border border-gray-200 shadow-sm">Draft</span>;
  }
  if (status === 'Leased') {
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-[#0F1E3D] shadow-sm">Leased</span>;
  }
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-400 border border-gray-100 shadow-sm">Inactive</span>;
}

function PropertyCard({ p }: { p: typeof properties[number] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100/50 overflow-hidden shadow-[0_14px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col group relative">
      <div className="h-44 bg-gradient-to-br from-[#F8FAFD] to-[#EEF4FE] relative flex items-center justify-center border-b border-gray-50 overflow-hidden">
        {/* Soft decorative background shapes */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#00BBFF]/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-[#3A7AFE]/10 rounded-full blur-xl"></div>
        <Building2 className="w-10 h-10 text-[#3A7AFE]/20 relative z-10" />
        
        <div className="absolute top-4 right-4 z-20">
          {statusPill(p.status)}
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="mb-3">
          <h3 className="font-extrabold text-[#0F1E3D] text-[17px] leading-snug group-hover:text-[#3A7AFE] transition-colors line-clamp-1">{p.title}</h3>
          <p className="text-xs font-medium text-gray-400 mt-1.5 flex items-center gap-1.5 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{p.address}</span>
          </p>
        </div>
        <div className="mt-auto">
          <div className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[#00BBFF] to-[#3A7AFE] tracking-tight">{p.price}</div>
          <div className="mt-3 flex items-center gap-3 text-xs font-medium text-gray-500">
            <span className="flex items-center gap-1.5"><Bed className="w-3.5 h-3.5" />{p.beds}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <span className="flex items-center gap-1.5"><Bath className="w-3.5 h-3.5" />{p.baths}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <span className="flex items-center gap-1.5"><LayoutGrid className="w-3.5 h-3.5" />{p.sqft}</span>
          </div>
          <div className="mt-5 flex items-center justify-between pt-4 border-t border-gray-50">
            <div className={`flex items-center gap-1.5 text-[13px] font-bold ${p.applicants > 0 ? 'text-[#0F1E3D]' : 'text-gray-400'}`}>
              <Users className={`w-4 h-4 ${p.applicants > 0 ? 'text-[#3A7AFE]' : ''}`} />
              {p.applicants} applicant{p.applicants !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-4">
              <button className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                Edit
              </button>
              <button className="text-sm font-bold text-[#3A7AFE] hover:text-[#0F1E3D] transition-colors">
                View
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandlordRedesigned() {
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
              RS
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
            
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-[#0F1E3D]">Your Properties</h1>
                <p className="text-[15px] font-medium text-gray-500 mt-2">Manage your listings and applicants.</p>
              </div>
              <button className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#00BBFF] to-[#3A7AFE] text-white text-sm font-bold shadow-md hover:shadow-lg hover:opacity-90 transition-all flex items-center gap-2 shrink-0">
                <Plus className="w-4 h-4" />
                Add Property
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Listings</span>
                <span className="text-2xl font-black text-[#0F1E3D]">6</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#EEF4FE] to-transparent pointer-events-none"></div>
                <span className="text-xs font-bold text-[#3A7AFE] uppercase tracking-wider mb-1">Active</span>
                <span className="text-2xl font-black text-[#0F1E3D]">3</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total Applicants</span>
                <span className="text-2xl font-black text-[#0F1E3D]">62</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-wrap items-center gap-2 mb-8">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  className="w-full pl-11 pr-4 py-3 bg-transparent text-sm font-medium text-[#0F1E3D] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3A7AFE]/20 rounded-xl transition-shadow" 
                  placeholder="Search properties by address or name..." 
                />
              </div>
              
              <div className="w-px h-8 bg-gray-100 hidden sm:block"></div>
              
              <div className="relative shrink-0">
                <select className="appearance-none pl-4 pr-10 py-3 bg-transparent text-sm font-bold text-[#0F1E3D] focus:outline-none cursor-pointer">
                  <option>All Statuses</option>
                  <option>Active</option>
                  <option>Draft</option>
                  <option>Leased</option>
                  <option>Inactive</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
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
