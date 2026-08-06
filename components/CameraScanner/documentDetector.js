export function createDocumentDetector({ stabilizationMs = 900, cooldownMs = 2500 } = {}) {
  let stableSince = null;
  let lastCaptureAt = null;

  const reset = () => {
    stableSince = null;
  };

  const markCaptured = (now = Date.now()) => {
    lastCaptureAt = now;
    stableSince = null;
  };

  const observe = ({ isAligned, now = Date.now() } = {}) => {
    if (!isAligned) {
      stableSince = null;
      return { shouldCapture: false, detected: false, confidence: 0 };
    }

    if (lastCaptureAt && now - lastCaptureAt < cooldownMs) {
      return { shouldCapture: false, detected: false, confidence: 0 };
    }

    if (stableSince === null) {
      stableSince = now;
      return { shouldCapture: false, detected: false, confidence: 0.35 };
    }

    const elapsed = now - stableSince;
    if (elapsed < stabilizationMs) {
      return {
        shouldCapture: false,
        detected: false,
        confidence: Math.min(0.9, 0.35 + elapsed / stabilizationMs * 0.55),
      };
    }

    stableSince = null;
    return { shouldCapture: true, detected: true, confidence: 1 };
  };

  return { observe, reset, markCaptured };
}
