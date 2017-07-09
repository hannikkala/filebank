require('clear-require').all();
const filesystemstorageroot = '/tmp/filebank';
const config = require('../../dist/config').config;
config.storage.filesystem.rootDir = filesystemstorageroot;
config.storage.enabled = 'filesystem';
const fs = require('fs');
const path = require('path');
const models = require('../../dist/models').default;
const helpers = require('../helpers');
const FilesystemStorage = require('../../dist/transport/filesystem').FilesystemStorage;
const apiTestBase = require('../apiTestBase');

describe('Directory API route', () => {

  const filesystem = new FilesystemStorage(filesystemstorageroot);

  before(() => {
    if (fs.existsSync(filesystemstorageroot)) {
      helpers.deleteFolderRecursive(filesystemstorageroot);
      fs.mkdirSync(filesystemstorageroot);
    }

    filesystem.setRootDir(filesystemstorageroot);
  });

  beforeEach(() => Promise.all([
    models.File.remove({}).exec(),
    models.Directory.remove({}).exec(),
  ]));

  const cb = (...filePieces) => {
    return Promise.resolve(fs.existsSync(path.resolve(filesystemstorageroot, ...filePieces)));
  };

  apiTestBase.getRoutes(cb);
  apiTestBase.postRoutes(cb);
  apiTestBase.putMetaRoutes(cb);
  apiTestBase.deleteRoutes(cb);
  apiTestBase.putRoutes(cb);

  after((done) => {
    helpers.deleteFolderRecursive(filesystemstorageroot);
    done();
  });
});
