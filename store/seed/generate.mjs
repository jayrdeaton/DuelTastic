// Seed data for the App Store screenshots (see store/README.md), made by the app's own stats engine and
// achievement catalog: three weeks of rounds by three player profiles, Maya against the CPU (working up from
// Drone to Mainframe) and against Leo and Priya face to face, winning a little over half her rounds.
//
//   node store/seed/generate.mjs        writes store/seed/seed.json (gitignored), then store/seed/reseed.sh
//
// Deterministic apart from the dates, which count back from now.
import { build } from 'esbuild'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '../..')

const ENTRY = `
import { applyRoundOutcome } from '@/utils/statsEngine'
import { DEFAULT_STATS } from '@/utils/statsValidation'
import { evaluateUnlockedIds, evaluateUnlockedIdsForProfile, unlockedKey } from '@/utils/achievementEngine'
import { DEFAULT_P1_COLOR, DEFAULT_P2_COLOR } from '@/constants/game'

const DAY = 86400000

// mulberry32
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function run(now) {
  const random = rng(42)
  const pick = (list) => list[Math.floor(random() * list.length)]
  const start = new Date(now - 21 * DAY)
  start.setHours(0, 0, 0, 0)

  const profiles = [
    { id: 'seed-maya', name: 'Maya', color: '#00bcd4', tag: 'MK', createdAt: start.getTime() + 19 * 3600000, updatedAt: start.getTime() + 19 * 3600000 },
    { id: 'seed-leo', name: 'Leo', color: '#ff9800', tag: 'LEO', createdAt: start.getTime() + 2 * DAY + 20 * 3600000, updatedAt: start.getTime() + 2 * DAY + 20 * 3600000 },
    { id: 'seed-priya', name: 'Priya', color: '#d500f9', tag: 'PJ', createdAt: start.getTime() + 6 * DAY + 18 * 3600000, updatedAt: start.getTime() + 6 * DAY + 18 * 3600000 }
  ]
  const [maya, leo, priya] = profiles
  // Colors Maya tried over the weeks, so the COLORS table has more than one row.
  const mayaColors = ['#00bcd4', '#00bcd4', '#00bcd4', '#2196f3', '#4caf50', '#fdd835', '#ec407a']

  let stats = DEFAULT_STATS
  const unlocked = {}
  let rounds = 0

  const record = (outcome, context, when) => {
    stats = applyRoundOutcome(stats, outcome, context, when)
    rounds++
    const t = when.getTime()
    for (const id of evaluateUnlockedIds(stats)) {
      const key = unlockedKey(id, null)
      if (!(key in unlocked)) unlocked[key] = t
    }
    for (const [profileId, bucket] of Object.entries(stats.profiles)) {
      for (const id of evaluateUnlockedIdsForProfile(bucket)) {
        const key = unlockedKey(id, profileId)
        if (!(key in unlocked)) unlocked[key] = t
      }
    }
  }

  // Days played: a few early, then every day for the last 15 (the Dedicated streak), today included.
  const days = [0, 2, 3, 6]
  for (let d = 6; d <= 21; d++) if (!days.includes(d)) days.push(d)

  for (const d of days) {
    const progress = d / 21
    const sessionStart = start.getTime() + d * DAY + (18 + Math.floor(random() * 3)) * 3600000
    let minute = 0
    const at = () => new Date(Math.min(sessionStart + (minute += 2 + Math.floor(random() * 4)) * 60000, now - 60000))

    // Against the CPU: Drone first, Bot from the first week, Mainframe in the last.
    const cpuRounds = 2 + Math.floor(random() * 4)
    for (let i = 0; i < cpuRounds; i++) {
      const difficulty = progress < 0.3 ? 'easy' : progress < 0.7 ? (random() < 0.7 ? 'normal' : 'easy') : random() < 0.5 ? 'hard' : 'normal'
      const winChance = { easy: 0.8, normal: 0.6 + 0.15 * progress, hard: 0.35 + 0.15 * progress }[difficulty]
      const r = random()
      const outcome = r < winChance ? { type: 'win', winner: 1 } : r < winChance + 0.06 ? { type: 'draw' } : { type: 'win', winner: 2 }
      const color = pick(mayaColors)
      record(outcome, { gameMode: 'vsCpu', cpuDifficulty: difficulty, colors: { 1: color, 2: DEFAULT_P2_COLOR }, profileIds: { 1: maya.id } }, at())
    }

    // Face to face, from the day Leo joined; Priya from the second week.
    if (d >= 2) {
      const twoRounds = 1 + Math.floor(random() * 4)
      for (let i = 0; i < twoRounds; i++) {
        const rival = d >= 6 && random() < 0.45 ? priya : leo
        const guest = random() < 0.15
        const r = random()
        const outcome = r < 0.55 ? { type: 'win', winner: 1 } : r < 0.62 ? { type: 'draw' } : { type: 'win', winner: 2 }
        const p1Color = pick(mayaColors)
        const p2Color = guest ? DEFAULT_P2_COLOR : rival.color
        record(outcome, { gameMode: 'twoPlayer', cpuDifficulty: 'normal', colors: { 1: p1Color, 2: p2Color }, profileIds: guest ? { 1: maya.id } : { 1: maya.id, 2: rival.id } }, at())
      }
    }
  }

  return { stats, unlocked, profiles, rounds }
}
`

// Beside this file, so the bundle's external requires resolve from the app's node_modules.
const workDir = fs.mkdtempSync(path.join(HERE, '.generate-'))
try {
  const bundleFile = path.join(workDir, 'bundle.cjs')
  await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundleFile,
    logLevel: 'error',
    alias: { '@': path.join(ROOT, 'src') },
    external: ['react-native', '@rific/core', 'react', 'react-redux']
  })
  const { run } = createRequire(import.meta.url)(bundleFile)
  const out = run(Date.now())
  fs.writeFileSync(path.join(HERE, 'seed.json'), JSON.stringify(out, null, 2) + '\n')
  const s = out.stats
  console.log(`${out.rounds} rounds: vs CPU ${s.vsCpu.wins}-${s.vsCpu.losses}-${s.vsCpu.draws} (best streak ${s.vsCpu.bestWinStreak}), two player ${s.twoPlayer.p1Wins}-${s.twoPlayer.p2Wins}-${s.twoPlayer.draws}, day streak ${s.currentDayStreak}`)
  console.log(`unlocked: ${Object.keys(out.unlocked).filter((k) => !k.includes(':')).sort().join(', ')}`)
} finally {
  fs.rmSync(workDir, { recursive: true, force: true })
}
