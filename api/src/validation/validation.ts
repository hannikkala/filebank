import ajv, { ErrorObject, ValidateFunction } from "ajv";
import glob from "glob";
import { omit } from "lodash";
import path from "path";

const fileSchemas = {} as Schemas;
const directorySchemas = {} as Schemas;

glob(`${__dirname}/../../schemas/file/*.json`, (err, files) => {
  if (err) throw err;
  files.forEach((file) => {
    fileSchemas[path.basename(file, ".json")] = require(file);
  });
});

glob(`${__dirname}/../../schemas/directory/*.json`, (err, files) => {
  if (err) throw err;
  files.forEach((file) => {
    directorySchemas[path.basename(file, ".json")] = require(file);
  });
});

type Schema = {
  id: string;
  type: string;
  properties: { [key: string]: any };
  required: Array<string>;
};

type Schemas = {
  [key: string]: Schema;
};

const directorySchema: Schema = {
  id: "Directory",
  type: "object",
  properties: {
    type: {
      enum: ["directory"]
    },
    name: {
      type: "string",
      minLength: 1
    },
    metadata: {
      type: "object"
    }
  },
  required: ["name", "type"]
};

const fileSchema: Schema = {
  id: "File",
  type: "object",
  properties: {
    type: {
      enum: ["file"]
    },
    name: {
      type: "string",
      minLength: 1
    },
    mimetype: {
      type: "string"
    },
    metadata: {
      type: "object"
    }
  },
  required: ["name", "type", "mimetype"]
};

const validateFn = (
  schema: Schema,
  obj: any
): ErrorObject[] | undefined | null => {
  const ajvInstance = new ajv({ allErrors: true });
  const validate: ValidateFunction = ajvInstance.compile(omit(schema, "id"));
  validate(obj);
  return validate.errors;
};

export const validateFile = (
  schema: string,
  obj: any
): ErrorObject[] | undefined | null => {
  const schemaObj = fileSchema;
  schemaObj.properties.metadata = schema
    ? fileSchemas[schema]
    : fileSchemas["Default"];
  return validateFn(schemaObj, obj);
};

export const validateDirectory = (
  schema: string,
  obj: any
): ErrorObject[] | undefined | null => {
  const schemaObj = directorySchema;
  schemaObj.properties.metadata = schema
    ? directorySchemas[schema]
    : directorySchemas["Default"];
  return validateFn(schemaObj, obj);
};

export const validateFileMeta = (
  schema: string,
  obj: any
): ErrorObject[] | undefined | null => {
  const schemaObj = schema ? fileSchemas[schema] : fileSchemas["Default"];
  return validateFn(schemaObj, obj);
};

export const validateDirectoryMeta = (
  schema: string,
  obj: any
): ErrorObject[] | undefined | null => {
  const schemaObj = schema
    ? directorySchemas[schema]
    : directorySchemas["Default"];
  return validateFn(schemaObj, obj);
};
/*export const expressValidator = (schema: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const schemaObj = schemas[schema];
    const ajvInstance = new ajv({ allErrors: true });
    const validate: ValidateFunction = ajvInstance.compile(schemaObj);
    const valid = validate(req.body);
    if (!valid) {
      next(new Error('Validation failed.'));
    } else {
      next();
    }
  };
};*/
