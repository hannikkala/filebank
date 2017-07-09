import { FileStorage } from '../index';
import { config, FilesystemStorageOptions, S3StorageOptions } from '../config';
import { FilesystemStorage } from './filesystem';
import { S3Storage } from './s3';

let storage: FileStorage;

export = {
  getInstance: (): FileStorage => {
    if (storage) return storage;
    switch (config.storage.enabled) {
      case 'filesystem':
        storage = new FilesystemStorage((config.storage.filesystem as FilesystemStorageOptions).rootDir);
        return storage;
      case 's3':
        storage = new S3Storage((config.storage.s3) as S3StorageOptions);
        return storage;
    }
    throw new Error(`Factory method failed. No require for storage ${config.storage.enabled}`);
  },
};
