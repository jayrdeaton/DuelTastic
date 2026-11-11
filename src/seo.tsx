import { useLocalSearchParams } from 'expo-router'
import Head from 'expo-router/head'
import type { Metadata } from 'expo-router/server'
import { Platform } from 'react-native'

import { games, pack } from '@/pack'

// The web build's page titles, descriptions, canonical links and link previews (CLAUDE.md, "Search and link previews"),
// so search engines and link previews see more than an empty page. Each route exports generateMetadata(), which Expo
// Router writes into that page's exported HTML, and draws PageTitle, which keeps the page's title in the tab once the
// app has loaded (the shell's own Head would set it to the app's name). The copy here is this pack's; everything under
// it is the same in every pack on games.infinitetoken.com.

/** What the pack is, in search results and link previews: its games by name, which is what people search for */
export const PACK_DESCRIPTION = 'Four arcade duel games in one: Trap, a light-cycle duel, plus Turf, Tag and Snake. Play the CPU or a friend on one screen, free in your browser with no ads.'
/** What a game's page adds after the game's blurb */
export const GAME_DESCRIPTION = 'One of four duel games in DuelTastic: play the CPU or a friend, free in your browser with no ads.'
/** The pack's name in its home page's title */
const HOME_NAME = pack.name
/** A game's name in its page's title */
const gameName = (game: Game) => game.title

type Game = (typeof games)[number]

const SITE_NAME = 'Infinite Token Games'
const ORIGIN = 'https://games.infinitetoken.com'
/** Games-Web's link preview card, which every page there shares */
const OG_IMAGE = { url: `${ORIGIN}/images/og.png`, width: 1200, height: 630 }

/** A page's full address: the hub, the path it serves this build under (build:web's WEB_BASE_URL, which Expo inlines as
 *  EXPO_BASE_URL), then the route's own path */
export const pageUrl = (path: string) => `${ORIGIN}${process.env.EXPO_BASE_URL ?? ''}${path}`

/** Name first, like a store listing: a search result that cuts the title short keeps the game's name */
const titled = (name: string) => `${name} | ${SITE_NAME}`

function page({ title, description, path, index = true }: { title: string; description: string; path: string; index?: boolean }): Metadata {
  const url = pageUrl(path)
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', siteName: SITE_NAME, title, description, url, images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
    ...(index ? {} : { robots: 'noindex' })
  }
}

export const HOME_TITLE = titled(HOME_NAME)

/** The home page's metadata (app/index.tsx) */
export const homeMetadata = (): Metadata => page({ title: HOME_TITLE, description: PACK_DESCRIPTION, path: '/' })

/** A game's page is the one Home opens: its setup screen, or its play screen when it has nothing to set up. Its loadout
 *  and play pages both name it as their canonical, so search engines count the two as one page. */
export const gamePath = (game: Game) => (game.useLoadout ? `/loadout/${game.id}` : `/play/${game.id}`)

export const gameTitle = (game: Game) => titled(`${gameName(game)} | ${pack.name}`)

/** A game page's metadata (app/loadout/[game].tsx and app/play/[game].tsx). An id the pack doesn't have, such as the
 *  export's own [game] page, gets Home's. */
export const gameMetadata = (id: string | string[] | undefined): Metadata => {
  const game = games.find((g) => g.id === id)
  return game ? page({ title: gameTitle(game), description: `${game.blurb} ${GAME_DESCRIPTION}`, path: gamePath(game) }) : homeMetadata()
}

export const screenTitle = (name: string) => titled(`${name} | ${pack.name}`)

/** Stats and Profiles: this device's own records, kept out of search results */
export const screenMetadata = (name: string, path: string): Metadata => page({ title: screenTitle(name), description: PACK_DESCRIPTION, path, index: false })

/** The tab's title once the app has loaded, matching the page's exported title. Web only: on iOS expo-router's Head is
 *  Handoff metadata that needs an origin this app doesn't set. Drawn deeper than the shell's Head, so it wins. */
export function PageTitle({ title }: { title: string }) {
  if (Platform.OS !== 'web') return null
  return (
    <Head>
      <title>{title}</title>
    </Head>
  )
}

/** PageTitle for a game route, from its id */
export function GamePageTitle() {
  const { game: id } = useLocalSearchParams<{ game: string }>()
  const game = games.find((g) => g.id === id)
  return <PageTitle title={game ? gameTitle(game) : HOME_TITLE} />
}
