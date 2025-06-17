import { useEffect, useRef, useState } from "react";
import { getSemaphore } from "@henrygd/semaphore";

export const OVERALL_STATUSES = {
  IDLE: "IDLE",
  LOADING: "LOADING",
  SUCCESS: "SUCCESS",
  SUCCESS_WITH_ERRORS: "SUCCESS_WITH_ERRORS",
  ERROR: "ERROR",
  RETRYING: "RETRYING",
};

export const isInTerminalStatus = (status) =>
  [
    OVERALL_STATUSES.IDLE,
    OVERALL_STATUSES.SUCCESS,
    OVERALL_STATUSES.ERROR,
    OVERALL_STATUSES.SUCCESS_WITH_ERRORS,
  ].includes(status);

/**
 * @typedef {{ status: string, data: any, message: string | null }} AsyncItemResult
 */

/**
 * useBatchRequest
 *
 * Executes an async task per key with concurrency control and generation safety.
 *
 * @param {Object} params
 * @param {string[]} params.keys - Unique identifiers for each task
 * @param {(key: string, signal: AbortSignal) => Promise<any>} params.task - Function to run per key
 * @param {string} params.semaphoreKey - Key for shared semaphore pool
 * @param {number} [params.concurrency=10] - Max concurrent tasks
 * @param {any} [params.trigger] - Optional: refetch when this value changes
 *
 * @returns {{
 *   results: Record<string, AsyncItemResult>,
 *   overallStatus: string,
 *   refetch: () => void,
 * }}
 */
export function useBatchRequest({
  keys,
  task,
  semaphoreKey,
  concurrency = 10,
  trigger,
}) {
  const [results, setResults] = useState({});
  const [overallStatus, setOverallStatus] = useState(OVERALL_STATUSES.IDLE);
  const generationRef = useRef(0);
  const controllerRef = useRef(null);
  const fetchIdRef = useRef(0); // increments on manual refetch

  const activeFetchId = `${trigger ?? ""}-${fetchIdRef.current}.`;

  const fetchBatch = async (keysToUse) => {
    if (!keysToUse.length) return;

    // Abort previous
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controller.signal;

    const currentGeneration = ++generationRef.current;
    const sem = getSemaphore(
      `${semaphoreKey}-${currentGeneration}`,
      concurrency,
    );

    const initialState = keysToUse.reduce((acc, key) => {
      acc[key] = { status: "LOADING", data: null, message: null };
      return acc;
    }, {});

    setResults(initialState);
    setOverallStatus(OVERALL_STATUSES.LOADING);

    await Promise.all(
      keysToUse.map(async (key) => {
        await sem.acquire();
        try {
          const data = await task(key, signal);
          if (!signal.aborted) {
            setResults((prev) => ({
              ...prev,
              [key]: { status: "SUCCESS", data, message: null },
            }));
          }
        } catch (error) {
          if (!signal.aborted) {
            setResults((prev) => ({
              ...prev,
              [key]: {
                status: "ERROR",
                data: null,
                message: error?.message || "Unknown error",
              },
            }));
          }
        } finally {
          sem.release();
        }
      }),
    ).then(() => {
      if (generationRef.current === currentGeneration) {
        setResults((prev) => {
          const statuses = Object.values(prev).map((r) => r.status);

          const hasErrors = statuses.includes("ERROR");
          const hasSuccess = statuses.includes("SUCCESS");

          setOverallStatus(
            hasSuccess && hasErrors
              ? OVERALL_STATUSES.SUCCESS_WITH_ERRORS
              : hasSuccess
                ? OVERALL_STATUSES.SUCCESS
                : OVERALL_STATUSES.ERROR,
          );

          return prev;
        });
      }
    });

    // if (generationRef.current === currentGeneration) {
    //   setResults((prev) => {
    //     const statuses = Object.values(prev).map((r) => r.status);
    //     const hasErrors = statuses.includes("ERROR");
    //     const hasSuccess = statuses.includes("SUCCESS");
    //
    //     setOverallStatus(
    //       hasSuccess && hasErrors
    //         ? OVERALL_STATUSES.SUCCESS_WITH_ERRORS
    //         : hasSuccess
    //           ? OVERALL_STATUSES.SUCCESS
    //           : OVERALL_STATUSES.ERROR,
    //     );
    //
    //     return prev;
    //   });
    // }
  };

  useEffect(() => {
    setOverallStatus(OVERALL_STATUSES.IDLE);
    setResults({});
    fetchBatch(keys);
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, activeFetchId]);

  const refetch = async (newKeys) => {
    if (newKeys) {
      await fetchBatch(newKeys || keys);
    } else {
      fetchIdRef.current++;
    }
  };

  return {
    results,
    overallStatus,
    refetch,
  };
}
