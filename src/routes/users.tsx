import { createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { ROLES } from '~/lib/auth/roles'
import type { Role } from '~/lib/auth/roles'
import { getUsers } from '~/lib/users/get-users'
import type { GetUsersResult, UserSummary } from '~/lib/users/get-users'
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
      {error && (
        <p role="alert" className="my-sm text-accent" data-testid="users-error">
          {error}
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full table-auto text-left text-sm">
          <thead>
            <tr>
              <th className="pr-md">Nome</th>
              <th className="pr-md">Email</th>
              <th className="pr-md">Papel</th>
              <th>Desde</th>
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
                  <td>{user.createdAt.slice(0, 10)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
