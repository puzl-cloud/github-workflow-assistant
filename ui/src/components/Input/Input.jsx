import styles from './Input.module.css';
import { FormElementLabel } from '../FormElement/FormElementLabel.jsx';

export const Input = ({ label, ...props }) => {
  return (
    <div className={styles.wrapper}>
      <FormElementLabel label={label}>
        <input {...props} className={styles.element} />
      </FormElementLabel>
    </div>
  );
};
