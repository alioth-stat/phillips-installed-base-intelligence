import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { STEP_DURATION, STEP_EASE } from '@/lib/motion'

interface StepShellProps {
  index: number
  children: React.ReactNode[]
}

// Sliding crossfade between wizard steps. This is a discrete,
// button-triggered step change (not a drag gesture), so a CSS transition is
// the right tool -- no need for a JS spring library here. The parallax cue
// lives in Background, which shifts its dither layer on the same timing.
export function StepShell({ index, children }: StepShellProps) {
  const reducedMotion = usePrefersReducedMotion()
  const count = children.length

  if (reducedMotion) {
    // Instant swap, cross-fade only -- no translate.
    return (
      <div className="w-full">
        {children.map((child, i) => (
          <div
            key={i}
            aria-hidden={i !== index}
            inert={i !== index ? true : undefined}
            style={{
              display: i === index ? 'block' : 'none',
              opacity: i === index ? 1 : 0,
              transition: 'opacity 200ms ease',
            }}
          >
            {child}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden">
      <div
        className="flex"
        style={{
          width: `${count * 100}%`,
          transform: `translateX(-${index * (100 / count)}%)`,
          transition: `transform ${STEP_DURATION}ms ${STEP_EASE}`,
        }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            aria-hidden={i !== index}
            inert={i !== index ? true : undefined}
            style={{ width: `${100 / count}%`, flexShrink: 0 }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
