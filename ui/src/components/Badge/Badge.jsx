import styles from './Badge.module.css';

export const Badge = ({ variant = 'default', ...props }) => (
  <label
    {...props}
    className={[styles.badge, styles[`variant-${variant}`]].join(' ')}
  />
);
