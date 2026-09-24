export interface SavedPhoto {
  url: string;
  thumbnailUrl: string;
}

export interface SavedLogo {
  url: string;
}

export interface StorageService {
  savePhoto(buffer: Buffer, userId: string): Promise<SavedPhoto>;
  saveLogo(buffer: Buffer, trainerId: string): Promise<SavedLogo>;
  delete(url: string): Promise<void>;
}

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');
