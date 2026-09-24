import { ValidationError } from 'class-validator';
import { AppException } from './app-exception';
import {
  flattenValidationErrors,
  ValidationException,
} from './validation.exception';

function makeError(
  property: string,
  constraints: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError {
  const error = new ValidationError();
  error.property = property;
  error.constraints = constraints;
  error.children = children;
  return error;
}

describe('flattenValidationErrors', () => {
  it('should map a flat set of constraint failures to a field -> messages record', () => {
    const errors = [
      makeError('email', { isEmail: 'email must be an email' }),
      makeError('password', {
        minLength: 'password must be longer than 8 characters',
      }),
    ];

    expect(flattenValidationErrors(errors)).toEqual({
      email: ['email must be an email'],
      password: ['password must be longer than 8 characters'],
    });
  });

  it('should collect multiple constraint messages for the same field', () => {
    const errors = [
      makeError('password', {
        minLength: 'password must be longer than 8 characters',
        isString: 'password must be a string',
      }),
    ];

    expect(flattenValidationErrors(errors).password).toEqual([
      'password must be longer than 8 characters',
      'password must be a string',
    ]);
  });

  it('should flatten nested @ValidateNested() children under a dotted path', () => {
    const errors = [
      makeError('slots', {}, [
        makeError('0', {}, [
          makeError('startTime', {
            matches: 'startTime must match /^([01]\\d|2[0-3]):[0-5]\\d$/',
          }),
        ]),
      ]),
    ];

    expect(flattenValidationErrors(errors)).toEqual({
      'slots.0.startTime': [
        'startTime must match /^([01]\\d|2[0-3]):[0-5]\\d$/',
      ],
    });
  });
});

describe('ValidationException', () => {
  it('should be an AppException with errorCode VALIDATION_ERROR and status 400', () => {
    const exception = new ValidationException([
      makeError('email', { isEmail: 'email must be an email' }),
    ]);

    expect(exception).toBeInstanceOf(AppException);
    expect(exception.errorCode).toBe('VALIDATION_ERROR');
    expect(exception.getStatus()).toBe(400);
  });

  it('should build a readable message joining every field-level constraint message', () => {
    const exception = new ValidationException([
      makeError('email', { isEmail: 'email must be an email' }),
      makeError('password', {
        minLength: 'password must be longer than 8 characters',
      }),
    ]);

    expect(exception.message).toBe(
      'email must be an email; password must be longer than 8 characters',
    );
  });

  it('should carry the field-level details record for API clients', () => {
    const exception = new ValidationException([
      makeError('email', { isEmail: 'email must be an email' }),
    ]);

    expect(exception.details).toEqual({
      email: ['email must be an email'],
    });
  });

  it('should fall back to a generic message when there are no constraint messages', () => {
    const exception = new ValidationException([]);

    expect(exception.message).toBe('Validation failed');
    expect(exception.details).toEqual({});
  });
});
