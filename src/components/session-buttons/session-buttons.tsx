import LoginButton from '~/components/login-button/login-button'
import LogoutButton from '~/components/logout-button/logout-button'
import { useSessionContext } from '~/components/session-provider/session-provider'

const SessionButtons = () => {
  const { session } = useSessionContext()
  return session ? <LogoutButton /> : <LoginButton />
}

export default SessionButtons
