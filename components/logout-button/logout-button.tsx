import Redacted from '../redacted/redacted'
import { useSessionContext } from '../session-provider/session-provider'

const LogoutButton = () => {
  const { session } = useSessionContext()

  return (
    <div>
      Hey, <Redacted revealOverwrite={true} redacted="Não tem nada de especial que dá pra fazer logado ainda :)">{`${session?.firstName}`}</Redacted>!
    </div >
  )
}

export default LogoutButton
