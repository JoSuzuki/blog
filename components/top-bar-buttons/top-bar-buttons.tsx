import SessionButtons from "../session-buttons/session-buttons";
import ThemeButton from "../theme-button/theme-button";

const TopBarButtons = () => {
  return <div className="navigation-container">
    <SessionButtons />
    <ThemeButton />
    <style jsx>{`
        .navigation-container {
          display: flex;
          align-items: center;
          column-gap: var(--spaces-md);
        }
      `}</style>
  </div>
}

export default TopBarButtons;