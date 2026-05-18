import assert from 'node:assert/strict'
import {
  buildS3PublicUrl,
  getS3UploadConfig,
  isS3UploadConfigured,
} from '../server/s3Upload'

assert.equal(isS3UploadConfigured({}), false)
assert.equal(
  isS3UploadConfigured({
    S3_ENDPOINT: 'https://oss2.example.com',
    S3_BUCKET: 'images',
    S3_ACCESS_KEY_ID: 'key',
    S3_SECRET_ACCESS_KEY: 'secret',
  }),
  true
)

const config = getS3UploadConfig({
  S3_ENDPOINT: 'https://oss2.example.com',
  S3_PUBLIC_BASE_URL: 'https://oss.example.com',
  S3_BUCKET: 'images',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_REGION: '',
})

assert.equal(config.endpoint, 'https://oss2.example.com')
assert.equal(config.publicBaseUrl, 'https://oss.example.com')
assert.equal(config.bucket, 'images')
assert.equal(config.region, 'us-east-1')
assert.equal(config.forcePathStyle, true)

assert.equal(
  buildS3PublicUrl(config, 'video-inputs/source image.png'),
  'https://oss.example.com/images/video-inputs/source%20image.png'
)

const virtualHosted = { ...config, forcePathStyle: false }
assert.equal(
  buildS3PublicUrl(virtualHosted, 'video-inputs/source.png'),
  'https://oss.example.com/video-inputs/source.png'
)

console.log('s3Upload tests passed')
