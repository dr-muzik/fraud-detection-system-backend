// upload.middleware.ts
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Options, StorageEngine } from 'multer';
import { Request } from 'express';

interface JsonUploadOptions extends Options {
  storage: StorageEngine;
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => void;
}

/**
 * Configuration options for handling JSON file uploads.
 *
 * This object defines the storage mechanism, file naming convention, and file filtering
 * logic for processing uploaded JSON files using Multer middleware.
 */
export const jsonUploadOptions: JsonUploadOptions = {
  storage: diskStorage({
    destination: './uploads', // make sure this folder exists
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      // Generate a unique filename using the current timestamp and a random number.
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  // Define the storage engine to use for saving uploaded files.
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (file.mimetype === 'application/json') cb(null, true);
    else cb(new Error('Only JSON files are allowed'), false);
  },
};
