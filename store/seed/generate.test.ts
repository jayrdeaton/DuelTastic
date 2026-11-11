// Seed data for the store screenshots (see store/README.md), made by the app's own stats engines and achievement
// catalogs: three weeks of rounds in all four games by three player profiles, Maya against the CPU (working up from
// the easiest level to the hardest) and against Leo and Priya face to face, winning a little over half her rounds.
// It runs in Jest, outside `npm test` (Jest's roots are src/), so it can load the pack's real store:
//
//   npx jest store/seed/generate.test.ts --roots='<rootDir>/src' --roots='<rootDir>/store/seed'
//
// Writes store/seed/seed.json (gitignored): `root`, every saved key of dueltastic:root as the store holds it, and
// `scenes`, the keys each scene changes. Then it launches the real store from each scene's save and checks that
// nothing was thrown away on the way in (a key the store reads differently would fall back to its default).
// store/seed/write-store.py writes a scene into a simulator before the app launches. Deterministic apart from the
// dates, which count back from now.
import fs from 'node:fs'
import path from 'node:path'

import { createAchievementBindings } from '@tastic/achievements'

import { ACHIEVEMENT_CATALOG as SNAKE_CATALOG } from '@/games/snake/constants/achievements'
import { SNAKE_POWERUP_ALL_TYPES } from '@/games/snake/constants/snake'
import { applyRoundOutcome as applySnakeRound, getProfileStatsView as snakeProfileView } from '@/games/snake/utils/statsEngine'
import { DEFAULT_STATS as SNAKE_DEFAULT_STATS } from '@/games/snake/utils/statsValidation'
import { TAG_POWERUPS } from '@/games/tag/constants'
import { POWERUP_ALL_TYPES } from '@/games/trap/constants/game'
import { TURF_POWERUPS } from '@/games/turf/constants'
import { createDuelAchievementCatalog } from '@/shared/duelStats/achievements'
import { applyRoundOutcome as applyDuelRound, getProfileStatsView as duelProfileView } from '@/shared/duelStats/statsEngine'
import { DEFAULT_STATS as DUEL_DEFAULT_STATS } from '@/shared/duelStats/statsValidation'

const OUT = path.join(__dirname, 'seed.json')
const DAY = 86400000
const P1 = '#2196f3'
const P2 = '#f44336'

// mulberry32
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Unlocked = Record<string, number>

// Records rounds the way createGameStats does: apply the round, then stamp every newly unlocked achievement (device
// and per profile) with the round's time.
function recorder<S extends { profiles: Record<string, unknown> }, P>(initial: S, catalog: Parameters<typeof createAchievementBindings<S, P>>[0], view: (p: P) => S) {
  const { evaluateUnlockedIds, evaluateUnlockedIdsForProfile, unlockedKey } = createAchievementBindings<S, P>(catalog, view)
  let stats = initial
  const unlocked: Unlocked = {}
  let rounds = 0
  return {
    record(apply: (prev: S) => S, when: Date) {
      stats = apply(stats)
      rounds++
      const t = when.getTime()
      for (const id of evaluateUnlockedIds(stats)) unlocked[unlockedKey(id, null)] ??= t
      for (const [profileId, bucket] of Object.entries(stats.profiles)) for (const id of evaluateUnlockedIdsForProfile(bucket as P)) unlocked[unlockedKey(id, profileId)] ??= t
    },
    done: () => ({ save: { stats, unlocked }, rounds, unlockedCount: Object.keys(unlocked).length })
  }
}

