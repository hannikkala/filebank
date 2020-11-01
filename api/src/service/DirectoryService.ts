import { directory, DirectoryModel } from "../models/directory";
import { file, FileModel } from "../models/file";
import { NotFoundError } from "../index";

export const buildTree = async (
  pathArr: string[]
): Promise<DirectoryModel[]> => {
  const dirPath: DirectoryModel[] = [];
  let parent: DirectoryModel | undefined = undefined;
  for (const i in pathArr) {
    const path = pathArr[i];
    const dir: DirectoryModel | null = await directory
      .findOne({
        name: path,
        parent: !parent ? { $eq: undefined } : parent._id
      })
      .exec();
    if (!dir) {
      throw new NotFoundError(`Directory ${path} not found.`);
    }
    parent = dir;
    dirPath.push(dir);
  }
  return dirPath;
};

export const listItems = async (
  dir: undefined | DirectoryModel
): Promise<(DirectoryModel | FileModel)[]> => {
  const dirs = await directory
    .find({ parent: dir ? dir._id : { $eq: null } })
    .exec();
  const files = await file
    .find({ directory: dir ? dir._id : { $eq: null } })
    .exec();
  return [...dirs, ...files];
};
