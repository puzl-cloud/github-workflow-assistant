import React from "react";
import styles from "./LoaderCircular.module.css";
import { cn } from "@/lib/utils.ts";

interface LoaderCircularProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: string;
}

export const LoaderCircular: React.FC<LoaderCircularProps> = ({
  size = "inherit",
  className,
  ...props
}) => {
  const style = { width: size, height: size };

  return (
    <span className={cn(styles.wrapper, className)} style={style} {...props}>
      <span className={styles.loader} style={style} />
    </span>
  );
};
