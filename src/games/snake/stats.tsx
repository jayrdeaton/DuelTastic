import { getAchievementCatalogRows } from '@tastic/achievements'
import { AchievementCatalogSection, ActivityStatSection, StatRow, StatSection, useWellColors } from '@tastic/hud'
import { ProfileChip } from '@tastic/profile'
import { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import { createGameStats } from '@/shared/gameStats'
import { MONO_FONT } from '@/shell/fonts'
import { useProfiles } from '@/shell/hooks/useProfiles'

import { ACHIEVEMENT_CATALOG } from './constants/achievements'
import type { SnakeMode } from './hooks/useSnakeState'
import type { ProfileStats, StatsState } from './types'
import { applyRoundOutcome, getBestScoreAnyMode, getProfileRankings, getProfileStatsView, getTotalPlayed, getTotalScore, type ProfileRanking, type RoundContext, type RoundOutcome } from './utils/statsEngine'
import { DEFAULT_PROFILE_STATS, DEFAULT_STATS, isValidStats, SNAKE_MODES } from './utils/statsValidation'

const MODE_LABELS: Record<SnakeMode, string> = { solo: 'Solo', vsCpu: 'Vs CPU', twoPlayer: '2 Player' }

// Snake's stats and achievements, under snakeAchievements: its own, not the pack's shared duel
// stats, since a Snake round is scored (best score, longest snake) and can be played alone.
const gameStats = createGameStats<StatsState, ProfileStats>({ key: 'snakeAchievements', defaultStats: DEFAULT_STATS, isValidStats, catalog: ACHIEVEMENT_CATALOG, getProfileStatsView })

function useSnakeStats() {
  const { stats, unlockedAchievements, record } = gameStats.useStats()
  // Records one finished round: who sat where (context.profileIds) gives the per-seat unlocks.
  const recordRoundOutcome = useCallback((outcome: RoundOutcome, context: RoundContext) => record((prev) => applyRoundOutcome(prev, outcome, context), context.profileIds), [record])
  return { stats, unlockedAchievements, recordRoundOutcome }
}

// The stats for one profile (a profile id) or every player (null): its own bucket viewed through
// the same StatsState shape every predicate already reads, or the device-wide stats themselves.
function useStatsView(profileId: string | null) {
  const { stats } = gameStats.useStats()
  const profileBucket = profileId ? (stats.profiles[profileId] ?? DEFAULT_PROFILE_STATS) : null
  return { stats, statsView: profileBucket ? getProfileStatsView(profileBucket) : stats }
}

function StatsSections({ profileId }: { profileId: string | null }) {
  const { stats, statsView } = useStatsView(profileId)
  const { profiles } = useProfiles()
  // The rankings' text sits in a StatSection well, so it takes the well's own colors.
  const { fg, fgMuted } = useWellColors()
  const rankings = useMemo(() => getProfileRankings(profiles, stats.profiles), [profiles, stats.profiles])

  return (
    <>
      <StatSection label='OVERALL'>
        <StatRow label='Rounds Played' value={String(getTotalPlayed(statsView))} />
        <StatRow label='Best Score' value={String(getBestScoreAnyMode(statsView))} />
        <StatRow label='Total Score' value={String(getTotalScore(statsView))} />
        <StatRow label='Longest Snake' value={String(statsView.longestSnake)} />
      </StatSection>

      <StatSection label='VERSUS'>
        <StatRow label='Record (W-L-D)' value={`${statsView.versus.wins}-${statsView.versus.losses}-${statsView.versus.draws}`} />
        <StatRow label='Current Streak' value={String(statsView.versusStreak.currentWinStreak)} />
        <StatRow label='Best Streak' value={String(statsView.versusStreak.bestWinStreak)} />
      </StatSection>

      {SNAKE_MODES.map((mode) => (
        <StatSection key={mode} label={MODE_LABELS[mode].toUpperCase()}>
          <StatRow label='High Score' value={String(statsView.byMode[mode].bestScore)} />
          <StatRow label='Rounds' value={String(statsView.byMode[mode].played)} />
          <StatRow label='Total Score' value={String(statsView.byMode[mode].totalScore)} />
        </StatSection>
      ))}

      {/* A leaderboard across profiles is a cross-profile question, so it only appears on
      Everyone. */}
      {profileId === null && rankings.length > 0 && (
        <StatSection label='PLAYER RANKINGS'>
          {rankings.map((ranking) => (
            <ProfileRankingRow key={ranking.profile.id} ranking={ranking} fg={fg} fgMuted={fgMuted} />
          ))}
        </StatSection>
      )}

      <ActivityStatSection stats={statsView} />
    </>
  )
}

function AchievementList({ profileId }: { profileId: string | null }) {
  const { unlockedAchievements } = gameStats.useStats()
  const { stats, statsView } = useStatsView(profileId)
  return <AchievementCatalogSection rows={getAchievementCatalogRows(ACHIEVEMENT_CATALOG, stats, statsView, unlockedAchievements, profileId)} />
}

// A profile's chip (its own color and tag), name and versus record, with its best score. @tastic/
// hud's StatRow has no leading identity chip, hence a row of its own.
function ProfileRankingRow({ ranking, fg, fgMuted }: { ranking: ProfileRanking; fg: string; fgMuted: string }) {
  const { profile, wins, losses, bestScore } = ranking
  return (
    <View style={styles.statRow}>
      <View style={styles.profileValue}>
        <ProfileChip profile={profile} />
        <Text variant='bodyMedium' style={[styles.boldText, { color: fg, fontFamily: MONO_FONT }]} numberOfLines={1}>
          {profile.name}
        </Text>
      </View>
      <Text variant='bodyMedium' style={{ color: fgMuted, fontFamily: MONO_FONT }}>
        {wins}-{losses}
        <Text style={{ color: fgMuted, fontFamily: MONO_FONT }}> (best {bestScore})</Text>
      </Text>
    </View>
  )
}

export const snakeStats = { reducers: { snakeAchievements: gameStats.reducer }, actions: gameStats.actions, Provider: gameStats.Provider, useSnakeStats, StatsSections, AchievementList }

const styles = StyleSheet.create({
  boldText: {
    fontWeight: 'bold'
  },
  profileValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  }
})
