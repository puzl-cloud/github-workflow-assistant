import { createContext, useContext, useEffect, useState, useRef } from "react";
import { usePlatformContext } from "@/providers/PlatformContext.jsx";
import { useAsync } from "@/lib/useAsync.js";

const LabelsContext = createContext(null);

export function LabelsProvider({ children }) {
  const [labelsToReplace, setLabelsToReplace] = useState(undefined);
  const [replacementValue, setReplacementValueBase] = useState("");
  const { data, error, isLoading, run } = useAsync();
  const { getLabelReplacementOptions } = usePlatformContext();
  const [replacementOptions, setReplacementOptions] = useState(undefined);
  const customLabelsRef = useRef(getInitialCustomLabels());

  useEffect(() => {
    run(getLabelReplacementOptions()).then((res) => {
      const serverOptions = res?.labels || [];
      const merged = [
        ...new Set([...serverOptions, ...customLabelsRef.current]),
      ];
      setReplacementOptions(merged);
    });
  }, []);

  const addCustomReplacementLabel = (label) => {
    const isFromServer = data?.labels?.includes(label);
    const isAlreadyStored = replacementOptions.includes(label);

    if (isFromServer || isAlreadyStored) return;
    customLabelsRef.current.push(label);
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(customLabelsRef.current),
    );
    setReplacementOptions((opts) => [...new Set([...(opts || []), label])]);
  };

  const setReplacementValue = (label) => {
    if (!label) return;
    setReplacementValueBase(label);
    addCustomReplacementLabel(label);
    setReplacementOptions((opts) => [...new Set([...(opts || []), label])]);
  };

  return (
    <LabelsContext.Provider
      value={{
        labelsToReplace,
        replacementValue,
        replacementOptions,
        setLabelsToReplace,
        setReplacementValue,
        addCustomReplacementLabel,
        error: error?.message,
        isLoading,
      }}
    >
      {children}
    </LabelsContext.Provider>
  );
}

export function useLabels() {
  const context = useContext(LabelsContext);
  if (!context) {
    throw new Error("useLabels must be used within a LabelsProvider");
  }
  return context;
}

const LOCAL_STORAGE_KEY = "wm:replacementLabels";

function getInitialCustomLabels() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
