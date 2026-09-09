import { useEffect, useRef, useState } from 'react'

interface StepShellProps {
  index: number
  children: React.ReactNode[]
}

const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
const DURATION = 280

function usePrefersReducedMotion() {
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  return reduced
}

// Sliding + blur-masked crossfade between wizard steps. This is a discrete,
// button-triggered step change (not a drag gesture), so a CSS transition is
// the right tool -- no need for a JS spring library here.
export function StepShell({ index, children }: StepShellProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (reducedMotion) return
    setIsTransitioning(true)
    const t = setTimeout(() => setIsTransitioning(false), DURATION)
    return () => clearTimeout(t)
  }, [index, reducedMotion])

  const count = children.length

  if (reducedMotion) {
    // Instant swap, cross-fade only -- no translate, no blur.
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
          transition: `transform ${DURATION}ms ${EASE_OUT}, filter ${DURATION}ms ease`,
          filter: isTransitioning ? 'blur(4px)' : 'blur(0px)',
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
