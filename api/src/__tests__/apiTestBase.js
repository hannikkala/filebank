process.env.FILESYSTEM_STORAGE_ENABLED = true;
process.env.FILESYSTEM_STORAGE_ROOT = '/tmp/filebank';

const validation = require('../dist/validation/validation');
const models = require('../dist/models').default;
const app = require('../dist/app');
const supertest = require('supertest');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const config = require('../dist/config').config;
const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
chai.use(require('chai-as-promised'));

const allAccessToken = jwt.sign({ scope: 'filebank:read filebank:write filebank:delete' }, 'v3rys3cr3tK3y');

const createDirectory = (obj) => new models.Directory(obj);
const createFile = (obj) => new models.File(obj);

const getRoutes = (fileVerifyCb) => {
  describe('GET route', () => {
    it('can list items in root directory', async () => {
      await Promise.all([
        createDirectory({ name: 'test', refId: 'test' }).save(),
        createDirectory({ name: 'test2', refId: 'test2' }).save(),
        createDirectory({ name: 'test3', refId: 'test3' }).save(),
        createFile({ name: 'test.txt', refId: 'test.txt', mimetype: 'application/octet-stream' }).save(),
        createFile({ name: 'test2.txt', refId: 'test2.txt', mimetype: 'application/octet-stream' }).save(),
        createFile({ name: 'test3.txt', refId: 'test3.txt', mimetype: 'application/octet-stream' }).save(),
      ]);
      return supertest(app)
        .get('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(res.body.length).to.equal(6);
        });
    });

    it('can list items in subdirectory', async () => {
      const directory = createDirectory({ name: 'subdir', refId: 'subdir' });
      await directory.save();
      await Promise.all([
        createDirectory({ name: 'test', refId: 'test', parent: directory._id }).save(),
        createDirectory({ name: 'test2', refId: 'test2', parent: directory._id }).save(),
        createFile({ name: 'test.txt', refId: 'test.txt', mimetype: 'application/octet-stream', directory: directory._id }).save(),
        createFile({ name: 'test2.txt', refId: 'test2.txt', mimetype: 'application/octet-stream', directory: directory._id }).save(),
      ]);
      return supertest(app)
        .get('/subdir')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          expect(res.body.length).to.equal(4);
        });
    });

    it('cannot list items in non-existing directory', async () => {
      await supertest(app)
        .get('/nonexisting')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect(404);
      expect(await fileVerifyCb('nonexisting')).to.equal(false);
    });

    it('can get file content', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('type', 'file')
        .attach('file', `${__dirname}/resources/64-64.jpg`)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(await fileVerifyCb('64-64.jpg')).to.equal(true);
      await supertest(app)
        .get('/64-64.jpg')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect(200)
        .expect('Content-Type', 'image/jpeg')
        .then(res => {
          assert(res.body instanceof Buffer, 'Return value must be buffer');
          const file = fs.readFileSync(`${__dirname}/resources/64-64.jpg`);
          assert.equal(res.body.length, file.length, 'Content size must match.');
        });
    });
  });
};

