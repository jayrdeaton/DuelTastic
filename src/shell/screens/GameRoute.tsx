import { Redirect, useLocalSearchParams } from 'expo-router'

import { usePackGame } from '@/shell/PackContext'
import { LoadoutScreen } from '@/shell/screens/LoadoutScreen'

// The game routes, loadout/[game] and play/[game]: a game's loadout and its play screen, by id. An id
// the pack doesn't have (a stale link, a web URL typed by hand) goes Home. The game id comes second,
// never first: expo-router strips the web build's base path off the front of an in-app link as well
// as the address bar, so a route starting with a game id the same as the base path (boxhockey/loadout
// under /boxhockey, lightcycles/loadout under /lightcycles) would lose that segment and land on
// /loadout, "Unmatched Route".
export function LoadoutRoute() {
  const { game: id } = useLocalSearchParams<{ game: string }>()
  const game = usePackGame(id)
  if (!game) return <Redirect href='/' />
  return <LoadoutScreen key={game.id} game={game} />
}

export function PlayRoute() {
  const { game: id } = useLocalSearchParams<{ game: string }>()
  const game = usePackGame(id)
  if (!game) return <Redirect href='/' />
  const { PlayScreen } = game
  return <PlayScreen key={game.id} />
}
