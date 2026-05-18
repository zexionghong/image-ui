import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

export type S3UploadConfig = {
  endpoint: string
  publicBaseUrl: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  forcePathStyle: boolean
  keyPrefix: string
}

type Env = Record<string, string | undefined>

function envValue(env: Env, key: string) {
  const value = env[key]
  return value && value.trim() ? value.trim() : ''
}

function normalizeBaseUrl(value: string) {
  return new URL(value).toString().replace(/\/+$/, '')
}

export function isS3UploadConfigured(env: Env = process.env) {
  return Boolean(
    envValue(env, 'S3_ENDPOINT') &&
    envValue(env, 'S3_BUCKET') &&
    envValue(env, 'S3_ACCESS_KEY_ID') &&
    envValue(env, 'S3_SECRET_ACCESS_KEY')
  )
}

export function getS3UploadConfig(env: Env = process.env): S3UploadConfig {
  const endpoint = envValue(env, 'S3_ENDPOINT')
  const bucket = envValue(env, 'S3_BUCKET')
  const accessKeyId = envValue(env, 'S3_ACCESS_KEY_ID')
  const secretAccessKey = envValue(env, 'S3_SECRET_ACCESS_KEY')

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 upload is not configured')
  }

  return {
    endpoint: normalizeBaseUrl(endpoint),
    publicBaseUrl: normalizeBaseUrl(envValue(env, 'S3_PUBLIC_BASE_URL') || endpoint),
    bucket,
    accessKeyId,
    secretAccessKey,
    region: envValue(env, 'S3_REGION') || 'us-east-1',
    forcePathStyle: envValue(env, 'S3_FORCE_PATH_STYLE') !== 'false',
    keyPrefix: envValue(env, 'S3_KEY_PREFIX') || 'video-inputs',
  }
}

function encodeKey(key: string) {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
}

export function buildS3PublicUrl(config: S3UploadConfig, key: string) {
  const encodedKey = encodeKey(key)
  const path = config.forcePathStyle
    ? `/${encodeURIComponent(config.bucket)}/${encodedKey}`
    : `/${encodedKey}`
  return new URL(path, `${config.publicBaseUrl}/`).toString()
}

export async function uploadBufferToS3(input: {
  key: string
  body: Buffer
  contentType: string
  config?: S3UploadConfig
}) {
  const config = input.config || getS3UploadConfig()
  const uploadTarget = config.forcePathStyle
    ? `${config.endpoint}/${config.bucket}/${input.key}`
    : `${new URL(config.endpoint).protocol}//${config.bucket}.${new URL(config.endpoint).host}/${input.key}`

  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  try {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }))
  } catch (err) {
    const error = err as Error & { $metadata?: { httpStatusCode?: number }, Code?: string, code?: string }
    const code = error.Code || error.code || error.name
    const status = error.$metadata?.httpStatusCode
    throw new Error(`S3 upload failed${status ? `: ${status}` : ''}${code ? ` ${code}` : ''} at ${uploadTarget}: ${error.message}`)
  }

  return buildS3PublicUrl(config, input.key)
}
