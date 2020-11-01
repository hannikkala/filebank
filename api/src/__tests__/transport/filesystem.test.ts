import { ItemType } from "../../index";
import * as fs from "fs";
import { FilesystemStorage } from "../../transport/filesystem";

import * as path from "path";

import * as helpers from "../helpers";

const filesystemstorageroot = "/tmp/filebank";
process.env.FILESYSTEM_STORAGE_ROOT = filesystemstorageroot;
const filesystem = new FilesystemStorage(filesystemstorageroot);

beforeAll(async () => {
  helpers.deleteFolderRecursive(filesystemstorageroot);
  fs.mkdirSync(filesystemstorageroot);
});

afterAll(async () => {
  helpers.deleteFolderRecursive(filesystemstorageroot);
});

describe("Filesystem storage", () => {
  it("can create directory", async () => {
    const dir = await filesystem.mkdir("", {
      refId: "temp",
      name: "temp",
      type: ItemType.Directory
    });
    expect(dir).toBeTruthy();
    expect(dir.type).toEqual("directory");
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, "temp"))
    ).toBeTruthy();
  });

  it("returns Promise when error", async () => {
    try {
      await filesystem.mkdir("nonexisting", {
        refId: "temp",
        name: "temp",
        type: ItemType.Directory
      });
      fail(new Error("Should fail."));
    } catch (e) {
      expect(e).toMatchSnapshot();
    }
  });

  it("can create subdirectory", async () => {
    const d = await filesystem.mkdir("", {
      refId: "subdir",
      name: "subdir",
      type: ItemType.Directory
    });
    const subdir = await filesystem.mkdir(d.refId, {
      refId: "temp",
      name: "temp",
      type: ItemType.Directory
    });
    expect(subdir.refId).toEqual("subdir/temp");
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, "subdir", "temp"))
    ).toBeTruthy();
  });

  it("can create file on root", async () => {
    const file = await filesystem.createFile(
      { name: "test.txt", refId: "test.txt", type: ItemType.File },
      undefined,
      new Buffer("test text")
    );
    expect(file).toBeTruthy();
    expect(file.type).toEqual(ItemType.File);
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, file.refId))
    ).toBeTruthy();
  });

  it("returns Promise when creating file failed", async () => {
    try {
      await filesystem.createFile(
        { name: "test.txt", refId: "test.txt", type: ItemType.File },
        { refId: "nonexist", name: "nonexist", type: ItemType.Directory },
        new Buffer("test text")
      );
      fail(new Error("Should fail."));
    } catch (e) {
      expect(e).toMatchSnapshot();
    }
  });

  it("can create file on subdir", async () => {
    const dir = await filesystem.mkdir("", {
      refId: "subdir2",
      name: "subdir2",
      type: ItemType.Directory
    });
    const file = await filesystem.createFile(
      { name: "test.txt", refId: "test.txt", type: ItemType.File },
      dir,
      new Buffer("test text")
    );
    expect(file).toBeTruthy();
    expect(file.refId).toEqual("subdir2/test.txt");
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, file.refId))
    ).toBeTruthy();
  });

  it("can remove directory", async () => {
    const dir = await filesystem.mkdir("", {
      refId: "rmdir",
      name: "rmdir",
      type: ItemType.Directory
    });
    const file = await filesystem.createFile(
      { refId: "test.txt", name: "test.txt", type: ItemType.File },
      dir,
      new Buffer("testtesttest")
    );
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, file.refId))
    ).toBeTruthy();
    await filesystem.rmdir("rmdir");
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, "rmdir"))
    ).toBeFalsy();
  });

  it("returns Promise when removing directory fails", async () => {
    try {
      await filesystem.rmdir("nonexist");
      fail(new Error("Should fail."));
    } catch (e) {
      expect(e).toMatchSnapshot();
    }
  });

  it("can get file content", async () => {
    const file = await filesystem.createFile(
      { refId: "content.txt", name: "content.txt", type: ItemType.File },
      undefined,
      new Buffer("testtesttest")
    );
    const buffer = await filesystem.getContent(file);
    expect(buffer.toString()).toEqual("testtesttest");
  });

  it("can list directory contents", async () => {
    const root = await filesystem.mkdir("", {
      refId: "content",
      name: "content",
      type: ItemType.Directory
    });
    await filesystem.createFile(
      { refId: "fileone.txt", name: "fileone.txt", type: ItemType.File },
      root,
      new Buffer("test")
    );
    await filesystem.createFile(
      { refId: "filetwo.txt", name: "filetwo.txt", type: ItemType.File },
      root,
      new Buffer("test2")
    );
    await filesystem.mkdir(root.refId, {
      refId: "subdir",
      name: "subdir",
      type: ItemType.Directory
    });
    const list = await filesystem.list(root.refId);
    expect(list).toHaveLength(3);
    expect(list.filter((item) => item.type === "file")).toHaveLength(2);
    expect(list.filter((item) => item.type === "directory")).toHaveLength(1);
  });

  it("can remove file", async () => {
    const file = await filesystem.createFile(
      { refId: "rmfile.txt", name: "rmfile.txt", type: ItemType.File },
      undefined,
      new Buffer("testtesttest")
    );
    await filesystem.removeFile(file);
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, "rmfile.txt"))
    ).toBeFalsy();
  });

  it("can move file", async () => {
    const file = await filesystem.createFile(
      { refId: "mvfile.txt", name: "mvfile.txt", type: ItemType.File },
      undefined,
      new Buffer("testtesttest")
    );
    const dir = await filesystem.mkdir("", {
      name: "moveto",
      refId: "moveto",
      type: ItemType.Directory
    });
    const newFile = await filesystem.moveFile(file, dir);
    expect(newFile.refId).toEqual("moveto/mvfile.txt");
    expect(
      fs.existsSync(path.resolve(filesystemstorageroot, "moveto", "mvfile.txt"))
    ).toBeTruthy();
  });

  it("can move directory and contents", async () => {
    const from = await filesystem.mkdir("", {
      name: "dirmovefrom",
      refId: "dirmovefrom",
      type: ItemType.Directory
    });
    await filesystem.mkdir("dirmovefrom", {
      name: "sub1",
      refId: "dirmovefrom/sub1",
      type: ItemType.Directory
    });
    await filesystem.createFile(
      {
        refId: "mvfile.txt",
        name: "dirmovefrom/mvfile.txt",
        type: ItemType.File
      },
      undefined,
      new Buffer("testtesttest")
    );
    await filesystem.mkdir("", {
      name: "dirmoveto",
      refId: "dirmoveto",
      type: ItemType.Directory
    });
    await filesystem.moveDirectory(from, {
      name: "dirmovefrom",
      refId: "dirmoveto/dirmovefrom",
      type: ItemType.Directory
    });
  });
});
