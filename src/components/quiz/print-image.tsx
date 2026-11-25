import { useEffect, useState } from 'react'
import { buttonClass } from '~/components/button/button'
import { quizImagePath } from '~/lib/quiz/quiz'
import type { QuizImageKind, QuizPrintView } from '~/lib/quiz/quiz'

const ZOOM_STEPS = [1, 1.5, 2, 3]

interface PrintImageProps {
  print: QuizPrintView
  kind: QuizImageKind
  /**
   * `fit`: as wide as the column, opening a zoomable view when tapped (a
   * phone shows a print at about half its size). `screen`: as large as the
   * given box allows, for the shared screen.
   */
  variant: 'fit' | 'screen'
}

/**
 * A print's censored or original image. The address differs per kind and
 * the route answers `no-store`, so the browser asks again at the reveal and
 * gets whatever the server allows at that moment.
 */
const PrintImage = ({ print, kind, variant }: PrintImageProps) => {
  const [zoomed, setZoomed] = useState(false)
  const src = quizImagePath(print.id, kind)
  const alt =
    kind === 'original'
      ? 'O print original, com os nomes'
      : 'Print de uma conversa, com os nomes escondidos'

  if (variant === 'screen') {
    return (
      <img
        src={src}
        alt={alt}
        width={print.width}
        height={print.height}
        className="h-full w-full object-contain"
        data-testid="quiz-image"
        data-kind={kind}
      />
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block w-full cursor-zoom-in border border-accent"
        aria-label="Ampliar o print"
        data-testid="quiz-image-button"
      >
        <img
          src={src}
          alt={alt}
          width={print.width}
          height={print.height}
          className="mx-auto h-auto max-h-[80vh] w-full object-contain"
          data-testid="quiz-image"
          data-kind={kind}
        />
      </button>
      <p className="mt-xs text-center text-xs text-accent">
        Toque no print para ampliar
      </p>
      {zoomed && (
        <Zoom
          src={src}
          alt={alt}
          print={print}
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  )
}

interface ZoomProps {
  src: string
  alt: string
  print: QuizPrintView
  onClose: () => void
}

/** The print over the whole screen, at its real size or larger, scrollable. */
const Zoom = ({ src, alt, print, onClose }: ZoomProps) => {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // The page behind must not scroll with the image.
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const controlClassName = `${buttonClass()} min-h-12 min-w-12`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Print ampliado"
      className="fixed inset-0 z-50 flex flex-col bg-background"
      data-testid="quiz-zoom"
    >
      <div className="flex items-center justify-between gap-sm border-b border-accent p-sm">
        <div className="flex gap-sm">
          <button
            type="button"
            className={controlClassName}
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            aria-label="Diminuir"
          >
            −
          </button>
          <button
            type="button"
            className={controlClassName}
            disabled={step === ZOOM_STEPS.length - 1}
            onClick={() =>
              setStep((current) => Math.min(ZOOM_STEPS.length - 1, current + 1))
            }
            aria-label="Aumentar"
          >
            +
          </button>
        </div>
        <button
          type="button"
          className={controlClassName}
          onClick={onClose}
          data-testid="quiz-zoom-close"
        >
          Fechar
        </button>
      </div>
      <div className="flex-1 overflow-auto overscroll-contain">
        <img
          src={src}
          alt={alt}
          width={print.width}
          height={print.height}
          // Its real size, however narrow the screen: that is the point.
          className="h-auto max-w-none"
          style={{ width: print.width * ZOOM_STEPS[step] }}
        />
      </div>
    </div>
  )
}

export default PrintImage
