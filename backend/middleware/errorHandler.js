const errorHandler = (
  err,
  req,
  res,
  next
) => {
  console.error("=================================");
  console.error("SERVER ERROR");
  console.error("=================================");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error."
        : err.message || "Something went wrong.",
  });
};

module.exports = errorHandler;