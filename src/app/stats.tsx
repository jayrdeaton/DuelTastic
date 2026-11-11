import { StatsScreen } from '@tastic/shell'
import type { GenerateMetadataFunction } from 'expo-router/server'

import { PageTitle, screenMetadata, screenTitle } from '@/seo'

// Kept out of search results (src/seo.tsx)
export const generateMetadata: GenerateMetadataFunction = () => screenMetadata('Stats', '/stats')

export default function Stats() {
  return (
    <>
      <PageTitle title={screenTitle('Stats')} />
      <StatsScreen />
    </>
  )
}
