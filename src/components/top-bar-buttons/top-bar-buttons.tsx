import ThemeButton from '~/components/theme-button/theme-button'

const TopBarButtons = () => {
  return (
    <div className="flex items-center gap-x-md">
      {/*
        Step 7 (auth) mounts the session buttons here, before the theme
        button: <SessionButtons /> renders the Login button, or the logout
        greeting when there is a session (legacy
        components/session-buttons/session-buttons.tsx).
      */}
      <ThemeButton />
    </div>
  )
}

export default TopBarButtons
