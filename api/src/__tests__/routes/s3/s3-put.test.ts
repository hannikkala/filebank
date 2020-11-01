import config from "../../../config/config";
config.set('storage.enabled', 's3');

import { S3Storage } from "../../../transport/s3";
import { File, Directory } from "../../../models";
import {
  truncateS3,
  expectStatus,
  expectStatus200,
  fileVerifyS3,
  moveDirectory,
  moveFile,
  postDirectoryRequest,
  postFileRequest,
  deleteS3Bucket
} from "../../helpers";
import transportFactory from "../../../transport/factory";
import mongoose from "mongoose";

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

describe('Directory S3 API route PUT route', () => {
  it('can move file', async () => {
    const res = await postFileRequest("/", `${__dirname}/../../resources/64-64.jpg`, "", {}, "moveme.jpg");
    expectStatus200(res);
    expect(await fileVerifyS3('moveme.jpg')).toEqual(true);

    const res2 = await postDirectoryRequest("/", "movehere");
    expectStatus200(res2);
    expect(res2.body.refId.startsWith('movehere')).toEqual(true);
    expect(res2.body.type).toEqual('directory');

    const res3 = await moveFile("/moveme.jpg", "/movehere");
    expectStatus200(res3)
    expect(res3.body.refId.startsWith('movehere/moveme.jpg')).toEqual(true);
    expect(res3.body.type).toEqual('file');

    expect(await fileVerifyS3('movehere', 'moveme.jpg')).toEqual(true);
  });

  it('cannot move file to nonexisting directory', async () => {
    const res = await postFileRequest("/", `${__dirname}/../../resources/64-64.jpg`, "", {}, "moveme2.jpg");
    expectStatus200(res);
    expect(await fileVerifyS3('moveme2.jpg')).toEqual(true);

    const res2 = await moveFile("/moveme2.jpg", "/movehere");
    expectStatus(res2, 404);
    expect(await fileVerifyS3('movehere', 'moveme2.jpg')).toEqual(false);
  });

  it('can move directory', async () => {
    const res = await postDirectoryRequest("/", "movethisdir");
    expectStatus200(res);
    expect(res.body.refId.startsWith('movethisdir')).toEqual(true);
    expect(res.body.type).toEqual('directory');

    const res2 = await postDirectoryRequest("/", "moveheredir");
    expectStatus200(res2);
    expect(res2.body.refId.startsWith('moveheredir')).toEqual(true);
    expect(res2.body.type).toEqual('directory');

    const res3 = await postFileRequest("/movethisdir", `${__dirname}/../../resources/64-64.jpg`, "", {}, "moveme.jpg");
    expectStatus200(res3);
    expect(await fileVerifyS3('movethisdir', 'moveme.jpg')).toEqual(true);

    const res4 = await moveDirectory("/movethisdir", "/moveheredir");
    expectStatus200(res4);
    expect(res4.body.refId.startsWith('moveheredir/movethisdir')).toEqual(true);
    expect(res4.body.type).toEqual('directory');

    expect(await fileVerifyS3('moveheredir', 'movethisdir')).toEqual(true);
  });

  it('can rename directory', async () => {
    const res = await postDirectoryRequest("/", "movethisdir1");
    expectStatus200(res);
    expect(res.body.refId.startsWith('movethisdir1')).toEqual(true);
    expect(res.body.type).toEqual('directory');

    const res2 = await postFileRequest("/movethisdir1", `${__dirname}/../../resources/64-64.jpg`, "", {}, "moveme.jpg");
    expectStatus200(res2);
    expect(await fileVerifyS3('movethisdir1', 'moveme.jpg')).toEqual(true);

    const res3 = await moveDirectory("/movethisdir1", "/moveheredir1");
    expectStatus200(res3);
    expect(res3.body.refId.startsWith('moveheredir1')).toEqual(true);
    expect(res3.body.type).toEqual('directory');

    expect(await fileVerifyS3('moveheredir1')).toEqual(true);
  });
});
