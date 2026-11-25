# Design system

How the blog and its games look, and the pieces to build them with. The tokens live in
`src/app.css`; every token and component is drawn, in the three themes side by side, on the
reference page at **`/design`** (not linked from the navigation). Read this before adding a page or
a game screen, and keep both up to date when something new becomes shared.

## Principles

1. **Square.** The site's own UI has no rounded corners. Lines are 1px for controls and frames and
   2px for panels that group things. (Two exceptions draw a physical object: the Tabu card, which
   keeps a paper card's corners, and the bullets and inline code inside a post.)
2. **The offset shadow means "click me".** Everything clickable has the `pressable` shadow, which
   lifts on hover and flattens when pressed. Nothing that is not clickable has it: a score, a badge,
   a heading. (The code blocks in posts keep their decorative shadow.)
3. **Outlined.** Buttons are outlined in their color on the page background. The game colors are
   always outlines. Only the one main action of a screen may be filled (`variant="solid"`), and only
   with the accent. A chosen option in a group is filled too (see choices below).
4. **Tokens only.** Colors, font sizes and spaces come from the tokens, never hex values or
   Tailwind's own scale (it is removed, so `text-lg` or `p-md` always means the blog's token). This is
   what keeps the light, dark and secret themes working.
5. **Phone first.** Most players are on a phone. Write the phone layout first and add `tablet:` for
   more room. A game's main actions sit in a bar fixed to the bottom of the screen, big and side by
   side (`ActionBar` with `wide` buttons in Tabu).

## Tokens

Declared as custom properties in `@layer base` and named for Tailwind in `@theme inline`, so
`var(--colors-accent)` is `text-accent`, `bg-accent`, `border-accent`.

### Theme colors

They change with the theme button (`data-theme` on `<html>`). The theme selectors work on any
element, so a part of a page can show another theme (give it `bg-background text-text` too).

| Token               | Use                                             | Light     | Dark      | Secret    |
| ------------------- | ----------------------------------------------- | --------- | --------- | --------- |
| `background`        | The page, and the fill of outlined buttons      | `#e9f1f7` | `#170440` | `#140005` |
| `text`              | Body text                                       | black     | white     | `#fff7ee` |
| `accent`            | Controls, borders, UI links, errors, active tab | `#432a79` | `#7670db` | `#ec0f2d` |
| `accent-background` | Tinted surfaces: tags, banners, the game table  | `#ebe2ff` | `#150044` | `#300300` |
| `secondary`         | Links in prose (`CommonLink`), list marks       | `#b0500a` | `#ffab5e` | `#ff3164` |
| `dimmed`            | Quiet details (the dot between comment fields)  | `#bbd1e2` | `#522ba9` | `#ce202e` |
| `inline-code`       | Inline code in posts                            | `#cae8ff` | `#4842b3` | `#a11010` |

Fixed: `white`, `black`, `selection` (`#3297fd`), `purple` and `purple-background` (the light
accent pair, used by the Tabu card back).

### Game colors

The same in every theme: `team-blue` (`#3d6bff`, Azul), `team-red` (`#ff5257`, Vermelho, and
anything live), `success` (`#1fa971`, a right answer, a go button). Each has:

