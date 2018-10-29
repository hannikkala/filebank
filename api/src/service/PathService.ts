import * as _ from 'lodash';
import { DirectoryModel } from '../models/directory';
import { FileModel } from '../models/file';
import models from '../models';
import DirectoryService = require('./DirectoryService');
import isInvalidPath = require('is-invalid-path');

class Path {
  private allowRoot: boolean;
  private pathProp: string;
  private subTreeProp?: DirectoryModel[];
  private pathPartsProp: string[];
  private currentProp?: DirectoryModel|FileModel;
  private basenameProp: string;
  constructor(path: string, allowRoot: boolean) {
    this.pathProp = path;
    this.allowRoot = allowRoot;
    if (!this.validate()) {
      throw 'Path not valid';
    }
    this.pathPartsProp = _.filter((this.pathProp || '').split('/'), part => !_.isEmpty(part));
    const base = this.pathPartsProp.pop();
    if (!base && !this.allowRoot) {
      throw 'Path not valid.';
    }
    this.basenameProp = base || '';
  }
  validate(): boolean {
    return !isInvalidPath(this.pathProp) || this.pathProp === '/';
  }

  async populate(): Promise<this> {
    this.subTreeProp = await DirectoryService.buildTree(this.pathPartsProp);
    const currentDir = _.last(this.subTreeProp);
    const dir = await models.Directory.findOne({ parent: currentDir ? currentDir._id : { $eq: null }, name: this.basenameProp }).exec();
    const file = await models.File.findOne({ directory: currentDir ? currentDir._id : { $eq: null }, name: this.basenameProp }).exec();
    this.currentProp = dir || file || undefined;
    return this;
  }

  exists(): boolean {
    return !!this.currentProp || (this.allowRoot && this.pathProp === '/');
  }

  get path(): string {
    return this.pathProp;
  }

  get subTree(): DirectoryModel[] {
    if (!this.subTreeProp) {
      throw new Error('Subtree is null, please call populate first.');
    }
    return this.subTreeProp;
  }

  get pathParts(): string[] {
    return this.pathPartsProp;
  }

  get current(): DirectoryModel | FileModel | undefined {
    return this.currentProp;
  }

  get basename(): string {
    return this.basenameProp;
  }
}

export = {
  parsePath: (path: string, allowRoot: boolean = false): Path => {
    return new Path(path, allowRoot);
  },
};
