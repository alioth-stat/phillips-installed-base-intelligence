import { useState } from 'react'
import { Background } from '@/components/Background'
import { StepShell } from '@/components/StepShell'
import { LoginStep } from '@/components/steps/LoginStep'
import { ModeStep } from '@/components/steps/ModeStep'
import { CaptureStep } from '@/components/steps/CaptureStep'
import { ReviewStep } from '@/components/steps/ReviewStep'
import { PanelStep } from '@/components/steps/PanelStep'
import type { Extraction } from '@/api'

const STEPS = ['login', 'mode', 'capture', 'review', 'panel'] as const
type Step = (typeof STEPS)[number]

const EMPTY_EXTRACTION: Extraction = { customer: null, city: null, country: null, items: [] }

function App() {
  const [step, setStep] = useState<Step>('login')
  const [mode, setMode] = useState<'texto' | 'voz' | 'foto'>('texto')
  const [sourceText, setSourceText] = useState('')
  const [extraction, setExtraction] = useState<Extraction>(EMPTY_EXTRACTION)
  // StepShell keeps every step mounted at all times (needed for the slide
  // transition), so any step's mount-only effects/useState(props...) only
  // run once, at t=0 before real data exists, and never re-sync later --
  // confirmed live twice: ReviewStep kept showing an empty form after real
  // fields were fetched, and PanelStep kept showing "no observations" after
  // a real save (its one-time useEffect fetch had already run against an
  // empty backend at initial mount). Bumping a per-step key exactly when a
  // fresh instance is needed forces a clean remount that re-reads current
  // props / re-runs its effect instead of replaying the stale first mount.
  const [captureKey, setCaptureKey] = useState(0)
  const [reviewKey, setReviewKey] = useState(0)
  const [panelKey, setPanelKey] = useState(0)

  const index = STEPS.indexOf(step)

  return (
    <>
      <Background step={index} />
      <StepShell index={index}>
        {[
          <LoginStep
            key="login"
            onStart={() => setStep('mode')}
            onViewPanel={() => {
              setPanelKey((k) => k + 1)
              setStep('panel')
            }}
          />,
          <ModeStep
            key="mode"
            onSelect={(m) => {
              setMode(m)
              setCaptureKey((k) => k + 1)
              setStep('capture')
            }}
            onBack={() => setStep('login')}
          />,
          <CaptureStep
            key={`capture-${captureKey}`}
            mode={mode}
            onExtracted={(text, extracted) => {
              setSourceText(text)
              setExtraction(extracted)
              setReviewKey((k) => k + 1)
              setStep('review')
            }}
            onBack={() => setStep('mode')}
          />,
          <ReviewStep
            key={`review-${reviewKey}`}
            sourceText={sourceText}
            extraction={extraction}
            onSaved={() => {
              setPanelKey((k) => k + 1)
              setStep('panel')
            }}
            onBack={() => setStep('capture')}
          />,
          <PanelStep
            key={`panel-${panelKey}`}
            onNewObservation={() => {
              setCaptureKey((k) => k + 1)
              setStep('mode')
            }}
            onBack={() => setStep('login')}
          />,
        ]}
      </StepShell>
    </>
  )
}

export default App
