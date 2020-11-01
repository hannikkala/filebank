import config from "../../../config/config";

const filesystemstorageroot = "/tmp/filebank";
config.set("storage.filesystem.rootDir", filesystemstorageroot);
config.set("storage.enabled", "filesystem");

import * as fs from "fs";
import { File, Directory } from "../../../models";
import * as helpers from "../../helpers";
import { createDirectory, createFile, expectStatus, getRequest, listRequest, postFileRequest } from "../../helpers";

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

describe('Directory FS API route GET route', () => {

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
      createFile({ name: "test2.txt", refId: 'test2.txt', mimetype: 'application/octet-stream', directory: directory._id }),
    ]);
    const res = await listRequest('/subdir');
    expect(res.body.length).toEqual(4);
  });

  it('cannot list items in non-existing directory', async () => {
    const res = await listRequest("/nonexisting");
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
