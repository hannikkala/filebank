import * as Promise from 'bluebird';

export interface FileStorage {
  mkdir(dirRef: string, dir: Directory): Promise<Directory>;

  rmdir(dirId: string): Promise<void>;

  getContent(file: File): Promise<Buffer>;

  removeFile(file: File): Promise<void>;

  createFile(file: File, directory: Directory|undefined, data: Buffer): Promise<File>;

  moveFile(item: File, destination: Directory): Promise<File>;

  moveDirectory(dir: Directory, destination: Directory, refCb: (oldItem: Item, newItem: Item) => Promise<void>): Promise<Directory>;
}

export enum ItemType {
  File = 'file',
  Directory = 'directory',
}

export interface Item {
  refId: string;
  name: string;
  type: ItemType;
}

export interface Directory extends Item {
  metadata?: any;
}

export interface File extends Item {
  mimetype?: string;
  metadata?: any;
}

export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UserInputError extends Error {
  constructor(message?: string) {
    super(message);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, UserInputError.prototype);
  }
}
