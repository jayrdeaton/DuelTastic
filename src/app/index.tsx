import { HomeScreen } from '@tastic/shell'
import type { GenerateMetadataFunction } from 'expo-router/server'

import { HOME_TITLE, homeMetadata, PageTitle } from '@/seo'

// The web page's title, description and link preview (src/seo.tsx)
export const generateMetadata: GenerateMetadataFunction = homeMetadata

export default function Home() {
  return (
    <>
      <PageTitle title={HOME_TITLE} />
      <HomeScreen />
    </>
  )
}
