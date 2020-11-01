import config from "../../../config/config";
const filesystemstorageroot = "/tmp/filebank";
config.set("storage.filesystem.rootDir", filesystemstorageroot);
config.set("storage.enabled", "filesystem");

import { File, Directory } from "../../../models";
import {
  expectStatus,
  expectStatus200,
  postDirectoryRequest,
  postFileRequest,
  putDirectoryRequest,
  putFileMetaRequest
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

describe("Directory FS API route PUT meta route", () => {
  it("can update metadata for directory", async () => {
    const res = await postDirectoryRequest("/", "metadir", "Test", {
      deepMeta: { thing: 1, another: 2, third: "third" },
      metaField: true
    });
    expectStatus200(res);
    expect(res.body.refId.startsWith("metadir")).toEqual(true);
    expect(res.body.type).toEqual("directory");

    const res2 = await putDirectoryRequest(`/${res.body._id}.meta`, "Test", {
      deepMeta: { thing: 2, another: 4, third: "fourth" },
      metaField: false
    });
    expectStatus200(res);
    expect(res2.body.metadata.metaField).toEqual(false);
    expect(res2.body.metadata.deepMeta.thing).toEqual(2);
    expect(res2.body.metadata.deepMeta.another).toEqual(4);
    expect(res2.body.metadata.deepMeta.third).toEqual("fourth");
  });

  it("cannot update invalid metadata for directory", async () => {
    const res = await postDirectoryRequest("/", "metadir-2", "Test", {
      deepMeta: { thing: 1, another: 2, third: "third" },
      metaField: true
    });
    expectStatus200(res);
    expect(res.body.refId.startsWith("metadir-2")).toEqual(true);
    expect(res.body.type).toEqual("directory");

    const res2 = await putDirectoryRequest(`/${res.body._id}.meta`, "Test", {
      deepMeta: { thing: "should be number", another: 4, third: false },
      metaField: "should be boolean"
    });
    expectStatus(res2, 400);
  });

  it("can update file metadata", async () => {
    const res = await postFileRequest(
      "/",
      `${__dirname}/../../resources/fire.pdf`,
      "Test",
      {
        deepMeta: { thing: 1, another: 2, third: "third" },
        metaField: true
      },
      "meta.pdf"
    );
    expectStatus200(res);

    const res2 = await putFileMetaRequest(`/${res.body._id}.meta`, "Test", {
      deepMeta: { thing: 2, another: 4, third: "fourth" },
      metaField: false
    });
    expectStatus200(res2);
    expect(res2.body.metadata.metaField).toEqual(false);
    expect(res2.body.metadata.deepMeta.thing).toEqual(2);
    expect(res2.body.metadata.deepMeta.another).toEqual(4);
    expect(res2.body.metadata.deepMeta.third).toEqual("fourth");
  });

  it("cannot update file with invalid metadata", async () => {
    const res = await postFileRequest(
      "/",
      `${__dirname}/../../resources/fire.pdf`,
      "Test",
      {
        deepMeta: { thing: 1, another: 2, third: "third" },
        metaField: true
      },
      "meta.pdf"
    );
    expectStatus200(res);

    const res2 = await putFileMetaRequest(`/${res.body._id}.meta`, "Test", {
      deepMeta: { thing: "should be number", another: 4, third: "fourth" },
      metaField: "should be boolean"
    });
    expectStatus(res2, 400);
  });

  it("cannot update metadata non-existing item", async () => {
    const res = await putFileMetaRequest(
      "/ffffffffffffffffffffffff.meta",
      "Test",
      {
        deepMeta: { thing: 2, another: 4, third: "fourth" },
        metaField: false
      }
    );
    expectStatus(res, 404);
  });
});
