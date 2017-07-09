import * as _ from 'lodash';
import { DirectoryModel } from '../models/directory';
import DirectoryService = require('./DirectoryService');
import { FileModel } from '../models/file';
import models from '../models';
import isInvalidPath = require('is-invalid-path');

class Path {
  private _allowRoot: boolean;
  private _path: string;
  private _subTree: DirectoryModel[];
  private _pathParts: string[];
  private _current?: DirectoryModel|FileModel;
  private _basename: string;
  constructor(path: string, allowRoot: boolean) {
    this._path = path;
    this._allowRoot = allowRoot;
    if (!this.validate()) {
      throw 'Path not valid';
    }
    this.parse();
  }
  validate(): boolean {
    return !isInvalidPath(this._path) || this._path === '/';
  }
  parse() {
    this._pathParts = _.filter((this._path || '').split('/'), part => !_.isEmpty(part));
    const base = this._pathParts.pop();
    if (!base && !this._allowRoot) {
      throw 'Path not valid.';
    }
    this._basename = base || '';
  }

  async populate(): Promise<this> {
    this._subTree = await DirectoryService.buildTree(this._pathParts);
    const currentDir = _.last(this._subTree);
    const dir = await models.Directory.findOne({ parent: currentDir ? currentDir._id : { $eq: null }, name: this._basename }).exec();
    const file = await models.File.findOne({ directory: currentDir ? currentDir._id : { $eq: null }, name: this._basename }).exec();
    this._current = dir || file || undefined;
    return this;
  }

  exists(): boolean {
    return !!this._current || (this._allowRoot && this._path === '/');
  }

  get path(): string {
    return this._path;
  }

  get subTree(): DirectoryModel[] {
    return this._subTree;
  }

  get pathParts(): string[] {
    return this._pathParts;
  }

  get current(): DirectoryModel | FileModel | undefined {
    return this._current;
  }

  get basename(): string {
    return this._basename;
  }
}

export = {
  parsePath: (path: string, allowRoot: boolean = false): Path => {
    return new Path(path, allowRoot);
  }
}
