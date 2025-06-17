import styles from './FilesTree.module.css';
export const TreeGroup = ({ children }) => {
  return <div className={styles.group}>{children}</div>;
};
