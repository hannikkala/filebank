import config from "../../../config/config";
const filesystemstorageroot = "/tmp/filebank";
config.set("storage.filesystem.rootDir", filesystemstorageroot);
config.set("storage.enabled", "filesystem");

import { File, Directory } from "../../../models";
import {
  expectStatus,
  expectStatus200,
  fileVerifyFS,
  moveDirectory,
  moveFile,
  postDirectoryRequest,
  postFileRequest
} from "../../helpers";
import * as helpers from "../../helpers";
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

describe("Directory FS API route PUT route", () => {
  it("can move file", async () => {
    const res = await postFileRequest(
      "/",
      `${__dirname}/../../resources/64-64.jpg`,
      "",
      {},
      "moveme.jpg"
    );
    expectStatus200(res);
    expect(await fileVerifyFS(filesystemstorageroot, "moveme.jpg")).toEqual(
      true
    );

    const res2 = await postDirectoryRequest("/", "movehere");
    expectStatus200(res2);
    expect(res2.body.refId.startsWith("movehere")).toEqual(true);
    expect(res2.body.type).toEqual("directory");

    const res3 = await moveFile("/moveme.jpg", "/movehere");
    expectStatus200(res3);
    expect(res3.body.refId.startsWith("movehere/moveme.jpg")).toEqual(true);
    expect(res3.body.type).toEqual("file");

    expect(
      await fileVerifyFS(filesystemstorageroot, "movehere", "moveme.jpg")
    ).toEqual(true);
  });

  it("cannot move file to nonexisting directory", async () => {
    const res = await postFileRequest(
      "/",
      `${__dirname}/../../resources/64-64.jpg`,
      "",
      {},
      "moveme2.jpg"
    );
    expectStatus200(res);
    expect(await fileVerifyFS(filesystemstorageroot, "moveme2.jpg")).toEqual(
      true
    );

    const res2 = await moveFile("/moveme2.jpg", "/movehere");
    expectStatus(res2, 404);
    expect(
      await fileVerifyFS(filesystemstorageroot, "movehere", "moveme2.jpg")
    ).toEqual(false);
  });

  it("can move directory", async () => {
    const res = await postDirectoryRequest("/", "movethisdir");
    expectStatus200(res);
    expect(res.body.refId.startsWith("movethisdir")).toEqual(true);
    expect(res.body.type).toEqual("directory");

    const res2 = await postDirectoryRequest("/", "moveheredir");
    expectStatus200(res2);
    expect(res2.body.refId.startsWith("moveheredir")).toEqual(true);
    expect(res2.body.type).toEqual("directory");

    const res3 = await postFileRequest(
      "/movethisdir",
      `${__dirname}/../../resources/64-64.jpg`,
      "",
      {},
      "moveme.jpg"
    );
    expectStatus200(res3);
    expect(
      await fileVerifyFS(filesystemstorageroot, "movethisdir", "moveme.jpg")
    ).toEqual(true);

    const res4 = await moveDirectory("/movethisdir", "/moveheredir");
    expectStatus200(res4);
    expect(res4.body.refId.startsWith("moveheredir/movethisdir")).toEqual(true);
    expect(res4.body.type).toEqual("directory");

    expect(
      await fileVerifyFS(filesystemstorageroot, "moveheredir", "movethisdir")
    ).toEqual(true);
  });

  it("can rename directory", async () => {
    const res = await postDirectoryRequest("/", "movethisdir1");
    expectStatus200(res);
    expect(res.body.refId.startsWith("movethisdir1")).toEqual(true);
    expect(res.body.type).toEqual("directory");

    const res2 = await postFileRequest(
      "/movethisdir1",
      `${__dirname}/../../resources/64-64.jpg`,
      "",
      {},
      "moveme.jpg"
    );
    expectStatus200(res2);
    expect(
      await fileVerifyFS(filesystemstorageroot, "movethisdir1", "moveme.jpg")
    ).toEqual(true);

    const res3 = await moveDirectory("/movethisdir1", "/moveheredir1");
    expectStatus200(res3);
    expect(res3.body.refId.startsWith("moveheredir1")).toEqual(true);
    expect(res3.body.type).toEqual("directory");

    expect(await fileVerifyFS(filesystemstorageroot, "moveheredir1")).toEqual(
      true
    );
  });
});
