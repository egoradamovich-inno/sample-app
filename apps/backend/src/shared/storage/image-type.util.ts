export type SniffedImageType = 'png' | 'jpeg' | 'svg' | 'unknown';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

/**
 * Content-sniffs the actual bytes of an uploaded file, rather than trusting
 * the declared MIME type / file extension — closes the extension-spoofing
 * gap and explicitly catches SVG (a text format with no fixed binary magic
 * number) even when it's mislabeled as image/png.
 */
export function sniffImageType(buffer: Buffer): SniffedImageType {
  if (
    buffer.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => buffer[index] === byte)
  ) {
    return 'png';
  }

  if (
    buffer.length >= JPEG_SIGNATURE.length &&
    JPEG_SIGNATURE.every((byte, index) => buffer[index] === byte)
  ) {
    return 'jpeg';
  }

  const head = buffer.subarray(0, 512).toString('utf8').toLowerCase();
  if (head.includes('<svg') || head.includes('<?xml')) {
    return 'svg';
  }

  return 'unknown';
}
