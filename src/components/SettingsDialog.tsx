import { useUpdateErrorToast } from '@rific/toaster'
import type { ViewRotation } from '@tastic/core'
import { BaseSettingsDialog } from '@tastic/hud'
import { useGuide } from '@tastic/hud/guide'

import { release } from '@/constants/release'
import { Settings } from '@/types'

export interface SettingsDialogProps {
  visible: boolean
  onDismiss: () => void
  settings: Settings
  setSettings: (update: Partial<Settings>) => void
  // Live physical-hold rotation (see @tastic/core's useRotation). BaseSettingsDialog lays the sheet
  // out in its own frame turned by this (see @tastic/hud's RotatedFrame), so it reads right-side-up
  // and fits the short edge however the phone is held. Defaults to 0 for a call site that doesn't
  // track one.
  rotation?: ViewRotation
  // Shows the "How to play" row that replays the intro. Off by default: the in-game (/game) dialog
  // leaves it out, since opening a full-screen guide over a live match (settings there already
  // pauses play) is disruptive - Home and the lobby, where nothing is running, turn it on.
  showHowToPlay?: boolean
}

// Thin adapter over @tastic/hud's shared settings shell - LightCycles' own Settings (lock
// orientation, edge guard) is the only thing that varies here; everything else (sound, haptics,
// appearance, update checking) is identical across every app using BaseSettingsDialog and lives
// entirely inside that package now. Keeps this file's own external props unchanged so none of its
// three call sites (index.tsx, lobby.tsx, game.tsx) needed to change.
export function SettingsDialog({ visible, onDismiss, settings, setSettings, rotation = 0, showHowToPlay = false }: SettingsDialogProps) {
  const { open: openGuide } = useGuide()
  return <BaseSettingsDialog visible={visible} onDismiss={onDismiss} rotation={rotation} version={release.otaVersion} lockOrientation={settings.lockOrientation} onLockOrientationChange={(value) => setSettings({ lockOrientation: value })} deferBottomEdgeGestures={settings.deferBottomEdgeGestures} onDeferBottomEdgeGestures={(value) => setSettings({ deferBottomEdgeGestures: value })} onUpdateError={useUpdateErrorToast()} onShowHowToPlay={showHowToPlay ? openGuide : undefined} />
}
