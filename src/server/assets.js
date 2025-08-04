import { AssetsS3 } from './AssetsS3'
import { AssetsLocal } from './AssetsLocal'

export const assets = process.env.ASSETS === 's3' ? new AssetsS3() : new AssetsLocal()
