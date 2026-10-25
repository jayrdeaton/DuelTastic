import type { AchievementDefinition as BaseAchievementDefinition, DayStreakState, OutcomeRecord, RoundResult, WinStreakState } from '@tastic/achievements'

import type { CpuDifficulty } from '@/shared/match/types'

// The stats every game in the pack keeps, under its own store key (see createDuelStats.tsx): the
// same shape for all three, since a round in each ends the same way (one seat wins, or a draw),
// against the CPU or between two people.

// Tier, unlock-map and achievement-definition types all come from @tastic/achievements now, and are
// re-exported here under their existing names so every consumer keeps its own `@/types` import
// untouched. AchievementDefinition is that package's generic, instantiated at this app's own stats
// shape: an achievement is a pure predicate over StatsState, exactly as it was before.
export type { AchievementTier, UnlockedAchievementsState } from '@tastic/achievements'
export type AchievementDefinition = BaseAchievementDefinition<StatsState>

// played/wins/losses/draws - one shape, reused for a difficulty bucket and a color bucket alike.
// Local aliases of @tastic/achievements' OutcomeRecord rather than fresh declarations, so this
// app's own vocabulary ("this color's stats") still reads at the call site while every helper in
// that package (applyResult, getMostPlayedKey, ...) accepts them directly.
export type DifficultyRecord = OutcomeRecord
export type ColorStats = OutcomeRecord

// The human's own vsCpu record - the human is always seat 1 in vsCpu mode (see cpuAi.ts's
// CPU_PLAYER). currentWinStreak/bestWinStreak come from WinStreakState; a draw resets the streak
// just like a loss (see @tastic/achievements' applyWinStreak).
export interface VsCpuStats extends OutcomeRecord, WinStreakState {
  byDifficulty: Record<CpuDifficulty, DifficultyRecord>
}

// Not an OutcomeRecord: local two-player rounds are tallied by SEAT, so there's no single "wins"
// field to share - p1Wins/p2Wins is the whole point of the shape.
export interface TwoPlayerStats {
  played: number
  p1Wins: number
  p2Wins: number
  draws: number
}

// A profile's own personal record - mirrors the decomposable parts of StatsState (vsCpu/twoPlayer/
// colors, plus the DayStreakState fields it extends), so the exact same achievement predicates and
// statsEngine.ts helpers that evaluate device-wide StatsState can evaluate a profile's own view
// unchanged (see statsEngine.ts's getProfileStatsView). twoPlayer.p1Wins/p2Wins are reinterpreted
// per profile: they mean this profile's OWN wins from seat 1 / seat 2, not the device's seat tally
// - see statsEngine.ts's bumpProfileForSeat. Omits `profiles` (no nesting) and `firstGameResult`
// (a one-time device-wide flag with no profile identity - see AchievementDefinition's scope).
export interface ProfileStats extends DayStreakState {
  vsCpu: VsCpuStats
  twoPlayer: TwoPlayerStats
  colors: Record<string, ColorStats>
}

// Extends DayStreakState for distinctDaysPlayed/currentDayStreak/bestDayStreak/lastPlayedDate -
// all four are maintained by @tastic/achievements' applyDayPlayed, which restarts a streak at 1
// (not 0) after a gap, since the day just played is always day one of a new streak.
export interface StatsState extends DayStreakState {
  vsCpu: VsCpuStats
  twoPlayer: TwoPlayerStats
  // Keyed by lowercase hex - every seat's color counts here regardless of gameMode, since color
  // choice is the one thing tracked uniformly across both modes (see statsEngine.ts).
  colors: Record<string, ColorStats>
  // Keyed by Profile.id - only populated for a seat that had a saved profile selected when its
  // round outcome was recorded (see MatchScreen's profileIds). A
  // stored blob from before this field existed is still valid (see statsValidation.ts's
  // isValidStats, which treats an absent `profiles` key as valid) and gets backfilled to {} once,
  // on load, via useAchievements' own migrateStats option - no schema-versioning machinery needed
  // for a purely-additive field. Full-parity per-profile achievement tracking (see
  // achievementEngine.ts's evaluateUnlockedIdsForProfile and the stats screen's player filter)
  // reads this map.
  profiles: Record<string, ProfileStats>
  // Set once, only when the very first round ever is recorded, then never touched again - powers
  // the one-off "your first-ever game was a win" achievement, which isn't derivable from
  // cumulative totals alone once later games start piling on top. Always from seat 1's
  // perspective (the only well-defined "first game" framing across both vsCpu and twoPlayer,
  // where there's no other stable identity - see statsEngine.ts's applyRoundOutcome).
  firstGameResult: RoundResult | null
}