- `-dark`: a deeper shade for pressed states, gradients and the 3D scenes on light backgrounds.
- `-ink`: the color for **text and outlines**. It is the color itself on dark and secret, and the
  dark shade on light so it stays readable. Outlined game buttons, badges and scores use `-ink`;
  fills (a team's header) use the plain color with white text.

Text on the page uses `text` or `accent`. Translucency is allowed for de-emphasis (`text-text/70`,
`opacity-60` on the team not playing), not for new colors.

### Type

Inter (variable), body weight 450 at `text-md`; Space Grotesk only for `Redacted` and similar
"hidden text" effects; the mono stack for code.

| Token     | Size     | Use                                     |
| --------- | -------- | --------------------------------------- |
| `text-lg` | 2.25rem  | The site name, a room code, a big score |
| `text-md` | 1.25rem  | Body                                    |
| `text-sm` | 1.125rem | Secondary text, lists in panels         |
| `text-xs` | 1rem     | Captions, labels, badges                |

Headings `h1`–`h6` have their own sizes in `app.css`. Weight is an axis of the variable font, so
`font-bold` does nothing: use `wght-semibold` (600) and `wght-bold` (850).

### Space, size and layout

`xs` 4px · `sm` 8px · `md` 16px · `lg` 32px · `xl` 48px, for padding, margin, gap and sizes
(`p-sm`, `gap-md`, `size-sm`). Spaces are in pixels on purpose: they keep the intended rhythm when a reader enlarges
the text, which stays in rem. New spacing is in pixels too. Breakpoints `mobile:` (480px) and `tablet:` (768px). The text column
is `max-w-container` (65ch); game pages go up to `max-w-[72rem]`.

### Lines and shadow

- `border` (1px) for controls (buttons, fields) and frames (around a board, an image).
- `border-2` for panels that group things (a team, the settings form, the room code box).
- `pressable` for the offset shadow. It is `--colors-accent` unless the element sets
  `--pressable-color` (the button tones do). It moves with `translate`, so it also works on
  absolutely positioned elements, and a disabled control has no shadow.

## Components

All in `src/components`. Use them instead of copying class strings.

### Button (`button/button.tsx`)

`<Button>` takes every `<button>` prop plus:

- `tone`: `accent` (default), `success`, `danger`, `team-blue`, `team-red`. Game colors are for
  game actions: `success` to start or mark a right answer, `danger` for "Tabu!" or a loss, a team's
  color to join it.
- `variant`: `outline` (default) or `solid`, the one main action of a screen (accent only).
- `size`: `xs` (an icon button in a list row: ⇄, ✕), `compact` (the top bar's Login and Sair), `sm`
  (a secondary action: Copiar link, Sortear times), `md` (default), `lg` (a game's main buttons),
  `icon` (a 30px square with one symbol; give it an `aria-label`).
- `wide`: on phones, share the row with the other buttons, tall and easy to hit.
- `hint`: a keyboard shortcut shown after the label from tablets up.

`buttonClass({ tone, variant, size, wide })` returns the same classes for a link or any element
that looks like a button. Disabled buttons are at 50% with no shadow.

### Choices (`choiceClass` in `button/button.tsx`)

One option of a group where one is chosen: a segmented control (Tabu's turn length), filter chips
(Santorini's Todas / Só as minhas), the quiz's answers. The chosen option is filled with the accent and
flat (clicking it does nothing); the others are outlined and pressable. Also mark the choice for
screen readers (`role="radio"` + `aria-checked`, or `aria-pressed`).

### Navigation

- `TabLinks` (`navigation-links`): a row of links with the active one underlined in the accent.
  The site's navigation and the tabs inside a page (Santorini's Salas / Partidas).
- `CommonLink`: a link in prose, `secondary` and underlined; external links open in a new tab.
- `Tag` / `TagName` (`tags`): a tag link (pressable) and the tag heading of a tag page (not).

### Fields

`Input` and `TextArea`: the label above, a 1px accent outline on a transparent background.

### Labels and messages

- `Badge` (`badge`): a short outlined label. `tone="live"` for something happening now (AO VIVO);
  also `accent`, `success`, `team-blue`, `team-red`.
- `ErrorMessage` (`notice`): what went wrong with the last action, accent text with `role="alert"`.
- `StatusBanner` (`notice`): a status in a tinted box, `busy` adds the spinning square
  (Reconectando…).
- `LoginRequired` and `Unavailable` (`game-notices`): what a game page shows instead of the game to
  a reader who is not logged in, or when the room cannot be shown. Each game wraps them with its own
  text and test ids.

## Game patterns

- **Team panel**: `border-2` in the team color, a header filled with the color (white, bold), the
  players in `text-sm` with an online square (`OnlineDot`: filled `success` when present, an empty
  accent outline when away).
- **Score**: outlined in the team's `-ink`, number in `text-lg wght-bold tabular-nums`. Not a button,
  so no shadow. The team not on turn is at `opacity-60`.
- **Action bar**: on phones a bar fixed to the bottom (safe-area aware) with `size="lg" wide`
  buttons; inline under the table from tablets up.
- **Room code**: `text-lg`, accent, bold, wide letter spacing, in a `border-2` box with a Copiar link
  button.
- **3D scenes and canvases** cannot read CSS. They follow the theme with `useSiteTheme()` and read
  colors with `readColorToken()` from `src/lib/site-theme.ts`. A scene may keep its own palette per
  theme (the Santorini board's Vector Terminal look, the Tabu table's lights), but player and team
  colors stay the game colors.
- **Motion** says what just happened and is over in well under a second: a piece falls into place,
  a worker hops, a marker pops up. Animate from `useFrame` through refs, never React state. With
  `prefers-reduced-motion: reduce` everything is drawn where it ends up and nothing spins or pulses
  (the Santorini board's `useReducedMotion` in `components/santorini/board-motion.ts`).

## Adding something

- A new color, size or space is a token in `app.css` (in every theme, if it is a theme color), named
  in `@theme inline`, and shown on `/design`.
- A pattern used in a second place becomes a component here, with its entry in this file and on
  `/design`.
