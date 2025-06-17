import styles from "./_ui/FilesExplorer.module.css";
import { useRepos } from "../../providers/ReposContext.jsx";
import { usePlatformContext } from "@/providers/PlatformContext.jsx";
import React, { useEffect, useRef, useState } from "react";
import { Row } from "@/components/layout/index.js";
import { FilesTree } from "./_ui/FilesTree.jsx";
import { useLabels } from "../../providers/LabelsContext.jsx";
import { transformYamlFiles } from "../../lib/yaml.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.js";
import { CardActionsSlot } from "@/components/Card/CardElements.jsx";
import { Icon } from "@/components/Icon/Icon.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.js";
import { isUndef, pluralize } from "@/lib/helpers.js";
import { Caption } from "@/components/typography/index.js";
import { Badge } from "@/components/ui/badge.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import {
  useWorkflows,
  WORKFLOW_STATUSES,
} from "@/pages/providers/WorkflowsContext.jsx";
import { SubmitDialog } from "@/pages/_ui/FilesExplorer/_ui/SubmitDialog.jsx";
import {
  isInTerminalStatus,
  OVERALL_STATUSES,
} from "@/lib/useBatchRequest.jsx";
import { LoaderCircular } from "@/components/Loader/index.js";
import { Button } from "@/components/ui/button.js";
import {
  extractRepoFromPath,
  useBranchPathByWorkflowPath,
} from "@/models/GitHubPlatform/lib/helpers.js";
import { cn } from "@/lib/utils.js";
import { getBranchKey } from "@/pages/_ui/FilesExplorer/lib/helpers.js";
import { groupWorkflows } from "@/pages/lib/helpers.js";

const BATCH_SIZE = 50; // Max number of branches to commit in one batch

