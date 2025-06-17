export const isUndef = (value) => typeof value === "undefined";

export const pluralize = (count, singular, plural = `${singular}s`) => {
  return `${count} ${count === 1 ? singular : plural}`;
};

export const decodeBase64 = (base64String) => {
  try {
    return atob(base64String);
  } catch (e) {
    return base64String;
  }
};
