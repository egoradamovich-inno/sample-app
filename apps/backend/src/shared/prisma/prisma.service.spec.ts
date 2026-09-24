import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('should connect on module init and disconnect on module destroy', async () => {
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalled();

    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalled();
  });
});
