import { Link } from 'react-router-dom'

interface PropertyCardProps {
  id?: string
  image: string
  perfectFit?: boolean
  postedAgo?: string
  beds: number
  baths: number
  sqft: number
  price: string
  address: string
}

export function PropertyCard({
  id,
  image,
  perfectFit = false,
  postedAgo,
  beds,
  baths,
  sqft,
  price,
  address,
}: PropertyCardProps) {
  const content = (
    <article className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="relative aspect-[4/3]">
        <img
          src={image}
          alt={address}
          className="w-full h-full object-cover"
        />
        {perfectFit && (
          <span className="absolute top-2 left-2 px-2 py-1 gradient-primary text-white text-xs font-medium rounded">
            Perfect Fit
          </span>
        )}
        {postedAgo && (
          <span className="absolute top-2 right-2 px-2 py-1 bg-gray-600/90 text-white text-xs rounded">
            {postedAgo}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex gap-4 text-gray-600 text-sm mb-2">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {beds} Beds
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            {baths} Baths
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {sqft} Ft
          </span>
        </div>
        <p className="font-bold text-lg text-gray-900">{price}</p>
        <p className="text-gray-600 text-sm">{address}</p>
      </div>
    </article>
  )

  if (id) {
    return (
      <Link to={`/property/${id}`} className="block">
        {content}
      </Link>
    )
  }

  return content
}
