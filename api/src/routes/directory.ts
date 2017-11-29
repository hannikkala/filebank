import * as express from 'express';
import models from '../models';
import * as _ from 'lodash';
import DirectoryService = require('../service/DirectoryService');
import { validateDirectory, validateDirectoryMeta, validateFile, validateFileMeta } from '../validation/validation';
import { NotFoundError, UserInputError, ItemType, Item } from '../index';
import * as multer from 'multer';
import { DirectoryModel } from '../models/directory';
import * as Bluebird from 'bluebird';
import { FileModel } from '../models/file';
import PathService = require('../service/PathService');
import jwtAuthz = require('express-jwt-authz');
import jwt = require('../util/jwt-auth');
import { config } from '../config';

const transportFactory = require('../transport/factory');
const router: express.Router = express.Router();
const storage = transportFactory.getInstance();
const upload = multer();

const nop = (req: express.Request, res:  express.Response, next: express.NextFunction) => {
  next();
};

const handleFileUpload = async function (req: express.Request, res: express.Response, currentDir: DirectoryModel|undefined) {
  let metadata = {};
  try {
    metadata = JSON.parse(req.body.metadata);
  } catch (e) {
    metadata = req.body.metadata;
  }
  const fileObject = {
    metadata,
    mimetype: req.body.mimetype || req.file ? req.file.mimetype : 'application/octet-stream',
    name: req.body.name || req.file.originalname,
    type: 'file',
    refId: '',
  };
  const fileValidatorResult = validateFile(req.body.schema, fileObject);
  if (fileValidatorResult) throw new UserInputError(JSON.stringify(fileValidatorResult));
  const file = await storage.createFile(fileObject, currentDir, req.file.buffer);
  fileObject.refId = file.refId;
  const mongoFile = new models.File(fileObject);
  await mongoFile.save();
  res.send(mongoFile);
};

router.get(['/', '/*'], config.authz.enabled ? jwt : nop, config.authz.enabled ? jwtAuthz(config.authz.readScope) : nop, async (req: express.Request, res: express.Response) => {
  try {
    const pathObj = await PathService.parsePath(req.params[0] || '/', true).populate();
    switch (pathObj.current ? pathObj.current.type : ItemType.Directory) {
      case ItemType.Directory:
        if(!pathObj.exists()) throw new NotFoundError();
        res.json(await DirectoryService.listItems(pathObj.current as DirectoryModel));
        break;

      case ItemType.File:
        const file = pathObj.current as FileModel;
        res.header('Content-Type', file.mimetype);
        res.send(await storage.getContent(file));
        break;
    }
  } catch (e) {
    console.error(e);
    res.status(404).send('Not found.');
  }
});

router.put('/:id\.meta', config.authz.enabled ? jwt : nop, config.authz.enabled ? jwtAuthz(config.authz.writeScope): nop, async (req: express.Request, res: express.Response) => {
  try {
    const [dir, file] = await Bluebird.all([
      models.Directory.findById(req.params.id).exec(),
      models.File.findById(req.params.id).exec()
    ]);
    if (!dir && !file) {
      throw new NotFoundError('Not found.');
    }
    if (config.schemaRequired && !req.body.schema) {
      throw new UserInputError('Schema parameter is required.');
    }
    if (dir) {
      const validate = validateDirectoryMeta(req.body.schema, _.omit(req.body, ['schema']));
      if (validate) throw new UserInputError(JSON.stringify(validate));
      dir.set('metadata', req.body);
      await dir.save();
      res.send(dir);
    } else if (file) {
      const validate = validateFileMeta(req.body.schema, _.omit(req.body, ['schema']));
      if (validate) throw new UserInputError(JSON.stringify(validate));
      file.set('metadata', req.body);
      await file.save();
      res.send(file);
    }
  } catch (e) {
    if (e instanceof NotFoundError) {
      console.warn(e);
      res.status(404).json('Not found.');
    } else if (e instanceof UserInputError) {
      console.warn(e);
      res.status(400).json(e.message);
    } else {
      console.error(e);
      res.status(500).json(e.message);
    }
  }
});

