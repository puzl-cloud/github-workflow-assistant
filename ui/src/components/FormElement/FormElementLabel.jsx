import styles from './FormElement.module.css';

export const FormElementLabel = ({ label, children, ...props }) => {
  return (
    <label {...props} className={styles.label}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
};
