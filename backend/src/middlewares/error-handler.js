export const notFoundHandler = (request, response) => {
  response.status(404).json({
    error: 'Route not found',
    path: request.originalUrl,
  });
};

export const errorHandler = (error, _request, response, _next) => {
  if (error.statusCode && error.expose) {
    response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ error: { code: 'PDF_TOO_LARGE', message: 'O PDF excede o limite configurado.' } });
    return;
  }
  console.error(error);
  response.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : 'Internal server error',
  });
};
