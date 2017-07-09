import mongoose = require('mongoose');
import { Directory, File, ItemType } from '../index';

export interface FileModel extends File, mongoose.Document {
  directory: string | Directory;
}

const fileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  refId: {
    type: String,
    required: true,
  },
  mimetype: {
    type: String,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
  directory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Directory',
  },
  type: {
    type: String,
    default: ItemType.Directory,
  },
});

export const file = mongoose.model<FileModel>('File', fileSchema);
