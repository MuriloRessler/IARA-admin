export const notFoundHandler = (request, response) => {
  response.status(404).json({
    error: 'Route not found',
    path: request.originalUrl,
  });
};

export const errorHandler = (error, _request, response, _next) => {
  console.error(error);
  response.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : 'Internal server error',
  });
};
