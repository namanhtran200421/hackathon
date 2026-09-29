/**
 * The last stops for every request: "not found", and errors. Visitors never
 * see internal error details.
 */

import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFound: RequestHandler = function (_request, response) {
  response.status(404).type("text/plain").send("Page not found.");
};

export const handleErrors: ErrorRequestHandler = function (error, _request, response, _next) {
  let status = 500;
  if (error && (error.status || error.statusCode)) {
    status = error.status || error.statusCode;
  }
  if (status >= 500) {
    console.error(error);
  }
  response.status(status).type("text/plain").send("Something went wrong.");
};
