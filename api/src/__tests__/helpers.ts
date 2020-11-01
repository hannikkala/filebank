import * as fs from "fs";
import * as jwt from "jsonwebtoken";
import path from "path";
import { Directory, File } from "../models";
import supertest from "supertest";
import { app } from "../app";
import config from "../config/config";
import { DeleteObjectsRequest, ObjectIdentifier } from "aws-sdk/clients/s3";
import _ from "lodash";
import transportFactory from "../transport/factory";
import { S3Storage } from "../transport/s3";

const getS3Storage = () => {
  return transportFactory.getInstance() as S3Storage;
};

export const deleteFolderRecursive = (path: string) => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file: string) => {
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
  }
};

export const truncateS3 = async () => {
  const data = await getS3Storage()
    .s3.listObjects({ Bucket: config.get("storage").s3.bucket })
    .promise();
  if (data.Contents?.length) {
    const delParams: DeleteObjectsRequest = {
      Bucket: config.get("storage").s3.bucket,
      Delete: {
        Objects: data.Contents.map(
          (obj) => ({ Key: obj.Key } as ObjectIdentifier)
        )
      }
    };
    await getS3Storage().s3.deleteObjects(delParams).promise();
  }
};

export const deleteS3Bucket = async () =>
  await getS3Storage()
    .s3.deleteBucket({ Bucket: config.get("storage").s3.bucket })
    .promise();

const allAccessToken = jwt.sign(
  { scope: "filebank:read filebank:write filebank:delete" },
  "v3rys3cr3tK3y"
);

export const createDirectory = (obj: any) => new Directory(obj).save();
export const createFile = (obj: any) => new File(obj).save();

const serverRequest = supertest(app);

export const expectStatus = (response: supertest.Response, status: number) =>
  expect(response.status).toEqual(status);

export const expectStatus200 = (response: supertest.Response) =>
  expectStatus(response, 200);

export const listRequest = (path: string) =>
  serverRequest
    .get(path)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .then((res) => res);

export const getRequest = (path: string) =>
  serverRequest
    .get(path)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .then((res) => res);

export const postDirectoryRequest = (
  path: string,
  name: string,
  schema: string = "",
  metadata: any = {}
) =>
  serverRequest
    .post(path)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .send({ name, type: "directory", metadata, schema })
    .expect("Content-Type", /json/)
    .then((res) => res);

export const putDirectoryRequest = (
  path: string,
  schema: string = "",
  metadata: any = {}
) =>
  serverRequest
    .put(path)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .send({
      ...metadata,
      schema
    })
    .expect("Content-Type", /json/)
    .then((res) => res);

export const postFileRequest = (
  filepath: string,
  file: string,
  schema: string = "",
  metadata: any = {},
  filename: string = ""
) =>
  serverRequest
    .post(filepath)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .field("type", "file")
    .field("metadata", JSON.stringify(metadata))
    .field("schema", schema)
    .field("name", filename || path.basename(file))
    .attach("file", file)
    .expect("Content-Type", /json/)
    .then((res) => res);

export const putFileMetaRequest = (
  filepath: string,
  schema: string = "",
  metadata: any = {}
) =>
  serverRequest
    .put(filepath)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .send({
      ...metadata,
      schema
    })
    .expect("Content-Type", /json/)
    .then((res) => res);

export const deleteDirectory = (filepath: string) =>
  serverRequest
    .delete(filepath)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .then((res) => res);

export const deleteFile = (filepath: string) =>
  serverRequest
    .delete(filepath)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .then((res) => res);

export const moveDirectory = (urlPath: string, target: string) =>
  serverRequest
    .put(urlPath)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .send({ target })
    .then((res) => res);

export const moveFile = (urlPath: string, target: string) =>
  serverRequest
    .put(urlPath)
    .set("Authorization", `Bearer ${allAccessToken}`)
    .send({ target })
    .then((res) => res);

export const fileVerifyS3 = async (...filePieces: string[]) => {
  const isFile = _.includes(_.last(filePieces), ".");
  const data = await getS3Storage()
    .s3.listObjects({
      Bucket: config.get("storage").s3.bucket,
      Prefix: isFile
        ? `${path.join(...filePieces)}`
        : `${path.join(...filePieces)}/`
    })
    .promise();
  return !!data.Contents?.length;
};

export const fileVerifyFS = (...filePieces: string[]) => {
  return fs.existsSync(path.resolve(...filePieces));
};
