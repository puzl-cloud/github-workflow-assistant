import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePlatformContext } from "../../providers/PlatformContext.jsx";
import { useAsync } from "@/lib/useAsync.js";
import { OVERALL_STATUSES, useBatchRequest } from "@/lib/useBatchRequest.jsx";

const ReposContext = createContext(null);

export function ReposProvider({ children }) {
  const { organisation, getRepositories, cloneRepository } =
    usePlatformContext();
  const { data: repos, error, isLoading, run, reset } = useAsync();

  const [selectedRepos, setSelectedRepos] = useState(undefined);
  const [retryCounts, setRetryCounts] = useState({});
  const [cloneTriggerVersion, setCloneTriggerVersion] = useState(0);
  const [clonedRepoOverrides, setClonedRepoOverrides] = useState({});

  useEffect(() => {
    if (!organisation) return;

    setSelectedRepos(undefined);
    setRetryCounts({});
    reset();

    run((signal) => getRepositories(organisation, { signal }));
  }, [organisation]);

  const repoNames = useMemo(
    () => (organisation && repos?.length ? repos.map(({ name }) => name) : []),
    [repos, organisation],
  );

  const task = useCallback(
    (repo, signal) => cloneRepository(organisation, repo, { signal }),
    [cloneRepository, organisation],
  );

  const cloneTrigger = useMemo(
    () => `${repoNames.join(",")}|${cloneTriggerVersion}`,
    [repoNames, cloneTriggerVersion],
  );

  const { results: clonedRepos, overallStatus: initialOverallStatus } =
    useBatchRequest({
      keys: repoNames,
      task,
      semaphoreKey: "clone-repos",
      concurrency: 10,
      trigger: cloneTrigger,
    });

  const [overrides, setOverrides] = useState({}); // repoName => status override

  // Retry errored repos (up to 10 times) in background
  useEffect(() => {
    if (initialOverallStatus !== OVERALL_STATUSES.SUCCESS_WITH_ERRORS) return;

    const erroredRepos = Object.entries(clonedRepos)
      .filter(([_, result]) => result.status === OVERALL_STATUSES.ERROR)
      .map(([name]) => name);

    erroredRepos.forEach((repoName) => {
      if (overrides[repoName] === "RETRYING") return;

      setOverrides((prev) => ({ ...prev, [repoName]: "RETRYING" }));

      let attempt = 0;

      const controller = new AbortController();

      const retry = () => {
        if (attempt >= 10) {
          setOverrides((prev) => {
            const updated = { ...prev };
            delete updated[repoName];
            return updated;
          });
          return;
        }

        attempt++;

        task(repoName, controller.signal)
          .then(() => {
            setOverrides((prev) => {
              const updated = { ...prev };
              delete updated[repoName];
              return updated;
            });

            setClonedRepoOverrides((prev) => ({
              ...prev,
              [repoName]: {
                status: OVERALL_STATUSES.SUCCESS,
                message: "Manual retry",
              },
            }));

            setRetryCounts((prev) => {
              const copy = { ...prev };
              delete copy[repoName];
              return copy;
            });

            setSelectedRepos((prev) => [...(prev || []), repoName]);
          })
          .catch(() => {
            setRetryCounts((prev) => ({
              ...prev,
              [repoName]: attempt,
            }));

            setTimeout(retry, 1000);
          });
      };

      // Start retry cycle
      setTimeout(retry, 1000);
    });
  }, [clonedRepos, initialOverallStatus]);

  // Final status override if all eventually succeed
  const derivedOverallStatus = useMemo(() => {
    const allSucceeded =
      repoNames.length > 0 &&
      repoNames.every(
        (name) =>
          clonedRepoOverrides[name]?.status === OVERALL_STATUSES.SUCCESS ||
          clonedRepos[name]?.status === OVERALL_STATUSES.SUCCESS ||
          overrides[name] === "RETRYING",
      );

    if (allSucceeded) return OVERALL_STATUSES.SUCCESS;
    return initialOverallStatus;
  }, [initialOverallStatus, clonedRepos, overrides, retryCounts, repoNames]);

  const clonedReposHash = useMemo(() => {
    if (!repos || !clonedRepos) return "";
    return repos
      .map((repo) => {
        const override = overrides[repo.name];
        const status = override || clonedRepos[repo.name]?.status || "pending";
        return `${repo.name}:${status}`;
      })
      .join("|");
  }, [repos, clonedRepos, overrides]);

  const saturatedRepos = useMemo(() => {
    if (!repos) return undefined;
    return repos.map((repo) => {
      const base = clonedRepoOverrides[repo.name] || clonedRepos?.[repo.name];
      const overrideStatus = overrides[repo.name];
      return {
        ...repo,
        message: base?.message,
        cloned: overrideStatus || base?.status,
      };
    });
  }, [clonedReposHash, repoNames]);

  // Select successful repos
  const successfulNames = useMemo(
    () =>
      saturatedRepos
        ?.filter((r) => r.cloned === OVERALL_STATUSES.SUCCESS)
        ?.map((r) => r.name) || [],
    [saturatedRepos],
  );

  const isReady =
    derivedOverallStatus === OVERALL_STATUSES.SUCCESS ||
    derivedOverallStatus === OVERALL_STATUSES.SUCCESS_WITH_ERRORS;

  useEffect(() => {
    if (isReady) {
      setSelectedRepos(successfulNames);
    }
  }, [isReady]);

  const cloneErrors = useMemo(() => {
    return Object.entries(clonedRepos)
      .filter(([name, result]) => {
        const wasManuallyFixed =
          clonedRepoOverrides[name]?.status === OVERALL_STATUSES.SUCCESS;
        return result.status === OVERALL_STATUSES.ERROR && !wasManuallyFixed;
      })
      .map(([name, result]) => ({
        name,
        message: result.message,
      }));
  }, [clonedRepos, clonedRepoOverrides]);

  const cloneError =
    derivedOverallStatus === OVERALL_STATUSES.ERROR
      ? {
          severity: "error",
          message: "Fetching failed for all repositories.",
        }
      : derivedOverallStatus === OVERALL_STATUSES.SUCCESS_WITH_ERRORS
        ? {
            severity: "warning",
            message: `${cloneErrors.length} of ${repoNames.length} repositories failed to fetch.`,
            details: cloneErrors,
          }
        : null;

  // Retry all (used in a manual retry button if all failed)
  const retryAll = () => {
    if (!organisation) return;
    setSelectedRepos(undefined);
    setRetryCounts({});
    setOverrides({});
    setCloneTriggerVersion((v) => v + 1); // triggers batch request
  };

  const branches = useMemo(
    () =>
      [OVERALL_STATUSES.SUCCESS, OVERALL_STATUSES.SUCCESS_WITH_ERRORS].includes(
        initialOverallStatus,
      )
        ? collectBranchNames(clonedRepos)
        : undefined,
    [initialOverallStatus, derivedOverallStatus],
  );

  return (
    <ReposContext.Provider
      value={{
        repos: saturatedRepos,
        branches,
        selectedRepos,
        setSelectedRepos,
        error: error || cloneError,
        isLoading,
        isReady: isReady && !!branches,
        retryAll,
      }}
    >
      {children}
    </ReposContext.Provider>
  );
}

export function useRepos() {
  const context = useContext(ReposContext);
  if (!context) {
    throw new Error("useRepos must be used within a ReposProvider");
  }
  return context;
}

function collectBranchNames(input) {
  const result = {};

  for (const jobName in input) {
    const job = input[jobName];
    result[jobName] = job.data?.map((item) => item.name) || [];
  }

  return result;
}
