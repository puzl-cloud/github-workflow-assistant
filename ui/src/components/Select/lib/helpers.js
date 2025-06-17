export const formatSelectOptions = (arr) => {
  return arr
    ? arr?.map((v) =>
        v?.label
          ? v
          : {
              value: v,
              label: v,
            },
      )
    : [];
};
