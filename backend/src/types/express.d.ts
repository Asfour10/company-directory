import 'express';
import { File } from 'multer';

declare global {
  namespace Express {
    namespace Multer {
      export { File };
    }
  }
}