const postRoutes = (fileVerifyCb) => {
  describe('POST route', () => {
    it('can create directory on fs root', async () => {
      const dir = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'test-1', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('test-1'));
          assert.equal(res.body.type, 'directory');
        });
      expect(await fileVerifyCb('test-1')).to.equal(true);
      return dir;
    });

    it('can create directory on subdir', async () => {
      const subdir = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'test-2', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('test-2'));
          assert.equal(res.body.type, 'directory');
          return res.body;
        });
      const d = await supertest(app)
        .post('/test-2')
        .send({ name: 'test-3', type: 'directory' })
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('test-2/test-3'));
          assert.equal(res.body.type, 'directory');
          assert.equal(res.body.parent, subdir._id);
        });
      expect(await fileVerifyCb('test-2', 'test-3')).to.equal(true);
      return d;
    });

    it('cannot create directory with invalid metadata', async () => {
      const dir = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          name: 'faildir',
          type: 'directory',
          metadata: {
            deepMeta: { thing: 'this should be number', another: 2, third: false },
            metaField: 'nottrue',
          },
          schema: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(400);
      expect(await fileVerifyCb('faildir')).to.equal(false);
      return dir;
    });

    it('can create file on root dir', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('metadata', JSON.stringify({
          deepMeta: { thing: 1, another: 2, third: 'third' },
          metaField: true,
        }))
        .field('type', 'file')
        .field('schema', 'Test')
        .attach('file', `${__dirname}/resources/fire.jpg`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert.equal(res.body.mimetype, 'image/jpeg');
          assert(res.body.refId.startsWith('fire.jpg'));
          assert.equal(res.body.type, 'file');
          assert.isObject(res.body.metadata, 'Metadata should be an object');
          assert.equal(res.body.metadata.deepMeta.another, 2);
        });
      expect(await fileVerifyCb('fire.jpg')).to.equal(true);
    });

    it('can create file on sub dir', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'test-4', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('test-4'));
          assert.equal(res.body.type, 'directory');
          return res.body;
        });
      await supertest(app)
        .post('/test-4')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('metadata', JSON.stringify({
          deepMeta: { thing: 1, another: 2, third: 'third' },
          metaField: true,
        }))
        .field('type', 'file')
        .field('schema', 'Test')
        .attach('file', `${__dirname}/resources/fire.pdf`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert.equal(res.body.mimetype, 'application/pdf');
          assert(res.body.refId.startsWith('test-4/fire.pdf'));
          assert.equal(res.body.type, 'file');
          assert.isObject(res.body.metadata, 'Metadata should be an object');
          assert.equal(res.body.metadata.deepMeta.third, 'third');
        });
      expect(await fileVerifyCb('test-4', 'fire.pdf')).to.equal(true);
    });

    it('can create file with different name', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('metadata', JSON.stringify({
          deepMeta: { thing: 1, another: 2, third: 'third' },
          metaField: true,
        }))
        .field('type', 'file')
        .field('name', 'another-fire.jpg')
        .field('schema', 'Test')
        .attach('file', `${__dirname}/resources/fire.jpg`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert.equal(res.body.mimetype, 'image/jpeg');
          assert(res.body.refId.startsWith('another-fire.jpg'));
          assert.equal(res.body.type, 'file');
          assert.isObject(res.body.metadata, 'Metadata should be an object');
          assert.equal(res.body.metadata.deepMeta.another, 2);
        });
      expect(await fileVerifyCb('another-fire.jpg')).to.equal(true);
    });

    it('cannot create file when schema is missing and required', async () => {
      config.schemaRequired = true;
      try {
        const promise = await supertest(app)
          .post('/')
          .set('Authorization', `Bearer ${allAccessToken}`)
          .field('metadata', JSON.stringify({}))
          .field('type', 'file')
          .attach('file', `${__dirname}/resources/fire.pdf`)
          .expect('Content-Type', /json/)
          .expect(400);
        expect(await fileVerifyCb('fire.pdf')).to.equal(false);
        return promise;
      } finally {
        config.schemaRequired = false;
      }
    });

    it('cannot create directory when schema is missing and required', async () => {
      config.schemaRequired = true;
      try {
        await supertest(app)
          .post('/')
          .set('Authorization', `Bearer ${allAccessToken}`)
          .send({
            name: 'faildir',
            type: 'directory',
            metadata: {
              deepMeta: { thing: 1, another: 2, third: 'third' },
              metaField: true,
            },
          })
          .expect('Content-Type', /json/)
          .expect(400);
      } finally {
        config.schemaRequired = false;
      }
    });
  });
};

