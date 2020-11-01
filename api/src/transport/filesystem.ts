import fs = require("fs");
import path = require("path");
import fsExtra = require("fs-extra");
import glob from "glob";
import { promisify } from "util";
import {
  Directory,
  File,
  FileStorage,
  Item,
  ItemType,
  MoveDirectoryResponse
} from "../index";

const DEFAULT_MIMETYPE = "application/octet-stream";

const deleteFolderRecursive = (path: string) => {
  fs.readdirSync(path).forEach((file) => {
    const curPath = `${path}/${file}`;
    if (fs.statSync(curPath).isDirectory()) {
      // recurse
      deleteFolderRecursive(curPath);
    } else {
      // delete file
      fs.unlinkSync(curPath);
    }
  });
  fs.rmdirSync(path);
};

export class FilesystemStorage implements FileStorage {
  rootDir: string;
  constructor(rootDir: string) {
    this.rootDir = rootDir;

    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir);
    }
  }
  relatify(path: string): string {
    if (path.length >= this.rootDir.length) {
      return path.substring(this.rootDir.length + 1);
    }
    return path;
  }
  async list(id: string): Promise<(Directory | File)[]> {
    const dirPath: string = path.resolve(this.rootDir, id);
    const filenames: string[] = fs.readdirSync(dirPath);
    return filenames.map((filename) => {
      const ref = this.relatify(path.resolve(this.rootDir, id, filename));
      if (fs.statSync(path.resolve(dirPath, filename)).isDirectory()) {
        return {
          refId: ref,
          name: filename,
          type: ItemType.Directory
        };
      } else {
        return {
          refId: ref,
          name: filename,
          mimetype: DEFAULT_MIMETYPE,
          type: ItemType.File
        };
      }
    });
  }

  async mkdir(dirRef: string, dir: Directory): Promise<Directory> {
    const dirPath = path.resolve(this.rootDir, dirRef || "", dir.name);
    fs.mkdirSync(dirPath);
    return {
      refId: this.relatify(dirPath),
      name: dir.name,
      type: ItemType.Directory
    };
  }

  rmdir(dirId: string): Promise<void> {
    try {
      deleteFolderRecursive(path.resolve(this.rootDir, dirId));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  async getContent(file: File): Promise<Buffer> {
    return fs.readFileSync(path.resolve(this.rootDir, file.refId));
  }

  async removeFile(file: File): Promise<void> {
    fs.unlinkSync(path.resolve(this.rootDir, file.refId));
  }

  async createFile(
    file: File,
    directory: Directory | undefined,
    data: Buffer
  ): Promise<File> {
    const filePath = path.resolve(
      this.rootDir,
      directory ? directory.refId : "",
      file.name
    );
    fs.writeFileSync(filePath, data);
    return {
      mimetype: DEFAULT_MIMETYPE,
      refId: this.relatify(filePath),
      name: file.name,
      type: ItemType.File
    };
  }

  async moveFile(file: File, destination: Directory): Promise<File> {
    function move(
      oldPath: string,
      newPath: string,
      callback: (err?: any) => void
    ) {
      const copy = () => {
        const readStream = fs.createReadStream(oldPath);
        const writeStream = fs.createWriteStream(newPath);

        readStream.on("error", callback);
        writeStream.on("error", callback);

        readStream.on("close", () => {
          fs.unlink(oldPath, callback);
        });

        readStream.pipe(writeStream);
      };
      fs.rename(oldPath, newPath, (err) => {
        if (err) {
          if (err.code === "EXDEV") {
            copy();
          } else {
            callback(err);
          }
          return;
        }
        callback();
      });
    }

    const moveAsync = promisify(move);

    const oldPath = path.resolve(this.rootDir, file.refId);
    const filename = file.refId.split("/").pop();
    const destPath = path.resolve(
      this.rootDir,
      destination.refId,
      filename || ""
    );
    await moveAsync(oldPath, destPath);
    file.refId = this.relatify(destPath);
    return file;
  }

  async moveDirectory(
    dir: Directory,
    destination: Directory
  ): Promise<MoveDirectoryResponse> {
    const subdirRoot = path.resolve(this.rootDir, dir.refId);
    const globAsync = promisify(glob);
    const items = await globAsync("**", { cwd: subdirRoot });
    const destinationRef = destination.refId
      ? destination.refId
      : destination.name;
    const targetPath = fs.existsSync(path.resolve(this.rootDir, destinationRef))
      ? path.resolve(this.rootDir, destinationRef, path.basename(dir.refId))
      : path.resolve(this.rootDir, destinationRef);

    fsExtra.moveSync(subdirRoot, targetPath);
    const allItems: {
      oldItem: Item;
      newItem: Item;
    }[] = items.map((item: string) => {
      const stat = fs.statSync(path.resolve(targetPath, item));
      const oldItem = {
        name: path.basename(item),
        refId: path.join(dir.refId, item),
        type: stat.isDirectory() ? ItemType.Directory : ItemType.File
      };
      const newItem = {
        name: path.basename(item),
        refId: path.join(destinationRef, item),
        type: stat.isDirectory() ? ItemType.Directory : ItemType.File
      };
      return {
        oldItem,
        newItem
      };
    });
    return {
      directory: {
        type: ItemType.Directory,
        name: path.basename(targetPath),
        refId: this.relatify(targetPath)
      },
      items: allItems
    };
  }
}
