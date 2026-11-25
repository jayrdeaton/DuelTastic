import { EditProfileRoute } from '@tastic/shell'
import type { GenerateMetadataFunction } from 'expo-router/server'

import { PageTitle, screenMetadata, screenTitle } from '@/seo'

// Kept out of search results (src/seo.tsx). A client route: the static web export has no page per profile
export const generateMetadata: GenerateMetadataFunction = (_request, { id }) => screenMetadata('Edit Profile', `/profile/${id}`)

// One profile's Edit Profile screen is @tastic/shell's (@tastic/profile's EditProfileScreen), pushed from Profiles with the
// profile's id or 'new', and from Settings' Profile row for seat 1's profile: Name, Tag and Color, saved as it's left by
// any way back. Deleting one takes its stats, achievements and settings with it (every game's reducers answer the removal).
export default function EditProfile() {
  return (
    <>
      <PageTitle title={screenTitle('Edit Profile')} />
      <EditProfileRoute />
    </>
  )
}