const putMetaRoutes = (fileVerifyCb) => {
  describe('PUT .meta route', () => {
    it('cannot create file with invalid metadata', async () => {
      const promise = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('metadata', JSON.stringify({
          deepMeta: { thing: 'this should be number', another: 2, third: false },
          metaField: 'nottrue',
        }))
        .field('type', 'file')
        .field('schema', 'Test')
        .attach('file', `${__dirname}/resources/fire.pdf`)
        .expect('Content-Type', /json/)
        .expect(400);
      expect(await fileVerifyCb('fire.pdf')).to.equal(false);
      return promise;
    });

    it('can update metadata for directory', async () => {
      const dir = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          name: 'metadir',
          type: 'directory',
          metadata: {
            deepMeta: { thing: 1, another: 2, third: 'third' },
            metaField: true,
          },
          schema: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('metadir'));
          assert.equal(res.body.type, 'directory');
          return res.body;
        });
      return await supertest(app)
        .put(`/${dir._id}.meta`)
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          deepMeta: { thing: 2, another: 4, third: 'fourth' },
          metaField: false,
          schema: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert.equal(res.body.metadata.metaField, false);
          assert.equal(res.body.metadata.deepMeta.thing, 2);
          assert.equal(res.body.metadata.deepMeta.another, 4);
          assert.equal(res.body.metadata.deepMeta.third, 'fourth');
        });
    });

    it('cannot update invalid metadata for directory', async () => {
      const dir = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          name: 'metadir-2',
          type: 'directory',
          metadata: {
            deepMeta: { thing: 1, another: 2, third: 'third' },
            metaField: true,
          },
          schema: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('metadir-2'));
          assert.equal(res.body.type, 'directory');
          return res.body;
        });
      return await supertest(app)
        .put(`/${dir._id}.meta`)
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          deepMeta: { thing: 'should be number', another: 4, third: false },
          metaField: 'should be boolean',
          schema: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(400);
    });

    it('can update file metadata', async () => {
      const file = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('metadata', JSON.stringify({
          deepMeta: { thing: 1, another: 2, third: 'third' },
          metaField: true,
        }))
        .field('type', 'file')
        .field('name', 'meta.pdf')
        .field('schema', 'Test')
        .attach('file', `${__dirname}/resources/fire.pdf`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then((res) => res.body);
      return await supertest(app)
        .put(`/${file._id}.meta`)
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          deepMeta: { thing: 2, another: 4, third: 'fourth' },
          metaField: false,
          schema: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(200)
        .then((res) => {
          assert.equal(res.body.metadata.metaField, false);
          assert.equal(res.body.metadata.deepMeta.thing, 2);
          assert.equal(res.body.metadata.deepMeta.another, 4);
          assert.equal(res.body.metadata.deepMeta.third, 'fourth');
        });
    });

    it('cannot update file with invalid metadata', async () => {
      const file = await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('metadata', JSON.stringify({
          deepMeta: { thing: 1, another: 2, third: 'third' },
          metaField: true,
        }))
        .field('type', 'file')
        .field('name', 'meta.pdf')
        .field('schema', 'Test')
        .attach('file', `${__dirname}/resources/fire.pdf`)
        .expect('Content-Type', /json/)
        .expect(200)
        .then((res) => res.body);
      return await supertest(app)
        .put(`/${file._id}.meta`)
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          deepMeta: { thing: 'should be number', another: 4, third: 'fourth' },
          metaField: 'should be boolean',
          schema: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(400);
    });

    it('cannot update metadata non-existing item', async () => {
      return await supertest(app)
        .put(`/ffffffffffffffffffffffff.meta`)
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({
          deepMeta: { thing: 2, another: 4, third: 'fourth' },
          metaField: false,
          schema: 'Test',
        })
        .expect(404);
    });
  });
};

