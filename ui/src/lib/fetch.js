export const formatErrorMessage = (error) => {
  if (!error || !error.status || !error.statusText) {
    return 'An unknown error occurred';
  }
  return `${error.status} - ${error.statusText}`;
};
