export const defaults = {
  env: {
    doc: "The application environment.",
    format: ["development", "test"],
    default: "development",
    env: "NODE_ENV"
  },
  storage: {
    enabled: {
      format: ["filesystem", "s3"],
      default: "filesystem",
      env: "STORAGE_ENABLED"
    },
    filesystem: {
      rootDir: {
        format: String,
        default: "/tmp/filebank",
        env: "FILESYSTEM_STORAGE_ROOT"
      }
    },
    s3: {
      clientOptions: {
        credentials: {
          accessKeyId: {
            format: String,
            default: "",
            env: "S3_STORAGE_ACCESS_KEY"
          },
          secretAccessKey: {
            format: String,
            default: "",
            env: "S3_STORAGE_SECRET_KEY"
          }
        },
        region: {
          format: String,
          default: "eu-west-1",
          env: "S3_STORAGE_REGION"
        }
      },
      bucket: {
        format: String,
        default: "filebank",
        env: "S3_STORAGE_BUCKET"
      },
      endpoint: {
        format: String,
        default: "http://localhost:4566",
        env: "S3_ENDPOINT"
      }
    }
  },
  schemaRequired: {
    format: Boolean,
    default: false,
    env: "SCHEMA_REQUIRED"
  },
  jwtKey: {
    format: String,
    default: "v3rys3cr3tK3y",
    env: "JWT_KEY"
  },
  authz: {
    enabled: {
      format: Boolean,
      default: true,
      env: "JWT_ENABLED"
    },
    readScope: {
      format: String,
      default: "filebank:read",
      env: "JWT_READ_SCOPE"
    },
    writeScope: {
      format: String,
      default: "filebank:write",
      env: "JWT_WRITE_SCOPE"
    },
    deleteScope: {
      format: String,
      default: "filebank:delete",
      env: "JWT_DELETE_SCOPE"
    }
  },
  mongo: {
    url: {
      format: String,
      default: "mongodb://localhost:27017/filebank",
      env: "MONGODB_URL"
    }
  }
};
