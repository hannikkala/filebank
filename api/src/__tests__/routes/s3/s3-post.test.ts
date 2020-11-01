import config from "../../../config/config";
config.set('storage.enabled', 's3');

import { S3Storage } from "../../../transport/s3";
import { File, Directory } from "../../../models";
import { truncateS3, expectStatus, expectStatus200, fileVerifyS3, postDirectoryRequest, postFileRequest, deleteS3Bucket } from "../../helpers";
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

describe('Directory S3 API route POST route', () => {
  it('can create directory on fs root', async () => {
    const res = await postDirectoryRequest("/", "test-1");
    expect(res.body.refId.startsWith('test-1')).toBeTruthy();
    expect(res.body.type).toEqual('directory');
    expect(await fileVerifyS3('test-1')).toEqual(true);
  });

  it('can create directory on subdir', async () => {
    const res = await postDirectoryRequest("/", "test-2");
    expect(res.body.refId.startsWith('test-2')).toBe(true);
    expect(res.body.type).toEqual('directory');

    const res2 = await postDirectoryRequest("/test-2", "test-3");
    expect(res2.body.refId.startsWith('test-2/test-3')).toBe(true);
    expect(res2.body.type).toEqual('directory');
    expect(res2.body.parent).toEqual(res.body._id);

    expect(await fileVerifyS3('test-2', 'test-3')).toEqual(true);
  });

  it('cannot create directory with invalid metadata', async () => {
    const res = await postDirectoryRequest("/", "faildir", "Test",{
      deepMeta: { thing: 'this should be number', another: 2, third: false },
      metaField: 'nottrue',
    });
    expectStatus(res, 400);
    expect(await fileVerifyS3("faildir")).toEqual(false);
  });

  it('can create file on root dir', async () => {
    const metadata = {
      deepMeta: { thing: 1, another: 2, third: 'third' },
      metaField: true,
    };
    const res = await postFileRequest("/", `${__dirname}/../../resources/fire.jpg`, "Test", metadata);
    expectStatus200(res);
    expect(res.body.mimetype).toEqual('image/jpeg');
    expect(res.body.refId.startsWith('fire.jpg')).toBe(true);
    expect(res.body.type).toEqual('file');
    expect(res.body.metadata).toEqual(metadata);
    expect(res.body.metadata.deepMeta.another).toEqual(2);
    expect(await fileVerifyS3('fire.jpg')).toEqual(true);
  });

  it('can create file on sub dir', async () => {
    const res = await postDirectoryRequest("/", "test-4");
    expectStatus200(res);
    expect(res.body.refId.startsWith('test-4')).toEqual(true);
    expect(res.body.type).toEqual('directory');

    const metadata = {
      deepMeta: { thing: 1, another: 2, third: 'third' },
      metaField: true,
    };
    const res2 = await postFileRequest("/test-4", `${__dirname}/../../resources/fire.pdf`, "Test", metadata);
    expectStatus200(res2);
    expect(res2.body.mimetype).toEqual('application/pdf');
    expect(res2.body.refId.startsWith('test-4/fire.pdf')).toEqual(true);
    expect(res2.body.type).toEqual('file');
    expect(res2.body.metadata).toEqual(metadata);
    expect(res2.body.metadata.deepMeta.third).toEqual('third');

    expect(await fileVerifyS3('test-4', 'fire.pdf')).toEqual(true);
  });

  it('can create file with different name', async () => {
    const metadata = {
      deepMeta: { thing: 1, another: 2, third: 'third' },
      metaField: true,
    };
    const res = await postFileRequest("/", `${__dirname}/../../resources/fire.jpg`, "Test", metadata, "another-fire.jpg");
    expectStatus200(res);

    expect(res.body.mimetype).toEqual('image/jpeg');
    expect(res.body.refId.startsWith('another-fire.jpg')).toEqual(true);
    expect(res.body.type).toEqual('file');
    expect(res.body.metadata.deepMeta.another).toEqual(2);

    expect(await fileVerifyS3("another-fire.jpg")).toEqual(true);
  });

  it('cannot create file when schema is missing and required', async () => {
    config.set("schemaRequired", true);
    try {
      const res = await postFileRequest("/", `${__dirname}/../../resources/fire.pdf`);
      expectStatus(res, 400);
      expect(await fileVerifyS3('fire.pdf')).toEqual(false);
    } finally {
      config.set("schemaRequired", false);
    }
  });

  it('cannot create directory when schema is missing and required', async () => {
    config.set("schemaRequired", true);
    try {
      const res = await postDirectoryRequest("/", "faildir", "",{
        deepMeta: { thing: 1, another: 2, third: 'third' },
        metaField: true,
      });
      expectStatus(res, 400);
    } finally {
      config.set("schemaRequired", false);
    }
  });
});
