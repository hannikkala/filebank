import config from "../../../config/config";
const filesystemstorageroot = "/tmp/filebank";
config.set("storage.filesystem.rootDir", filesystemstorageroot);
config.set("storage.enabled", "filesystem");

import { File, Directory } from "../../../models";
import { expectStatus, expectStatus200, fileVerifyFS, postDirectoryRequest, postFileRequest } from "../../helpers";
import * as helpers from "../../helpers";
import fs from "fs";

beforeAll(() => {
  helpers.deleteFolderRecursive(filesystemstorageroot);
  fs.mkdirSync(filesystemstorageroot);
});

beforeEach(async () => {
  await File.deleteMany({}).exec();
  await Directory.deleteMany({}).exec();
});

afterAll(async () => {
  helpers.deleteFolderRecursive(filesystemstorageroot);
});

describe('Directory FS API route POST route', () => {
  it('can create directory on fs root', async () => {
    const res = await postDirectoryRequest("/", "test-1");
    expect(res.body.refId.startsWith('test-1')).toBeTruthy();
    expect(res.body.type).toEqual('directory');
    expect(await fileVerifyFS(filesystemstorageroot, 'test-1')).toEqual(true);
  });

  it('can create directory on subdir', async () => {
    const res = await postDirectoryRequest("/", "test-2");
    expect(res.body.refId.startsWith('test-2')).toBe(true);
    expect(res.body.type).toEqual('directory');

    const res2 = await postDirectoryRequest("/test-2", "test-3");
    expect(res2.body.refId.startsWith('test-2/test-3')).toBe(true);
    expect(res2.body.type).toEqual('directory');
    expect(res2.body.parent).toEqual(res.body._id);

    expect(await fileVerifyFS(filesystemstorageroot, 'test-2', 'test-3')).toEqual(true);
  });

  it('cannot create directory with invalid metadata', async () => {
    const res = await postDirectoryRequest("/", "faildir", "Test",{
      deepMeta: { thing: 'this should be number', another: 2, third: false },
      metaField: 'nottrue',
    });
    expectStatus(res, 400);
    expect(await fileVerifyFS(filesystemstorageroot, "faildir")).toEqual(false);
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
    expect(await fileVerifyFS(filesystemstorageroot, 'fire.jpg')).toEqual(true);
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

    expect(await fileVerifyFS(filesystemstorageroot, 'test-4', 'fire.pdf')).toEqual(true);
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

    expect(await fileVerifyFS(filesystemstorageroot, "another-fire.jpg")).toEqual(true);
  });

  it('cannot create file when schema is missing and required', async () => {
    config.set("schemaRequired", true);
    try {
      const res = await postFileRequest("/", `${__dirname}/../../resources/fire.pdf`);
      expectStatus(res, 400);
      expect(await fileVerifyFS(filesystemstorageroot, 'fire.pdf')).toEqual(false);
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
