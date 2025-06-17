import { Badge } from "@/components/ui/badge.js";
import React, { useMemo } from "react";
import { useLabels } from "@/pages/providers/LabelsContext.jsx";
import { replaceRunsOnInYaml } from "@/pages/lib/yaml.js";

import { diffLines, formatLines } from "unidiff";
import { parseDiff, Diff, Hunk } from "react-diff-view";
import "react-diff-view/style/index.css";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet.js";
import styles from "./FilesExplorer.module.css";
import { TreeItem } from "@/components/FilesTree/index.js";
import { Icon } from "@/components/Icon/Icon.jsx";
import { Code } from "@/components/Code/index.js";
import { cn } from "@/lib/utils.js";

export function Workflow({ workflow, checked, onSelect, isScrolling }) {
  const { labelsToReplace, replacementValue } = useLabels();
  const [diff, setDiff] = React.useState(null);
  const [showDiff, setShowDiff] = React.useState(false);

  const labelsToBeReplaced = useMemo(
    () =>
      replacementValue
        ? labelsToReplace?.filter((label) => workflow.labels.includes(label))
        : null,
    [labelsToReplace, replacementValue],
  );

  const diffKey = labelsToBeReplaced?.join();

  const computedDiff = useMemo(() => {
    if (!labelsToBeReplaced?.length || !replacementValue) return;
    const updated = replaceRunsOnInYaml(
      workflow.content,
      labelsToReplace,
      replacementValue,
    );
    const diffText = formatLines(diffLines(workflow.content, updated), {
      context: 2,
    });
    return parseDiff(diffText)?.[0];
  }, [diffKey]);

  const handleShowDiff = () => {
    setShowDiff((prev) => !prev);
    if (!diff) setDiff(computedDiff);
  };

  const isModified = labelsToBeReplaced?.length && computedDiff;

  const content = (
    <div className={cn(styles.row, isModified ? styles.modified : "")}>
      <div className={styles.workflowRow}>
        <div className={styles.labelsRow}>
          <TreeItem
            iconName={"minus"}
            selectable
            onSelect={onSelect}
            checked={checked}
          >
            <div className={styles.itemTitle}>{workflow.workflowPath}</div>
          </TreeItem>
          <div>
            <div className={styles.labelsSlot}>
              <Labels labels={workflow.labels} />
            </div>
          </div>
        </div>
        {!isScrolling ? (
          <SheetTrigger className={styles.sheetTrigger}>
            <Icon name="file-code-2" size={"20px"} />
          </SheetTrigger>
        ) : (
          <div className={styles.sheetTrigger} /> // we need it to avoid content shifting on scroll and reduce dom size
        )}
      </div>
      {isModified ? (
        <div className={cn(styles.diffSlot, "pb-4")}>
          <span
            onClick={handleShowDiff}
            style={{ borderBottom: "1px dashed", cursor: "pointer" }}
          >
            {showDiff ? "Hide diff" : "Show diff"}
          </span>
          {showDiff ? (
            <Diff
              viewType="unified"
              diffType={computedDiff?.type}
              hunks={computedDiff?.hunks}
            >
              {(hunks) =>
                hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
              }
            </Diff>
          ) : null}
        </div>
      ) : null}
    </div>
  );
  // We use isScrolling to simplify DOM while scrolling large lists and minimise performance issues.
  return isScrolling ? (
    content
  ) : (
    <Sheet key={workflow.originalPath} modal={false}>
      {content}
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Workflow</SheetTitle>
          <SheetDescription>{`${workflow.organisation}/${workflow.repository}/blob/${workflow.branch}/${workflow.workflowPath}`}</SheetDescription>
        </SheetHeader>
        <div className="p-4 pt-0 w-full">
          <Code code={workflow.content} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Labels({ labels }) {
  return labels?.length ? (
    <>
      <span>runs-on:&nbsp;</span>
      {labels?.map((label) => (
        <Badge key={label} variant="secondary">
          {label}
        </Badge>
      ))}
    </>
  ) : (
    <span className={"text-muted-foreground text-sm"}>no runs-on labels</span>
  );
}
