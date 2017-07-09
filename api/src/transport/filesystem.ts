import fs = require('fs');
import path = require('path');
import fsExtra = require('fs-extra');
import * as glob from 'glob';
import { FileStorage, Directory, File, ItemType, Item } from '../index';
import * as Promise from 'bluebird';
import { config, FilesystemStorageOptions } from '../config';

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
  list(id: string): Promise<(Directory | File)[]> {
    const dirPath : string = path.resolve(this.rootDir, id);
    return Promise.fromNode(cb => fs.readdir(dirPath, cb))
      .then((filenames: string[]) => {
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
      });
  }

  mkdir(dirRef: string, dir: Directory): Promise<Directory> {
    const dirPath = path.resolve(this.rootDir, dirRef || '', dir.name);
    return Promise.fromCallback(cb => fs.mkdir(dirPath, cb))
      .then(() => {
        return {
          refId: this.relatify(dirPath),
          name: dir.name,
          type: ItemType.Directory,
        };
      });
  }

  rmdir(dirId: string): Promise<void> {
    try {
      deleteFolderRecursive(path.resolve(this.rootDir, dirId));
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  getContent(file: File): Promise<Buffer> {
    return Promise.fromCallback(cb => fs.readFile(path.resolve(this.rootDir, file.refId), cb));
  }

  removeFile(file: File): Promise<void> {
    return Promise.fromCallback(cb => fs.unlink(path.resolve(this.rootDir, file.refId), cb));
  }

  createFile(file: File, directory: Directory|undefined, data: Buffer): Promise<File> {
    const filePath = path.resolve(this.rootDir, directory ? directory.refId : '', file.name);
    return Promise.fromCallback(cb => fs.writeFile(filePath, data, cb))
      .then(() => {
        return {
          mimetype: DEFAULT_MIMETYPE,
          refId: this.relatify(filePath),
          name: file.name,
          type: ItemType.File,
        };
      });
  }

  moveFile(file: File, destination: Directory): Promise<File> {
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
    const destPath = path.resolve(this.rootDir, destination.refId, filename);
    return Promise.fromCallback(cb => move(oldPath, destPath, cb))
      .then(() => {
        file.refId = this.relatify(destPath);
        return file;
      });
  }

  moveDirectory(dir: Directory, destination: Directory, refCb: (oldItem: Item, newItem: Item) => Promise<void>): Promise<Directory> {
    const subdirRoot = path.resolve(this.rootDir, dir.refId);
    return Promise.fromNode(cb => glob('**', { cwd: subdirRoot }, cb))
      .then((items) => {
        const destinationRef = destination.refId ? destination.refId : destination.name;
        const targetPath = fs.existsSync(path.resolve(this.rootDir, destinationRef)) ?
          path.resolve(this.rootDir, destinationRef, path.basename(dir.refId)) :
          path.resolve(this.rootDir, destinationRef);

        fsExtra.moveSync(subdirRoot, targetPath);
        const subitemPromises = items.map((item: string) => {
          const stat = fs.statSync(path.resolve(targetPath, item));
          const oldItem = { name: path.basename(item), refId: path.join(dir.refId, item), type: stat.isDirectory() ? ItemType.Directory : ItemType.File };
          const newItem = {
            name: path.basename(item),
            refId: path.join(destinationRef, item),
            type: stat.isDirectory() ? ItemType.Directory : ItemType.File,
          };
          return refCb(oldItem, newItem);
        });
        return Promise.all(subitemPromises).then(() => {
          return { type: ItemType.Directory, name: path.basename(targetPath), refId: this.relatify(targetPath) };
        });
      });
  }

  setRootDir(dir: string) {
    this.rootDir = dir;
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir);
    }
  }
}
