import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { sharelinksApi } from '../../api/endpoints/sharelinks'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { StampBadge } from '../../components/ui/StampBadge'
import { TextField } from '../../components/ui/TextField'

export type ShareLinkKind = 'static' | 'coach-invite'

export interface ShareLinkGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  linkType: ShareLinkKind
  onGenerated?: () => void
}

export function ShareLinkGenerationModal({ isOpen, onClose, linkType, onGenerated }: ShareLinkGenerationModalProps) {
  const [targetEmail, setTargetEmail] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCopied, setShowCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setCode(null)
      setUrl(null)
      setTargetEmail('')
      setShowCopied(false)
      return
    }
    if (linkType === 'static') {
      setIsGenerating(true)
      sharelinksApi
        .generateStatic()
        .then((result) => {
          setCode(result.code)
          setUrl(result.url)
          onGenerated?.()
        })
        .finally(() => setIsGenerating(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, linkType])

  async function handleCoachInviteSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsGenerating(true)
    try {
      const result = await sharelinksApi.generateCoachInvite({ targetEmail })
      setCode(result.code)
      setUrl(result.url)
      onGenerated?.()
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleCopy(): Promise<void> {
    if (url === null) {
      return
    }
    await navigator.clipboard.writeText(url)
    setShowCopied(true)
    setTimeout(() => setShowCopied(false), 1500)
  }

  const title = linkType === 'static' ? 'Generate Share Link' : 'Invite a Coach'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {code === null && linkType === 'coach-invite' && (
          <form onSubmit={(event) => void handleCoachInviteSubmit(event)} className="flex flex-col gap-4" noValidate>
            <TextField
              label="Coach email"
              type="email"
              required
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
            />
            <Button type="submit" disabled={isGenerating}>
              {isGenerating ? 'Generating…' : 'Generate invite'}
            </Button>
          </form>
        )}

        {isGenerating && linkType === 'static' && <p className="text-body text-ink-soft">Generating…</p>}

        {code !== null && (
          <div className="flex flex-col gap-3">
            <p className="break-all rounded-sm border border-rule-strong bg-paper px-3 py-3 font-mono text-mono text-ink">
              {code}
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => void handleCopy()}>
                Copy link
              </Button>
              {showCopied && <StampBadge label="Copied" variant="active" animate />}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
