import * as _ from 'lodash';

export interface FilesystemStorageOptions {
  rootDir: string;
}

export interface S3StorageOptions {
  clientOptions: {
    credentials: {
      accessKeyId: string,
      secretAccessKey: string,
    },
    region: string;
  };
  bucket: string;
}

export const config = {
  storage: {
    enabled: process.env.STORAGE_ENABLED || 'filesystem',
    filesystem: {
      rootDir: process.env.FILESYSTEM_STORAGE_ROOT || '/tmp/filebank',
    } as FilesystemStorageOptions,
    s3: {
      clientOptions: {
        credentials: {
          accessKeyId: process.env.S3_STORAGE_ACCESS_KEY || '',
          secretAccessKey: process.env.S3_STORAGE_SECRET_KEY || '',
        },
        region: process.env.S3_STORAGE_REGION || 'eu-west-1',
      },
      bucket: process.env.S3_STORAGE_BUCKET || 'filebank',
    } as S3StorageOptions,
  },
  schemaRequired: !!process.env.SCHEMA_REQUIRED,
  jwtKey: process.env.JWT_KEY || 'v3rys3cr3tK3y',
  authz: {
    enabled: JSON.parse(process.env.JWT_ENABLED || 'true'),
    readScope: _.split(process.env.JWT_READ_SCOPE || 'filebank:read', ','),
    writeScope: _.split(process.env.JWT_WRITE_SCOPE || 'filebank:write', ','),
    deleteScope: _.split(process.env.JWT_DELETE_SCOPE || 'filebank:delete', ','),
  },
  mongoDbUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/filebank',
};
