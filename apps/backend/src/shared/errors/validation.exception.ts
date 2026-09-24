import { ValidationError } from 'class-validator';
import { AppException } from './app-exception';

/**
 * Flattens class-validator's (possibly nested, for @ValidateNested()) error
 * tree into a flat `{ "field.path": ["message", ...] }` map — the shape the
 * spec's VALIDATION_ERROR `details` field expects.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints && Object.keys(error.constraints).length > 0) {
      details[path] = Object.values(error.constraints);
    }

    if (error.children?.length) {
      Object.assign(details, flattenValidationErrors(error.children, path));
    }
  }

  return details;
}

/**
 * Thrown from the global ValidationPipe's exceptionFactory so class-validator
 * failures surface through AppExceptionFilter as `errorCode: 'VALIDATION_ERROR'`
 * with a readable `message` and field-level `details`, matching the spec's
 * error catalog — instead of Nest's default `errorCode: 'HTTP_EXCEPTION'`
 * with `message` as an unstructured array and `details` lost.
 */
export class ValidationException extends AppException {
  constructor(errors: ValidationError[]) {
    const details = flattenValidationErrors(errors);
    const message =
      Object.values(details).flat().join('; ') || 'Validation failed';
    super('VALIDATION_ERROR', message, 400, details);
  }
}
