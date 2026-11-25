/**
 * Declares hardware features Google Play would otherwise read as required as not required.
 *
 * Play infers required features from the manifest, and a device without one can't install the app (Play Console's
 * "Required hardware feature declarations are restricting your app's availability"):
 * - android.hardware.screen.portrait, from the android:screenOrientation="portrait" app.json's "orientation" puts on the
 *   main activity. The activity still asks for portrait.
 *
 * Declaring a feature with android:required="false" stops Play from inferring it.
 */
const { withAndroidManifest } = require('expo/config-plugins')

const OPTIONAL_FEATURES = ['android.hardware.screen.portrait']

module.exports = function withOptionalFeatures(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest
    const features = manifest['uses-feature'] ?? []
    for (const name of OPTIONAL_FEATURES) {
      const declared = features.find((feature) => feature.$['android:name'] === name)
      if (declared) declared.$['android:required'] = 'false'
      else features.push({ $: { 'android:name': name, 'android:required': 'false' } })
    }
    manifest['uses-feature'] = features
    return mod
  })
}
