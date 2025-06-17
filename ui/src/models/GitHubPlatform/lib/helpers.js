import { useWorkflows } from "@/pages/providers/WorkflowsContext.jsx";

export const parseWorkflowPath = (input, repoBranches) => {
  const parts = input.split("/");
  if (parts.length < 4) throw new Error("Invalid path format");

  const [organisation, repository, ...rest] = parts;
  const repoKey = `${organisation}/${repository}`;

  const branches = repoBranches?.[repository];
  if (!branches) {
    throw new Error(`No branches found for ${repoKey}`);
  }

  for (let i = 1; i <= rest.length; i++) {
    const maybeBranch = rest.slice(0, i).join("/");

    if (branches.includes(maybeBranch)) {
      return {
        organisation,
        repository,
        branch: maybeBranch,
        workflowPath: rest.slice(i).join("/"),
        originalPath: input,
      };
    }
  }

  throw new Error(
    `Could not resolve branch from path: ${input}. Try to clear local repo storage.`,
  );
};

export const getBranchPath = ({ organisation, repository, branch }) => {
  if (!organisation || !repository || !branch) {
    throw new Error("Organisation, repository, and branch are required");
  }

  return `${organisation}/${repository}/${branch}`;
};

export const transformWorkflow = (file, repoBranches) => {
  return {
    ...parseWorkflowPath(file.path, repoBranches),
    labels: file["runs-on"],
    content: atob(file.content),
  };
};

export function extractRepoFromPath(path, organisation) {
  const parts = path.split("/");

  const orgIndex = parts.indexOf(organisation);
  if (orgIndex === -1 || orgIndex + 1 >= parts.length) return null;

  return parts[orgIndex + 1]; // repo follows org
}

/**
 * Returns the full branch path (org/repo/branch) for a given workflow path.
 * @param {string} originalPath
 * @returns {string | null}
 */
export function useBranchPathByWorkflowPath() {
  const { workflows } = useWorkflows();

  return (originalPath) => {
    if (!workflows || !originalPath) return null;

    for (const result of Object.values(workflows)) {
      const items = result?.data || [];
      for (const item of items) {
        if (item.originalPath === originalPath) {
          return `${item.organisation}/${item.repository}/${item.branch}`;
        }
      }
    }

    return null;
  };
}
