import { Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import sharp from 'sharp';
import { AppException } from '../errors/app-exception';
import { sniffImageType } from './image-type.util';
import { SavedLogo, SavedPhoto, StorageService } from './storage.service';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const PHOTO_THUMBNAIL_SIZE = 150;
const LOGO_MAX_DIMENSION = 200;

interface NodeErrnoLike {
  code?: string;
}

@Injectable()
export class LocalDiskStorage implements StorageService {
  async savePhoto(buffer: Buffer, userId: string): Promise<SavedPhoto> {
    const type = this.assertAllowedImage(buffer);
    const dir = join(UPLOAD_ROOT, 'photos');
    await mkdir(dir, { recursive: true });

    const extension = type === 'png' ? 'png' : 'jpg';
    const timestamp = Date.now();
    const filename = `${userId}-${timestamp}.${extension}`;
    const thumbnailFilename = `${userId}-${timestamp}-thumb.${extension}`;

    const thumbnailBuffer = await sharp(buffer)
      .resize(PHOTO_THUMBNAIL_SIZE, PHOTO_THUMBNAIL_SIZE, { fit: 'cover' })
      .toBuffer();

    await writeFile(join(dir, filename), buffer);
    await writeFile(join(dir, thumbnailFilename), thumbnailBuffer);

    return {
      url: `/uploads/photos/${filename}`,
      thumbnailUrl: `/uploads/photos/${thumbnailFilename}`,
    };
  }

  async saveLogo(buffer: Buffer, trainerId: string): Promise<SavedLogo> {
    const type = this.assertAllowedImage(buffer);
    const dir = join(UPLOAD_ROOT, 'branding');
    await mkdir(dir, { recursive: true });

    const extension = type === 'png' ? 'png' : 'jpg';
    const filename = `${trainerId}-${Date.now()}.${extension}`;

    const image = sharp(buffer);
    const metadata = await image.metadata();
    const exceedsRecommendedSize =
      (metadata.width ?? 0) > LOGO_MAX_DIMENSION ||
      (metadata.height ?? 0) > LOGO_MAX_DIMENSION;

    // Never upscale a smaller-than-recommended logo — only shrink oversized
    // ones down to the recommended 200x200 (plan H2).
    const outputBuffer = exceedsRecommendedSize
      ? await image
          .resize(LOGO_MAX_DIMENSION, LOGO_MAX_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer()
      : buffer;

    await writeFile(join(dir, filename), outputBuffer);

    return { url: `/uploads/branding/${filename}` };
  }

  async delete(url: string): Promise<void> {
    const relativePath = url.replace(/^\/?uploads\//, '');
    const fullPath = join(UPLOAD_ROOT, relativePath);
    try {
      await unlink(fullPath);
    } catch (error) {
      if ((error as NodeErrnoLike).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  }

  private assertAllowedImage(buffer: Buffer): 'png' | 'jpeg' {
    const type = sniffImageType(buffer);
    if (type !== 'png' && type !== 'jpeg') {
      throw new AppException(
        'VALIDATION_ERROR',
        'Only PNG or JPG images are allowed',
        400,
        { detectedType: type },
      );
    }
    return type;
  }
}
