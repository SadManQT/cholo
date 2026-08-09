import { AppError } from '../utils/AppError.js';

function formatIssues(issues, source) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || source,
    issue: issue.message,
  }));
}

export const validate = (schema, source = 'body') => (request, _response, next) => {
  const result = schema.safeParse(request[source]);

  if (!result.success) {
    return next(
      new AppError(
        422,
        'VALIDATION_FAILED',
        formatIssues(result.error.issues, source),
      ),
    );
  }

  request[source] = result.data;
  return next();
};
