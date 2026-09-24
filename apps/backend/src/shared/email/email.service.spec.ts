import { EmailService } from './email.service';

describe('EmailService', () => {
  it('should log the to/subject/body and resolve', async () => {
    const service = new EmailService();
    const logSpy = jest
      .spyOn(service['logger'], 'log')
      .mockImplementation(() => undefined);

    await expect(
      service.send({
        to: 'parent@example.com',
        subject: 'Verify your email',
        body: 'Click here to verify',
      }),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('parent@example.com'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verify your email'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Click here to verify'),
    );
  });
});
