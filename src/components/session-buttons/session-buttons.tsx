import LoginButton from '~/components/login-button/login-button'
import LogoutButton from '~/components/logout-button/logout-button'
import { useSession } from '~/lib/auth/use-session'

const SessionButtons = () => {
  const { user } = useSession()
  return user ? <LogoutButton /> : <LoginButton />
}

export default SessionButtons
