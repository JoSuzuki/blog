import Article from '~/components/article/article'
import CommonLink from '~/components/common-link/common-link'
import Navbar from '~/components/navbar/navbar'

/**
 * The 404 page: the router's not-found component, so it renders (with a 404
 * status) for any unknown path, `/404` included. The secret post's redirect
 * script sends readers to `/404`, where a long press on the theme button turns
 * the reveal flag on and takes them back (see ThemeButton).
 */
const NotFound = () => {
  return (
    <>
      <Navbar animatedName links={false} />
      <Article>
        <div className="mx-auto flex flex-col items-center justify-center">
          <h1>404</h1>
          <h1>Vish parece que está página não existe</h1>
          PS: talvez exista um easter egg escondido nessas páginas 😉
          <CommonLink href="/">Voltar para home</CommonLink>
        </div>
      </Article>
    </>
  )
}

export default NotFound
