export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} was not found.`,
    },
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const isMulterLimit = error?.name === 'MulterError' && error?.code === 'LIMIT_FILE_SIZE';
  const isBadJson = error?.type === 'entity.parse.failed';
  const isDuplicate = error?.code === '23505';
  const isForeignKey = error?.code === '23503';
  const isDatabaseUnavailable = ['57014', '57P01', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code);
  const status = error instanceof HttpError
    ? error.status
    : isMulterLimit
      ? 413
      : isBadJson
        ? 400
        : isDuplicate || isForeignKey
          ? 409
          : isDatabaseUnavailable
            ? 503
            : 500;
  const code = error instanceof HttpError
    ? error.code
    : isMulterLimit
      ? 'IMAGE_TOO_LARGE'
      : isBadJson
        ? 'INVALID_JSON'
        : isDuplicate
          ? 'DUPLICATE_RESOURCE'
          : isForeignKey
            ? 'RELATED_RESOURCE_CONFLICT'
            : isDatabaseUnavailable
              ? 'DATABASE_UNAVAILABLE'
              : 'INTERNAL_ERROR';
  const message = error instanceof HttpError
    ? error.message
    : isMulterLimit
      ? 'The water-test image exceeds the 10 MB limit.'
      : isBadJson
        ? 'The request body is not valid JSON.'
        : isDuplicate
          ? 'A record with these details already exists.'
          : isForeignKey
            ? 'This action conflicts with related data.'
            : isDatabaseUnavailable
              ? 'The AQUILITY service is temporarily unavailable. Please try again.'
        : 'An unexpected server error occurred.';

  if (status >= 500) {
    console.error(JSON.stringify({ event: 'request-failed', requestId: req.requestId || null, status, code, errorName: error?.name || 'Error' }));
  }

  res.status(status).json({ error: { code, message, requestId: req.requestId || undefined } });
}
