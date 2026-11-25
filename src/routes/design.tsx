import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import Badge from '~/components/badge/badge'
import Button, { choiceClass } from '~/components/button/button'
import type { ButtonTone } from '~/components/button/button'
import CommonLink from '~/components/common-link/common-link'
import Footer from '~/components/footer/footer'
import Input from '~/components/input/input'
import Navbar from '~/components/navbar/navbar'
import { TabLinks } from '~/components/navigation-links/navigation-links'
import { ErrorMessage, StatusBanner } from '~/components/notice/notice'
import Redacted from '~/components/redacted/redacted'
import { TagName } from '~/components/tags/tags'
import { SITE_THEMES } from '~/lib/site-theme'
import type { SiteTheme } from '~/lib/site-theme'

// The design system's reference page: every token and component, drawn by
// the real components in the three themes. Not linked from the navigation.
// DESIGN.md says when to use what.

export const Route = createFileRoute('/design')({
  head: () => ({
    meta: [
      { title: 'Design | JoSuzuki' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Design,
})

const THEME_NAMES: Record<SiteTheme, string> = {
  light: 'Light ☀️',
  dark: 'Dark 🌙',
  secret: 'Secret 🌚',
}

const THEME_COLORS = [
  ['background', 'Page'],
  ['text', 'Body text'],
  ['accent', 'Controls, links in UI, borders'],
  ['accent-background', 'Tinted surfaces'],
  ['secondary', 'Links in prose, list marks'],
  ['dimmed', 'Quiet details'],
  ['inline-code', 'Inline code'],
] as const

const GAME_COLORS = [
  ['team-blue', 'Azul'],
  ['team-red', 'Vermelho, live'],
  ['success', 'Right answer, go'],
] as const

const TONES: ButtonTone[] = [
  'accent',
  'success',
  'danger',
  'team-blue',
  'team-red',
]

const Section = ({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) => (
  <section id={id} className="mb-xl">
    <h2 className="mb-md">{title}</h2>
    {children}
  </section>
)

/** The three themes side by side, each drawing `children`. */
const InThemes = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-md tablet:grid-cols-3">
    {SITE_THEMES.map((theme) => (
      <div
        key={theme}
        data-theme={theme}
        className="min-w-0 border border-accent bg-background p-md text-text"
      >
        <p className="mb-sm text-xs text-accent wght-semibold">
          {THEME_NAMES[theme]}
        </p>
        {children}
      </div>
    ))}
  </div>
)

const Swatch = ({ token, role }: { token: string; role: string }) => (
  <li className="flex items-center gap-sm">
    <span
      className="size-lg shrink-0 border border-text/30"
      style={{ background: `var(--colors-${token})` }}
    />
    <span className="min-w-0 text-xs leading-tight">
      <code className="block wght-semibold">{token}</code>
      <span className="text-text/70">{role}</span>
    </span>
  </li>
)

const Name = ({ children }: { children: ReactNode }) => (
  <code className="text-xs text-accent">{children}</code>
)

const Example = ({ name, children }: { name: string; children: ReactNode }) => (
  <div className="mb-md">
    <p className="mb-xs">
      <Name>{name}</Name>
    </p>
    <div className="flex flex-wrap items-center gap-sm">{children}</div>
  </div>
)

function Design() {
  const [rounds, setRounds] = useState(2)
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-[72rem] pb-xl">
        <h1>Design system</h1>
        <p className="mb-md max-w-container">
          The tokens and components of the blog and its games, drawn by the real
          components. When to use what is in <code>DESIGN.md</code>; the tokens
          are in <code>src/app.css</code>.
        </p>
        <ul className="mb-lg flex flex-wrap gap-x-md text-sm">
          {[
            ['principles', 'Principles'],
            ['color', 'Color'],
            ['type', 'Type'],
            ['space', 'Space and lines'],
            ['buttons', 'Buttons'],
            ['controls', 'Other controls'],
            ['feedback', 'Labels and messages'],
            ['games', 'Games'],
          ].map(([id, title]) => (
            <li key={id}>
              <a className="text-secondary underline" href={`#${id}`}>
                {title}
              </a>
            </li>
          ))}
        </ul>

        <Section id="principles" title="Principles">
          <ol className="max-w-container list-decimal pl-lg">
            <li>
              <strong>Square.</strong> No rounded corners on the site&apos;s own
              UI. Lines are 1px for controls and frames, 2px for panels that
              group things.
            </li>
            <li>
              <strong>The offset shadow means “click me”.</strong> Everything
              clickable has it (it lifts on hover and flattens when pressed),
              nothing else does.
            </li>
            <li>
              <strong>Outlined.</strong> Buttons are outlined in their color.
              Only the one main action of a screen may be filled, and only with
              the accent.
            </li>
            <li>
              <strong>Tokens only.</strong> Colors, sizes and spaces come from
              the tokens, so the three themes keep working. Game colors are the
              same in every theme.
            </li>
            <li>
              <strong>Phone first.</strong> Most players are on a phone: main
              game actions sit in a bar at the bottom of the screen, big and
              side by side.
            </li>
          </ol>
        </Section>

        <Section id="color" title="Color">
          <p className="mb-sm max-w-container">
            Theme colors change with the theme button. Use them through their
            Tailwind names: <Name>text-accent</Name>,{' '}
            <Name>bg-accent-background</Name>, <Name>border-accent</Name>.
          </p>
          <InThemes>
            <ul className="flex flex-col gap-sm">
              {THEME_COLORS.map(([token, role]) => (
                <Swatch key={token} token={token} role={role} />
              ))}
            </ul>
          </InThemes>
          <p className="mt-lg mb-sm max-w-container">
            Game colors are the same in every theme. Each has a{' '}
            <Name>-dark</Name> shade (pressed states, gradients) and an{' '}
            <Name>-ink</Name> alias for text and outlines, which is the dark
            shade on the light theme so it stays readable.
          </p>
          <InThemes>
            <ul className="flex flex-col gap-sm">
              {GAME_COLORS.map(([token, role]) => (
                <Swatch key={token} token={token} role={role} />
              ))}
              {GAME_COLORS.map(([token]) => (
                <Swatch
                  key={`${token}-ink`}
                  token={`${token}-ink`}
                  role="Text and outlines"
                />
              ))}
            </ul>
          </InThemes>
        </Section>

        <Section id="type" title="Type">
          <div className="grid gap-lg tablet:grid-cols-2">
            <div>
              <p className="mb-sm text-xs text-accent">
                Inter (variable), body weight 450
              </p>
              <ul className="flex flex-col gap-sm">
                <li className="text-lg leading-tight wght-bold">
                  text-lg · 2.25rem
                </li>
                <li className="text-md">text-md · 1.25rem, body</li>
                <li className="text-sm">text-sm · 1.125rem, secondary</li>
                <li className="text-xs">text-xs · 1rem, captions and labels</li>
              </ul>
              <p className="mt-md mb-sm text-xs text-accent">Weights</p>
              <p>
                Regular 450 ·{' '}
                <span className="wght-semibold">wght-semibold</span> ·{' '}
                <span className="wght-bold">wght-bold</span>
              </p>
              <p className="mt-xs text-xs">
                The weight is an axis of the variable font:{' '}
                <Name>font-bold</Name> does nothing, use the <Name>wght-*</Name>{' '}
                utilities.
              </p>
            </div>
            <div>
              <h1 className="leading-tight">Heading 1</h1>
              <h2>Heading 2</h2>
              <h3>Heading 3</h3>
              <p className="mt-sm">
                A paragraph with a{' '}
                <CommonLink href="/design">CommonLink</CommonLink> and a{' '}
                <Redacted redacted="segredo">Redacted</Redacted> word in Space
                Grotesk.
              </p>
              <p className="mt-sm font-mono text-sm">font-mono for code</p>
            </div>
          </div>
        </Section>

        <Section id="space" title="Space and lines">
          <div className="grid gap-lg tablet:grid-cols-2">
            <ul className="flex flex-col gap-xs">
              {[
                ['xs', '4px'],
                ['sm', '8px'],
                ['md', '16px'],
                ['lg', '32px'],
                ['xl', '48px'],
              ].map(([name, value]) => (
                <li key={name} className="flex items-center gap-sm text-xs">
                  <code className="w-xl">{name}</code>
                  <span
                    className="h-sm bg-accent"
                    style={{ width: `var(--spaces-${name})` }}
                  />
                  <span className="text-text/70">{value}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-md text-sm">
              <div className="border border-accent p-sm">
                <Name>border</Name> 1px: controls, frames around a board or an
                image
              </div>
              <div className="border-2 border-accent p-sm">
                <Name>border-2</Name> 2px: a panel that groups things (a team, a
                settings form)
              </div>
              <div className="pressable border border-accent p-sm">
                <Name>pressable</Name>: only on things you can click
              </div>
            </div>
          </div>
          <p className="mt-md text-xs">
            Breakpoints: <Name>mobile:</Name> 480px, <Name>tablet:</Name> 768px.
            Write for the phone first and add <Name>tablet:</Name> for more
            room. Text column: <Name>max-w-container</Name> (65ch).
          </p>
        </Section>

        <Section id="buttons" title="Buttons">
          <InThemes>
            <Example name="tone (outline)">
              {TONES.map((tone) => (
                <Button key={tone} tone={tone} size="sm">
                  {tone}
                </Button>
              ))}
            </Example>
            <Example name='variant="solid"'>
              <Button variant="solid" size="sm">
                Entrar na sala
              </Button>
            </Example>
            <Example name="disabled">
              <Button size="sm" disabled>
                Disabled
              </Button>
              <Button size="sm" tone="success" disabled>
                Começar
              </Button>
            </Example>
          </InThemes>
          <div className="mt-lg">
            <Example name='size="xs" · "compact" · "sm" · "md" · "lg" · "icon"'>
              <Button size="xs" title="Mudar de time">
                ⇄
              </Button>
              <Button size="compact">Login</Button>
              <Button size="sm">Copiar link</Button>
              <Button>Criar sala</Button>
              <Button size="lg" tone="success" hint="Espaço">
                Acertou
              </Button>
              <Button size="icon" aria-label="Som">
                🔊
              </Button>
            </Example>
            <Example name='size="lg" wide (phone action bar)'>
              <div className="flex w-full max-w-[24rem] gap-sm">
                <Button size="lg" wide tone="danger">
                  Tabu!
                </Button>
                <Button size="lg" wide tone="success">
                  Acertou
                </Button>
              </div>
            </Example>
          </div>
        </Section>

        <Section id="controls" title="Other controls">
          <div className="grid gap-lg tablet:grid-cols-2">
            <div>
              <Example name="choiceClass(chosen)">
                <div role="radiogroup" className="flex flex-wrap gap-xs">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={n === rounds}
                      onClick={() => setRounds(n)}
                      className={`min-w-xl text-sm ${choiceClass(n === rounds)}`}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
              </Example>
              <Example name="TabLinks">
                <TabLinks
                  label="Example"
                  links={[
                    { to: '/design', title: 'Salas', exact: true },
                    { to: '/games', title: 'Partidas', exact: false },
                  ]}
                />
              </Example>
              <Example name="Tag · TagName">
                <span className="pressable border border-accent bg-accent-background px-xs leading-[1.2] text-accent">
                  reflexões
                </span>
                <TagName tag="reflexões" />
              </Example>
            </div>
            <div>
              <Input name="design-name" label="Input" defaultValue="Jonathan" />
              <p className="text-xs">
                Fields: a 1px accent outline on a transparent background, the
                label above.
              </p>
            </div>
          </div>
        </Section>

        <Section id="feedback" title="Labels and messages">
          <InThemes>
            <Example name="Badge">
              <Badge tone="live">AO VIVO</Badge>
              <Badge>3 jogadores</Badge>
              <Badge tone="success">+1</Badge>
              <Badge tone="team-blue">Azul</Badge>
              <Badge tone="team-red">−1</Badge>
            </Example>
            <Example name="StatusBanner">
              <StatusBanner busy>Reconectando…</StatusBanner>
            </Example>
            <Example name="ErrorMessage">
              <ErrorMessage message="Não foi possível entrar na sala." />
            </Example>
          </InThemes>
        </Section>

        <Section id="games" title="Games">
          <p className="mb-md max-w-container">
            A team is a 2px panel in its color with a filled header. The score
            of a team is outlined, not shadowed: it is not a button. The team on
            turn is at full strength, the other one at 60%.
          </p>
          <InThemes>
            <div className="grid grid-cols-2 gap-sm">
              {(
                [
                  ['team-blue', 'Azul', 'border-team-blue', 'bg-team-blue'],
                  ['team-red', 'Vermelho', 'border-team-red', 'bg-team-red'],
                ] as const
              ).map(([tone, name, border, bg]) => (
                <section key={tone} className={`border-2 p-sm ${border}`}>
                  <h3
                    className={`-mx-sm -mt-sm mb-sm flex justify-between px-sm py-xs text-md text-white wght-bold ${bg}`}
                  >
                    {name} <span className="text-sm">2</span>
                  </h3>
                  <ul className="flex flex-col gap-xs text-sm">
                    <li className="flex items-center gap-xs">
                      <span className="inline-block size-sm border border-success-dark bg-success" />
                      Ana
                    </li>
                    <li className="flex items-center gap-xs">
                      <span className="inline-block size-sm border border-accent" />
                      Bruno
                    </li>
                  </ul>
                </section>
              ))}
            </div>
            <div className="mt-sm grid grid-cols-2 gap-sm">
              <div className="border border-team-blue-ink px-sm py-xs text-team-blue-ink">
                <span className="text-lg leading-none wght-bold">7</span>{' '}
                <span className="text-xs">Azul</span>
              </div>
              <div className="border border-team-red-ink px-sm py-xs text-right text-team-red-ink opacity-60">
                <span className="text-xs">Vermelho</span>{' '}
                <span className="text-lg leading-none wght-bold">4</span>
              </div>
            </div>
          </InThemes>
          <p className="mt-md max-w-container text-sm">
            The 3D scenes (the Santorini board, the Tabu table) cannot read CSS:
            they follow the theme with <Name>useSiteTheme()</Name> and read
            tokens with <Name>readColorToken()</Name> from{' '}
            <Name>src/lib/site-theme.ts</Name>. A scene may keep a palette of
            its own per theme (the board&apos;s Vector Terminal look), but its
            player colors stay the team colors.
          </p>
        </Section>

        <Footer />
      </main>
    </>
  )
}
