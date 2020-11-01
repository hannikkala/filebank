import config from "../../../config/config";
config.set('storage.enabled', 's3');
config.set("storage.s3.endpoint", "http://localhost:4566");
config.set("storage.s3.clientOptions.credentials.accessKeyId", "test");
config.set("storage.s3.clientOptions.credentials.secretAccessKey", "test");

import { File, Directory } from "../../../models";
import transportFactory from '../../../transport/factory';
import {
  truncateS3,
  deleteDirectory, deleteFile,
  expectStatus,
  expectStatus200, fileVerifyS3,
  postDirectoryRequest,
  postFileRequest, deleteS3Bucket
} from "../../helpers";
import { S3Storage } from "../../../transport/s3";

beforeAll(async () => {
  const s3Storage: S3Storage = transportFactory.getInstance() as S3Storage;
  return new Promise((resolve) => {
    s3Storage.on('initialized', () => {
      resolve();
    });
  });
});

beforeEach(async () => {
  await File.deleteMany({}).exec();
  await Directory.deleteMany({}).exec();
});

afterEach(async () => {
  await truncateS3();
});

afterAll(async () => {
  await deleteS3Bucket();
});

describe('Directory S3 API route DELETE route', () => {
  it('can delete directory on fs root', async () => {
    const res = await postDirectoryRequest("/", "deletethis");
    expectStatus200(res);
    expect(res.body.refId.startsWith('deletethis')).toEqual(true);
    expect(res.body.type).toEqual('directory');

    const res2 = await deleteDirectory("/deletethis");
    expectStatus(res2, 204);

    expect(await fileVerifyS3('deletethis')).toEqual(false);
  });

  it('cannot delete non-existing directory', async () => {
    const res2 = await deleteDirectory("/nonexisting");
    expectStatus(res2, 404);

    expect(await fileVerifyS3('nonexisting')).toEqual(false);
  });

  it('can delete file on fs root', async () => {
    const res = await postFileRequest("/", `${__dirname}/../../resources/64-64.jpg`);
    expectStatus200(res);

    expect(await fileVerifyS3('64-64.jpg')).toEqual(true);

    const res2 = await deleteFile('/64-64.jpg');
    expectStatus(res2, 204);

    expect(await fileVerifyS3('64-64.jpg')).toEqual(false);
  });

  it('cannot delete non-existing file', async () => {
    const res = await deleteFile('/nonexisting.jpg');
    expectStatus(res, 404);

    expect(await fileVerifyS3('nonexisting.jpg')).toEqual(false);
  });
});
