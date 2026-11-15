const upstream = require('./electron-builder.config.cjs')

// Give this fork its own profile, Dock entry, and update lifecycle.
module.exports = {
  ...upstream,
  appId: 'local.orcrant.orca',
  productName: 'Orca Local',
  protocols: [],
  mac: {
    ...upstream.mac,
    extendInfo: {
      ...upstream.mac.extendInfo,
      CFBundleDisplayName: 'Orca',
      CFBundleName: 'Orca Local',
      CFBundleExecutable: 'Orca'
    },
    extraResources: upstream.mac.extraResources.filter(
      (resource) => !resource.to?.startsWith('orcad-template')
    )
  },
  extraMetadata: {
    ...upstream.extraMetadata,
    name: 'orca-local',
    productName: 'Orca Local',
    orcaManualUpdates: true
  },
  directories: { ...upstream.directories, output: 'dist/orca-local' },
  publish: null
}