function generate(now: number) {
  const random = rng(42)
  const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)]
  const start = new Date(now - 21 * DAY)
  start.setHours(0, 0, 0, 0)
  const at0 = start.getTime()

  const profiles = [
    { id: 'seed-maya', name: 'Maya', color: P1, tag: 'MK', createdAt: at0 + 19 * 3600000, updatedAt: at0 + 19 * 3600000 },
    { id: 'seed-leo', name: 'Leo', color: P2, tag: 'LEO', createdAt: at0 + 2 * DAY + 20 * 3600000, updatedAt: at0 + 2 * DAY + 20 * 3600000 },
    { id: 'seed-priya', name: 'Priya', color: '#d500f9', tag: 'PJ', createdAt: at0 + 6 * DAY + 18 * 3600000, updatedAt: at0 + 6 * DAY + 18 * 3600000 }
  ]
  const [maya, leo, priya] = profiles
  // Colors Maya tried over the weeks, so each game's COLORS table has more than one row
  const mayaColors = [maya.color, maya.color, maya.color, '#00bcd4', '#4caf50', '#fdd835']

  const duel = Object.fromEntries(['trap', 'turf', 'tag'].map((id) => [id, recorder(DUEL_DEFAULT_STATS, createDuelAchievementCatalog('First'), duelProfileView)]))
  const snake = recorder(SNAKE_DEFAULT_STATS, SNAKE_CATALOG, snakeProfileView)

  // Days played: a few early, then every day for the last 15, today included
  const days = [0, 2, 3, 6]
  for (let d = 6; d <= 21; d++) if (!days.includes(d)) days.push(d)

  for (const d of days) {
    const progress = d / 21
    const sessionStart = at0 + d * DAY + (18 + Math.floor(random() * 3)) * 3600000
    let minute = 0
    const at = () => new Date(Math.min(sessionStart + (minute += 2 + Math.floor(random() * 4)) * 60000, now - 60000))
    const difficulty = () => (progress < 0.3 ? 'easy' : progress < 0.7 ? (random() < 0.7 ? 'normal' : 'easy') : random() < 0.5 ? 'hard' : 'normal') as 'easy' | 'normal' | 'hard'
    const winChance = (level: 'easy' | 'normal' | 'hard') => ({ easy: 0.8, normal: 0.6 + 0.15 * progress, hard: 0.35 + 0.15 * progress })[level]

    // Two or three of the games each evening, Trap most
    const tonight = ['trap', 'turf', 'tag', 'snake'].filter((g) => g === 'trap' || random() < 0.6)
    for (const game of tonight) {
      const cpuRounds = 1 + Math.floor(random() * 3)
      for (let i = 0; i < cpuRounds; i++) {
        const level = difficulty()
        const r = random()
        const won = r < winChance(level)
        const drew = !won && r < winChance(level) + 0.06
        if (game === 'snake') {
          const score = 6 + Math.floor(random() * (won ? 40 : 22) + progress * 18)
          const outcome = { mode: 'vsCpu' as const, seats: { 1: { score, snakeLength: 3 + score } }, winner: won ? (1 as const) : drew ? null : (2 as const) }
          snake.record((prev) => applySnakeRound(prev, outcome, { cpuDifficulty: level, profileIds: { 1: maya.id } }, at()), at())
        } else {
          const outcome = won ? { type: 'win' as const, winner: 1 as const } : drew ? { type: 'draw' as const } : { type: 'win' as const, winner: 2 as const }
          duel[game].record((prev) => applyDuelRound(prev, outcome, { gameMode: 'vsCpu', cpuDifficulty: level, colors: { 1: pick(mayaColors), 2: P2 }, profileIds: { 1: maya.id } }, at()), at())
        }
      }
      // Face to face, from the day Leo joined; Priya from the second week
      if (d < 2) continue
      const twoRounds = Math.floor(random() * 3)
      for (let i = 0; i < twoRounds; i++) {
        const rival = d >= 6 && random() < 0.45 ? priya : leo
        const r = random()
        if (game === 'snake') {
          const a = 8 + Math.floor(random() * 30)
          const b = 8 + Math.floor(random() * 30)
          const outcome = { mode: 'twoPlayer' as const, seats: { 1: { score: a, snakeLength: 3 + a }, 2: { score: b, snakeLength: 3 + b } }, winner: r < 0.55 ? (1 as const) : r < 0.62 ? null : (2 as const) }
          snake.record((prev) => applySnakeRound(prev, outcome, { cpuDifficulty: 'normal', profileIds: { 1: maya.id, 2: rival.id } }, at()), at())
        } else {
          const outcome = r < 0.55 ? { type: 'win' as const, winner: 1 as const } : r < 0.62 ? { type: 'draw' as const } : { type: 'win' as const, winner: 2 as const }
          duel[game].record((prev) => applyDuelRound(prev, outcome, { gameMode: 'twoPlayer', cpuDifficulty: 'normal', colors: { 1: pick(mayaColors), 2: rival.color }, profileIds: { 1: maya.id, 2: rival.id } }, at()), at())
        }
      }
    }
  }

  const results = { trap: duel.trap.done(), turf: duel.turf.done(), tag: duel.tag.done(), snake: snake.done() }
  const games = Object.keys(results) as (keyof typeof results)[]

  // What every scene shares: sound off, every How to Play seen, the three profiles with Maya in seat 1, dark
  const root: Record<string, unknown> = {
    sound: { enabled: false },
    profiles,
    profileSelection: { 1: maya.id, 2: leo.id },
    seatColors: { lastGuestColor: { 1: P1, 2: P2 }, lastCpuColor: P2, profileColors: {} },
    ...Object.fromEntries(
      games.flatMap((g) => [
        [`${g}Guide`, { versionSeen: 1 }],
        [`${g}Achievements`, results[g].save]
      ])
    )
  }
  // Each game's loadout, as Maya last set it up: every powerup on, and the arena each shot shows
  const settings = (cpuLevel: 'normal' | 'hard', trapArena: 'pillars' | 'portals') => ({
    trapSettings: { [maya.id]: { arenaVariant: trapArena, cpuDifficulty: cpuLevel, enabledPowerups: POWERUP_ALL_TYPES } },
    turfSettings: { [maya.id]: { arena: 'pillars', crash: 'home', cpuDifficulty: cpuLevel, powerups: TURF_POWERUPS } },
    tagSettings: { [maya.id]: { arena: 'pillars', cpuDifficulty: cpuLevel, powerups: TAG_POWERUPS } },
    snakeSettings: { [maya.id]: { arenaVariant: 'pillars', cpuDifficulty: cpuLevel, enabledPowerups: SNAKE_POWERUP_ALL_TYPES } }
  })
  const scenes = {
    // 01-duel: Trap face to face, Maya against Leo
    twoPlayer: { opponent: { seatTwo: 'person' }, ...settings('normal', 'pillars') },
    // Turf, Tag and Snake against the CPU; Trap against Mainframe on Portals; Home and the stats screen
    vsCpu: { opponent: { seatTwo: 'cpu' }, ...settings('hard', 'portals') }
  }
  return { root, scenes, results }
}

