import React, { useMemo, useRef, useState } from "react";
import { GroupedVirtuoso } from "react-virtuoso";
import { getBranchPath } from "@/models/GitHubPlatform/lib/helpers.js";
import { useRepos } from "@/pages/providers/ReposContext.jsx";
import { usePlatformContext } from "@/providers/PlatformContext.jsx";
import { WORKFLOW_STATUSES } from "@/pages/providers/WorkflowsContext.jsx";
import { groupWorkflows } from "@/pages/lib/helpers.js";
import { Branch } from "./Branch";
import { Workflow } from "./Workflow";
import styles from "./FilesExplorer.module.css";
import { Icon } from "@/components/Icon/Icon.jsx";
import { useVirtuosoHeight } from "@/pages/_ui/FilesExplorer/lib/size-observer.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.js";
import { Button } from "@/components/ui/button.js";
import {
  RepoHeader,
  Group,
  Item,
} from "@/pages/_ui/FilesExplorer/_ui/Elements.jsx";
import { CardContent } from "@/components/ui/card.js";
import { getBranchKey } from "@/pages/_ui/FilesExplorer/lib/helpers.js";

export const FilesTree = ({
  workflows,
  workflowsStatus,
  submissionResults,
  onFileSelect,
  onBranchSelect,
  filesSelected,
  refetch,
}) => {
  const virtuoso = useRef(null);
  const panelRef = useRef(null);
  const height = useVirtuosoHeight(panelRef, {
    minHeight: 200,
    minWidth: 1024,
  });

  const { organisation } = usePlatformContext();
  const { selectedRepos: repoNames } = useRepos();
  const [isScrolling, setIsScrolling] = useState(false);

  const errors = submissionResults
    ? Object.entries(submissionResults)
        .filter(([_, result]) => !result.success)
        .map(([path, result]) => ({ path, success: result.success }))
    : [];

  const grouped = useMemo(() => {
    if (!workflows) return [];

    return Object.entries(workflows).map(
      ([repo, { data, status, message }]) => {
        const branches = data ? groupWorkflows(data) : {};
        const groupedBranches = Object.entries(branches).map(
          ([branch, workflows]) => {
            const branchPath = getBranchPath({
              organisation,
              repository: repo,
              branch,
            });
            return { branch, branchPath, workflows };
          },
        );
        return {
          repo,
          status,
          message,
          branches: groupedBranches,
        };
      },
    );
  }, [workflows, organisation]);

  const isReady =
    workflowsStatus === WORKFLOW_STATUSES.SUCCESS ||
    workflowsStatus === WORKFLOW_STATUSES.SUCCESS_WITH_ERRORS;

  const flatItems = useMemo(() => {
    if (!isReady) return [];

    return grouped.flatMap(({ repo, branches }) =>
      branches.flatMap(({ branch, branchPath, workflows, ...rest }) => {
        const workflowsEntries = workflows ? Object.values(workflows) : [];

        const items = [
          {
            type: "branch",
            repo,
            branch,
            branchPath,
            workflowsAmount: workflowsEntries?.length,
          },
        ];

        items.push(
          ...(workflows
            ? workflowsEntries.map((workflow) => ({
                type: "workflow",
                repo,
                branch,
                branchPath,
                ...workflow,
              }))
            : []),
        );

        return items;
      }),
    );
  }, [grouped, workflowsStatus, repoNames]);

  const groupCounts = useMemo(() => {
    return grouped.map(({ branches }) =>
      branches.reduce((count, { workflows }) => {
        const wCount = workflows ? Object.keys(workflows).length : 0;
        return count + 1 + wCount; // +1 for the branch header
      }, 0),
    );
  }, [grouped]);

  return (
    <div className={styles.treeWrapper}>
      {!isReady ? (
        <div className={styles.treeScroller}>
          {grouped.map(({ repo, branches, status, message }) => (
            <Group>
              <RepoHeader
                repo={repo}
                status={status}
                message={message}
                branchCount={branches?.length}
                key={repo}
              />
            </Group>
          ))}
        </div>
      ) : (
        <>
          <CardContent className={"flex justify-end mb-2"}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {" "}
                  <Icon
                    name={"gallery-vertical"}
                    size={"20px"}
                    className={"mr-2"}
                  />
                  Scroll to Branch{" "}
                  <Icon
                    name={"chevron-down"}
                    size={"16px"}
                    className={"ml-2 text-muted-foreground"}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                {groupCounts
                  .reduce(
                    ({ firstItemsIndexes, offset }, count) => {
                      return {
                        firstItemsIndexes: [...firstItemsIndexes, offset],
                        offset: offset + count,
                      };
                    },
                    { firstItemsIndexes: [], offset: 0 },
                  )
                  .firstItemsIndexes.map((itemIndex, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        virtuoso.current.scrollToIndex({
                          index: itemIndex,
                        });
                      }}
                    >
                      {grouped[index]?.repo}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>

          <div ref={panelRef} className={styles.treeSlot}>
            <GroupedVirtuoso
              ref={virtuoso}
              context={{ isScrolling }}
              isScrolling={setIsScrolling}
              components={{ Group, Item }}
              groupCounts={groupCounts}
              groupContent={(index) => {
                return (
                  <RepoHeader
                    repo={repoNames[index]}
                    status={grouped[index].status}
                    message={grouped[index].message}
                    branchCount={grouped[index].branches.length}
                    refetch={() => refetch([repoNames[index]])}
                  />
                );
              }}
              itemContent={(index, _, __, { isScrolling }) => {
                const item = flatItems[index];
                if (!item) return null;
                const branchKey = getBranchKey(item.repo, item.branch);

                if (item.type === "branch") {
                  return (
                    <Branch
                      key={item.branchPath}
                      checked={
                        filesSelected[branchKey]?.length ===
                        item.workflowsAmount
                      }
                      onSelect={() => onBranchSelect(item.repo, item.branch)}
                      errors={errors}
                      isScrolling={isScrolling}
                      branch={item.branch}
                      branchPath={item.branchPath}
                      workflowsAmount={item.workflowsAmount}
                    />
                  );
                }

                if (item.type === "workflow") {
                  return (
                    <Workflow
                      key={item.originalPath}
                      workflow={item}
                      checked={filesSelected[branchKey]?.includes(
                        item.originalPath,
                      )}
                      onSelect={() =>
                        onFileSelect(item.originalPath, item.branch, item.repo)
                      }
                      isScrolling={isScrolling}
                    />
                  );
                }

                return null;
              }}
              style={{
                height: Math.max(+height || 0, 400),
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};
