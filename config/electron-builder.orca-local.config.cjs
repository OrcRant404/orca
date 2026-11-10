const upstream = require('./electron-builder.config.cjs')

// Give this fork its own profile, Dock entry, and update lifecycle.
module.exports = {
  ...upstream,
  appId: 'local.orcrant.orca',
  productName: 'Orca Local',
  protocols: [],
  extraMetadata: { ...upstream.extraMetadata, name: 'orca-local', productName: 'Orca Local' },
  directories: { ...upstream.directories, output: 'dist/orca-local' },
  publish: null
}
