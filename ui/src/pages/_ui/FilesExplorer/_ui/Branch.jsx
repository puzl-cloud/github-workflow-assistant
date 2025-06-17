import React from "react";
import styles from "./FilesExplorer.module.css";
import { TreeItem } from "@/components/FilesTree/index.js";
import { Badge } from "@/components/ui/badge.js";
import { Icon } from "@/components/Icon/Icon.jsx";

export const Branch = ({
  branch,
  branchPath,
  workflowsAmount,
  checked,
  onSelect,
  errors,
}) => {
  const hasError = errors?.some((e) => e.path.endsWith(branchPath));

  return (
    <div className={styles.collapsibleTrigger}>
      <TreeItem
        iconName={"git-branch"}
        selectable
        checked={checked}
        onSelect={() => onSelect(branchPath)}
      >
        <div className={"flex"}>
          {branch}&nbsp;
          <Badge variant="secondary">{workflowsAmount}</Badge>
          {hasError ? (
            <>
              &nbsp;
              <Badge variant="destructive">
                <Icon name={"x"} size={"15px"} /> Commit Error
              </Badge>
            </>
          ) : null}
        </div>
      </TreeItem>
    </div>
  );
};
