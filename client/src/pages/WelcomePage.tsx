import { Link } from 'react-router-dom'

export function WelcomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
      <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-10 w-auto mb-3" />
      <p className="text-gray-600 italic mb-12">Find your perfect match</p>

      <div className="w-full max-w-sm">
        <Link
          to="/signup"
          className="block w-full py-3 px-4 btn-primary text-white font-medium text-center rounded-lg"
        >
          Sign Up with Email
        </Link>
      </div>

      <p className="mt-8 text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="text-emerald-600 font-medium underline hover:text-emerald-700">
          Sign In
        </Link>
      </p>
    </div>
  )
}
