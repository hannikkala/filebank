import express = require('express');
import ajv = require('ajv');
import { ErrorObject, ValidateFunction } from 'ajv';
import * as glob from 'glob';
import * as path from 'path';

const fileSchemas = {} as any;
const directorySchemas = {} as any;

glob(`${__dirname}/../../schemas/file/*.json`, (err, files) => {
  if (err) throw err;
  files.forEach((file) => {
    fileSchemas[path.basename(file, '.json')] = require(file);
  });
});

glob(`${__dirname}/../../schemas/directory/*.json`, (err, files) => {
  if (err) throw err;
  files.forEach((file) => {
    directorySchemas[path.basename(file, '.json')] = require(file);
  });
});

const directorySchema = {
  id: 'Directory',
  type: 'object',
  properties: {
    type: {
      enum: [
        'directory',
      ],
    },
    name: {
      type: 'string',
      minLength: 1,
    },
    metadata: {
      type: 'object',
    },
  },
  required: ['name', 'type'],
};

const fileSchema = {
  id: 'File',
  type: 'object',
  properties: {
    type: {
      enum: [
        'file',
      ],
    },
    name: {
      type: 'string',
      minLength: 1,
    },
    mimetype: {
      type: 'string',
    },
    metadata: {
      type: 'object',
    },
  },
  required: ['name', 'type', 'mimetype'],
};

export const validateFile = (schema: string, obj: any): ErrorObject[]|undefined|null => {
  const schemaObj = fileSchema;
  schemaObj.properties.metadata = schema ? fileSchemas[schema] : fileSchemas['Default'];
  const ajvInstance = new ajv({ allErrors: true });
  const validate: ValidateFunction = ajvInstance.compile(schemaObj);
  validate(obj);
  return validate.errors;
};

export const validateDirectory = (schema: string, obj: any): ErrorObject[]|undefined|null => {
  const schemaObj = directorySchema;
  schemaObj.properties.metadata = schema ? directorySchemas[schema] : directorySchemas['Default'];
  const ajvInstance = new ajv({ allErrors: true });
  const validate: ValidateFunction = ajvInstance.compile(schemaObj);
  validate(obj);
  return validate.errors;
};

export const validateFileMeta = (schema: string, obj: any): ErrorObject[]|undefined|null => {
  const schemaObj = schema ? fileSchemas[schema] : fileSchemas['Default'];
  const ajvInstance = new ajv({ allErrors: true });
  const validate: ValidateFunction = ajvInstance.compile(schemaObj);
  validate(obj);
  return validate.errors;
};

export const validateDirectoryMeta = (schema: string, obj: any): ErrorObject[]|undefined|null => {
  const schemaObj = schema ? directorySchemas[schema] : directorySchemas['Default'];
  const ajvInstance = new ajv({ allErrors: true });
  const validate: ValidateFunction = ajvInstance.compile(schemaObj);
  validate(obj);
  return validate.errors;
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
