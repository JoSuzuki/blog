const withNextra = require('nextra')('./nextra-theme/theme.tsx')
module.exports = withNextra({
  webpack: (config, { dev, isServer }) => {
    if (!dev && isServer) {
      const originalEntry = config.entry

      config.entry = async () => {
        const entries = { ...(await originalEntry()) }

        // These scripts can import components from the app and use ES modules
        entries['./scripts/gen-rss.js'] = './scripts/gen-rss.js'

        return entries
      }
    }

    return config
  },
})