import fs = require('fs');
import path = require('path');
import fsExtra = require('fs-extra');
import * as glob from 'glob';
import { Directory, File, FileStorage, Item, ItemType } from '../index';
import * as Bluebird from 'bluebird';

const DEFAULT_MIMETYPE = 'application/octet-stream';

const deleteFolderRecursive = (path: string) => {
  fs.readdirSync(path).forEach((file) => {
    const curPath = `${path}/${file}`;
    if (fs.statSync(curPath).isDirectory()) { // recurse
      deleteFolderRecursive(curPath);
    } else { // delete file
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
    const dirPath : string = path.resolve(this.rootDir, id);
    const filenames: string[] = await Bluebird.fromNode<string[]>(cb => fs.readdir(dirPath, cb));
    const items: (Directory | File)[] = [];
    filenames.map((filename) => {
      const ref = this.relatify(path.resolve(this.rootDir, id, filename));
      if (fs.statSync(path.resolve(dirPath, filename)).isDirectory()) {
        items.push({
          refId: ref,
          name: filename,
          type: ItemType.Directory,
        });
      } else {
        items.push({
          refId: ref,
          name: filename,
          mimetype: DEFAULT_MIMETYPE,
          type: ItemType.File,
        });
      }
    });
    return items;
  }

  async mkdir(dirRef: string, dir: Directory): Promise<Directory> {
    const dirPath = path.resolve(this.rootDir, dirRef || '', dir.name);
    await Bluebird.fromNode(cb => fs.mkdir(dirPath, cb));
    return {
      refId: this.relatify(dirPath),
      name: dir.name,
      type: ItemType.Directory,
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
    return Bluebird.fromNode<Buffer>(cb => fs.readFile(path.resolve(this.rootDir, file.refId), cb));
  }

  async removeFile(file: File): Promise<void> {
    await Bluebird.fromNode(cb => fs.unlink(path.resolve(this.rootDir, file.refId), cb));
  }

  async createFile(file: File, directory: Directory|undefined, data: Buffer): Promise<File> {
    const filePath = path.resolve(this.rootDir, directory ? directory.refId : '', file.name);
    await Bluebird.fromCallback(cb => fs.writeFile(filePath, data, cb));
    return {
      mimetype: DEFAULT_MIMETYPE,
      refId: this.relatify(filePath),
      name: file.name,
      type: ItemType.File,
    };
  }

  async moveFile(file: File, destination: Directory): Promise<File> {
    function move(oldPath: string, newPath: string, callback: (err?: NodeJS.ErrnoException) => void) {
      fs.rename(oldPath, newPath, (err) => {
        if (err) {
          if (err.code === 'EXDEV') {
            copy();
          } else {
            callback(err);
          }
          return;
        }
        callback();
      });
      function copy() {
        const readStream = fs.createReadStream(oldPath);
        const writeStream = fs.createWriteStream(newPath);

        readStream.on('error', callback);
        writeStream.on('error', callback);

        readStream.on('close', () => {
          fs.unlink(oldPath, callback);
        });

        readStream.pipe(writeStream);
      }
    }

    const oldPath = path.resolve(this.rootDir, file.refId);
    const filename = file.refId.split('/').pop();
    const destPath = path.resolve(this.rootDir, destination.refId, filename || '');
    await Bluebird.fromCallback(cb => move(oldPath, destPath, cb));
    file.refId = this.relatify(destPath);
    return file;
  }

  async moveDirectory(dir: Directory, destination: Directory, refCb: (oldItem: Item, newItem: Item) => Promise<void>): Promise<Directory> {
    const subdirRoot = path.resolve(this.rootDir, dir.refId);
    const items = await Bluebird.fromNode<string[]>(cb => glob('**', { cwd: subdirRoot }, cb));
    const destinationRef = destination.refId ? destination.refId : destination.name;
    const targetPath = fs.existsSync(path.resolve(this.rootDir, destinationRef)) ?
      path.resolve(this.rootDir, destinationRef, path.basename(dir.refId)) :
      path.resolve(this.rootDir, destinationRef);

    fsExtra.moveSync(subdirRoot, targetPath);
    items.map((item: string) => {
      const stat = fs.statSync(path.resolve(targetPath, item));
      const oldItem = { name: path.basename(item), refId: path.join(dir.refId, item), type: stat.isDirectory() ? ItemType.Directory : ItemType.File };
      const newItem = {
        name: path.basename(item),
        refId: path.join(destinationRef, item),
        type: stat.isDirectory() ? ItemType.Directory : ItemType.File,
      };
      return refCb(oldItem, newItem);
    });
    return { type: ItemType.Directory, name: path.basename(targetPath), refId: this.relatify(targetPath) };
  }

  setRootDir(dir: string) {
    this.rootDir = dir;
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir);
    }
  }
}
