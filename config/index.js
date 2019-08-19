module.exports = {
  pathPrefix: '/', // Prefix for all links. If you deploy your site to example.com/portfolio your pathPrefix should be "portfolio"

  siteTitle: 'Eu, reflexivo', // Navigation and Site Title
  siteTitleAlt: 'Eu, reflexivo - JoSuzuki', // Alternative Site title for SEO
  siteTitleManifest: 'EuReflexivo',
  siteUrl: 'https://josuzuki.netlify.com', // Domain of your site. No trailing slash!
  siteLanguage: 'pt', // Language Tag on <html> element
  siteHeadline: 'Escrevendo, aprendendo e refletindo', // Headline for schema.org JSONLD
  siteBanner: '/social/social.png', // Your image for og:image tag. You can find it in the /static folder
  favicon: 'src/favicon.png', // Your image for favicons. You can find it in the /src folder
  siteDescription: 'Um blog, o de sempre.', // Your site description
  author: 'JoSuzuki', // Author for schemaORGJSONLD
  siteLogo: '/social/logo.png', // Image for schemaORGJSONLD

  // siteFBAppID: '123456789', // Facebook App ID - Optional
  userTwitter: '@JoSuzuki', // Twitter Username - Optional
  // ogSiteName: 'minimal', // Facebook Site Name - Optional
  ogLanguage: 'pt_BR', // Facebook Language
  googleAnalyticsID: 'UA-47519312-6',

  // Manifest and Progress color
  // See: https://developers.google.com/web/fundamentals/web-app-manifest/
  themeColor: '#3498DB',
  backgroundColor: '#2b2e3c',
}
