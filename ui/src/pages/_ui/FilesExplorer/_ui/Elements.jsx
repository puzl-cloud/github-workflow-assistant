import React from "react";
import { Icon } from "@/components/Icon/Icon.jsx";
import { Skeleton } from "@/components/ui/skeleton.js";
import { Alert, AlertTitle } from "@/components/ui/alert.js";
import { TreeItem } from "@/components/FilesTree/index.js";
import styles from "@/pages/_ui/FilesExplorer/_ui/FilesExplorer.module.css";
import {
  isInTerminalStatus,
  OVERALL_STATUSES,
} from "@/lib/useBatchRequest.jsx";
import { Badge } from "@/components/ui/badge.js";
import { cn } from "@/lib/utils.js";
import { Button } from "@/components/ui/button.js";

export function Loader() {
  return (
    <div className="space-y-2 m-4">
      <div className="space-x-2 flex items-center">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-[250px]" />
      </div>
      <div className="space-x-2 flex items-center">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-[250px]" />
      </div>
    </div>
  );
}

export function Error({ message }) {
  return (
    <Alert variant={"destructive"}>
      <Icon name={"circle-x"} size={16} />
      <AlertTitle>Error: {message}</AlertTitle>
    </Alert>
  );
}

export function RepoHeader({ repo, status, message, branchCount, refetch }) {
  return (
    <TreeItem iconName="book" className={cn(styles.repoHeader, "w-full")}>
      <div className={"flex items-center justify-between w-full"}>
        <div className={"flex items-center"}>
          <span>{repo}&nbsp;</span>
          {status === OVERALL_STATUSES.SUCCESS ? (
            <Badge variant="secondary">
              <Icon name={"git-branch"} size={"16px"} />
              {branchCount} branches
            </Badge>
          ) : status !== OVERALL_STATUSES.ERROR ? (
            <Badge variant="secondary">searching</Badge>
          ) : null}
          {message && (
            <span className="text-destructive ml-2 text-sm mt-1">
              {message}
            </span>
          )}
        </div>
        {refetch ? (
          <Button
            onClick={() => refetch([repo])}
            size={"sm"}
            disabled={!isInTerminalStatus(status)}
          >
            <Icon name={"rotate-cw"} size={"14px"} />
            Refetch
          </Button>
        ) : null}
      </div>
    </TreeItem>
  );
}

export function Group({ className, ...props }) {
  return <div {...props} className={cn(styles.treeGroup, className)} />;
}

export function Item({ className, ...props }) {
  return <div {...props} className={cn(styles.treeItem, className)} />;
}
