// The App Store's product page header and search results art (iOS 27's creative assets, see store/README.md). The
// header is a real round, never a lookalike: the app's own engine (createInitialGameState, tickGame) on a 21:9 board,
// with the CPU's own AI (chooseCpuDirection, at Bot) riding both cycles, drawn the way GameBoard.tsx draws a trail (0.85-cell
// stroke, round caps and joins, a 0.95-cell head with a white ring) in the default player colors. The search art fans
// the four games' screenshot captures (store/screenshots/raw/iphone/01-duel, 03-turf, 04-tag, 05-snake) out in phones
// under a headline in the app's display font (Orbitron Bold).
//
//   node store/creative/build.mjs
//
// Writes store/screenshots/header.png (3840 x 1646), store/screenshots/search.png (3840 x 2560) and Google Play's
// store/screenshots/google-play/feature-graphic.png (1024 x 500, the header's round cropped), each with -safe
// and -384 previews, through the app-store-prep skill's creative.mjs (CREATIVE=/path/to/creative.mjs to override).
// Deterministic: the round's seed is fixed (SEED below).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { build } from 'esbuild'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '../..')
const OUT_DIR = path.join(ROOT, 'store', 'screenshots')
const CREATIVE = process.env.CREATIVE ?? path.join(os.homedir(), '.claude/skills/app-store-prep/scripts/creative.mjs')
const FONT = path.join(ROOT, 'node_modules/@expo-google-fonts/orbitron/700Bold/Orbitron_700Bold.ttf')
const WORK = fs.mkdtempSync(path.join(HERE, '.build-'))

// Header: 3840 x 1646 at CELL px a cell. The safe area (x 1097-2743, y 493-1154) is where both heads must end up.
const HEADER = { width: 3840, height: 1646, cell: 48, safe: { x0: 1097, x1: 2743, y0: 493, y1: 1154 } }
// The header's round is played on a board inside what every device shows of the header in App Store Connect's Device
// Preview (about x 330-3510 on the iPhone, y 190-1290 on iPad landscape; the app-store-prep skill's references/apple.md),
// a cell clear of each side, so no trail is cut off by any crop. The first header's round filled the whole 21:9, and its
// trails ran off the bottom on iPad landscape and off the sides on the iPhone (2026-11-12). Google Play shows all of its
// feature graphic, so that keeps the full-bleed round (FULL).
const BOARD = { x: 384, y: 260, width: 3072, height: 960 }
const FULL = { x: 0, y: 0, width: HEADER.width, height: HEADER.height }
const SEED = Number(process.env.SEED ?? 0)

const ENTRY = `
import { chooseCpuDirection } from '@/games/trap/utils/cpuAi'
import { applyTurnIntent, buildOccupiedSet, buildPortalLookup, createInitialGameState, startPlaying, stepsFor, tickGame } from '@/games/trap/utils/gameEngine'

// The seat colors (pack.ts's seatColors): blue for player 1, red for player 2
const P1 = '#2196f3'
const P2 = '#f44336'

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One round between two CPUs, every tick's state kept. 'sideBySide' starts the riders at the left and right ends,
// which suits a wide board.
export function playRound(width, height, cell, seed) {
  const random = rng(seed)
  let s = startPlaying(createInitialGameState(width, height, 'sideBySide', { 1: P1, 2: P2 }, cell, false))
  const states = [s]
  while (s.phase === 'playing' && states.length < 2000) {
    const portals = buildPortalLookup(s.portals)
    for (const seat of [1, 2]) {
      const player = s.players[seat]
      const occupied = buildOccupiedSet(s.players, s.obstacles, s.overpass)
      const direction = chooseCpuDirection({ player, grid: s.grid, occupied, difficulty: 'normal', random, ownSteps: stepsFor(player.effects), pickups: s.pickups, heldPowerup: player.heldPowerup, portals, overpass: s.overpass })
      s = applyTurnIntent(s, seat, direction)
    }
    s = tickGame(s, undefined, 1, [], random)
    states.push(s)
  }
  return states
}
`

