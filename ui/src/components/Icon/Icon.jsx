
import styles from './Icon.module.css';
import {ICONS} from "@/components/Icon/icons.js";

export const Icon = ({ name, size,...props }) => {
  const LucideIcon = ICONS[name];
  if (!LucideIcon) return null;

  return <LucideIcon className={styles.icon} size={size} {...props} />;
};
