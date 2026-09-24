import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Branding } from '../../api/endpoints/branding'
import { brandingApi } from '../../api/endpoints/branding'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'

// Matches the real system's --color-cinder default (frontend-design-spec.md).
const DEFAULT_COLOR = '#e2621b'

export function TrainerBrandingPage() {
  const [branding, setBranding] = useState<Branding | null>(null)
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null)
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    brandingApi.get().then((result) => {
      if (cancelled) {
        return
      }
      setBranding(result)
      setColor(result.primaryColorHex ?? DEFAULT_COLOR)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function uploadLogo(file: File): Promise<void> {
    setIsSaving(true)
    try {
      const result = await brandingApi.uploadLogo(file)
      setBranding(result)
      setSuccessMessage('Logo updated.')
    } catch {
      setErrorMessage('Unable to upload this logo. Please try a different file.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (file === undefined) {
      return
    }
    setSuccessMessage(null)
    setErrorMessage(null)

    // Client-side rejection (defense in depth alongside the backend's own SVG
    // rejection, per G-5) — checked before ever hitting the API, and checked on
    // both the extension AND the declared MIME type since either can lie.
    const looksLikeSvg = file.name.toLowerCase().endsWith('.svg') || file.type === 'image/svg+xml'
    if (looksLikeSvg) {
      setErrorMessage('SVG logos are not supported. Please upload a PNG or JPG file instead.')
      event.target.value = ''
      return
    }

    setPreviewLogoUrl(URL.createObjectURL(file))
    void uploadLogo(file)
  }

  async function handleColorSave(): Promise<void> {
    setIsSaving(true)
    setSuccessMessage(null)
    try {
      const result = await brandingApi.update({ primaryColorHex: color })
      setBranding(result)
      setSuccessMessage('Primary color updated.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleReset(): void {
    setColor(DEFAULT_COLOR)
  }

  const displayedLogoUrl = previewLogoUrl ?? branding?.logoUrl ?? null

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 font-display text-display-lg uppercase tracking-tight text-ink">Branding</h1>

      {errorMessage !== null && <Banner variant="error">{errorMessage}</Banner>}
      {successMessage !== null && <Banner variant="success">{successMessage}</Banner>}

      <section className="mt-6 flex flex-col gap-3">
        <h2 className="font-display text-display-md uppercase tracking-tight text-ink">Logo</h2>
        <label htmlFor="logo-upload" className="text-label uppercase tracking-wide text-ink-soft">
          Upload logo (PNG or JPG)
        </label>
        <input id="logo-upload" type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} disabled={isSaving} />

        <div
          data-testid="mock-header-preview"
          style={{ borderColor: color }}
          className="mt-2 flex items-center gap-2 rounded-sm border-2 bg-paper-raised p-3"
        >
          {displayedLogoUrl !== null && <img src={displayedLogoUrl} alt="" className="h-8 w-8 rounded-sm object-contain" />}
          <span style={{ color }} className="font-display uppercase tracking-tight">
            Training Platform
          </span>
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="font-display text-display-md uppercase tracking-tight text-ink">Primary Color</h2>
        <label htmlFor="color-picker" className="text-label uppercase tracking-wide text-ink-soft">
          Primary color
        </label>
        <input id="color-picker" type="color" value={color} onChange={(e) => setColor(e.target.value)} />

        {/* Purely a visual preview of the picked color — not an actual control, so
            it renders as non-interactive markup rather than a real <button> that a
            keyboard user would tab to and find does nothing. */}
        <div className="mt-2 flex items-center gap-3" aria-hidden="true">
          <div style={{ backgroundColor: color }} className="rounded-sm px-4 py-2 font-body font-semibold text-paper-raised">
            Sample button
          </div>
          <span style={{ borderColor: color, color }} className="rounded-sm border-2 px-2 py-0.5 text-label uppercase">
            Sample badge
          </span>
        </div>

        <div className="mt-3 flex gap-3">
          <Button onClick={() => void handleColorSave()} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save color'}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset to default
          </Button>
        </div>
      </section>
    </main>
  )
}
