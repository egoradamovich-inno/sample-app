import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Profile, UpdateProfilePayload } from '../api/endpoints/profile'
import { profileApi } from '../api/endpoints/profile'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { Switch } from '../components/ui/Switch'
import { TextField } from '../components/ui/TextField'

interface ReadOnlyRowProps {
  label: string
  value: string
}

/** Read-only fields render as static `text-label` rows, never disabled inputs —
 * a disabled input visually implies "you could edit this if something changed". */
function ReadOnlyRow({ label, value }: ReadOnlyRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label uppercase tracking-wide text-ink-soft">{label}</span>
      <span className="text-body text-ink">{value}</span>
    </div>
  )
}

export function ProfileEditPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<UpdateProfilePayload>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    profileApi.getOwn().then((result) => {
      if (cancelled) {
        return
      }
      setProfile(result)
      setForm({
        firstName: result.firstName,
        lastName: result.lastName,
        phone: result.phone ?? undefined,
        school: result.school ?? undefined,
        bio: result.bio ?? undefined,
        jerseyNumber: result.jerseyNumber ?? undefined,
        emergencyContact: result.emergencyContact ?? undefined,
        credentials: result.credentials ?? undefined,
        certifications: result.certifications ?? [],
        publicVisible: result.publicVisible ?? false,
        businessName: result.businessName ?? undefined,
        address: result.address ?? undefined,
        website: result.website ?? undefined,
        description: result.description ?? undefined,
      })
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSaving(true)
    setSuccessMessage(null)
    setErrorMessage(null)
    try {
      const updated = await profileApi.updateOwn(form)
      setProfile(updated)
      setSuccessMessage('Profile updated.')
    } catch {
      setErrorMessage('Unable to save your profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setSuccessMessage(null)
    setErrorMessage(null)
    try {
      const updated = await profileApi.uploadPhoto(file)
      setProfile(updated)
    } catch {
      setErrorMessage('Unable to upload your photo. Please try again.')
    }
  }

  if (isLoading || profile === null) {
    return (
      <main className="mx-auto max-w-[480px] px-4 py-12">
        <p className="text-body text-ink-soft">Loading…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-8 px-4 py-12">
      <h1 className="font-display text-display-lg uppercase tracking-tight text-ink">Profile</h1>

      {successMessage !== null && <Banner variant="success">{successMessage}</Banner>}
      {errorMessage !== null && <Banner variant="error">{errorMessage}</Banner>}

      <div className="flex flex-col gap-4">
        <ReadOnlyRow label="Email" value={profile.email} />
        <ReadOnlyRow label="Role" value={profile.role} />
        {profile.role === 'PLAYER' && <ReadOnlyRow label="Skill Level" value={profile.skillLevel ?? '—'} />}
        <ReadOnlyRow label="Created" value={new Date(profile.createdAt).toLocaleDateString()} />
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
        <TextField
          label="First name"
          required
          value={form.firstName ?? ''}
          onChange={(e) => setForm({ ...form, firstName: e.target.value })}
        />
        <TextField
          label="Last name"
          required
          value={form.lastName ?? ''}
          onChange={(e) => setForm({ ...form, lastName: e.target.value })}
        />
        <TextField label="Phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />

        {profile.role === 'PLAYER' && (
          <>
            <TextField label="School" value={form.school ?? ''} onChange={(e) => setForm({ ...form, school: e.target.value })} />
            <TextField
              label="Jersey number"
              value={form.jerseyNumber ?? ''}
              onChange={(e) => setForm({ ...form, jerseyNumber: e.target.value })}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="profile-photo" className="text-label uppercase tracking-wide text-ink-soft">
                Photo
              </label>
              {profile.photoUrl != null && profile.photoUrl !== '' && (
                <img src={profile.photoUrl} alt="Profile" className="h-24 w-24 rounded-sm object-cover" />
              )}
              <input id="profile-photo" type="file" accept="image/png,image/jpeg" onChange={(e) => void handlePhotoChange(e)} />
            </div>
          </>
        )}

        {profile.role === 'COACH' && (
          <>
            <TextField label="Bio" value={form.bio ?? ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            <TextField
              label="Credentials"
              value={form.credentials ?? ''}
              onChange={(e) => setForm({ ...form, credentials: e.target.value })}
            />
            <TextField
              label="Certifications (comma-separated)"
              value={(form.certifications ?? []).join(', ')}
              onChange={(e) =>
                setForm({
                  ...form,
                  certifications: e.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0),
                })
              }
            />
            <Switch
              id="public-visible"
              label="Show my public coach profile"
              checked={form.publicVisible ?? false}
              onChange={(checked) => setForm({ ...form, publicVisible: checked })}
            />
          </>
        )}

        {profile.role === 'TRAINER' && (
          <>
            <TextField
              label="Business name"
              value={form.businessName ?? ''}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            />
            <TextField label="Address" value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <TextField label="Website" value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <TextField
              label="Description"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </>
        )}

        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </main>
  )
}
