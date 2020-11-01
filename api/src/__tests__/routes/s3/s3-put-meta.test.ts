import config from "../../../config/config";
config.set('storage.enabled', 's3');
config.set("storage.s3.endpoint", "http://localhost:4566");
config.set("storage.s3.clientOptions.credentials.accessKeyId", "test");
config.set("storage.s3.clientOptions.credentials.secretAccessKey", "test");

import { S3Storage } from "../../../transport/s3";
import { File, Directory } from "../../../models";
import {
  truncateS3,
  expectStatus,
  expectStatus200,
  postDirectoryRequest,
  postFileRequest,
  putDirectoryRequest,
  putFileMetaRequest, deleteS3Bucket
} from "../../helpers";
import transportFactory from "../../../transport/factory";

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

describe('Directory S3 API route PUT meta route', () => {
    it('can update metadata for directory', async () => {
      const res = await postDirectoryRequest("/", "metadir", "Test", {
        deepMeta: { thing: 1, another: 2, third: 'third' },
        metaField: true,
      });
      expectStatus200(res);
      expect(res.body.refId.startsWith('metadir')).toEqual(true);
      expect(res.body.type).toEqual('directory');

      const res2 = await putDirectoryRequest(`/${res.body._id}.meta`, "Test", {
        deepMeta: { thing: 2, another: 4, third: 'fourth' },
        metaField: false
      });
      expectStatus200(res);
      expect(res2.body.metadata.metaField).toEqual(false);
      expect(res2.body.metadata.deepMeta.thing).toEqual(2);
      expect(res2.body.metadata.deepMeta.another).toEqual(4);
      expect(res2.body.metadata.deepMeta.third).toEqual('fourth');
    });

    it('cannot update invalid metadata for directory', async () => {
      const res = await postDirectoryRequest("/", "metadir-2", "Test", {
        deepMeta: { thing: 1, another: 2, third: 'third' },
        metaField: true,
      });
      expectStatus200(res);
      expect(res.body.refId.startsWith('metadir-2')).toEqual(true);
      expect(res.body.type).toEqual('directory');

      const res2 = await putDirectoryRequest(`/${res.body._id}.meta`, "Test", {
        deepMeta: { thing: 'should be number', another: 4, third: false },
        metaField: 'should be boolean'
      });
      expectStatus(res2, 400);
    });

    it('can update file metadata', async () => {
      const res = await postFileRequest("/", `${__dirname}/../../resources/fire.pdf`, "Test", {
        deepMeta: { thing: 1, another: 2, third: 'third' },
        metaField: true,
      }, "meta.pdf");
      expectStatus200(res);

      const res2 = await putFileMetaRequest(`/${res.body._id}.meta`, "Test", {
        deepMeta: { thing: 2, another: 4, third: 'fourth' },
        metaField: false
      });
      expectStatus200(res2);
      expect(res2.body.metadata.metaField).toEqual(false);
      expect(res2.body.metadata.deepMeta.thing).toEqual(2);
      expect(res2.body.metadata.deepMeta.another).toEqual(4);
      expect(res2.body.metadata.deepMeta.third).toEqual('fourth');
    });

    it('cannot update file with invalid metadata', async () => {
      const res = await postFileRequest("/", `${__dirname}/../../resources/fire.pdf`, "Test", {
        deepMeta: { thing: 1, another: 2, third: 'third' },
        metaField: true,
      }, "meta.pdf");
      expectStatus200(res);

      const res2 = await putFileMetaRequest(`/${res.body._id}.meta`, "Test", {
        deepMeta: { thing: 'should be number', another: 4, third: 'fourth' },
        metaField: 'should be boolean'
      });
      expectStatus(res2, 400);
    });

    it('cannot update metadata non-existing item', async () => {
      const res = await putFileMetaRequest('/ffffffffffffffffffffffff.meta', "Test", {
        deepMeta: { thing: 2, another: 4, third: 'fourth' },
        metaField: false
      });
      expectStatus(res, 404);
    });
});
