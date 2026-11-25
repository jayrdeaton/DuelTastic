# 2 to 4 players: the plan

A draft for Jay to review (2026-11-25). Nothing here is built yet. The open choices are under Decisions at the end, each with a
recommendation.

## What it is

- **A party mode on big screens:** up to four people around one iPad (or a big Android tablet), or at one computer, in all four
  games. Player 1's opponent menu offers 2, 3 or 4 Players where there's room for them. 2 Players is today's 2 Player, unchanged.
- **Elimination rounds:** a rider who crashes (or a snake that dies, or whoever's It at the buzzer) is out, and the round goes on
  until one is left. The match around the rounds is today's: the countdown, a result card per player, Play Again once everyone
  presses it, the round pips, Quit.
- **Every seat a person at launch.** CPUs in empty seats come later (section 7).
- **Not on phones:** four corners of a phone are too small to steer in.
- **PuckTastic stays exactly as it is.** Every change to the shared packages is opt-in; a pack that asks for none of it builds the
  same store and draws the same screens.
- **The name stays DuelTastic.** CLAUDE.md, "The name stays DuelTastic", already calls more players a bonus mode for big screens.
- **Not in this:** teams (2 against 2), one player per edge of the iPad, online play, more than four.

Jay wants all four games done before any of it ships (section 11).

## 1. Where everyone sits

Two to a side, each player owning the quarter of the screen in front of them. On a landscape iPad lying flat on a table:

```
            far side (turned 180)
   +------------------+------------------+
   |  seat 4          |  seat 2          |
   |  (top left)      |  (top right)     |
   +------------------+------------------+
   |  seat 1          |  seat 3          |
   |  (bottom left)   |  (bottom right)  |
   +------------------+------------------+
            near side (upright)
```

- **Seat 1 and seat 2 stay across the table from each other**, as in today's 2 Player, and the layout is the same turned 180
  degrees: what seat 1 sees from the bottom left, seat 2 sees from the top right, and the same for seats 3 and 4.
- **Three players:** seats 1 and 3 share the near side, and seat 2 keeps the whole far half, as today.
- **Why two to a side, not one per edge:** everything that faces a player today turns 0 or 180 degrees (the countdown, the result
  cards, the seat toasts, the loadout's halves), and it all keeps working. One per edge needs quarter turns, which `SeatToasters`
  dropped on 2026-11-06 with the drawn rotation, triangular touch zones, and leaves the two players on the short edges about 8
  inches of a 13-inch iPad each. A long edge fits two children side by side.
- **Landscape or portrait:** the same quarters either way. Landscape gives each pair the long edge, so it's the one to recommend;
  portrait works.
- **The board fills the window** in a 3 or 4 player round. Today a landscape iPad's board is capped at 1000pt wide
  (`MAX_BOARD_CONTENT_WIDTH`, `MatchScreen`) with gutters either side; four players need every bit of it.
- **At a computer:** the same four quarters, all upright, as 2 Player sits side by side upright today. The keys are the four
  keyboard schemes there already are: WASD, the arrows, IJKL and the numpad. A laptop has no numpad, so its fourth player takes
  the mouse (dragging in their own quarter), or the round is three players.
- **Not on a phone:** the choice only shows at a computer (the shell's `useAtComputer`) or where the window's shortest side is at
  least 700pt: every iPad, the iPad mini included, and 10-inch Android tablets. If the window shrinks under that in the loadout
  (Split View, Stage Manager), the loadout falls back to 2 Players. A round already in play carries on: its board is fixed at mount
  and scales to the window, as today.

## 2. Steering

Steering stays absolute, as it is today: swipe toward the top of the screen and your rider goes toward the top of the screen,
whichever seat you're in. Player 2 already plays this way from across the table (`shared/match/turnIntent.ts` explains why it needs
no flip): a swipe and the move it makes are the same direction on the glass, whichever side you watch from. So no seat needs its
swipes turned for its edge, and that would still hold for a player on a short edge. Steering relative to the rider (swipe left to
turn its left) would be a new control scheme for everyone, and isn't part of this.

- **Touch:** each seat's quarter is its own native view with its own gesture recognizer. That's `TouchInputLayer`'s reason for two
  views today (two fingers landing in one touch batch raced for one recognizer), and it extends to four. The web layer's pointer
  zones split the same way.
- **Keys:** `resolveKeyAction` (`shared/match/keyControls.ts`) looks up which of up to four seats owns a key.
- **An eliminated seat's quarter** stops steering.

## 3. The match frame in DuelTastic (`src/shared/match`)

What Trap, Turf and Tag share today, made to take 2 to 4 seats. Snake has its own copy of most of this (section 5).

- **Seats:** `Player` becomes `1 | 2 | 3 | 4`. `GameMode` gains `'party'`, a round of 3 or 4 people, and the round carries the
  seats playing. `humanPlayersFor` takes them. A 2 Players round is `'twoPlayer'`, exactly as today.
- **Outcomes:** `RoundOutcome` keeps its two kinds (one seat wins, or a draw) and gains the seats a draw is between and the order
  seats went out, which the result cards show as places. A 2 Player round fills them in and reads as before.
- **Going out:** a round component reports each seat as it goes out. The crash sound and buzz play for each one (today only as
  the round ends), and an OUT banner with the seat's place (4TH, 3RD) shows in its quarter, turned to face it, while the rest play
  on.
- **Where seats start** (`grid.ts`'s `startingStateFor`): each rider at the middle of its own quarter, heading round in a pinwheel
  (seat 1 up, seat 4 right, seat 2 down, seat 3 left), so nobody starts head-on with anybody. With three, seat 2 starts in the
  middle of the far half, heading down.
- **Zones** (`playerZones.ts`): a quarter (or the far half, with three) per seat, read by the touch layers, the countdown, the
  result cards and the seat toasts alike, as `zoneSideFor` is now.
- **What faces each player** (`seatToastSpots`, `SeatToasters`, `OnboardingOverlay`, `RoundOverDialog`): each seat's countdown,
  result card and unlock toasts in its own quarter, the far two turned 180. Four toast stacks in place of two. Each result card
  shows that player's place and its own Play Again and Quit. A quarter of an iPad mini in landscape is about 566 by 372pt, room for
  the 360pt card.
- **`MatchOverDialog`** tallies every seat's wins; **`RoundHistoryPips`** draws each round in its winner's color, as now.
- **`MatchScreen`:** each seat's color (today it reads seats 1 and 2 off the theme; seats 3 and 4 come from the shell, section 4),
  profile and name for every seat, and a party round's record (section 8).
- **`useMatchFlow`:** Play Again waits for every person in the round.
- **`MatchChips`:** in a party round the players are face to face, so the back and settings chips sit on the side edges at the line
  between the two sides, as in 2 Player.
- **Board colors:** `gateColors`' `occupiedHues` takes every seat's color, so the gates still keep away from all of them. The
  powerup boxes are drawn in the theme's text color (`onSurface`) in a party round, as Snake's already are: the theme's tertiary,
  the boxes' color now, is worked out from seats 1 and 2 only and sits close to seat 3's proposed green.

## 4. The packages, in release order

Each change is opt-in. A pack that sets none of it (PuckTastic, CardTastic) builds the same store and draws the same screens, and
each package's tests pin that. PuckTastic doesn't need to move onto any of these releases; if it does later, nothing changes for it.
Before each release, PuckTastic's `npm run verify` runs against the packed package (`npm install --no-save`, never yalc).

1. **`@tastic/input`:** `assignSeatScheme` (swap on conflict) takes any number of seats: the seat already holding the scheme gets
   the picking seat's old one. The same results for two seats, so PuckTastic's calls don't change. `KEY_SCHEMES` already has the
   four keyboard schemes.
2. **`@tastic/profile`:** a seat's menu can mark more than one other seat's profile taken (`ProfilePicker`'s taken profile, and its
   color page's taken color, as lists), and `avoidSeatColorClash` moves each later seat off every earlier seat's color onto the
   first free default. The selection and seat-colors slices are already generic over seats, and on rehydrate they fill a seat the
   saved state doesn't have from the defaults, so seats 3 and 4 need nothing new there. The native module doesn't change, but the
   version bump moves DuelTastic's iOS fingerprint (CLAUDE.md, "The 2026-11-25 @tastic releases"), so the release needs a new
   build.
3. **`@tastic/split-screen`:** a four-zone layout beside `DualZoneLayout` (the quarters, the far two turned 180, and the shared band
   across the middle that face to face 2 Player has), with its zone bounds. `needsSharedNeutralZone` already takes a player count.
4. **`@tastic/hud`:** `PlayerSetupPanel` passes the taken lists through; `useZoneClampedAlign` keeps a seat's menu inside its own
   quarter (it reads split-screen's zone bounds, so it comes after 3); the guide's `SeatDiagram` draws three and four seats, for the
   party's How to Play card.
5. **`@tastic/achievements`:** nothing. `mapUnlocksBySeat` and `broadcastDeviceUnlocks` already take any seats and a list of
   winners.
6. **`@tastic/shell`:**
   - `GameDefinition.maxPlayers?: 3 | 4`. Unset is 2, today's.
   - `PackDefinition.partySeatColors?: { 3: string; 4: string }`, seats 3's and 4's starting colors. `seatColors` stays seats 1
     and 2, so PuckTastic's pack still fits.
   - `Seat` becomes `1 | 2 | 3 | 4`. A pack's store gets seats 3 and 4 (in `profileSelection` and `seatColors`) and a new `party`
     key (`{ players: 2 | 3 | 4 }`) only when one of its games sets `maxPlayers`, so PuckTastic's saved state is untouched.
   - The opponent menu's Player row becomes 2 Players, 3 Players and 4 Players, up to the game's `maxPlayers`, where there's room
     (a new `useRoomForParty`: at a computer, or a window whose shortest side is at least 700pt). Picking 3 or 4 sets seat 2 to a
     person and `party.players`; the round is `RoundMode` `'party'` with its seats (`ActiveRound.seats`), and `humanSeatsFor` takes
     them. Anywhere without the room, or in a game without `maxPlayers`, the same saved choice reads as 2 Players.
   - The party loadout, on the four-zone layout: a panel per seat in its quarter (seat 1's with the opponent button, each other's
     Player 3, Player 4 or a profile, captioned PLAYER 3 and PLAYER 4), each seat's controls picker at a computer, a Ready per seat,
     and the game's options and Back and Settings in the band across the middle.
   - `useSeatColors` gives every seat's color: seats 3 and 4 from their remembered guest color or their profile's pick. The theme
     stays the triad of seats 1 and 2.
   - `createPlayerSettings` keeps controls per seat for every seat, and `distinctControls` keeps them apart across all of them;
     `seatPlayerKey` gives `guest:3` and `guest:4`. `createGameStats`' `record` takes profile ids for any seat.
7. **DuelTastic.**

Input, profile and split-screen don't need each other's new parts, so 1 to 3 can go out together. Hud hands profile's taken lists
on and clamps to split-screen's quarters, so it goes after both, and the shell goes last since it needs all of them.

## 5. Each game with 3 or 4 riders

With two, every game plays exactly as today.

### Trap: last rider standing

- **Rules:** a crash puts a rider out and the round goes on. The last one riding wins. If everyone still riding crashes on the
  same tick, it's a draw between them.
- **A crashed rider's trail clears** as its crash's wipe passes along it (`RiderCrash`'s head-to-tail wipe already shows it going),
  freeing the room for the rest. The other way is to leave it as a wall (Decisions).
- **The engine:** `tickGame` (`games/trap/utils/gameEngine.ts`) names riders 1 and 2 throughout (`p1`, `trail1`, `dir1`, `crash1`)
  and checks one head-on pair. It becomes a loop over the riders still in: each sub-step works out every stepping rider's next
  cell, and any cell two or more step into is a head-on for all of them, except that a lone shielded rider among them wins it.
  Out of bounds, trails, walls, the Overpass's levels, Shield breaks (finding which trail was hit among all of them) and pickups
  (first rider checked takes it, as now) work per rider as they do today. About 311 lines of Trap name a seat, the most of the four.
- **The board and HUD:** each rider's trail, head and crash, the board's edge in each seat's color along its own quarter
  (`SplitWalls`), and each seat's held powerup badge in its own corner (`PowerupHud`).

### Turf: most ground among those left

- **Starts:** a 7 x 7 square of ground at the middle of each quarter (with three, seat 2's in the middle of the far half).
- **Trails as one bit per seat:** today a cell's trails are marked with the seat number itself (`trails[i] |= seat`), and seat 3
  would read as seats 1 and 2 together. It becomes `1 << (seat - 1)`.
- **Crash Ends Round:** a crash puts the rider out; its trail clears and its ground goes back to nobody's (Decisions). The clock
  gives the round to the most ground among those still riding; if one is left before then, they win at once.
- **Crash Sends Home:** nobody goes out by crashing, as today. A rider whose ground is all taken is suffocated and out. The clock
  gives the round to the most ground.
- **Head-ons:** on one of the two riders' ground, the other crashes, as today; on a third rider's ground or nobody's, both crash.
- **Cutting:** riding into anyone else's trail crashes its owner, as today.
- **The HUD:** each player's own share and the clock at their corner, and their place (1ST to 4TH) in place of the other rider's
  share.

### Tag: elimination Hot Potato

- **Least Time It** works for any number as it is: one It, everyone else runs, and less time as It wins.
- **Hot Potato in a party round is heats:** whoever is It when a heat's clock runs out is out, and the next heat starts at once
  from where everyone is, until one is left. With four, a round is three heats. A heat is 30 seconds (Decisions).
- **The next It:** whoever tagged the rider who just went out, so the chase carries on from where it stopped; if that rider was
  It for the whole heat, the runner nearest them (Decisions).
- **Tagging:** It tags whichever runner it reaches (the nearest, if two at once). The new It's freeze stands, so there are no
  tag-backs, as today.
- **Who starts It:** today the seats take turns, seat 2 first; in a party round the turn goes round all the seats.
- **The HUD:** IT or RUN, the heat's clock and the held powerup at each player's corner.

### Snake: last snake alive

- **Rules:** a snake that dies is out; the last one alive wins. Snakes dying on the same tick as the last ones: the higher score
  wins, the same score is a draw.
- **A dead snake's body fades away**, like Trap's trail (Decisions).
- **Food:** two pieces at once with three or four snakes (today `food` is one cell). A number to tune by playing.
- **The most work of the four, despite its engine:** `tickSnake` already keeps the snakes in an array, and `applySnakePowerupActivation`
  looks the opponent up by id. But Snake has its own of nearly everything the others share: its board, play screen, countdown,
  Game Over card, touch and keyboard layers, seat split (`useSeatSplit`) and stats. Each needs the party treatment of section 3.
  Its result is a Game Over card per player with their place and score.
- Solo stays as it is.

## 6. Powerups aimed at "your opponent"

These have one target today, the other rider:

| Game | Aimed at the other rider |
| --- | --- |
| Trap | Stasis, Overclock, Hack, Prune |
| Turf | Frost, Mud, Tangle, Gust |
| Tag | Freeze, Mud, Tangle |
| Snake | Coldblood, Constrict, Mesmerize, Frenzy |

**Recommended: the nearest rider still in** (head to head, through the board), ties going to the next seat round from yours. A
child can see who it'll hit, and the effect's ring shows who it did. In Tag, a runner's always lands on It, and It's on the nearest
runner. The alternatives: everyone else at once (too strong with four, and a pile of rings), or the leader (Turf has ground and
Snake a score to lead by, Trap and Tag don't). Needed at launch; it goes into each game's activation (`applyActivation`,
`applyTurfActivation`, `applyTagActivation`, `applySnakePowerupActivation`). Prune and Constrict cut the nearest rider's trail or body.

## 7. CPUs for empty seats (later)

Every seat is a person at launch: with three children, they pick 3 Players. Today's CPUs each reason about one opponent:

- **Trap and Snake** steer mostly by free space (flood fills over every trail), so more riders is mostly a bigger occupied set,
  keeping clear of every other head, and the nearest-rider targeting above. Trap's CPU is also fixed to seat 2 (`CPU_PLAYER`).
  About half a day each.
- **Turf and Tag** reason about `them`: Turf's threat to its trail, its cut and the other rider's reach, and Tag's chase and its
  run. Turf's become the nearest rider's (the soonest any rider could reach its trail); Tag's It chases the nearest runner and a
  runner only minds It. About a day each.
- **The loadout:** how a seat becomes a CPU is to settle then (an empty seat's button offering the CPU's levels, or a count of CPUs
  in player 1's menu). The CPU's remembered color (`seatColors.lastCpuColor`) is one color today and would become one per seat.
- Three to four days in all, plus playing against them.

## 8. Stats and achievements

- **2 Player rounds count as today.**
- **A party round doesn't fit the games' stats:** `shared/duelStats` keeps one seat winning or a draw, and its `twoPlayer` bucket
  is seat 1's and seat 2's wins (Snake's own stats are the same). Adding a party bucket there would change the saved shape, and the
  stats checks (`statsValidation.ts`) reject a save missing a field, so every player's saved stats would start over after the
  update. DuelTastic is out (v1.0.0 and v1.1.0 are tagged, and the web build saves stats too), so that would cost real players their records. Filling the missing bucket in is old-save
  handling, which is Jay's call (Decisions).
- **Recommended at launch, without touching saved data:** a new pack key, `partyAchievements`, built with `@tastic/achievements`'
  `createAchievementsSlice` like each game's: per game, rounds played and won by each profile and by guests. It shows as a Party
  section through `PackDefinition.StatsSections` (first on the Stats tab, already handed the player and game filters). A new key
  starts empty with no migration. A party round leaves each game's own stats, achievements and day streak alone.
- **Later:** party achievements in that key's catalog (play a four-player round, win one, win three in a row), toasted on each
  seat's own stack. About a day or two.

## 9. How to Play

Each game's How to Play gets a party card when the round is a party (`GameGuide.getSteps` is handed the mode): two to a side, steer
in your own corner, last one riding wins; and in Tag, the heats. Its picture is hud's `SeatDiagram` with three or four seats. Copy
for Jay to review; `packGuides.test.tsx` covers it like every other card (90-character bodies, Title Case, no keys on touch).

## 10. Phases and estimates

| Phase | What | Estimate |
| --- | --- | --- |
| 0 | Jay's decisions (below) | |
| 1 | The packages (section 4): input, profile, split-screen, hud, shell, each released by tag with PuckTastic checked against it | 3 to 4 days |
| 2 | DuelTastic's match frame (section 3): seats, outcomes, OUT banners, starts, zones, touch and keys, cards, toasts, colors | 2 to 3 days |
| 3 | The games (section 5), powerup targeting included: Trap 1, Turf 1 to 1.5, Tag 1, Snake 1.5 to 2 | 4.5 to 5.5 days |
| 4 | Party stats and their section (section 8), How to Play cards (section 9) | 1 to 1.5 days |
| 5 | Playing it on an iPad with several people, and fixing what that finds (section 12) | 1 to 2 days |
| | **To launch** | **about 12 to 16 days** |
| 6 | CPUs for empty seats (section 7) | 3 to 4 days |
| 7 | Party achievements (section 8) | 1 to 2 days |

That's more than the one to two weeks given before: that figure counted the foundation as one piece (2 to 3 days), where here the
packages and DuelTastic's own match frame are separate pieces of work, Snake brings its own copy of the frame, and the iPad sessions
need time to fix what they find.

## 11. What ships when

- **The packages** release as each is done. Nothing changes for PuckTastic or DuelTastic until a game sets `maxPlayers`.
- **DuelTastic's work lands on `main` game by game with `maxPlayers` unset**, so `main` stays releasable with 2 Player as it is.
  The last change sets `maxPlayers: 4` on all four games at once, so no release has party mode in some games and not others.
- **One release** turns it on, a new version on every platform together (the App Store, Google Play and the web). The
  `@tastic/profile` bump moves the iOS fingerprint, so it goes out in new builds (Jay runs them), not an over-the-air update.
- **The store listing** can add a line (two to four players on an iPad) and iPad screenshots of a party round. Optional, and not
  needed to ship.

## 12. Testing

- **Jest, in DuelTastic:** each engine with three and four riders (Trap: a three-way head-on, the last two crashing together as a
  draw between them, a crashed rider's cells freed; Turf: seats 3 and 4's trail bits, a head-on on a third rider's ground,
  suffocation putting one out while the round goes on, the clock among those left; Tag: a heat ending with It out, the next It,
  Least Time It with four; Snake: last alive, a tie on score); starts and zones for three and four (each seat's quarter, the
  pinwheel); countdowns, cards, toasts and OUT banners placed and turned per seat; four turns in one tick through each round hook;
  keys for four schemes; powerup targeting; the party stats; How to Play cards.
- **Jest, in the packages:** each one's own suite, and a test that a pack with no party game builds today's store and loadout.
- **The web dev server:** the party loadout and a round at 1280x800 at a computer (four keyboard seats), and in a touch-emulated
  iPad-size window.
- **The iOS Simulator:** layout, landscape and portrait, Split View hiding the choice. It can't do more than two touches at once, so
  it can't stand in for four players.
- **An iPad with several people** (Jay's family). What to check:
  - four children swiping at once, each steering only their own rider;
  - each player reading their own countdown, card, toasts and OUT banner the right way up;
  - Play Again waiting for everyone, Quit from either chip;
  - landscape and portrait, and an iPad mini;
  - a palm resting in a quarter: each quarter's pan takes one finger (`maxPointers(1)`), so a resting hand could swallow that
    player's swipes;
  - Edge Guard and the home indicator under the near pair's hands;
  - the elimination sound and buzz (sound off for everything else, on only for that check).
- **A keyboard with four players:** many keyboards drop a third or fourth key held at once (rollover), so four players on one
  keyboard may lose turns; and a laptop's three schemes plus the mouse.

## Decisions

Still defaults, until Jay says otherwise:

1. **Where the mode lives.** Default: 2 Players, 3 Players and 4 Players in place of Player in player 1's opponent menu, where
   there's room. The other way: a Players control (2, 3, 4) in each game's options row.
2. **How everyone sits.** Default: two to a side, each in a quarter (seat 1 bottom left, seat 3 bottom right, seat 4 top left,
   seat 2 top right, the far two turned 180); with three, seat 2 has the whole far half. Landscape recommended, portrait works. The
   other way: one player per edge, which needs quarter turns and triangular touch zones.
3. **Phones excluded.** Default: the choice shows at a computer, or where the window's shortest side is at least 700pt (every iPad,
   10-inch Android tablets). The other way: 600pt, which lets in 7- and 8-inch Android tablets with smaller quarters.
4. **CPUs at launch.** Default: no, every seat a person; CPUs come after (section 7).
5. **Stats at launch.** Default: a new `partyAchievements` key with rounds played and won per game and profile, shown as a Party
   section, no achievements yet, and nothing added to the games' own saved stats. The other way, folding party rounds into each
   game's stats, would either start every player's stats over on the update or need the missing field filled in for 1.x saves,
   which is old-save handling and Jay's call.
6. **Seat 3 and 4 colors.** Default: Emerald (`#4caf50`) and Yellow (`#fdd835`) from the 20 swatches, the four colors children
   know from party games, with the powerup boxes drawn in the text color in a party round (section 3). Two things to know: red and
   green look alike to the commonest kinds of color blindness, so seats 2 and 3 would be told apart by their corner; and Yellow sits
   near Dash's and Overdrive's gold ring (a ring round the head, not the head's fill). The other way: Yellow and Magenta
   (`#d500f9`), kinder to color blindness but close to Hack's and Tangle's violet ring.
7. **A crashed rider's trail and a dead snake's body.** Default: they clear, as the crash's wipe already shows. The other way:
   they stay as walls, which makes the board close in faster.
8. **Turf: an eliminated rider's ground.** Default: it goes back to nobody's, so nobody seems to own ground while out. The other
   way: it stays theirs and the others can still claim it.
9. **Tag's heats.** Default: 30 seconds each, the next It being whoever tagged the rider who went out (or the runner nearest them,
   if they were It all heat). The other way: a random It among those left.
10. **Powerups aimed at "your opponent".** Default: the nearest rider still in (in Tag, a runner's hit It, and It's the nearest
   runner). The other way: everyone else at once.
11. **Snake's party win.** Default: last snake alive, score breaking a tie. The other way: the top score when a clock runs out,
   which Snake doesn't have today.
12. **The board's size in a party round.** Default: the whole window, without today's 1000pt width cap. The other way: keep the
   cap, leaving gutters on a landscape iPad.
13. **Where riders head at the start.** Default: a pinwheel (seat 1 up, seat 4 right, seat 2 down, seat 3 left), so nobody starts
   head-on. The other way: the near pair up and the far pair down, two head-ons at once.
