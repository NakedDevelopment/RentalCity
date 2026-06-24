import { Link } from 'react-router-dom'
import { Bed, Bath, Maximize } from 'lucide-react'

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
    <article className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_14px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-all duration-300 cursor-pointer">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={image}
          alt={address}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {perfectFit && (
          <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#3A7AFE] text-white text-xs font-bold rounded-full shadow-sm">
            Perfect Fit
          </span>
        )}
        {postedAgo && (
          <span className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-full shadow-sm">
            {postedAgo}
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="flex gap-4 text-gray-500 text-xs font-medium mb-3">
          <span className="flex items-center gap-1.5">
            <Bed className="w-3.5 h-3.5" />
            {beds} Beds
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="w-3.5 h-3.5" />
            {baths} Baths
          </span>
          <span className="flex items-center gap-1.5">
            <Maximize className="w-3.5 h-3.5" />
            {sqft} Ft
          </span>
        </div>
        <p className="font-extrabold text-lg text-[#0F1E3D] group-hover:text-[#3A7AFE] transition-colors">{price}</p>
        <p className="text-gray-500 text-sm mt-0.5">{address}</p>
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
