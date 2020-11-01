import * as express from "express";
import * as models from "../models/index";
import * as _ from "lodash";
import {
  validateDirectory,
  validateDirectoryMeta,
  validateFile,
  validateFileMeta
} from "../validation/validation";
import {
  Directory,
  File,
  ItemType,
  NotFoundError,
  UserInputError
} from "../index";
import multer from "multer";
import { DirectoryModel } from "../models/directory";
import { FileModel } from "../models/file";
import config from "../config/config";
import { buildTree, listItems } from "../service/DirectoryService";
import { parsePath } from "../service/PathService";
import jwtAuth from "../util/jwt-auth";

import transportFactory from "../transport/factory";
import { checkRole } from "../middleware/checkRole";
const router: express.Router = express.Router();
const storage = transportFactory.getInstance();
const upload = multer();

const authz = config.get("authz");

const nop = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  next();
};

const handleFileUpload = async function (
  req: express.Request,
  res: express.Response,
  currentDir: DirectoryModel | undefined
) {
  let metadata = {};
  try {
    metadata = JSON.parse(req.body.metadata);
  } catch (e) {
    metadata = req.body.metadata;
  }
  const fileObject: File = {
    metadata,
    mimetype:
      req.body.mimetype || req.file
        ? req.file.mimetype
        : "application/octet-stream",
    name: req.body.name || req.file.originalname,
    type: ItemType.File,
    refId: ""
  };
  const fileValidatorResult = validateFile(req.body.schema, fileObject);
  if (fileValidatorResult)
    throw new UserInputError(JSON.stringify(fileValidatorResult));
  const file = await storage.createFile(
    fileObject,
    currentDir,
    req.file.buffer
  );
  fileObject.refId = file.refId;
  const mongoFile = new models.File(fileObject);
  await mongoFile.save();
  res.send(mongoFile);
};

router.get(
  ["/", "/*"],
  [
    authz.enabled ? jwtAuth : nop,
    authz.enabled ? checkRole(_.split(authz.readScope, ",")) : nop
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const pathObj = await parsePath(req.params[0] || "/", true).populate();
      switch (pathObj.current ? pathObj.current.type : ItemType.Directory) {
        case ItemType.Directory:
          if (!pathObj.exists()) throw new NotFoundError();
          res.json(await listItems(pathObj.current as DirectoryModel));
          break;

        case ItemType.File:
          const file = pathObj.current as FileModel;
          res.header("Content-Type", file.mimetype);
          res.send(await storage.getContent(file));
          break;
      }
    } catch (e) {
      console.error(e);
      res.status(404).send("Not found.");
    }
  }
);

router.put(
  "/:id.meta",
  [
    authz.enabled ? jwtAuth : nop,
    authz.enabled ? checkRole(_.split(authz.writeScope, ",")) : nop
  ],
  async (req: express.Request, res: express.Response) => {
    try {
      const [dir, file] = await Promise.all([
        models.Directory.findById(req.params.id).exec(),
        models.File.findById(req.params.id).exec()
      ]);
      if (!dir && !file) {
        throw new NotFoundError("Not found.");
      }
      if (config.get("schemaRequired") && !req.body.schema) {
        throw new UserInputError("Schema parameter is required.");
      }
      if (dir) {
        const validate = validateDirectoryMeta(
          req.body.schema,
          _.omit(req.body, ["schema"])
        );
        if (validate) throw new UserInputError(JSON.stringify(validate));
        dir.set("metadata", req.body);
        await dir.save();
        res.send(dir);
      } else if (file) {
        const validate = validateFileMeta(
          req.body.schema,
          _.omit(req.body, ["schema"])
        );
        if (validate) throw new UserInputError(JSON.stringify(validate));
        file.set("metadata", req.body);
        await file.save();
        res.send(file);
      }
    } catch (e) {
      if (e instanceof NotFoundError) {
        console.warn(e);
        res.status(404).json("Not found.");
      } else if (e instanceof UserInputError) {
        console.warn(e);
        res.status(400).json(e.message);
      } else {
        console.error(e);
        res.status(500).json(e.message);
      }
    }
  }
);

