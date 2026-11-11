import { ProfilesRoute } from '@tastic/shell'
import type { GenerateMetadataFunction } from 'expo-router/server'

import { PageTitle, screenMetadata, screenTitle } from '@/seo'

// Kept out of search results (src/seo.tsx)
export const generateMetadata: GenerateMetadataFunction = () => screenMetadata('Profiles', '/profiles')

export default function Profiles() {
  return (
    <>
      <PageTitle title={screenTitle('Profiles')} />
      <ProfilesRoute />
    </>
  )
}
