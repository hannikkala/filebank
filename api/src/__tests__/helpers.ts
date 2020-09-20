import * as fs from 'fs';

export const deleteFolderRecursive = (path: string) => {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file: string) => {
      const curPath = `${path}/${file}`;
      if (fs.statSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};
