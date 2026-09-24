import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AppException } from './app-exception';
import { AppExceptionFilter } from './app-exception.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

function createMockArgumentsHost(): {
  host: ArgumentsHost;
  response: MockResponse;
} {
  const response: MockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;

  beforeEach(() => {
    filter = new AppExceptionFilter();
  });

  it('should serialize an AppException with errorCode and details', () => {
    const exception = new AppException(
      'DUPLICATE_EMAIL',
      'Email already in use',
      409,
      { field: 'email' },
    );
    const { host, response } = createMockArgumentsHost();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 409,
      errorCode: 'DUPLICATE_EMAIL',
      message: 'Email already in use',
      details: { field: 'email' },
    });
  });

  it('should fall back to a generic errorCode for a standard Nest HttpException', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    const { host, response } = createMockArgumentsHost();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 403,
      errorCode: 'HTTP_EXCEPTION',
      message: 'Forbidden',
      details: undefined,
    });
  });

  it('should map an unknown thrown error to a 500 with a generic error code', () => {
    const exception = new Error('boom');
    const { host, response } = createMockArgumentsHost();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      errorCode: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      details: undefined,
    });
  });
});
