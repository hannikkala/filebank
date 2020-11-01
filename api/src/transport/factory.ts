import { FileStorage } from '../index';
import config from '../config/config';
import { FilesystemStorage } from './filesystem';
import { S3Storage } from "./s3";
import { FilesystemStorageOptions } from "../config";

export let storage: FileStorage;
const storageConfig = config.get("storage");

export default {
  getInstance: (): FileStorage => {
    if (storage) return storage;
    switch (storageConfig.enabled) {
      case 'filesystem':
        storage = new FilesystemStorage((storageConfig.filesystem as FilesystemStorageOptions).rootDir);
        return storage;
      case 's3':
        storage = new S3Storage(storageConfig.s3);
        return storage;
    }
    throw new Error(`Factory method failed. No require for storage ${storageConfig.enabled}`);
  },
};
