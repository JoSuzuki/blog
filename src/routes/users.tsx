import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import Article from '~/components/article/article'
import Button from '~/components/button/button'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { ErrorMessage } from '~/components/notice/notice'
import { ROLES } from '~/lib/auth/roles'
import type { Role } from '~/lib/auth/roles'
import { getUsers } from '~/lib/users/get-users'
import type { GetUsersResult, UserSummary } from '~/lib/users/get-users'
import { deleteUser } from '~/lib/users/delete-user'
import { setUserRole } from '~/lib/users/set-user-role'
import { useReload } from '~/lib/use-reload'

export const Route = createFileRoute('/users')({
  loader: async () => {
    const result = await getUsers().catch((): GetUsersResult => ({
      ok: false,
      reason: 'unavailable',
    }))
    // To anyone but an admin this page does not exist.
    if (!result.ok && result.reason !== 'unavailable') throw notFound()
    return result
  },
  head: () => ({
    meta: [
      { title: 'Users | JoSuzuki' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: UsersPage,
})

function UsersPage() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <h1>Users</h1>
        {result.ok ? (
          <Users users={result.users} currentUserId={result.currentUserId} />
        ) : (
          <p data-testid="users-unavailable">
            Não foi possível carregar os usuários agora.
          </p>
        )}
        <Footer />
      </Article>
    </>
  )
}

interface UsersProps {
  users: UserSummary[]
  currentUserId: number
}

function Users({ users, currentUserId }: UsersProps) {
  const reload = useReload('/users')
  // The row whose change is in flight; one at a time.
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The row whose Apagar was pressed once and now asks to confirm.
  const [confirmingId, setConfirmingId] = useState<number | null>(null)

  const handleDelete = async (userId: number) => {
    setPendingId(userId)
    setError(null)
    try {
      const result = await deleteUser({ data: { userId } })
      if (!result.ok) setError(result.message)
    } catch {
      setError('Não foi possível falar com o servidor. Tente de novo.')
    } finally {
      await reload()
      setConfirmingId(null)
      setPendingId(null)
    }
  }

  const handleChange = async (userId: number, role: Role) => {
    setPendingId(userId)
    setError(null)
    try {
      const result = await setUserRole({ data: { userId, role } })
      if (!result.ok) setError(result.message)
    } catch {
      setError('Não foi possível falar com o servidor. Tente de novo.')
    } finally {
      // Also after a refusal: the list then shows what is really stored.
      await reload()
      setPendingId(null)
    }
  }

  return (
    <div data-testid="users">
      <p className="mb-sm text-sm">
        Apagar uma conta remove também as partidas de Santorini e Tabu que ela
        criou ou jogou, inclusive do histórico dos outros jogadores. Os
        comentários ficam. A pessoa pode criar uma conta nova depois.
      </p>
      <ErrorMessage message={error} testId="users-error" />
      <div className="overflow-auto">
        <table className="w-full table-auto text-left text-sm">
          <thead>
            <tr>
              <th className="pr-md">Nome</th>
              <th className="pr-md">Apelido</th>
              <th className="pr-md">Email</th>
              <th className="pr-md">Papel</th>
              <th className="pr-md">Desde</th>
              <th>
                <span className="sr-only">Apagar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const self = user.id === currentUserId
              return (
                <tr key={user.id} data-testid={`user-${user.id}`}>
                  <td className="pr-md">
                    {user.name}
                    {self && ' (você)'}
                  </td>
                  <td className="pr-md">{user.nickname ?? '—'}</td>
                  <td className="pr-md">{user.email}</td>
                  <td className="pr-md">
                    {/* The loader's value, not local state: after a change
                        the list is reloaded and shows what was stored. */}
                    <select
                      aria-label={`Papel de ${user.name}`}
                      value={user.role}
                      // An admin cannot change their own role (the server
                      // refuses it too), so the site always has one.
                      disabled={self || pendingId !== null}
                      onChange={(event) =>
                        void handleChange(user.id, event.target.value as Role)
                      }
                      className="border border-accent bg-background text-text"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pr-md">{user.createdAt.slice(0, 10)}</td>
                  <td className="py-xs whitespace-nowrap">
                    {/* Not your own row, nor another admin's (the server
                        refuses both): demote an admin first. */}
                    {!self &&
                      user.role !== 'ADMIN' &&
                      (confirmingId === user.id ? (
                        <span className="flex gap-xs">
                          <Button
                            tone="danger"
                            size="xs"
                            disabled={pendingId !== null}
                            onClick={() => void handleDelete(user.id)}
                            aria-label={`Confirmar: apagar a conta de ${user.name}`}
                          >
                            Apagar mesmo
                          </Button>
                          <Button
                            size="xs"
                            disabled={pendingId !== null}
                            onClick={() => setConfirmingId(null)}
                          >
                            Cancelar
                          </Button>
                        </span>
                      ) : (
                        <Button
                          tone="danger"
                          size="xs"
                          disabled={pendingId !== null}
                          onClick={() => setConfirmingId(user.id)}
                          aria-label={`Apagar a conta de ${user.name}`}
                        >
                          Apagar
                        </Button>
                      ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
