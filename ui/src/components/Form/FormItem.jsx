import styles from "./Form.module.css";
import { cn } from "@/lib/utils.js";

export const FormItem = ({ className, ...props }) => (
  <div {...props} className={cn(className, styles.item)} />
);