function bundle() {
  const file = path.join(WORK, 'engine.cjs')
  return build({ stdin: { contents: ENTRY, resolveDir: ROOT, loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', outfile: file, logLevel: 'error', alias: { '@': path.join(ROOT, 'src') }, external: ['react-native', 'react'] }).then(() => createRequire(import.meta.url)(file))
}

// The frame to draw: both riders alive, both heads inside the safe area, and as much trail on the board as possible.
// A cell's spot on the header is its spot on the board plus the board's corner (`board.x`, `board.y`). `balance` is how
// evenly the trail covers the board's left and right halves (1 when even), for choosing between rounds.
function pickFrame(states, { cell, safe }, board) {
  const inSafe = (c) => {
    const x = board.x + (c.x + 0.5) * cell
    const y = board.y + (c.y + 0.5) * cell
    return x > safe.x0 + cell && x < safe.x1 - cell && y > safe.y0 + cell && y < safe.y1 - cell
  }
  let best = null
  for (const s of states) {
    const p = s.players
    if (!p[1].alive || !p[2].alive) continue
    const heads = [p[1].trail.at(-1), p[2].trail.at(-1)]
    if (!heads.every(inSafe)) continue
    const length = p[1].trail.length + p[2].trail.length
    if (!best || length > best.length) best = { state: s, length }
  }
  if (best) {
    const cols = board.width / cell
    const left = [1, 2].reduce((n, seat) => n + best.state.players[seat].trail.filter((c) => c.x < cols / 2).length, 0)
    best.balance = 1 - Math.abs(2 * left - best.length) / best.length
  }
  return best
}

// GameBoard.tsx's trail: a 0.85-cell stroke through the cell centers, round caps and joins, then the head (RiderHead's
// classic skin), a filled 0.95-cell circle with a white ring and a thin black line outside it. The glow under it is the hero title trails' (HeroTitleTrails.tsx).
function trailSvg(player, cell) {
  const pts = player.trail.map((c) => `${(c.x + 0.5) * cell},${(c.y + 0.5) * cell}`)
  const head = player.trail.at(-1)
  const cx = (head.x + 0.5) * cell
  const cy = (head.y + 0.5) * cell
  const w = cell * 0.85
  const r = cell * 0.475
  return `
    <polyline points="${pts.join(' ')}" fill="none" stroke="${player.color}" stroke-width="${w * 2.2}" stroke-linecap="round" stroke-linejoin="round" opacity="0.35" filter="url(#glow)"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${player.color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 1.6}" fill="${player.color}" opacity="0.5" filter="url(#glow)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${player.color}"/>
    <circle cx="${cx}" cy="${cy}" r="${r + cell * 0.095}" fill="none" stroke="#000000" stroke-width="${cell * 0.12}"/>
    <circle cx="${cx}" cy="${cy}" r="${r - cell * 0.05}" fill="none" stroke="#ffffff" stroke-width="${cell * 0.18}"/>`
}

function headerPage(state, board) {
  const { width, height, cell } = HEADER
  const trails = `${trailSvg(state.players[1], cell)}
  ${trailSvg(state.players[2], cell)}`
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${cell * 0.6}"/></filter></defs>
  <rect width="${width}" height="${height}" fill="#000"/>
  ${board.x || board.y ? `<g transform="translate(${board.x} ${board.y})">${trails}</g>` : trails}
</svg></body></html>`
}

// Search results, 3840 x 2560: state the obvious, and fill the card. iOS 27's search card shows the whole 3:2 on iPhone
// as on iPad, about 390pt wide on a phone (Jay's App Store screenshots, 2026-11-13; App Store Connect's preview cropping
// it to the top 1500 was the preview's bug), so ten pixels here are about a point there. The first version, kept to
// that strip and the template's middle (x 836-3004), read as mostly empty with a 15pt headline and one game. Now the
// headline runs across the top at 250px, and under it the four games fan out in phones running off the bottom, in the
// order Home lists them: Trap, Turf, Tag and Snake. The board color behind it all is the app's black, lit by the two
// riders' colors. Phones from the app-store-prep skill's phone.mjs.
const { fan } = await import(pathToFileURL(path.join(path.dirname(CREATIVE), 'phone.mjs')).href)
const SHOTS = ['01-duel', '03-turf', '04-tag', '05-snake'].map((name) => path.join(OUT_DIR, 'raw', 'iphone', `${name}.png`))
function searchPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Orbitron; src: url('${pathToFileURL(FONT).href}'); }
html,body { margin:0; background:#000; }
.page { position:relative; width:3840px; height:2560px; overflow:hidden; background: radial-gradient(ellipse 1500px 1300px at 1100px 1700px, rgba(33,150,243,0.22) 0%, rgba(33,150,243,0) 100%), radial-gradient(ellipse 1500px 1300px at 2740px 1700px, rgba(244,67,54,0.2) 0%, rgba(244,67,54,0) 100%), radial-gradient(ellipse at 50% 30%, #0b1a24 0%, #000 70%); }
.copy { position:absolute; left:0; right:0; top:170px; display:flex; flex-direction:column; align-items:center; text-align:center; }
.title { font-family: Orbitron; font-size:250px; line-height:1.08; color:#fff; letter-spacing:2px; white-space:nowrap; }
.title .p1 { color:#2196f3; } .title .p2 { color:#f44336; }
.sub { margin-top:50px; font-family: Orbitron; font-size:96px; line-height:1.3; color:#aab4bd; white-space:nowrap; }
</style></head><body><div class="page">
  <div class="copy">
    <div class="title"><span class="p1">Four</span> <span class="p2">Duel</span> Games</div>
    <div class="sub">Trap, Turf, Tag and Snake.<br>Two players, one phone.</div>
  </div>
  ${fan(SHOTS, { top: 980, scale: 0.66, gap: -80, turn: 3, drop: 90, ring: 'rgba(255,255,255,0.18)', shadow: '0 40px 140px rgba(0,0,0,0.8)' })}
</div></body></html>`
}

// Google Play's feature graphic (1024 x 500, no words): the full-bleed round (FULL), cropped to Play's shape around the
// middle of Apple's safe area, where both heads are.
function featurePage(state) {
  const { width, height, cell, safe } = HEADER
  const cropH = height
  const cropW = Math.round((cropH * 1024) / 500)
  const x0 = Math.round((safe.x0 + safe.x1) / 2 - cropW / 2)
  return headerPage(state, FULL).replace(`width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`, `width="1024" height="500" viewBox="${x0} 0 ${cropW} ${cropH}"`).replace('<rect width=', `<rect x="${x0}" width=`)
}

function render(page, kind, out) {
  const html = path.join(WORK, `${kind}.html`)
  fs.writeFileSync(html, page)
  execFileSync(CREATIVE, [html, kind, out], { stdio: 'inherit' })
}

try {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const { playRound } = await bundle()
  // The feature graphic's round is the first seed with enough trail (the 2026-11-11 pick). The header's is the best of
  // 200 seeds by trail times balance, so the round fills the board rather than one end of it.
  const pickRound = (name, board, { best = false } = {}) => {
    let pick = null
    for (let seed = SEED; seed < SEED + 200; seed++) {
      const found = pickFrame(playRound(board.width, board.height, HEADER.cell, seed), HEADER, board)
      if (!found || found.length <= 140) continue
      if (!best) {
        pick = { ...found, seed }
        break
      }
      if (!pick || found.length * found.balance > pick.length * pick.balance) pick = { ...found, seed }
    }
    if (!pick) throw new Error(`No ${name} round put both heads in the safe area with enough trail`)
    console.log(`${name}: seed ${pick.seed}, tick ${pick.state.tick}, ${pick.length} trail cells, balance ${pick.balance.toFixed(2)}`)
    return pick
  }
  render(headerPage(pickRound('header', BOARD, { best: true }).state, BOARD), 'header', path.join(OUT_DIR, 'header.png'))
  fs.mkdirSync(path.join(OUT_DIR, 'google-play'), { recursive: true })
  render(featurePage(pickRound('feature', FULL).state), 'feature', path.join(OUT_DIR, 'google-play', 'feature-graphic.png'))
  const missing = SHOTS.find((shot) => !fs.existsSync(shot))
  if (!missing) render(searchPage(), 'search', path.join(OUT_DIR, 'search.png'))
  else console.log(`search: skipped, no capture at ${path.relative(ROOT, missing)} yet`)
} finally {
  fs.rmSync(WORK, { recursive: true, force: true })
}
