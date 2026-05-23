const isProd = process.env.NODE_ENV === 'production';

module.exports = function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: isProd && status === 500 ? 'Internal server error' : err.message,
  });
};
