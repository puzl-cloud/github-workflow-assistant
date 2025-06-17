import styles from "./Header.module.css";

export const Header = () => {
  return (
    <header className={styles.wrapper}>
      <div>GitHub Workflow Assistant</div>
      <div className={styles.logoRow}>
        by&nbsp;
        <span className={styles.logo}>
          <Logo />
          puzl.cloud
        </span>
      </div>
    </header>
  );
};

function Logo() {
  return (
    <div className={styles.logoImg}>
      <svg viewBox="0 0 16 16">
        <g>
          <path d="M0,0v16h16V0H0z M13,7H9V3h4V7z"></path>
        </g>
      </svg>
    </div>
  );
}
