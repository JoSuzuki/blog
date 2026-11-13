import SessionButtons from '~/components/session-buttons/session-buttons'
import ThemeButton from '~/components/theme-button/theme-button'

const TopBarButtons = () => {
  return (
    <div className="flex items-center gap-x-md">
      <SessionButtons />
      <ThemeButton />
    </div>
  )
}

export default TopBarButtons
