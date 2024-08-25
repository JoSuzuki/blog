import { Fragment } from "react";
import LoginButton from "../login-button/login-button";
import LogoutButton from "../logout-button/logout-button";
import { useSessionContext } from "../session-provider/session-provider";

const SessionButtons = () => {
  const { session } = useSessionContext()

  return <Fragment>
    {session ? <LogoutButton /> : <LoginButton />}
  </Fragment>
}

export default SessionButtons;