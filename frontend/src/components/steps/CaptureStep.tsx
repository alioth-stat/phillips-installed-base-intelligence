import { useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { GlassPanel } from '@/components/GlassPanel'
import { extractText, transcribeAudio, type Fields } from '@/api'

interface CaptureStepProps {
  mode: 'texto' | 'voz'
  onExtracted: (sourceText: string, fields: Fields) => void
  onBack: () => void
}

const PLACEHOLDER =
  'Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un tomógrafo. Uno de los resonadores parece de unos ocho años.'

export function CaptureStep({ mode, onExtracted, onBack }: CaptureStepProps) {
  const [text, setText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setIsTranscribing(true)
        try {
          const transcript = await transcribeAudio(blob)
          setText(transcript)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al transcribir el audio.')
        } finally {
          setIsTranscribing(false)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch {
      setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  async function handleExtract() {
    setError(null)
    setIsExtracting(true)
    try {
      const fields = await extractText(text)
      onExtracted(text, fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al extraer la información.')
    } finally {
      setIsExtracting(false)
    }
  }

  const busy = isTranscribing || isExtracting

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <GlassPanel className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Describe lo que observaste
        </h2>

        {mode === 'voz' && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white/50 p-6">
            <Button
              type="button"
              size="lg"
              variant={isRecording ? 'destructive' : 'default'}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
            >
              {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
              {isRecording ? 'Detener grabación' : 'Grabar'}
            </Button>
            {isTranscribing && (
              <p className="text-sm text-muted-foreground">Transcribiendo con QVAC (on-device)...</p>
            )}
          </div>
        )}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={6}
          className="resize-none bg-white/70"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} disabled={busy}>
            Atrás
          </Button>
          <Button onClick={handleExtract} disabled={!text.trim() || busy}>
            {isExtracting ? 'Analizando con QVAC...' : 'Extraer información'}
          </Button>
        </div>
      </GlassPanel>
    </div>
  )
}
