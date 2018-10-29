require('clear-require').all();

const config = require('../../dist/config').config;
config.storage.s3.enabled = true;
config.storage.s3.bucket = 'test-bucket-for-stuff';
config.storage.enabled = 's3';
const AWS = require('aws-sdk');

const storage = require('../../dist/transport/factory').getInstance();
const _ = require('lodash');
const models = require('../../dist/models').default;
const helpers = require('../helpers');
const apiTestBase = require('../apiTestBase');
const path = require('path');

describe('Directory S3 API route', () => {

  const s3 = new AWS.S3(config.storage.s3.clientOptions);

  before(() => {
    return new Promise((resolve) => {
      storage.on('initialized', () => {
        resolve();
      })
    });
  });

  beforeEach(() => Promise.all([
    models.File.remove({}).exec(),
    models.Directory.remove({}).exec(),
  ]));

  const cb = (...filePieces) => {
    const isFile = _.includes(_.last(filePieces), '.');
    return s3.listObjects({ Bucket: config.storage.s3.bucket, Prefix: isFile ? `${path.join(...filePieces)}` : `${path.join(...filePieces)}/` }).promise()
      .then((data) => {
        return !!data.Contents.length;
      });
  };

  apiTestBase.getRoutes(cb);
  apiTestBase.postRoutes(cb);
  apiTestBase.putMetaRoutes(cb);
  apiTestBase.deleteRoutes(cb);
  apiTestBase.putRoutes(cb);

  after(() => {
    return s3.listObjects({ Bucket: config.storage.s3.bucket }).promise()
      .then((data) => {
        if (!data.Contents.length) return;
        const delParams = {
          Bucket: config.storage.s3.bucket,
          Delete: {
            Objects: [],
          },
        };
        data.Contents.map(obj => {
          return delParams.Delete.Objects.push({ Key: obj.Key });
        });
        return s3.deleteObjects(delParams).promise();
      }).then(() => s3.deleteBucket({ Bucket: config.storage.s3.bucket }).promise());
  });
});
