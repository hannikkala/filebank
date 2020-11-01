import config from "../../../config/config";
config.set('storage.enabled', 's3');

import { S3Storage } from "../../../transport/s3";
import { File, Directory } from "../../../models";
import fs from 'fs';
import { createDirectory, createFile, truncateS3, expectStatus, getRequest, listRequest, postFileRequest, deleteS3Bucket } from "../../helpers";
import transportFactory from "../../../transport/factory";
import * as mongoose from "mongoose";

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
  await Promise.all(mongoose.connections.map(conn => conn.close()));
});

describe('Directory S3 API route GET route', () => {
  it('can list items in root directory', async () => {
    await Promise.all([
      createDirectory({ name: 'test', refId: 'test' }),
      createDirectory({ name: 'test2', refId: 'test2' }),
      createDirectory({ name: 'test3', refId: 'test3' }),
      createFile({ name: 'test.txt', refId: 'test.txt', mimetype: 'application/octet-stream' }),
      createFile({ name: 'test2.txt', refId: 'test2.txt', mimetype: 'application/octet-stream' }),
      createFile({ name: 'test3.txt', refId: 'test3.txt', mimetype: 'application/octet-stream' }),
    ]);
    const res = await listRequest('/');
    expect(res.body.length).toEqual(6);
  });

  it('can list items in subdirectory', async () => {
    const directory = await createDirectory({ name: 'subdir', refId: 'subdir' });
    await Promise.all([
      createDirectory({ name: 'test', refId: 'test', parent: directory._id }),
      createDirectory({ name: 'test2', refId: 'test2', parent: directory._id }),
      createFile({ name: 'test.txt', refId: 'test.txt', mimetype: 'application/octet-stream', directory: directory._id }),
      createFile({ name: 'test2.txt', refId: 'test2.txt', mimetype: 'application/octet-stream', directory: directory._id }),
    ]);
    const res = await listRequest('/subdir');
    expect(res.body.length).toEqual(4);
  });

  it('cannot list items in non-existing directory', async () => {
    const res = await listRequest('/nonexisting');
    expectStatus(res, 404);
  });

  it('can get file content', async () => {
    await postFileRequest('/', `${__dirname}/../../resources/64-64.jpg`);
    const res = await getRequest('/64-64.jpg');
    expect(res.body instanceof Buffer).toBeTruthy();
    const file = fs.readFileSync(`${__dirname}/../../resources/64-64.jpg`);
    expect(res.body.length).toEqual(file.length);
  });
});
