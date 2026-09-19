export function RentScoreVerificationBadge({ verified }: { verified: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {verified ? 'Verified' : 'Unverified'}
    </span>
  )
}