import { AppException } from '../errors/app-exception';

const writeFileMock = jest.fn().mockResolvedValue(undefined);
const mkdirMock = jest.fn().mockResolvedValue(undefined);
const unlinkMock = jest.fn().mockResolvedValue(undefined);

jest.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]): unknown => writeFileMock(...args),
  mkdir: (...args: unknown[]): unknown => mkdirMock(...args),
  unlink: (...args: unknown[]): unknown => unlinkMock(...args),
}));

const toBufferMock = jest.fn().mockResolvedValue(Buffer.from('thumb'));
const resizeMock = jest.fn().mockReturnThis();
const metadataMock = jest.fn().mockResolvedValue({ width: 100, height: 100 });
const sharpMock = jest.fn(() => ({
  resize: resizeMock,
  toBuffer: toBufferMock,
  metadata: metadataMock,
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: (...args: unknown[]) => sharpMock(...args),
}));

// Import after mocks are registered.
import { LocalDiskStorage } from './local-disk.storage';

const PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const SVG_BUFFER = Buffer.from(
  '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
);

describe('LocalDiskStorage', () => {
  let storage: LocalDiskStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    writeFileMock.mockResolvedValue(undefined);
    mkdirMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
    toBufferMock.mockResolvedValue(Buffer.from('thumb'));
    metadataMock.mockResolvedValue({ width: 100, height: 100 });
    storage = new LocalDiskStorage();
  });

  describe('saveLogo', () => {
    it('should reject an SVG file even when mislabeled as an image type', async () => {
      await expect(storage.saveLogo(SVG_BUFFER, 'trainer-1')).rejects.toThrow(
        AppException,
      );
      expect(writeFileMock).not.toHaveBeenCalled();
    });

    it('should reject a non-image buffer', async () => {
      await expect(
        storage.saveLogo(Buffer.from('not an image'), 'trainer-1'),
      ).rejects.toThrow(AppException);
    });

    it('should save a valid PNG logo and return its url', async () => {
      const result = await storage.saveLogo(PNG_BUFFER, 'trainer-1');
      expect(result.url).toContain('trainer-1');
      expect(writeFileMock).toHaveBeenCalled();
    });

    it('should leave a logo smaller than 200x200 unresized (never upscale)', async () => {
      metadataMock.mockResolvedValue({ width: 100, height: 80 });

      await storage.saveLogo(PNG_BUFFER, 'trainer-1');

      expect(resizeMock).not.toHaveBeenCalled();
      const [, writtenBuffer] = writeFileMock.mock.calls[0] as [string, Buffer];
      expect(writtenBuffer).toBe(PNG_BUFFER);
    });

    it('should resize a logo larger than 200x200 down to 200x200 via sharp', async () => {
      metadataMock.mockResolvedValue({ width: 4000, height: 3000 });
      toBufferMock.mockResolvedValue(Buffer.from('resized-logo'));

      const result = await storage.saveLogo(PNG_BUFFER, 'trainer-1');

      expect(sharpMock).toHaveBeenCalledWith(PNG_BUFFER);
      expect(resizeMock).toHaveBeenCalledWith(
        200,
        200,
        expect.objectContaining({ withoutEnlargement: true }),
      );
      const [, writtenBuffer] = writeFileMock.mock.calls[0] as [string, Buffer];
      expect(writtenBuffer).toEqual(Buffer.from('resized-logo'));
      expect(result.url).toContain('trainer-1');
    });

    it('should resize when only one dimension exceeds 200px', async () => {
      metadataMock.mockResolvedValue({ width: 200, height: 900 });

      await storage.saveLogo(PNG_BUFFER, 'trainer-1');

      expect(resizeMock).toHaveBeenCalled();
    });
  });

  describe('savePhoto', () => {
    it('should generate a thumbnail via sharp and return both urls', async () => {
      const result = await storage.savePhoto(PNG_BUFFER, 'user-1');
      expect(result.url).toContain('user-1');
      expect(result.thumbnailUrl).toContain('user-1');
      expect(sharpMock).toHaveBeenCalled();
      expect(resizeMock).toHaveBeenCalled();
      expect(writeFileMock).toHaveBeenCalledTimes(2);
    });

    it('should reject a non-PNG/JPG buffer', async () => {
      await expect(storage.savePhoto(SVG_BUFFER, 'user-1')).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('delete', () => {
    it('should be idempotent when the file does not exist', async () => {
      const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' });
      unlinkMock.mockRejectedValueOnce(enoent);

      await expect(
        storage.delete('/uploads/missing.png'),
      ).resolves.toBeUndefined();
    });

    it('should delete an existing file', async () => {
      await storage.delete('/uploads/existing.png');
      expect(unlinkMock).toHaveBeenCalled();
    });
  });
});
