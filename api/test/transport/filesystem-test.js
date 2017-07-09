const filesystemstorageroot = '/tmp/filebank';
process.env.FILESYSTEM_STORAGE_ROOT = filesystemstorageroot;

const fs = require('fs');
const path = require('path');
const chai = require('chai');
const assert = chai.assert;
const helpers = require('../helpers');
const Promise = require('bluebird');
const Filesystem = require('../../dist/transport/filesystem').FilesystemStorage;

describe('Filesystem storage', () => {
  const filesystem = new Filesystem(filesystemstorageroot);

  before(() => {
    if (fs.existsSync(filesystemstorageroot)) {
      helpers.deleteFolderRecursive(filesystemstorageroot);
      fs.mkdirSync(filesystemstorageroot);
    }

    filesystem.setRootDir(filesystemstorageroot);
  });

  it('can create directory', () => {
    return filesystem.mkdir('', { refId: 'temp', name: 'temp' })
      .then((dir) => {
        assert(dir, 'Directory was not created.');
        assert(dir.type === 'directory', 'Type was not directory.');
        assert(fs.existsSync(path.resolve(filesystemstorageroot, 'temp')));
      });
  });

  it('returns Promise when error', (done) => {
    filesystem.mkdir('nonexisting', { refId: 'temp', name: 'temp' })
      .then(() => {
        done(new Error('Should throw an error.'));
      }).catch((err) => {
        done();
      });
  });

  it('can create subdirectory', () => {
    return filesystem.mkdir('', { refId: 'subdir', name: 'subdir' })
      .then((d) => filesystem.mkdir(d.refId, { refId: 'temp', name: 'temp' }))
      .then((directory) => {
        assert(directory.refId === 'subdir/temp');
        assert(fs.existsSync(path.resolve(filesystemstorageroot, 'subdir', 'temp')));
      })
  });

  it('can create file on root', () => {
    return filesystem.createFile({ name: 'test.txt', refId: 'test.txt' }, undefined, new Buffer('test text'))
      .then((file) => {
        assert(file, 'File was not created.');
        assert(file.type === 'file', 'Type was not file.');
        assert(fs.existsSync(path.resolve(filesystemstorageroot, file.refId)));
      })
  });

  it('returns Promise when creating file failed', (done) => {
    filesystem.createFile({ name: 'test.txt', refId: 'test.txt' }, { refId: 'nonexist', name: 'nonexist' }, new Buffer('test text'))
      .then(() => {
        done(new Error('Should throw error.'));
      }).catch((err) => {
        done();
      })
  });

  it('can create file on subdir', () => {
    return filesystem.mkdir('', { refId: 'subdir2', name: 'subdir2' })
      .then((dir) => filesystem.createFile({ name: 'test.txt', refId: 'test.txt' }, dir, new Buffer('test text')))
      .then((file) => {
        assert(file, 'File was not created.');
        assert(file.refId === 'subdir2/test.txt', 'Wrong file reference.');
        assert(file.type === 'file', 'Type was not file.');
        assert(fs.existsSync(path.resolve(filesystemstorageroot, file.refId)));
      })
  });

  it('can remove directory', () => {
    return filesystem.mkdir('', { refId: 'rmdir', name: 'rmdir' })
      .then((dir) => filesystem.createFile({ refId: 'test.txt', name: 'test.txt' }, dir, new Buffer('testtesttest')))
      .then((file) => {
        assert(fs.existsSync(path.resolve(filesystemstorageroot, file.refId)));
        return filesystem.rmdir('rmdir');
      }).then(() => {
        assert(!fs.existsSync(path.resolve(filesystemstorageroot, 'rmdir')));
      })
  });

  it('returns Promise when removing directory fails', (done) => {
    filesystem.rmdir('nonexist')
      .then(() => {
        done(new Error('Should throw error.'));
      })
      .catch(() => {
        done();
      })
  });

  it('can get file content', () => {
    return filesystem.createFile({ refId: 'content.txt', name: 'content.txt' }, null, new Buffer('testtesttest'))
      .then((file) => filesystem.getContent(file))
      .then((buffer) => {
        assert(buffer.toString() === 'testtesttest', 'Content does not match.')
      });
  });

  it('can list directory contents', () => {
    return filesystem.mkdir('', { refId: 'content', name: 'content' })
      .then((root) => Promise.all([
        filesystem.createFile({ refId: 'fileone.txt', name: 'fileone.txt' }, root, new Buffer('test')),
        filesystem.createFile({ refId: 'filetwo.txt', name: 'filetwo.txt' }, root, new Buffer('test2')),
        filesystem.mkdir(root.refId, { refId: 'subdir', name: 'subdir' }),
      ])).then(() => filesystem.list('content'))
      .then((list) => {
        assert(list.length === 3, 'Item count mismatch.');
        assert(list.filter(item => item.type === 'file').length === 2, 'File count mismatch.');
        assert(list.filter(item => item.type === 'directory').length === 1, 'Directory count mismatch.');
      });
  });

  it('can remove file', () => {
    return filesystem.createFile({ refId: 'rmfile.txt', name: 'rmfile.txt' }, null, new Buffer('testtesttest'))
      .then((file) => filesystem.removeFile(file))
      .then(() => {
        assert(!fs.existsSync(path.resolve(filesystemstorageroot, 'rmfile.txt')), 'File still exists.')
      });
  });

  it('can move file', async () => {
    const file = await filesystem.createFile({ refId: 'mvfile.txt', name: 'mvfile.txt' }, null, new Buffer('testtesttest'));
    const dir = await filesystem.mkdir('', { name: 'moveto', refId: 'moveto' });
    const newFile = await filesystem.moveFile(file, dir);
    assert.equal(newFile.refId, 'moveto/mvfile.txt');
    assert(fs.existsSync(path.resolve(filesystemstorageroot, 'moveto', 'mvfile.txt')));
  });

  it('can move directory and contents', async () => {
    const from = await filesystem.mkdir('', { name: 'dirmovefrom', refId: 'dirmovefrom' });
    await filesystem.mkdir('dirmovefrom', { name: 'sub1', refId: 'dirmovefrom/sub1' });
    await filesystem.createFile({ refId: 'mvfile.txt', name: 'dirmovefrom/mvfile.txt' }, null, new Buffer('testtesttest'));
    const to = await filesystem.mkdir('', { name: 'dirmoveto', refId: 'dirmoveto' });
    const dir = await filesystem.moveDirectory(from, { name: 'dirmovefrom', refId: 'dirmoveto/dirmovefrom'}, async (old, newItem) => {
      console.log(old, newItem);
    });
  });

  after((done) => {
    if (fs.existsSync(filesystemstorageroot)) {
      helpers.deleteFolderRecursive(filesystemstorageroot);
    }
    done();
  })
});
