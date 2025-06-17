import { cn } from "@/lib/utils";
import styles from "./Panel.module.css";

export const Panel = (props) => <div className={styles.panel} {...props} />;

export const PanelTitle = (props) => (
  <div className={styles.title} {...props} />
);

export const PanelContent = (props) => (
  <div className={styles.content} {...props} />
);

export const PanelError = ({ className, ...props }) => (
  <div className={cn(styles.error, className)} {...props} />
);
