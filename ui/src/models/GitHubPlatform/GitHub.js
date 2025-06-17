import { formatErrorMessage } from "../../lib/fetch.js";
import { parseWorkflowPath, transformWorkflow } from "./lib/helpers.js";
import { useRepos } from "@/pages/providers/ReposContext.jsx";

export const getOrganisations = async (options) => {
  const res = await fetch(`/api/orgs`, options);

  if (!res.ok) throw new Error(formatErrorMessage(res));

  return await res.json();
};

export const getRepositories = async (owner, options) => {
  const res = await fetch(`/api/orgs/${owner}/repos`, options);

  if (!res.ok) throw new Error(formatErrorMessage(res));

  return await res.json();
};

export const cloneRepository = async (owner, repo, options) => {
  const res = await fetch(
    `/api/orgs/${owner}/repos/${repo}/fetch-workflows`,
    options,
  );

  if (!res.ok) throw new Error(formatErrorMessage(res));

  return await res.json();
};

export const useWorkflowsFetcher = () => {
  const { branches } = useRepos();
  return async (owner, repo, options = {}) => {
    const endpoint = `/api/orgs/${owner}/repos/${repo}/workflows`;

    const res = await fetch(endpoint, options);
    if (!res.ok) throw new Error(formatErrorMessage(res));

    const raw = await res.json();

    return raw.map((file) => transformWorkflow(file, branches));
  };
};

export const submitWorkflows = async (content, options = {}) => {
  const res = await fetch("/api/workflows", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(content),
    ...options,
  });

  if (!res.ok) throw new Error(formatErrorMessage(res));

  return await res.json();
};

export const getRunsOnLabels = async (options) => {
  const res = await fetch("/api/runs-on-labels", options);

  if (!res.ok) throw new Error(formatErrorMessage(res));

  return await res.json();
};

export const getUser = async (options) => {
  const res = fetch("/api/user", options);

  if (!res.ok) throw new Error(formatErrorMessage(res));

  return await res.json();
};
