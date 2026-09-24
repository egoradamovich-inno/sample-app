import { useEffect, useState } from 'react'
import type { PlayerProfileSummary } from '../api/endpoints/player-profiles'
import { playerProfilesApi } from '../api/endpoints/player-profiles'
import { useAuth } from '../auth/AuthContext'
import { useActiveContext } from './ActiveContextContext'

/** The "Locker Nameplate Flip" — clicking the current context flips open the list
 * (parent: "Me" + per-child sections; child: a flat trainer list, no "Me" section
 * at all, per FR-026), then re-flips shut on selection. Both variants are driven
 * off the SAME data fetch; only the grouping differs. */
export function ContextSwitcher() {
  const { isChildAccount } = useAuth()
  const { selection, setSelection } = useActiveContext()
  const [profiles, setProfiles] = useState<PlayerProfileSummary[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    playerProfilesApi.list().then((result) => {
      if (cancelled) {
        return
      }
      setProfiles(result)
      if (selection === null) {
        const firstWithTrainer = result.find((profile) => profile.trainerAssociations.length > 0)
        if (firstWithTrainer !== undefined) {
          const trainer = firstWithTrainer.trainerAssociations[0]
          setSelection({
            memberId: firstWithTrainer.id,
            memberName: firstWithTrainer.displayName,
            trainerId: trainer.trainerId,
            trainerName: trainer.trainerName,
          })
        }
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSelect(member: PlayerProfileSummary, trainerId: string, trainerName: string): void {
    setSelection({ memberId: member.id, memberName: member.displayName, trainerId, trainerName })
    setIsOpen(false)
  }

  const meProfiles = profiles.filter((profile) => !profile.isChild)
  const childProfiles = profiles.filter((profile) => profile.isChild)

  return (
    <div className="relative inline-block [perspective:800px]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="rounded-sm border border-rule-strong bg-paper-raised px-3 py-2 font-display uppercase tracking-wide text-ink"
      >
        {selection !== null ? `${selection.memberName} · ${selection.trainerName}` : 'Select context'}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute z-30 mt-1 min-w-[240px] rounded-sm border border-rule-strong bg-paper-raised p-3 shadow-lg motion-safe:animate-[nameplate-flip-open_220ms_ease-out] motion-reduce:animate-none"
        >
          {isChildAccount ? (
            <ul className="flex flex-col gap-1">
              {profiles[0]?.trainerAssociations.map((trainer) => (
                <li key={trainer.trainerId}>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full rounded-sm px-2 py-1 text-left text-body text-ink hover:bg-cinder-tint"
                    onClick={() => profiles[0] !== undefined && handleSelect(profiles[0], trainer.trainerId, trainer.trainerName)}
                  >
                    {trainer.trainerName}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-3">
              {meProfiles.map((profile) => (
                <div key={profile.id}>
                  <p className="text-label uppercase tracking-wide text-ink-soft">Me</p>
                  <ul className="flex flex-col gap-1">
                    {profile.trainerAssociations.map((trainer) => (
                      <li key={trainer.trainerId}>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full rounded-sm px-2 py-1 text-left text-body text-ink hover:bg-cinder-tint"
                          onClick={() => handleSelect(profile, trainer.trainerId, trainer.trainerName)}
                        >
                          {trainer.trainerName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {childProfiles.map((profile) => (
                <div key={profile.id}>
                  <p className="text-label uppercase tracking-wide text-ink-soft">{profile.displayName}</p>
                  <ul className="flex flex-col gap-1">
                    {profile.trainerAssociations.map((trainer) => (
                      <li key={trainer.trainerId}>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full rounded-sm px-2 py-1 text-left text-body text-ink hover:bg-cinder-tint"
                          onClick={() => handleSelect(profile, trainer.trainerId, trainer.trainerName)}
                        >
                          {trainer.trainerName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
