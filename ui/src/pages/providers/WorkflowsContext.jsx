import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react";
import { usePlatformContext } from "@/providers/PlatformContext.jsx";
import { useRepos } from "@/pages/providers/ReposContext.jsx";
import {
  isInTerminalStatus,
  OVERALL_STATUSES,
  useBatchRequest,
} from "@/lib/useBatchRequest.jsx";

const WorkflowsContext = createContext(null);

export const WORKFLOW_STATUSES = OVERALL_STATUSES;

export function WorkflowsProvider({ children }) {
  const { organisation, useWorkflowsFetcher } = usePlatformContext();
  const { selectedRepos, repos, isReady } = useRepos();
  const getWorkflows = useWorkflowsFetcher();
  const orgVersionRef = useRef(0);

  const workflowsCacheRef = useRef({});
  const [status, setStatus] = useState(OVERALL_STATUSES.IDLE);

  const repoList = useMemo(() => {
    return isReady
      ? repos
          ?.filter(
            ({ cloned, name }) =>
              cloned === OVERALL_STATUSES.SUCCESS &&
              selectedRepos?.includes(name),
          )
          ?.map(({ name }) => name) || []
      : [];
  }, [repos, selectedRepos, isReady]);

  const reposToFetch = useMemo(() => {
    return repoList.filter((repo) => !(repo in workflowsCacheRef.current));
  }, [repoList]);

  const task = useCallback(
    (repo, signal) => getWorkflows(organisation, repo, { signal }),
    [getWorkflows, organisation],
  );

  const {
    results: inFlightResults,
    overallStatus,
    refetch,
  } = useBatchRequest({
    keys: reposToFetch,
    task,
    semaphoreKey: "workflows-fetch",
    concurrency: 10,
    trigger: reposToFetch.join(","),
  });

  useEffect(() => {
    setStatus(OVERALL_STATUSES.IDLE);
    orgVersionRef.current++;
    workflowsCacheRef.current = {};
  }, [organisation]);

  const currentOrgVersion = orgVersionRef.current;

  useEffect(() => {
    if (!isInTerminalStatus(overallStatus)) return;
    if (orgVersionRef.current !== currentOrgVersion) return; // Skip stale update

    for (const [repo, result] of Object.entries(inFlightResults)) {
      if (result.status === OVERALL_STATUSES.SUCCESS) {
        workflowsCacheRef.current[repo] = result;
      }
    }

    const successCount = Object.keys(workflowsCacheRef.current).length;
    if (!successCount) return;

    if (successCount === repoList.length) {
      setStatus(OVERALL_STATUSES.SUCCESS);
    } else if (successCount > 0) {
      setStatus(OVERALL_STATUSES.SUCCESS_WITH_ERRORS);
    } else {
      setStatus(OVERALL_STATUSES.ERROR);
    }
  }, [overallStatus, repoList]);

  // Combine cache + current batch results for selected repos
  const visibleWorkflows = useMemo(() => {
    const result = {};

    for (const repo of repoList) {
      if (repo in inFlightResults) {
        result[repo] = inFlightResults[repo];
      } else if (repo in workflowsCacheRef.current) {
        result[repo] = workflowsCacheRef.current[repo];
      }
    }

    return result;
  }, [repoList, inFlightResults]);

  const isInReadyStatus = useMemo(() => isInTerminalStatus(status), [status]);

  return (
    <WorkflowsContext.Provider
      value={{
        workflows: visibleWorkflows,
        currentFetchStatus: overallStatus,
        overallStatus: status,
        refetch: (keys) => {
          refetch(keys || repoList);
        },
        isReady: isInReadyStatus,
      }}
    >
      {children}
    </WorkflowsContext.Provider>
  );
}

export function useWorkflows() {
  const context = useContext(WorkflowsContext);
  if (!context) {
    throw new Error("useWorkflows must be used within a WorkflowsProvider");
  }
  return context;
}
