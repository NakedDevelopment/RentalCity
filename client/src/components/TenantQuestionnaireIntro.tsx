import React from 'react'
import { ArrowRight, Clock, House, Star } from 'lucide-react'

// Classic JSX (`tsx --test` without the client tsconfig) compiles elements to React.createElement.
void React

const cards = [
  {
    title: 'Better matches',
    body: 'Landlords who fit how you live.',
    tile: 'bg-[#E6F7F6] text-[#0E8F8C]',
    icon: House,
  },
  {
    title: 'Takes a few minutes',
    body: 'Short and simple, done in one go.',
    tile: 'bg-[#FFF1E4] text-[#E07A1F]',
    icon: Clock,
  },
  {
    title: 'Stand out to landlords',
    body: 'A complete profile gets noticed first.',
    tile: 'bg-[#EEF0FF] text-[#4F46E5]',
    icon: Star,
  },
] as const

export function TenantQuestionnaireIntro({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto font-sans text-[#0F1E3D]"
      style={{
        background:
          'radial-gradient(ellipse 70% 55% at 0% 0%, rgba(0, 187, 255, 0.18), rgba(255, 255, 255, 0) 58%), #fbfcfe',
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-8 sm:px-8 md:px-12 md:py-10">
        <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-8 w-auto self-start" />

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col pb-6 pt-10 md:pt-16">
          <p className="text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1A8CB8] md:text-center">
            Before your questionnaire
          </p>

          <h1 className="mt-4 text-left text-[2.75rem] font-bold leading-[1.05] tracking-[-0.03em] md:text-center md:text-5xl lg:text-6xl">
            <span className="block text-[#0F1E3D]">Find the landlord</span>
            <span className="block bg-gradient-primary bg-clip-text text-transparent">who&apos;s right for you.</span>
          </h1>

          <p className="mt-4 max-w-md text-left text-base leading-7 text-[#64748B] md:mx-auto md:max-w-3xl md:text-center md:text-lg">
            This quick survey helps us match you with the best landlord for you.
          </p>

          <div className="mt-8 grid gap-3 md:mt-10 md:grid-cols-3 md:gap-4">
            {cards.map((card) => {
              const Icon = card.icon
              return (
                <article
                  key={card.title}
                  className="flex items-center gap-4 rounded-2xl border border-[#E4E9F0] bg-white px-4 py-4 md:flex-col md:items-center md:px-5 md:py-6 md:text-center"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.tile}`}>
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#0F1E3D]">{card.title}</h2>
                    <p className="mt-0.5 text-sm leading-5 text-[#64748B]">{card.body}</p>
                  </div>
                </article>
              )
            })}
          </div>

          <button
            type="button"
            data-testid="button-start-survey"
            onClick={onStart}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-base font-semibold text-white shadow-[0_12px_28px_rgba(58,122,254,0.32)] md:mx-auto md:mt-10 md:w-72"
          >
            Start the Survey
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