const deleteRoutes = (fileVerifyCb) => {
  describe('DELETE route', () => {
    it('can delete directory on fs root', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'deletethis', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('deletethis'));
          assert.equal(res.body.type, 'directory');
        });
      const del = await supertest(app)
        .delete('/deletethis')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect(204);
      expect(await fileVerifyCb('deletethis')).to.equal(false);
      return del;
    });

    it('cannot delete non-existing directory', async () => {
      const del = await supertest(app)
        .delete('/nonexisting')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect(404);
      expect(await fileVerifyCb('nonexisting')).to.equal(false);
      return del;
    });

    it('can delete file on fs root', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('type', 'file')
        .attach('file', `${__dirname}/resources/64-64.jpg`)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(await fileVerifyCb('64-64.jpg')).to.equal(true);
      await supertest(app)
        .delete('/64-64.jpg')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect(204);
      expect(await fileVerifyCb('64-64.jpg')).to.equal(false);
    });

    it('cannot delete non-existing file', async () => {
      await supertest(app)
        .delete('/nonexisting.jpg')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .expect(404);
      expect(await fileVerifyCb('nonexisting.jpg')).to.equal(false);
    });
  });
};

const putRoutes = (fileVerifyCb) => {
  describe('PUT route', () => {
    it('can move file', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('type', 'file')
        .field('name', 'moveme.jpg')
        .attach('file', `${__dirname}/resources/64-64.jpg`)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(await fileVerifyCb('moveme.jpg')).to.equal(true);
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'movehere', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('movehere'));
          assert.equal(res.body.type, 'directory');
        });
      await supertest(app)
        .put('/moveme.jpg')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ target: '/movehere' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('movehere/moveme.jpg'));
          assert.equal(res.body.type, 'file');
        });
      expect(await fileVerifyCb('movehere', 'moveme.jpg')).to.equal(true);
    });

    it('cannot move file to nonexisting directory', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('type', 'file')
        .field('name', 'moveme2.jpg')
        .attach('file', `${__dirname}/resources/64-64.jpg`)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(await fileVerifyCb('moveme2.jpg')).to.equal(true);
      await supertest(app)
        .put('/moveme2.jpg')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ target: '/movehere' })
        .expect(404);
      expect(await fileVerifyCb('movehere', 'moveme2.jpg')).to.equal(false);
    });

    it('can move directory', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'movethisdir', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('movethisdir'));
          assert.equal(res.body.type, 'directory');
        });
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'moveheredir', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('moveheredir'));
          assert.equal(res.body.type, 'directory');
        });
      await supertest(app)
        .post('/movethisdir')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('type', 'file')
        .field('name', 'moveme.jpg')
        .attach('file', `${__dirname}/resources/64-64.jpg`)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(await fileVerifyCb('movethisdir', 'moveme.jpg')).to.equal(true);
      await supertest(app)
        .put('/movethisdir')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ target: '/moveheredir' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('moveheredir/movethisdir'));
          assert.equal(res.body.type, 'directory');
        });
      expect(await fileVerifyCb('moveheredir', 'movethisdir')).to.equal(true);
    });

    it('can rename directory', async () => {
      await supertest(app)
        .post('/')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ name: 'movethisdir1', type: 'directory' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('movethisdir1'));
          assert.equal(res.body.type, 'directory');
        });
      await supertest(app)
        .post('/movethisdir1')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .field('type', 'file')
        .field('name', 'moveme.jpg')
        .attach('file', `${__dirname}/resources/64-64.jpg`)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(await fileVerifyCb('movethisdir1', 'moveme.jpg')).to.equal(true);
      await supertest(app)
        .put('/movethisdir1')
        .set('Authorization', `Bearer ${allAccessToken}`)
        .send({ target: '/moveheredir1' })
        .expect('Content-Type', /json/)
        .expect(200)
        .then(res => {
          assert(res.body.refId.startsWith('moveheredir1'));
          assert.equal(res.body.type, 'directory');
        });
      expect(await fileVerifyCb('moveheredir1')).to.equal(true);
    });
  });
};

module.exports = {
  getRoutes,
  postRoutes,
  putMetaRoutes,
  deleteRoutes,
  putRoutes,
};