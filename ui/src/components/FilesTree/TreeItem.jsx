import styles from "./FilesTree.module.css";
import { Icon } from "../Icon/Icon.jsx";
import React from "react";
import { Checkbox } from "@/components/ui/checkbox.js";
import { cn } from "@/lib/utils.js";

export const TreeItem = ({
  children,
  iconName,
  selectable,
  onSelect,
  checked,
  className,
  ...props
}) => {
  return (
    <div className={cn(styles.item, className)} {...props}>
      {selectable ? (
        <div className={cn(styles.checkboxWrapper, styles.itemElement)}>
          <Checkbox checked={checked} onCheckedChange={onSelect} />
        </div>
      ) : (
        <div />
      )}
      {iconName ? (
        <Icon
          name={iconName}
          size={20}
          className={cn(styles.itemIcon, styles.itemElement)}
        />
      ) : null}
      <div className={cn(styles.itemElement, "w-full")}>{children}</div>
    </div>
  );
};
