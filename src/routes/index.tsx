import { createFileRoute } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Button from '~/components/button/button'
import CommonLink from '~/components/common-link/common-link'
import Input from '~/components/input/input'
import TextArea from '~/components/text-area/text-area'
import ThemeButton from '~/components/theme-button/theme-button'

// Placeholder that exercises the shell and the leaf components until the real
// home page is ported.
export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Home | JoSuzuki' }] }),
  component: Home,
})

function Home() {
  return (
    <>
      <nav className="mx-auto flex max-w-container items-center justify-between py-md">
        <h1 className="text-lg">Jonathan Suzuki</h1>
        <ThemeButton />
      </nav>
      <Article>
        <p className="my-md">
          Hey, I'm Jonathan Suzuki a software engineer at{' '}
          <span className="font-grotesk font-bold">qulture.rocks</span>! I enjoy
          playing smash bros and making cool things with code. The{' '}
          <CommonLink href="/">posts</CommonLink> are on their way to{' '}
          <CommonLink href="https://tanstack.com/start">
            TanStack Start
          </CommonLink>
          .
        </p>
        <hr className="mt-xl mb-lg border-accent" />
        <h2 className="mt-lg mb-md">Posts recentes</h2>
        <form onSubmit={(event) => event.preventDefault()}>
          <Input name="name" label="Nome" />
          <TextArea name="comment" label="Comentário" />
          <div className="mt-sm flex justify-end">
            <Button type="submit">Comentar</Button>
          </div>
        </form>
      </Article>
    </>
  )
}
