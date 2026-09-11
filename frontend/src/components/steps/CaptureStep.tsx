import { useEffect, useRef, useState } from 'react'
import { Camera, Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { GlassPanel } from '@/components/GlassPanel'
import { analyzePhoto, extractText, transcribeAudio, type Extraction } from '@/api'

interface CaptureStepProps {
  mode: 'texto' | 'voz' | 'foto'
  onExtracted: (sourceText: string, extraction: Extraction) => void
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

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

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
        // A clip stopped almost immediately can leave the webm muxer with only
        // a header and no finished cluster -- ffmpeg then fails to parse it.
        // Catch that here with a clear message instead of a raw transcode error.
        if (blob.size < 4000) {
          setError('Grabación muy corta. Mantén presionado "Grabar" al menos un par de segundos.')
          return
        }
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
      // Timeslice so the muxer flushes data periodically during recording,
      // not only in one shot at stop() -- lowers the odds of an unfinished
      // cluster on short clips.
      recorder.start(250)
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

  async function handleAnalyzePhoto() {
    if (!photoFile) return
    setError(null)
    setIsAnalyzingPhoto(true)
    try {
      const result = await analyzePhoto(photoFile)
      onExtracted(result.description, result.fields)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al analizar la foto.')
    } finally {
      setIsAnalyzingPhoto(false)
    }
  }

  const busy = isTranscribing || isExtracting

  if (mode === 'foto') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <GlassPanel className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Toma una foto del equipo
          </h2>
          <p className="text-sm text-muted-foreground">
            Enfoca la placa o etiqueta del equipo para leer marca y modelo.
          </p>

          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white/50 p-6">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Vista previa del equipo"
                className="max-h-64 rounded-lg object-contain"
              />
            ) : (
              <Camera className="size-10 text-muted-foreground" />
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={isAnalyzingPhoto}
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={isAnalyzingPhoto}
              onClick={() => photoInputRef.current?.click()}
            >
              {photoFile ? 'Elegir otra foto' : 'Tomar / elegir foto'}
            </Button>
            {isAnalyzingPhoto && (
              <p className="text-sm text-muted-foreground">Analizando con QVAC (on-device)...</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" onClick={onBack} disabled={isAnalyzingPhoto}>
              Atrás
            </Button>
            <Button onClick={handleAnalyzePhoto} disabled={!photoFile || isAnalyzingPhoto}>
              {isAnalyzingPhoto ? 'Analizando con QVAC...' : 'Analizar foto'}
            </Button>
          </div>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
