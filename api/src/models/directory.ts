import * as mongoose from "mongoose";
import { Directory, ItemType } from "../index";

export interface DirectoryModel extends Directory, mongoose.Document {
  parent: string | DirectoryModel;
}

const directorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 1
  },
  refId: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Directory"
  },
  type: {
    type: String,
    default: ItemType.Directory
  }
});

directorySchema.index({ parent: 1, name: 1 }, { unique: true });

export const directory: mongoose.Model<DirectoryModel> = mongoose.model<
  DirectoryModel
>("Directory", directorySchema);
