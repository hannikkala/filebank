General purpose file storage API with customizable file and directory metadata.

## Table of contents

* [Features](#features)
* [Usage](#usage)
* [API Methods](#apimethods)
    - [GET](#apimethods_get)
    - [POST](#apimethods_post)
    - [PUT](#apimethods_put)
    - [DELETE](#apimethods_delete)
* [Environment variables](#envvars)
* [JSON Schema validation](#jsonschema)

## Features

<a name="features"></a>

* REST API for file operations
* Filesystem backend
* S3 backend
* Customizable file and directory metadata with JSON schema
* Uses MongoDB as metadata storage
* JWT authorization

## Usage

<a name="usage"></a>

#### With Docker-Compose

```yaml
version: '2.1'
services:
  filebank:
    image: hannikkala/filebank
    environment:
      - MONGODB_URL=mongodb://mongo:27017/filebank
      # - STORAGE_ENABLED=filesystem
      # - FILESYSTEM_STORAGE_ROOT=/tmp/filebank
      # - S3_STORAGE_ACCESS_KEY=mys3accesskey
      # - S3_STORAGE_SECRET_KEY=mys3secret
      # - S3_STORAGE_REGION=us-west-1
      # - S3_STORAGE_BUCKET=filebank 
      # - SCHEMA_REQUIRED=false
      # - JWT_KEY=v3rys3cr3tK3y
      # - JWT_READ_SCOPE=filebank:read
      # - JWT_WRITE_SCOPE=filebank:write
      # - JWT_DELETE_SCOPE=filebank:delete
    #volumes:
      #- ./schemas:/data/app/schemas # For custom schemas
    ports:
      - 8000:3000
    depends_on:
      - mongo

  mongo:
    image: mongo:3
    expose:
      - 27017

```

#### With Docker

Pull image:

```bash
$ docker pull hannikkala/filebank
```

Run the image, running MongoDB required.

```bash
$ docker run -it -e MONGODB_URL=mongodb://mongoserver:27017 hannikkala/filebank 
```

#### Without Docker

Clone the repo:

```bash
$ git clone https://github.com/hannikkala/filebank.git
$ cd api
$ npm install
$ npm run build && npm start
```

After this Filebank listens to port 3000. 

## API Methods

<a name="apimethods"></a>

#### GET

<a name="apimethods_get"></a>

Path `/directory` or `/directory/file.ext`. If path is directory, method will list all items in directory. If path points to a file, its contents will be returns on response.

Example response for directory:

```json
[
  {
    "_id": "mongoid",
    "type": "directory",
    "name": "subdirectory",
    "metadata": {
      "ifAny": true
    },
    "refId": "file reference id"
  },
  {
    "_id": "mongoid",
    "type": "file",
    "name": "file.png",
    "metadata": {
      "ifAny": true
    },
    "refId": "file reference id"
  }
]
```

#### POST

<a name="apimethods_post"></a>

###### Upload file

Multipart request with `file` as attachment name.

Example with NodeJS request.

```javascript
const formData = {
  // Tells service that content type is file. [REQUIRED]
  type: 'file',
  
  // Pass file name to be used instead of original file name. [OPTIONAL]
  name: 'my_name_for_image.jpg',
  
  // Pass file name to be used instead of original file name. [OPTIONAL]
  schema: 'MySchema',
  
  // Pass metadata to a file. JSON string that matches schema definition if
  // schema parameter has been given. 
  // [OPTIONAL] If SCHEMA_REQUIRED environment key is set to false and no schema parameter given. 
  // [REQUIRED] Otherwise.
  metadata: JSON.stringfy({
    metaField: true,
    numberField: 2,
    subObject: {
      whatever: 'here',
    }
  }),
  
  // Pass file contents via stream. Has to be named "file". [REQUIRED]
  file: fs.createReadStream(__dirname + '/unicycle.jpg'),
};

request.post({url:'http://filebank.service/directory', formData: formData, auth: { bearer: 'bearertoken' }}, function optionalCallback(err, httpResponse, body) {
  if (err) {
    return console.error('upload failed:', err);
  }
  console.log('Upload successful!  Server responded with:', body);
});
```

Example response: 
```json
{
  "_id": "mongoid",
  "type": "file",
  "name": "my_name_for_image.jpg",
  "metadata": {
      "metaField": true,
      "numberField": 2,
      "subObject": {
        "whatever": "here"
      }
  },
  "refId": "directory/my_name_for_image.jpg"
}
```

###### Create directory

Example with NodeJS request.

```javascript
const options = {
    uri: 'http://filebank.service/',
    method: 'POST',
    json: {
      "type": "directory",
      "name": "my_folder",
      "metadata": {
        "metafield": true
      },
      "schema": "MySchema"
    }
};

request(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log(body);
    }
});
```

Example response:

```json
{
  "_id": "mongoid",
  "type": "directory",
  "name": "my_folder",
  "metadata": {
      "metaField": true
  },
  "refId": "my_folder"
}
```

#### PUT

<a name="apimethods_put"></a>

###### Move file

You can move single file with `PUT` request with `target` parameter in body:

```javascript
const options = {
    uri: 'http://filebank.service/file.jpeg',
    method: 'PUT',
    json: {
      "target": "/existing/directory"
    },
    auth: {
      bearer: 'token with write scope'
    }
};

request(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log(body);
    }
});
```

> NOTE! Target parameter can also be file name and then file will be moved as well as renamed.

###### Move directory

Moving directory is very similar to moving files. 

```javascript
const options = {
    uri: 'http://filebank.service/existing',
    method: 'PUT',
    json: {
      "target": "/another/directory"
    },
    auth: {
      bearer: 'token with write scope'
    }
};

request(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log(body);
    }
});
```

> NOTE! If target directory does not exist, original directory will be moved and renamed as target directory. If target exists, directory will be moved to its sub directory.

#### DELETE

<a name="apimethods_delete"></a>

###### Remove directory

```javascript
request.delete({url:'http://filebank.service/directory', auth: { bearer: 'bearertoken' }}, function optionalCallback(err, httpResponse, body) {
  if (err) {
    return console.error('upload failed:', err);
  }
  console.log('Delete successful!');
});
```

Server responds with HTTP 204 if successful.

###### Remove file

```javascript
request.delete({url:'http://filebank.service/path/to/file.png', auth: { bearer: 'bearertoken' }}, function optionalCallback(err, httpResponse, body) {
  if (err) {
    return console.error('upload failed:', err);
  }
  console.log('Delete successful!');
});
```

Server responds with HTTP 204 if successful.

## Environment variables

<a name="envvars"></a>

#### MONGODB_URL

URL to MongoDB that will be used for metadata storage. 
Default value: `mongodb://localhost:27017/filebank`.

#### STORAGE_ENABLED

Which backend to use? Allowed values: `filesystem`, `s3`. 
Default value: `filesystem`.

#### FILESYSTEM_STORAGE_ROOT
 
Root directory for filesystem storage. This is where your saved files and directories are stored. This takes effect only if **STORAGE_ENABLED** is set to `filesystem`.
Default value: `/tmp/filebank`.

#### S3_STORAGE_ACCESS_KEY

S3 storage access key. This takes effect only if **STORAGE_ENABLED** is set to `s3`.

#### S3_STORAGE_SECRET_KEY

S3 storage secret key. This takes effect only if **STORAGE_ENABLED** is set to `s3`.

#### S3_STORAGE_REGION

S3 storage region. This takes effect only if **STORAGE_ENABLED** is set to `s3`.
Default value: `eu-west-1`.

#### S3_STORAGE_BUCKET

S3 storage bucket to use. Will be created if doesn't exist.
Default value: `filebank`.

#### SCHEMA_REQUIRED

If this variable is set to `true` parameter *schema* must be in HTTP request body. Parameter must be a string corresponding JSON schema file name in *schemas/file/* or *schemas/directory/* depending of the item being created or updated.  
Default value: `false`.

#### JWT_KEY 

Key used for JWT encryption.
Default value: `v3rys3cr3tK3y`

#### JWT_READ_SCOPE

Required scope name for `GET` operations. Can also be a comma-separated list and any match is be sufficient.
Default value: `filebank:read`

#### JWT_WRITE_SCOPE 

Required scope name for `POST` and `PUT` operations. Can also be a comma-separated list and any match is be sufficient.
Default value: `filebank:write`

#### JWT_DELETE_SCOPE

Required scope name for `DELETE` operations. Can also be a comma-separated list and any match is be sufficient.
Default value: `filebank:delete`

## JSON Schema Validation

<a name="jsonschema"></a>

Filebank has integrated support for validating files and directories metadata with standard [JSON Schemas](http://json-schema.org/). Service uses [ajv](https://github.com/epoberezkin/ajv) implementation. It has great [documentation](http://epoberezkin.github.io/ajv/) that should get you started quickly.

###### With Docker Compose

Create local directory containing following structure:

```
.
├── file
|   ├── MySchema.json
|   └── Default.json
└── directory
    ├── SpecialDirectory.json
    └── Default.json
```

Add volume definition to `docker-compose.yml` :

```yaml
services:
    filebank:
      ....
      volumes:
        - ./schemas:/data/app/schemas
```

Example schema `SpecialDirectory.json`:

```json
{
  "type": "object",
  "properties": {
    "metaField": {
      "type": "boolean"
    },
    "deepMeta": {
      "type": "object",
      "properties": {
        "thing": {
          "type": "number"
        },
        "third": {
          "type": "string"
        }
      },
      "required": ["thing", "third"]
    }
  },
  "required": ["metaField", "deepMeta"]
}
```

Example request that passes validation:

```javascript
const options = {
    uri: 'http://filebank.service/',
    method: 'POST',
    json: {
      "type": "directory",
      "name": "my_folder",
      "metadata": {
        "metaField": true,
        "deepMeta": {
          "thing": 5,
          "third": "any string"
        }
      },
      "schema": "SpecialDirectory" // Mapping
    }
};

request(options, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      console.log(body);
    }
});
```
