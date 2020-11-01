import {
  Directory,
  File,
  FileStorage,
  Item,
  ItemType,
  MoveDirectoryResponse
} from "../index";
import { DeleteObjectsRequest } from "aws-sdk/clients/s3";
import * as _ from "lodash";
import { S3StorageOptions } from "../config";
import { EventEmitter } from "events";
import * as AWS from "aws-sdk";
import S3 from "aws-sdk/clients/s3";
import path = require("path");
import config from "../config/config";

const { s3, enabled } = config.get("storage");

AWS.config.setPromisesDependency(Promise);
AWS.config.update({ region: s3.clientOptions.region, s3ForcePathStyle: true });

export class S3Storage extends EventEmitter implements FileStorage {
  bucket: string;
  s3: S3;

  constructor(options: S3StorageOptions) {
    super();
    const opts = {
      apiVersion: "2006-03-01",
      ...(options.endpoint
        ? { endpoint: options.endpoint, s3BucketEndpoint: true }
        : {})
    };
    this.s3 = new AWS.S3(Object.assign(opts, options.clientOptions));
    this.bucket = options.bucket;
    if (!enabled) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.initialize().then(() => {});
  }

  async initialize(): Promise<any> {
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise();
      this.emit("initialized");
    } catch (e) {
      await this.s3
        .createBucket({
          Bucket: this.bucket,
          ACL: "authenticated-read"
        })
        .promise();
      this.emit("initialized");
    }
  }

  async list(_id: string): Promise<(Directory | File)[]> {
    const data = await this.s3.listObjects({ Bucket: this.bucket }).promise();
    return data.Contents!.map((obj: S3.Object) => {
      return {
        type: obj.Key!.endsWith("/") ? ItemType.Directory : ItemType.File,
        name: obj.Key || "",
        refId: obj.Key || ""
      };
    });
  }

  async mkdir(dirRef: string, dir: Directory): Promise<Directory> {
    const key = `${dirRef}${dir.name}/`;
    await this.s3
      .putObject({ Bucket: this.bucket, Key: key, ACL: "authenticated-read" })
      .promise();
    return { name: dir.name, type: ItemType.Directory, refId: key };
  }

  async rmdir(dirId: string): Promise<void> {
    await this.s3.deleteObject({ Bucket: this.bucket, Key: dirId }).promise();
  }

  async getContent(file: File): Promise<Buffer> {
    const data = await this.s3
      .getObject({ Bucket: this.bucket, Key: file.refId })
      .promise();
    return _.isString(data.Body!)
      ? Buffer.from(data.Body! as string)
      : (data.Body! as Buffer);
  }

  async removeFile(file: File): Promise<void> {
    await this.s3
      .deleteObject({ Bucket: this.bucket, Key: file.refId })
      .promise();
  }

  async createFile(
    file: File,
    directory: Directory | any,
    data: Buffer
  ): Promise<File> {
    const key = `${directory ? directory.refId : ""}${file.name}`;
    await this.s3
      .upload({
        Bucket: this.bucket,
        Key: key,
        ACL: "authenticated-read",
        Body: data
      })
      .promise();
    return {
      name: file.name,
      type: ItemType.File,
      refId: key,
      mimetype: file.mimetype
    };
  }

  async moveFile(item: File, destination: Directory): Promise<File> {
    const key = `${destination ? destination.refId : ""}${path.basename(
      item.refId
    )}`;
    await this.s3
      .copyObject({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${item.refId}`,
        Key: key
      })
      .promise();
    await this.s3
      .deleteObject({ Bucket: this.bucket, Key: item.refId })
      .promise();
    return {
      name: item.name,
      type: ItemType.File,
      refId: key,
      mimetype: item.mimetype
    };
  }

  async moveDirectory(
    dir: Directory,
    destination: Directory
  ): Promise<MoveDirectoryResponse> {
    const targetRef = destination.refId
      ? destination.refId
      : `${destination.name}/`;
    const data = await this.s3
      .listObjects({ Bucket: this.bucket, Prefix: dir.refId })
      .promise();
    const exists = await this.s3
      .listObjects({ Bucket: this.bucket, Prefix: targetRef })
      .promise();
    const deleteParams: DeleteObjectsRequest = {
      Bucket: this.bucket,
      Delete: {
        Objects: []
      }
    };
    const targetPrefix = exists.Contents!.length
      ? `${targetRef}${dir.name}/`
      : `${targetRef}`;
    const items: {
      oldItem: Item;
      newItem: Item;
    }[] = await Promise.all(
      _.map(data.Contents!, async (s3item: S3.Object) => {
        deleteParams.Delete.Objects.push({ Key: s3item.Key! });
        const newKey = s3item.Key!.replace(dir.refId, targetPrefix);
        await this.s3
          .copyObject({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${s3item.Key}`,
            Key: newKey
          })
          .promise();
        return {
          oldItem: {
            refId: s3item.Key!,
            name: path.basename(s3item.Key!),
            type: s3item.Key!.endsWith("/") ? ItemType.Directory : ItemType.File
          },
          newItem: {
            refId: newKey,
            name: path.basename(s3item.Key!),
            type: s3item.Key!.endsWith("/") ? ItemType.Directory : ItemType.File
          }
        };
      })
    );
    await this.s3.deleteObjects(deleteParams).promise();
    return {
      directory: {
        name: path.basename(targetPrefix),
        type: ItemType.Directory,
        refId: targetPrefix
      },
      items
    };
  }
}