export const FilesExplorer = () => {
  const { selectedRepos } = useRepos();
  const { organisation, submitWorkflows } = usePlatformContext();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const { workflows, overallStatus, currentFetchStatus, refetch, isReady } =
    useWorkflows();
  const [filesByBranch, setFilesByBranch] = useState({});
  const [localError, setLocalError] = useState(null);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitTotal, setSubmitTotal] = useState(0);
  const abortControllerRef = useRef(null);
  const getBranchPathByWorkflowPath = useBranchPathByWorkflowPath();
  const {
    labelsToReplace,
    replacementValue,
    setReplacementValue,
    setLabelsToReplace,
  } = useLabels();

  const allPaths = collectOriginalPaths(workflows);

  const workflowsHash = workflows
    ? Object.entries(workflows)
        .map(
          ([repo, { status }]) =>
            `${repo}-${status === OVERALL_STATUSES.SUCCESS}`,
        )
        .join(",")
    : null;

  // Prefill filesByBranch once workflows are loaded
  useEffect(() => {
    if (!workflows) return;

    const filesGrouped = {};

    for (const [_, { status, data }] of Object.entries(workflows)) {
      if (status !== "SUCCESS" || !Array.isArray(data)) continue;

      for (const item of data) {
        const { repository, branch, originalPath } = item;

        const branchKey = getBranchKey(repository, branch);

        if (!filesGrouped[branchKey]) {
          filesGrouped[branchKey] = [];
        }
        filesGrouped[branchKey].push(originalPath);
      }
    }

    setFilesByBranch((prev) => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(filesGrouped).map(([branch, paths]) => [
          branch,
          [...new Set([...(prev[branch] || []), ...paths])],
        ]),
      ),
    }));
  }, [workflowsHash]);

  useEffect(() => {
    if (!labelsToReplace?.length || !workflows) return;

    const labelSet = new Set(labelsToReplace);
    const nextFilesByBranch = {};

    for (const { status, data } of Object.values(workflows)) {
      if (status !== "SUCCESS" || !Array.isArray(data)) continue;

      for (const item of data) {
        const { labels, originalPath, repository, branch } = item;
        if (!originalPath || !labels?.some((l) => labelSet.has(l))) continue;

        const key = getBranchKey(repository, branch);
        if (!nextFilesByBranch[key]) nextFilesByBranch[key] = [];
        nextFilesByBranch[key].push(originalPath);
      }
    }

    setFilesByBranch(nextFilesByBranch);
  }, [labelsToReplace, workflows]);

  function handleBranchChange(repo, branch) {
    const files = workflows?.[repo]?.data?.filter(
      (file) => file.branch === branch,
    );

    const key = getBranchKey(repo, branch);
    const allPaths = files?.map((f) => f.originalPath).filter(Boolean) || [];

    setFilesByBranch((prev) => {
      const selectedPaths = new Set(prev[key] || []);
      const allSelected = allPaths.every((path) => selectedPaths.has(path));

      const next = { ...prev };

      if (allSelected) {
        delete next[key];
      } else {
        next[key] = allPaths;
      }

      return next;
    });
  }

  function handleFileChange(path, branch, repo) {
    if (!branch) return;

    const key = getBranchKey(repo, branch);

    setFilesByBranch((prev) => {
      const current = prev[key] || [];
      const exists = current.includes(path);

      const updated = exists
        ? current.filter((p) => p !== path)
        : [...current, path];

      const next = { ...prev };
      if (updated.length === 0) {
        delete next[key];
      } else {
        next[key] = updated;
      }

      return next;
    });
  }

  if (isUndef(selectedRepos)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
        </CardHeader>
        <CardContent>
          <Placeholder />
        </CardContent>
      </Card>
    );
  }

  const handleReplace = async () => {
    setSubmitted(false);
    setLocalError(null);
    setResult(null);

    if (!Object.keys(filesByBranch).length) {
      return setLocalError("No files to commit");
    }
    if (!labelsToReplace) return setLocalError("No labels to replace");
    if (!replacementValue) return setLocalError("No replacement value");

    setSubmitting(true);
    abortControllerRef.current = new AbortController();

    const updatedByBranch = {};

    try {
      for (const [repo, { status, data }] of Object.entries(workflows)) {
        if (status !== "SUCCESS" || !Array.isArray(data)) continue;

        const grouped = groupWorkflows(data); // { branch: { workflowPath: item } }

        for (const [branch, itemsByPath] of Object.entries(grouped)) {
          const key = getBranchKey(repo, branch);
          const selectedPaths = filesByBranch[key];
          if (!selectedPaths?.length) continue;

          const itemsToTransform = Object.values(itemsByPath).filter((item) =>
            selectedPaths.includes(item.originalPath),
          );

          const transformed = transformYamlFiles(
            itemsToTransform,
            labelsToReplace,
            replacementValue,
          )
            .filter((f) => f.wasModified)
            .map(({ path, content }) => ({ path, content }));

          if (transformed.length) {
            updatedByBranch[key] = transformed;
          }
        }
      }

      const totalFiles = Object.values(updatedByBranch).flat().length;

      if (totalFiles === 0) {
        return setLocalError("No modified files to commit");
      }

      setSubmitTotal(totalFiles);
      setSubmitProgress(0);

      const chunkObjectEntries = (obj, size) => {
        const entries = Object.entries(obj);
        const result = [];
        for (let i = 0; i < entries.length; i += size) {
          result.push(entries.slice(i, i + size));
        }
        return result;
      };

      const branchBatches = chunkObjectEntries(updatedByBranch, BATCH_SIZE);

      let localResult = {};

      for (const batch of branchBatches) {
        if (abortControllerRef.current.signal.aborted) {
          const firstPath = batch[0]?.[1]?.[0]?.path;
          const failedBranch = getBranchPathByWorkflowPath(firstPath);
          if (failedBranch) {
            localResult[failedBranch] = { success: false };
          }
          throw new Error("Cancelled");
        }

        setSubmitted(true);

        const files = batch.flatMap(([_, files]) => files);
        const res = await submitWorkflows(
          files,
          abortControllerRef.current.signal,
        );

        localResult = { ...localResult, ...res };
        setSubmitProgress((prev) => prev + files.length);
      }

      setLabelsToReplace([]);
      setReplacementValue(null);
      setResult(localResult);

      const erroredRepos = new Set();

      Object.entries(localResult).forEach(([path, { success }]) => {
        if (!success) {
          const repo = extractRepoFromPath(path, organisation);
          if (repo) erroredRepos.add(repo);
        }
      });

      const erroredReposArray = Array.from(erroredRepos);
      const succeededRepos = selectedRepos.filter(
        (repo) => !erroredReposArray.includes(repo),
      );
      if (succeededRepos.length) {
        refetch(succeededRepos);
      }
    } catch (err) {
      if (err?.message === "Cancelled") {
        setLocalError("Commit cancelled by user.");
      } else {
        setLocalError(err.message || "Commit failed");
      }
    } finally {
      setSubmitting(false);
      abortControllerRef.current = null;
    }
  };

  return !Object.keys(workflows).length &&
    overallStatus === WORKFLOW_STATUSES.LOADING ? (
    <Card>
      <CardHeader>
        <CardTitle>Workflows</CardTitle>
      </CardHeader>
      <CardContent>
        <Loader />
      </CardContent>
    </Card>
  ) : (
    <>
      <Card id={"tree-card"} className={"self-start"}>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
          <CardDescription>
            <Caption>
              Found{" "}
              <Badge variant={"secondary"}>
                {allPaths?.workflows?.length}{" "}
                {!isInTerminalStatus(currentFetchStatus) ? (
                  <LoaderCircular
                    size={"1em"}
                    className={"text-muted-foreground"}
                  />
                ) : null}
              </Badge>{" "}
              workflows across{" "}
              <Badge variant={"secondary"}>
                {Object.keys(workflows).length}
              </Badge>{" "}
              repositories
            </Caption>
          </CardDescription>
        </CardHeader>

        {!Object.keys(workflows).length ? (
          <CardContent>
            <Placeholder />
          </CardContent>
        ) : (
          <>
            <div className={cn(styles.explorer, "border-b")}>
              <FilesTree
                workflows={workflows}
                workflowsStatus={overallStatus}
                submissionResults={result}
                onFileSelect={handleFileChange}
                onBranchSelect={handleBranchChange}
                filesSelected={filesByBranch}
                refetch={refetch}
              />
            </div>
            <CardContent id={"tree-actions"} className={"mt-auto"}>
              <CardActionsSlot className={"flex items-center"}>
                <div className={"mr-2 text-right text-muted-foreground"}>
                  CI will be skipped
                </div>
                <SubmitDialog
                  onSubmit={handleReplace}
                  submitting={submitting}
                  disabled={
                    !labelsToReplace?.length || submitting || !replacementValue
                  }
                  submitProgress={submitProgress}
                  submitTotal={submitTotal}
                  abortControllerRef={abortControllerRef}
                />
              </CardActionsSlot>

              {(localError || result) && !submitting ? (
                <SuccessMessage result={result} message={localError} />
              ) : null}
              {localError && !result ? (
                <Alert variant={"destructive"} className={"mt-2"}>
                  <Icon name={"circle-x"} size={16} />
                  <AlertTitle>{localError}</AlertTitle>
                </Alert>
              ) : null}

              {submitting && submitTotal > BATCH_SIZE && (
                <div className={"text-center my-4"}>
                  <p>
                    Submitting {submitProgress} / {submitTotal}. Please, don't
                    close this window.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => abortControllerRef.current?.abort()}
                    className={"mt-2"}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </>
  );
};

function SuccessMessage({ result, message }) {
  if (!result) return null;

  const successes = Object.values(result).filter((r) => r.success)?.length;
  const errors = Object.values(result).filter((r) => !r.success)?.length;

  const mixedResult = successes && errors;
  const allFailed = errors && !successes;

  const CASES = {
    success: {
      icon: "check",
      title: "Success!",
      description: "Changes committed successfully.",
    },
    error: {
      variant: "destructive",
      icon: "circle-x",
      title: "Commit failed",
      description: message,
    },
    mixed: {
      variant: "destructive",
      icon: "frown",
      title: "Some commits failed",
      description: `${pluralize(successes, "commit")} succeeded, ${pluralize(errors, "commit")} failed. ${message ? message : "Check workflow explorer for details."}`,
    },
  };

  const view = CASES[mixedResult ? "mixed" : allFailed ? "error" : "success"];

  return (
    <Row>
      <Alert variant={view.variant}>
        <Icon name={view.icon} size={16} />
        <AlertTitle>{view.title}</AlertTitle>
        <AlertDescription>{view.description}</AlertDescription>
      </Alert>
    </Row>
  );
}

function Loader() {
  return (
    <div className="space-y-2">
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

function Placeholder() {
  return (
    <div className="text-muted-foreground">
      <div className="text-lg font-semibold">
        No workflows found for selected repositories.
      </div>
      <div className="text-base">
        Try to select another repository or check that your repositories have
        workflow files.
      </div>
    </div>
  );
}

function collectOriginalPaths(obj) {
  if (!obj || typeof obj !== "object") {
    return null;
  }

  const workflows = [];
  const branches = [];

  for (const key in obj) {
    const dataArray = obj[key]?.data;
    if (Array.isArray(dataArray)) {
      for (const item of dataArray) {
        if (item.originalPath) {
          workflows.push(item.originalPath);
        }
        if (item.organisation && item.repository && item.branch) {
          branches.push(
            `${item.organisation}/${item.repository}/${item.branch}`,
          );
        }
      }
    }
  }

  return { branches, workflows };
}
