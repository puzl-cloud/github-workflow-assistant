import { createContext, useContext, useState } from "react";
import { GitHubInstance } from "../models/GitHubPlatform/GitHubPlatform.class.js";

const PlatformContext = createContext();

export const PlatformProvider = ({ children }) => {
  const [organisation, setOrganisation] = useState(null);

  const platformInstance = GitHubInstance;

  const api = {
    organisation,
    setOrganisation,
    getOrganisations: platformInstance.getOrganisations,
    getRepositories: platformInstance.getRepositories,
    cloneRepository: platformInstance.cloneRepository,
    useWorkflowsFetcher: platformInstance.useWorkflowsFetcher,
    getLabelReplacementOptions: platformInstance.getLabelReplacementOptions,
    submitWorkflows: platformInstance.submitWorkflows,
  };

  return (
    <PlatformContext.Provider value={api}>{children}</PlatformContext.Provider>
  );
};

export const usePlatformContext = () => useContext(PlatformContext);