// redux-persist keeps each slice as its own JSON string inside the root blob
const rootBlob = (slices: Record<string, unknown>) => JSON.stringify(Object.fromEntries([...Object.entries(slices), ['_persist', { version: -1, rehydrated: true }]].map(([key, value]) => [key, JSON.stringify(value)])))

async function launch(blob: string) {
  let loaded: typeof import('@/pack') | undefined
  jest.isolateModules(() => {
    const storage = require('@react-native-async-storage/async-storage')
    void storage.multiSet([['dueltastic:root', blob]])
    loaded = require('@/pack')
  })
  const { persistor, store } = loaded!
  await new Promise<void>((resolve) => {
    if (persistor.getState().bootstrapped) resolve()
    else persistor.subscribe(() => persistor.getState().bootstrapped && resolve())
  })
  await persistor.flush()
  return store.getState() as unknown as Record<string, unknown>
}

it('writes the screenshot seed, and the pack store reads every scene of it back unchanged', async () => {
  const { root, scenes, results } = generate(Date.now())
  fs.writeFileSync(OUT, JSON.stringify({ root, scenes }, null, 1) + '\n')
  // eslint-disable-next-line no-console -- the generator reports what it wrote
  for (const [game, r] of Object.entries(results)) console.log(`${game}: ${r.rounds} rounds, ${r.unlockedCount} unlocks`)

  for (const scene of Object.values(scenes)) {
    const saved = { ...root, ...scene }
    const state = await launch(rootBlob(saved))
    for (const [key, value] of Object.entries(saved)) expect([key, state[key]]).toEqual([key, value])
  }
})
