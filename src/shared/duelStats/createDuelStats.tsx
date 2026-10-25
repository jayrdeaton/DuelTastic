import { getAchievementCatalogRows } from '@tastic/achievements'
import { AchievementCatalogSection, ActivityStatSection, StatRow, StatSection, useWellColors } from '@tastic/hud'
import { ProfileChip } from '@tastic/profile'
import { useCallback, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'

import { createDuelAchievementCatalog } from '@/shared/duelStats/achievements'
import { applyRoundOutcome, getBestPerformingColor, getFavoriteColor, getOverallTotals, getProfileOverallTotals, getProfileRankings, getProfileStatsView, type ProfileRanking, type RoundContext } from '@/shared/duelStats/statsEngine'
import { DEFAULT_PROFILE_STATS, DEFAULT_STATS, isValidStats } from '@/shared/duelStats/statsValidation'
import type { ColorStats, ProfileStats, StatsState } from '@/shared/duelStats/types'
import { createGameStats } from '@/shared/gameStats'
import type { RoundOutcome } from '@/shared/match/types'
import { MONO_FONT } from '@/shell/fonts'
import { useProfiles } from '@/shell/hooks/useProfiles'

interface DuelStatsOptions {
  // The game's id: its stats and achievements are saved under `${id}Achievements`.
  id: string
  // The game's own name for its first achievement ("Play your first game.").
  firstGameTitle: string
}

// One game's stats and achievements, the same for every game in the pack (see types.ts): its store
// slice and context (the shared createGameStats), the hook its play screen records rounds through,
// and its sections on the shell's stats screen.
export function createDuelStats({ id, firstGameTitle }: DuelStatsOptions) {
  const catalog = createDuelAchievementCatalog(firstGameTitle)
  const gameStats = createGameStats<StatsState, ProfileStats>({ key: `${id}Achievements`, defaultStats: DEFAULT_STATS, isValidStats, catalog, getProfileStatsView })

  function useDuelStats() {
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
    return { stats, profileBucket, statsView: profileBucket ? getProfileStatsView(profileBucket) : stats }
  }

  function StatsSections({ profileId }: { profileId: string | null }) {
    const { stats, profileBucket, statsView } = useStatsView(profileId)
    const { profiles } = useProfiles()
    const { fg, fgMuted } = useWellColors()

    const overall = useMemo(() => (profileBucket ? getProfileOverallTotals(profileBucket) : getOverallTotals(stats)), [stats, profileBucket])
    const favoriteColor = useMemo(() => getFavoriteColor(statsView), [statsView])
    const bestColor = useMemo(() => getBestPerformingColor(statsView), [statsView])
    const sortedColors = useMemo(() => Object.entries(statsView.colors).sort(([, a], [, b]) => b.played - a.played), [statsView.colors])
    const rankings = useMemo(() => getProfileRankings(profiles, stats.profiles), [profiles, stats.profiles])

    return (
      <>
        <StatSection label='OVERALL'>
          <StatRow label='Played' value={String(overall.played)} />
          <StatRow label='Wins' value={String(overall.wins)} />
          <StatRow label='Losses' value={String(overall.losses)} />
          <StatRow label='Draws' value={String(overall.draws)} />
        </StatSection>

        <StatSection label='VS CPU'>
          <StatRow label='Record (W-L-D)' value={`${statsView.vsCpu.wins}-${statsView.vsCpu.losses}-${statsView.vsCpu.draws}`} />
          <StatRow label='Current Streak' value={String(statsView.vsCpu.currentWinStreak)} />
          <StatRow label='Best Streak' value={String(statsView.vsCpu.bestWinStreak)} />
        </StatSection>

        {/* Everyone keeps the seat framing (whoever sat where); a selected profile switches to that
        profile's own record, where p1Wins+p2Wins is always THIS profile's own win count. */}
        <StatSection label='TWO PLAYER (LOCAL)'>
          {profileBucket ? (
            <>
              <StatRow label='Played' value={String(statsView.twoPlayer.played)} />
              <StatRow label='Wins' value={String(statsView.twoPlayer.p1Wins + statsView.twoPlayer.p2Wins)} />
              <StatRow label='Losses' value={String(statsView.twoPlayer.played - statsView.twoPlayer.p1Wins - statsView.twoPlayer.p2Wins - statsView.twoPlayer.draws)} />
              <StatRow label='Draws' value={String(statsView.twoPlayer.draws)} />
            </>
          ) : (
            <>
              <StatRow label='Played' value={String(stats.twoPlayer.played)} />
              <StatRow label='Seat 1 Wins' value={String(stats.twoPlayer.p1Wins)} />
              <StatRow label='Seat 2 Wins' value={String(stats.twoPlayer.p2Wins)} />
              <StatRow label='Draws' value={String(stats.twoPlayer.draws)} />
            </>
          )}
        </StatSection>

        {sortedColors.length > 0 && (
          <StatSection label='COLORS (W-L-D)'>
            {sortedColors.map(([hex, colorStats]) => (
              <ColorStatRow key={hex} hex={hex} colorStats={colorStats} isFavorite={hex === favoriteColor} isBest={hex === bestColor} fg={fg} fgMuted={fgMuted} />
            ))}
          </StatSection>
        )}

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
    return <AchievementCatalogSection rows={getAchievementCatalogRows(catalog, stats, statsView, unlockedAchievements, profileId)} />
  }

  return { reducers: { [`${id}Achievements`]: gameStats.reducer }, actions: gameStats.actions, Provider: gameStats.Provider, useDuelStats, StatsSections, AchievementList, catalog }
}

interface ColorStatRowProps {
  hex: string
  colorStats: ColorStats
  isFavorite: boolean
  isBest: boolean
  fg: string
  fgMuted: string
}

function ColorStatRow({ hex, colorStats, isFavorite, isBest, fg, fgMuted }: ColorStatRowProps) {
  return (
    <View style={styles.statRow}>
      <View style={styles.rowValue}>
        <View style={[styles.swatch, { backgroundColor: hex }]} />
        <Text variant='bodyMedium' style={[styles.boldText, { color: fg, fontFamily: MONO_FONT }]}>
          {hex.toUpperCase()}
        </Text>
        {isFavorite && <Icon source='star' size={14} color='#FFD54F' />}
        {isBest && <Icon source='trophy' size={14} color='#FFD54F' />}
      </View>
      <Text variant='bodyMedium' style={{ color: fgMuted, fontFamily: MONO_FONT }}>
        {colorStats.wins}-{colorStats.losses}-{colorStats.draws}
        <Text style={{ color: fgMuted, fontFamily: MONO_FONT }}> ({colorStats.played} played)</Text>
      </Text>
    </View>
  )
}

// A profile's chip (its own color and tag), name and record. @tastic/hud's StatRow has no leading
// identity chip, hence a row of its own.
function ProfileRankingRow({ ranking, fg, fgMuted }: { ranking: ProfileRanking; fg: string; fgMuted: string }) {
  const { profile, wins, losses, draws, played } = ranking
  return (
    <View style={styles.statRow}>
      <View style={styles.rowValue}>
        <ProfileChip profile={profile} />
        <Text variant='bodyMedium' style={[styles.boldText, { color: fg, fontFamily: MONO_FONT }]} numberOfLines={1}>
          {profile.name}
        </Text>
      </View>
      <Text variant='bodyMedium' style={{ color: fgMuted, fontFamily: MONO_FONT }}>
        {wins}-{losses}-{draws}
        <Text style={{ color: fgMuted, fontFamily: MONO_FONT }}> ({played} played)</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  boldText: {
    fontWeight: 'bold'
  },
  rowValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  statRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  swatch: {
    borderColor: 'rgba(128,128,128,0.6)',
    borderRadius: 10,
    borderWidth: 1,
    height: 18,
    width: 18
  }
})
