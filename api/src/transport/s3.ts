import { Directory, FileStorage, File, Item, ItemType } from '../index';
import Promise = require('bluebird');
import AWS = require('aws-sdk');
import S3 = require('aws-sdk/clients/s3');
import { DeleteObjectsRequest, GetObjectOutput, ListObjectsOutput } from 'aws-sdk/clients/s3';
import * as _ from 'lodash';
import path = require('path');
import { S3StorageOptions } from '../config';
import { EventEmitter } from 'events';

AWS.config.setPromisesDependency(Promise);
AWS.config.update({ region: 'eu-west-1' });

export class S3Storage extends EventEmitter implements FileStorage {
  _bucket: string;
  private _s3: AWS.S3;

  constructor(options: S3StorageOptions) {
    super();
    this._s3 = new AWS.S3(Object.assign({ apiVersion: '2006-03-01' }, options.clientOptions));
    this._bucket = options.bucket;
    this.initialize();
  }

  initialize(): Promise<any> {
    return Promise.fromNode(cb => this._s3.headBucket({ Bucket: this._bucket }, cb))
      .then(() => {
        this.emit('initialized');
      })
      .catch(() => {
        return this._s3.createBucket({
          Bucket: this._bucket,
          ACL: 'authenticated-read'
        }).promise()
          .then(() => {
            this.emit('initialized');
          });
      });
  }

  list(id: string): Promise<(Directory | File)[]> {
    return Promise.fromNode(cb => this._s3.listObjects({ Bucket: this._bucket }, cb))
      .then((data) => {
        return data.Contents.map((obj: S3.Object) => {
          return {
            type: obj.Key!.endsWith('/') ? ItemType.Directory : ItemType.File,
            name: obj.Key,
          };
        });
      });
  }

  mkdir(dirRef: string, dir: Directory): Promise<Directory> {
    const key = `${dirRef}${dir.name}/`;
    return Promise.fromNode(cb => this._s3.putObject({ Bucket: this._bucket, Key: key, ACL: 'authenticated-read' }, cb))
      .then(() => {
        return { name: dir.name, type: ItemType.Directory, refId: key };
      });
  }

  rmdir(dirId: string): Promise<void> {
    return Promise.fromNode(cb => this._s3.deleteObject({ Bucket: this._bucket, Key: dirId }, cb));
  }

  getContent(file: File): Promise<Buffer> {
    return Promise.fromNode(cb => this._s3.getObject({ Bucket: this._bucket, Key: file.refId }, cb))
      .then((data: GetObjectOutput) => {
        return _.isString(data.Body!) ? new Buffer(data.Body! as string) : data.Body! as Buffer;
      });
  }

  removeFile(file: File): Promise<void> {
    return Promise.fromNode(cb => this._s3.deleteObject({ Bucket: this._bucket, Key: file.refId }, cb));
  }

  createFile(file: File, directory: Directory | any, data: Buffer): Promise<File> {
    const key = `${directory ? directory.refId : ''}${file.name}`;
    return Promise.fromNode(cb => this._s3.upload({
      Bucket: this._bucket, Key: key, ACL: 'authenticated-read', Body: data
    }, cb))
      .then(() => {
        return { name: file.name, type: ItemType.File, refId: key, mimetype: file.mimetype };
      });
  }

  moveFile(item: File, destination: Directory): Promise<File> {
    const key = `${destination ? destination.refId : ''}${path.basename(item.refId)}`;
    return Promise.fromNode(cb => this._s3.copyObject({
      Bucket: this._bucket,
      CopySource: `${this._bucket}/${item.refId}`,
      Key: key
    }, cb))
      .then(() => {
        return Promise.fromNode(cb => this._s3.deleteObject({ Bucket: this._bucket, Key: item.refId }, cb));
      }).then(() => {
        return { name: item.name, type: ItemType.File, refId: key, mimetype: item.mimetype };
      });
  }

  moveDirectory(dir: Directory, destination: Directory, refCb: (oldItem: Item, newItem: Item) => Promise<void>): Promise<Directory> {
    const targetRef = destination.refId ? destination.refId : `${destination.name}/`;
    return Promise.all([
      Promise.fromNode(cb => this._s3.listObjects({ Bucket: this._bucket, Prefix: dir.refId }, cb)),
      Promise.fromNode(cb => this._s3.listObjects({ Bucket: this._bucket, Prefix: targetRef }, cb))
    ]).spread((data: ListObjectsOutput, exists: ListObjectsOutput) => {
        const deleteParams: DeleteObjectsRequest = {
          Bucket: this._bucket,
          Delete: {
            Objects: [],
          },
        };
        const targetPrefix = exists.Contents!.length ? `${targetRef}${dir.name}/` : `${targetRef}`;
        console.log('targetprefix', targetPrefix);
        return Promise.map(data.Contents!, (s3item: S3.Object) => {
          deleteParams.Delete.Objects.push({ Key: s3item.Key! });
          const newKey = s3item.Key!.replace(dir.refId, targetPrefix);
          console.log('copyobject', s3item.Key, newKey);
          return Promise.fromNode(cb => this._s3.copyObject({
            Bucket: this._bucket,
            CopySource: `${this._bucket}/${s3item.Key}`,
            Key: newKey,
          }, cb))
            .then(() => {
              console.log('refCb', s3item.Key);
              if (s3item.Key === dir.refId) return;
              return refCb({
                refId: s3item.Key!,
                name: path.basename(s3item.Key!),
                type: s3item.Key!.endsWith('/') ? ItemType.Directory : ItemType.File,
              }, {
                refId: newKey,
                name: path.basename(s3item.Key!),
                type: s3item.Key!.endsWith('/') ? ItemType.Directory : ItemType.File,
              });
            });
        }).then(() => {
          console.log('deleteParams');
          return Promise.fromNode(cb => this._s3.deleteObjects(deleteParams, cb));
        }).then(() => {
          return { name: path.basename(targetPrefix), type: ItemType.Directory, refId: targetPrefix };
        });
      })
  }

}

