// The App Store's product page header and search results art (iOS 27's creative assets, see store/README.md). The
// header is a real round, never a lookalike: the app's own engine (createInitialGameState, tickGame) on a 21:9 board,
// with the CPU's own AI (chooseCpuDirection, at Bot) riding both cycles, drawn the way GameBoard.tsx draws a trail (0.85-cell
// stroke, round caps and joins, a 0.95-cell head with a white ring) in the default player colors. The search art puts
// the 01-duel screenshot capture (store/screenshots/raw/iphone/01-duel.png) in a phone beside a headline in the app's
// display font (Orbitron Bold).
//
//   node store/creative/build.mjs
//
// Writes store/screenshots/header.png (3840 x 1646) and store/screenshots/search.png (3840 x 2560), each with -safe
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
const CAPTURE = path.join(OUT_DIR, 'raw', 'iphone', '01-duel.png')
const FONT = path.join(ROOT, 'node_modules/@expo-google-fonts/orbitron/700Bold/Orbitron_700Bold.ttf')
const WORK = fs.mkdtempSync(path.join(HERE, '.build-'))

// Header: 3840 x 1646 at CELL px a cell. The safe area (x 1097-2743, y 493-1154) is where both heads must end up.
const HEADER = { width: 3840, height: 1646, cell: 48, safe: { x0: 1097, x1: 2743, y0: 493, y1: 1154 } }
const SEED = Number(process.env.SEED ?? 0)

const ENTRY = `
import { DEFAULT_P1_COLOR, DEFAULT_P2_COLOR } from '@/constants/game'
import { chooseCpuDirection } from '@/utils/cpuAi'
import { applyTurnIntent, buildOccupiedSet, buildPortalLookup, buildTunnelCellSet, buildTunnelOccupiedSet, createInitialGameState, startPlaying, stepsFor, tickGame } from '@/utils/gameEngine'

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
  let s = startPlaying(createInitialGameState(width, height, 'sideBySide', { 1: DEFAULT_P1_COLOR, 2: DEFAULT_P2_COLOR }, cell, false))
  const states = [s]
  while (s.phase === 'playing' && states.length < 2000) {
    for (const seat of [1, 2]) {
      const player = s.players[seat]
      const tunnelCellSet = buildTunnelCellSet(s.tunnels)
      const occupied = buildOccupiedSet(s.players, s.obstacles, tunnelCellSet)
      const direction = chooseCpuDirection({ player, grid: s.grid, occupied, difficulty: 'normal', random, ownSteps: stepsFor(player.effects), pickups: s.pickups, heldPowerup: player.heldPowerup, portals: buildPortalLookup(s.portals), tunnelCellSet, tunnelOccupied: buildTunnelOccupiedSet(s.players, tunnelCellSet, seat) })
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
function pickFrame(states, { cell, safe }) {
  const inSafe = (c) => {
    const x = (c.x + 0.5) * cell
    const y = (c.y + 0.5) * cell
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
  return best
}

// GameBoard.tsx's trail: a 0.85-cell stroke through the cell centers, round caps and joins, then the head, a filled
// 0.95-cell circle with a white ring. The glow under it is the hero title trails' (HeroTitleTrails.tsx).
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
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff" stroke-width="${cell * 0.12}"/>`
}

function headerPage(state) {
  const { width, height, cell } = HEADER
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${cell * 0.6}"/></filter></defs>
  <rect width="${width}" height="${height}" fill="#000"/>
  ${trailSvg(state.players[1], cell)}
  ${trailSvg(state.players[2], cell)}
</svg></body></html>`
}

// Search results: the headline on the left, the duel capture in a phone on the right, both inside the safe area
// (x 836-3004, y 765-1795). The board color behind it all is the app's own black.
function searchPage() {
  const capture = pathToFileURL(CAPTURE).href
  const phoneH = 1180
  const phoneW = Math.round((phoneH * 1320) / 2868)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Orbitron; src: url('${pathToFileURL(FONT).href}'); }
html,body { margin:0; background:#000; }
.page { position:relative; width:3840px; height:2560px; overflow:hidden; background: radial-gradient(ellipse at 70% 50%, #0b1a24 0%, #000 65%); }
.copy { position:absolute; left:900px; top:765px; width:1300px; height:1030px; display:flex; flex-direction:column; justify-content:center; }
.title { font-family: Orbitron; font-size:150px; line-height:1.12; color:#fff; letter-spacing:2px; }
.title .p1 { color:#2196f3; } .title .p2 { color:#f44336; }
.sub { margin-top:60px; font-family: Orbitron; font-size:72px; line-height:1.3; color:#9aa4ad; }
.phone { position:absolute; left:${2540 - phoneW / 2}px; top:${1280 - phoneH / 2}px; width:${phoneW}px; height:${phoneH}px; border-radius:80px; background:#1c1c1e; padding:12px; box-sizing:border-box; box-shadow: 0 0 120px rgba(33,150,243,0.25), 0 0 120px rgba(244,67,54,0.15); }
.phone img { width:100%; height:100%; border-radius:70px; display:block; }
</style></head><body><div class="page">
  <div class="copy">
    <div class="title"><span class="p1">Light</span> <span class="p2">Cycle</span><br>Duels</div>
    <div class="sub">Two players, one phone.<br>Or take on the CPU.</div>
  </div>
  <div class="phone"><img src="${capture}"></div>
</div></body></html>`
}

function render(page, kind, out) {
  const html = path.join(WORK, `${kind}.html`)
  fs.writeFileSync(html, page)
  execFileSync(CREATIVE, [html, kind, out], { stdio: 'inherit' })
}

try {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const { playRound } = await bundle()
  let pick = null
  for (let seed = SEED; seed < SEED + 200 && !pick; seed++) {
    const found = pickFrame(playRound(HEADER.width, HEADER.height, HEADER.cell, seed), HEADER)
    if (found && found.length > 140) pick = { ...found, seed }
  }
  if (!pick) throw new Error('No round put both heads in the safe area with enough trail')
  console.log(`header: seed ${pick.seed}, tick ${pick.state.tick}, ${pick.length} trail cells`)
  render(headerPage(pick.state), 'header', path.join(OUT_DIR, 'header.png'))
  if (fs.existsSync(CAPTURE)) render(searchPage(), 'search', path.join(OUT_DIR, 'search.png'))
  else console.log(`search: skipped, no capture at ${path.relative(ROOT, CAPTURE)} yet`)
} finally {
  fs.rmSync(WORK, { recursive: true, force: true })
}