router.post(
  ["/", "/*"],
  [
    authz.enabled ? jwtAuth : nop,
    authz.enabled ? checkRole(_.split(authz.writeScope, ",")) : nop
  ],
  upload.single("file"),
  async (req: express.Request, res: express.Response) => {
    const path: string[] = _.filter(
      (req.params[0] || "").split("/"),
      (part) => !_.isEmpty(part)
    );

    try {
      const dirs = await buildTree(path);
      const currentDir = dirs.pop();

      if (config.get("schemaRequired") && !req.body.schema) {
        throw new UserInputError("Schema parameter is required.");
      }

      if (!req.body.type) {
        req.body.type = req.file ? "file" : "directory";
      }

      switch (req.body.type) {
        case "directory":
          const validatorResult = validateDirectory(
            req.body.schema,
            _.omit(req.body, "schema")
          );
          if (validatorResult)
            throw new UserInputError(validatorResult.toString());
          const data = Object.assign({}, req.body, {
            parent: currentDir ? currentDir._id : null
          });
          const dirObj = await storage.mkdir(
            currentDir ? currentDir.refId : "",
            data
          );
          data.refId = dirObj.refId;
          const dir = new models.Directory(data);
          await dir.save();
          res.send(dir);
          break;

        case "file":
          await handleFileUpload(req, res, currentDir);
          break;

        default:
          throw `Invalid item type: ${req.body.type}`;
      }
    } catch (e) {
      if (e instanceof NotFoundError) {
        console.warn(e);
        res.status(404).json("Directory not found.");
      } else if (e instanceof UserInputError) {
        console.warn(e);
        res.status(400).json(e.message);
      } else {
        console.error(e);
        res.status(500).json(e.message);
      }
    }
  }
);

router.put(
  ["/", "/*"],
  [
    authz.enabled ? jwtAuth : nop,
    authz.enabled ? checkRole(_.split(authz.writeScope, ",")) : nop
  ],
  async (req: express.Request, res: express.Response) => {
    if (!req.body.target) {
      res.status(400).send("Missing target parameter.");
      return;
    }

    try {
      const sourcePath = await parsePath(req.params[0]).populate();
      const targetPath = await parsePath(req.body.target).populate();
      if (!targetPath.basename) {
        throw new UserInputError("Target name empty.");
      }
      if (!sourcePath.current) {
        throw new NotFoundError("Not found.");
      }

      switch (sourcePath.current.type) {
        case ItemType.Directory:
          const dir = sourcePath.current as DirectoryModel;
          const targetRef = targetPath.current ||
            _.last(targetPath.subTree) || {
              name: targetPath.basename,
              parent: null
            };
          const { directory: newDir, items } = await storage.moveDirectory(
            sourcePath.current,
            targetRef as Directory
          );
          await Promise.all(
            items.map(async (change) => {
              const { oldItem, newItem } = change;
              return newItem.type === ItemType.Directory
                ? models.Directory.findOneAndUpdate(
                    { refId: oldItem.refId },
                    { $set: { refId: newItem.refId } }
                  ).exec()
                : models.File.findOneAndUpdate(
                    { refId: oldItem.refId },
                    { $set: { refId: newItem.refId } }
                  ).exec();
            })
          );
          dir.refId = newDir.refId;
          dir.name = newDir.name;
          await dir.save();
          res.send(dir);
          break;

        case ItemType.File:
          if (!targetPath.current)
            throw new NotFoundError("Target directory not found.");
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
  }
);

router.delete(
  ["/", "/*"],
  [
    authz.enabled ? jwtAuth : nop,
    authz.enabled ? checkRole(_.split(authz.deleteScope, ",")) : nop
  ],
  async (req: express.Request, res: express.Response) => {
    // const path: string[] = _.filter((req.params[0] || '').split('/'), part => !_.isEmpty(part));

    try {
      const deletePath = await parsePath(req.params[0]).populate();
      if (!deletePath.current) {
        throw "Not found.";
      }

      switch (deletePath.current.type) {
        case ItemType.Directory:
          const dir = deletePath.current as DirectoryModel;
          await dir.remove();
          await storage.rmdir(dir.refId);
          res.status(204).json("Deleted");
          break;

        case ItemType.File:
          const file = deletePath.current as FileModel;
          await storage.removeFile(file);
          await file.remove();
          res.status(204).json("Deleted");
          break;
      }
    } catch (e) {
      console.error(e);
      res.status(404).send("Not found.");
    }
  }
);

export default router;
