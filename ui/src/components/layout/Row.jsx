import styles from './layout.module.css';
export const Row = (props) => (
  <div {...props} className={[styles.row, props.className].join(' ')} />
);