router.post(['/', '/*'], config.authz.enabled ? jwt : nop, config.authz.enabled ? jwtAuthz(config.authz.writeScope) : nop, upload.single('file'), async (req: express.Request, res: express.Response) => {
  const path: string[] = _.filter((req.params[0] || '').split('/'), part => !_.isEmpty(part));

  try {
    const dirs = await DirectoryService.buildTree(path);
    const currentDir = dirs.pop();

    if (config.schemaRequired && !req.body.schema) {
      throw new UserInputError('Schema parameter is required.');
    }

    if (!req.body.type) {
      req.body.type = req.file ? 'file' : 'directory';
    }

    switch (req.body.type) {
      case 'directory':
        const validatorResult = validateDirectory(req.body.schema, _.omit(req.body, 'schema'));
        if (validatorResult) throw new UserInputError(validatorResult.toString());
        const data = Object.assign({}, req.body, { parent: currentDir ? currentDir._id : null });
        const dirObj = await storage.mkdir(currentDir ? currentDir.refId : '', data);
        data.refId = dirObj.refId;
        const dir = new models.Directory(data);
        await dir.save();
        res.send(dir);
        break;

      case 'file':
        await handleFileUpload(req, res, currentDir);
        break;

      default:
        throw `Invalid item type: ${req.body.type}`;
    }
  } catch (e) {
    if (e instanceof NotFoundError) {
      console.warn(e);
      res.status(404).json('Directory not found.');
    } else if (e instanceof UserInputError) {
      console.warn(e);
      res.status(400).json(e.message);
    } else {
      console.error(e);
      res.status(500).json(e.message);
    }
  }
});

router.put(['/', '/*'], config.authz.enabled ? jwt : nop, config.authz.enabled ? jwtAuthz(config.authz.writeScope) : nop, async (req: express.Request, res: express.Response) => {
  if (!req.body.target) {
    res.status(400).send('Missing target parameter.');
    return;
  }

  try {
    const sourcePath = await PathService.parsePath(req.params[0]).populate();
    const targetPath = await PathService.parsePath(req.body.target).populate();
    if (!targetPath.basename) {
      throw new UserInputError('Target name empty.');
    }
    if (!sourcePath.current) {
      throw new NotFoundError('Not found.');
    }

    switch (sourcePath.current.type) {
      case ItemType.Directory:
        const dir = sourcePath.current as DirectoryModel;
        const targetRef = targetPath.current || _.last(targetPath.subTree) || { name: targetPath.basename };
        const newDir = await storage.moveDirectory(sourcePath.current, targetRef, (oldItem: Item, newItem: Item) => {
          return newItem.type === ItemType.Directory ?
            models.Directory.findOneAndUpdate({ refId: oldItem.refId }, { $set: { refId: newItem.refId } }).exec() :
            models.File.findOneAndUpdate({ refId: oldItem.refId }, { $set: { refId: newItem.refId } }).exec();
        });
        dir.refId = newDir.refId;
        dir.name = newDir.name;
        await dir.save();
        res.send(dir);
        break;

      case ItemType.File:
        if (!targetPath.current) throw new NotFoundError('Target directory not found.');
        const file = sourcePath.current as FileModel;
        const updatedFile = await storage.moveFile(file, targetPath.current);
        file.refId = updatedFile.refId;
        await file.save();
        res.send(file);
        break;
    }
  } catch (e) {
    if (e instanceof NotFoundError) {
      console.warn(e);
      res.status(404).send(e.message);
    } else {
      console.error(e);
      res.status(500).send(e.message);
    }
  }
});

router.delete(['/', '/*'], config.authz.enabled ? jwt : nop, config.authz.enabled ? jwtAuthz(config.authz.deleteScope) : nop, async (req: express.Request, res: express.Response) => {
  const path: string[] = _.filter((req.params[0] || '').split('/'), part => !_.isEmpty(part));

  try {
    const deletePath = await PathService.parsePath(req.params[0]).populate();
    if (!deletePath.current) {
      throw 'Not found.';
    }

    switch (deletePath.current.type) {
      case ItemType.Directory:
        const dir = deletePath.current as DirectoryModel;
        await dir.remove();
        await storage.rmdir(dir.refId);
        res.status(204).json('Deleted');
        break;

      case ItemType.File:
        const file = deletePath.current as FileModel;
        await storage.removeFile(file);
        await file.remove();
        res.status(204).json('Deleted');
        break;
    }
  } catch (e) {
    console.error(e);
    res.status(404).send('Not found.');
  }
});

export = router;
