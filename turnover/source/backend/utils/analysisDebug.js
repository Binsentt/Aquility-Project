export function createAnalysisDebugLogger(enabled = false) {
  if (!enabled) return null;
  return (stage, details = {}) => {
    console.info(JSON.stringify({ event: 'analysis-debug', stage, ...details }));
  };
}
