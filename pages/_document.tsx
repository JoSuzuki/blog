import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
} from 'next/document'

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    const meta = {
      title: 'JoSuzuki',
      description:
        'Software engineer, smash bros player. Currently doing cool things with code.',
    }

    return (
      <Html lang="pt">
        <Head>
          <meta name="robots" content="follow, index" />
          <meta name="description" content={meta.description} />
          <meta property="og:site_name" content={meta.title} />
          <meta property="og:description" content={meta.description} />
          <meta property="og:title" content={meta.title} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@jo_suzuki" />
          <meta name="twitter:title" content={meta.title} />
          <meta name="twitter:description" content={meta.description} />
          <script
            dangerouslySetInnerHTML={{
              __html: `
            (function(){
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme && savedTheme !== 'null') {
        document.documentElement.setAttribute('data-theme', savedTheme)
      } else if (window.matchMedia) {
        const osTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
        document.documentElement.setAttribute('data-theme', osTheme)
        localStorage.setItem('theme', osTheme)
      } else {
        document.documentElement.setAttribute('data-theme', 'dark')
        localStorage.setItem('theme', 'dark')
      }
    })()`,
            }}
          ></script>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
