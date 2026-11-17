const { createHash } = require('node:crypto')
const { getConfig } = require('expo/config')
const { getDefaultConfig } = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

// On the web, Expo writes this app's config (name, version, scheme and the rest) into expo-constants as it bundles, which is what
// Constants.expoConfig reads, the web tab title included. Metro's cache key leaves that config out, and every app on this Mac
// shares one cache folder ($TMPDIR/metro-cache), so an app on the same package versions as another could be served the other
// app's config. Keying the cache on this app's own config keeps the apps apart, and refreshes it when the config changes.
// Drop this once Expo puts the app config in its own cache key.
const { exp } = getConfig(__dirname, { isPublicConfig: true, skipSDKVersionRequirement: true })
config.cacheVersion = createHash('sha1').update(JSON.stringify(exp)).digest('hex')

module.exports = config
