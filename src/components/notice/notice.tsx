import type { ReactNode } from 'react'

// Messages about the page itself rather than its content.

/**
 * What went wrong with the last action, in the accent color, announced to
 * screen readers. Renders nothing without a message.
 */
export const ErrorMessage = ({
  message,
  testId,
}: {
  message: string | null
  testId?: string
}) =>
  message ? (
    <p role="alert" className="my-sm text-accent" data-testid={testId}>
      {message}
    </p>
  ) : null

/**
 * A status line in a tinted box: something the reader should know but need
 * not act on (the connection dropped and is coming back). `busy` adds a
 * spinning square.
 */
export const StatusBanner = ({
  children,
  busy = false,
  testId,
}: {
  children: ReactNode
  busy?: boolean
  testId?: string
}) => (
  <div
    role="status"
    className="mb-sm flex items-center gap-sm border border-accent bg-accent-background px-sm py-xs text-sm"
    data-testid={testId}
  >
    {busy && (
      <span className="inline-block size-sm shrink-0 animate-spin bg-accent" />
    )}
    <span>{children}</span>
  </div>
)
