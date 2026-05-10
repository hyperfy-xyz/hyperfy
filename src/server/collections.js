import { CollectionsS3 } from './CollectionsS3'
import { CollectionsLocal } from './CollectionsLocal'

export const collections = process.env.COLLECTIONS === 's3' ? new CollectionsS3() : new CollectionsLocal()