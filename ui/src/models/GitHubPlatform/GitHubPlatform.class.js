import Platform from "../Platform/Platform.class.js";
import * as github from "./GitHub.js";
import { useWorkflowsFetcher } from "./GitHub.js";

class GitHub extends Platform {
  constructor() {
    super({
      platform: "github",
      displayName: "GitHub",
    });
  }

  useWorkflowsFetcher = github.useWorkflowsFetcher;
  getOrganisations = github.getOrganisations;
  getRepositories = github.getRepositories;
  cloneRepository = github.cloneRepository;
  getLabelReplacementOptions = github.getRunsOnLabels;
  submitWorkflows = github.submitWorkflows;
}

export const GitHubInstance = new GitHub();
