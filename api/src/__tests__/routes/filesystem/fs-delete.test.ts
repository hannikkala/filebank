import config from "../../../config/config";

const filesystemstorageroot = "/tmp/filebank";
config.set("storage.filesystem.rootDir", filesystemstorageroot);
config.set("storage.enabled", "filesystem");

import { Directory, File } from "../../../models";
import * as helpers from "../../helpers";
import {
  deleteDirectory,
  deleteFile,
  expectStatus,
  expectStatus200,
  fileVerifyFS,
  postDirectoryRequest,
  postFileRequest
} from "../../helpers";
import fs from "fs";
import mongoose from "mongoose";

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
  await Promise.all(mongoose.connections.map((conn) => conn.close()));
});

describe("Directory FS API route DELETE route", () => {
  it("can delete directory on fs root", async () => {
    const res = await postDirectoryRequest("/", "deletethis");
    expectStatus200(res);
    expect(res.body.refId.startsWith("deletethis")).toEqual(true);
    expect(res.body.type).toEqual("directory");

    const res2 = await deleteDirectory("/deletethis");
    expectStatus(res2, 204);

    expect(await fileVerifyFS(filesystemstorageroot, "deletethis")).toEqual(
      false
    );
  });

  it("cannot delete non-existing directory", async () => {
    const res2 = await deleteDirectory("/nonexisting");
    expectStatus(res2, 404);

    expect(await fileVerifyFS(filesystemstorageroot, "nonexisting")).toEqual(
      false
    );
  });

  it("can delete file on fs root", async () => {
    const res = await postFileRequest(
      "/",
      `${__dirname}/../../resources/64-64.jpg`
    );
    expectStatus200(res);

    expect(await fileVerifyFS(filesystemstorageroot, "64-64.jpg")).toEqual(
      true
    );

    const res2 = await deleteFile("/64-64.jpg");
    expectStatus(res2, 204);

    expect(await fileVerifyFS(filesystemstorageroot, "64-64.jpg")).toEqual(
      false
    );
  });

  it("cannot delete non-existing file", async () => {
    const res = await deleteFile("/nonexisting.jpg");
    expectStatus(res, 404);

    expect(
      await fileVerifyFS(filesystemstorageroot, "nonexisting.jpg")
    ).toEqual(false);
  });
});
