import * as React from "react";
import { useSafeDispatch } from "./useSafeDispatch";

// Example usage:
// const {data, error, status, run} = useAsync()
// React.useEffect(() => {
//     run(fetchText(readme));
// }, [readme, chartVersion]);

const STATUSES = {
  idle: "idle",
  resolved: "resolved",
  rejected: "rejected",
  pending: "pending",
};

const defaultInitialState = { status: STATUSES.idle, data: null, error: null };

function useAsync(initialState) {
  const initialStateRef = React.useRef({
    ...defaultInitialState,
    ...initialState,
  });

  const [{ status, data, error }, setState] = React.useReducer(
    (state, action) => ({ ...state, ...action }),
    initialStateRef.current,
  );

  const safeSetState = useSafeDispatch(setState);
  const abortControllerRef = React.useRef(null);

  const setData = React.useCallback(
    (data) => safeSetState({ data, status: STATUSES.resolved }),
    [safeSetState],
  );

  const setError = React.useCallback(
    (error) => safeSetState({ error, status: STATUSES.rejected }),
    [safeSetState],
  );

  const reset = React.useCallback(() => {
    abortControllerRef.current?.abort();
    safeSetState(initialStateRef.current);
  }, [safeSetState]);

  const run = React.useCallback(
    (promiseOrFactory) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      safeSetState({ status: STATUSES.pending });

      let promise;

      if (typeof promiseOrFactory === "function") {
        // Advanced use: getRepositories(org, { signal })
        promise = promiseOrFactory(controller.signal);
      } else {
        // Basic use: run(fetchSomething())
        promise = promiseOrFactory;
      }

      if (!promise || !promise.then) {
        throw new Error(
          "The argument passed to run must be a promise or a function returning a promise.",
        );
      }

      return promise.then(
        (data) => {
          if (!controller.signal.aborted) {
            setData(data);
          }
          return data;
        },
        (error) => {
          if (!controller.signal.aborted) {
            setError(error);
          }
          return Promise.reject(error);
        },
      );
    },
    [safeSetState, setData, setError],
  );

  return {
    isIdle: status === STATUSES.idle,
    isLoading: status === STATUSES.pending,
    isError: status === STATUSES.rejected,
    isSuccess: status === STATUSES.resolved,
    setData,
    setError,
    error,
    status,
    data,
    run,
    reset,
  };
}

export { useAsync };
