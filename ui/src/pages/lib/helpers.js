export const groupWorkflows = (workflows) => {
  return workflows?.reduce((acc, item) => {
    const { branch, workflowPath } = item;

    if (!acc[branch]) {
      acc[branch] = {};
    }

    acc[branch][workflowPath] = item;

    return acc;
  }, {});
};
