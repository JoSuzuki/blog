import Link from 'next/link'
import Article from '../components/article/article'
import CommonLink from '../components/common-link/common-link'
import HomeNavbar from '../components/home/home-navbar'

export default function Custom404() {
  return (
    <>
      <HomeNavbar />
      <Article>
        <div className="container">
          <h1>404</h1>
          <h1>Vish parece que está página não existe</h1>
          Manda uma msg pra mim caso vc queira descobrir o tema secreto
          <CommonLink href="/">Voltar para home</CommonLink>
        </div>
      </Article>
      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          margin-right: auto;
        }
      `}</style>
    </>
  )
}
