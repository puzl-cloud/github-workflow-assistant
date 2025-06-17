export const validateAndFixCustomLabel = (input) => {
  if (typeof input !== "string") {
    return { valid: false, reason: "Label must be a string." };
  }

  let value = input;

  const fixSteps = [
    { name: "trim", apply: (v) => v.trim() },
    { name: "lowercase", apply: (v) => v.toLowerCase() },
    { name: "remove leading hyphen", apply: (v) => v.replace(/^[-]+/, "") },
    { name: "remove trailing hyphen", apply: (v) => v.replace(/[-]+$/, "") },
    { name: "dedupe hyphens", apply: (v) => v.replace(/-{2,}/g, "-") },
  ];

  for (const step of fixSteps) {
    value = step.apply(value);
  }

  // non-fixable validations
  if (value.length === 0) {
    return { valid: false, reason: "Label cannot be empty after cleanup." };
  }

  if (value.length > 64) {
    return { valid: false, reason: "Label must be at most 64 characters." };
  }

  if (!/^[a-z0-9-]+$/.test(value)) {
    return {
      valid: false,
      reason: "Label can only contain lowercase letters, numbers, and hyphens.",
    };
  }

  return value === input
    ? { valid: true, value }
    : {
        valid: true,
        value,
        reason: "Label was auto-corrected.",
      };
};
