import { S3Client } from "@aws-sdk/client-s3";

export type S3Config = {
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  forcePathStyle?: boolean;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

export function getS3Config(): S3Config {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const forcePathStyleRaw = process.env.S3_FORCE_PATH_STYLE?.trim();

  return {
    region: requireEnv("S3_REGION"),
    endpoint: endpoint && endpoint.length > 0 ? endpoint : undefined,
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    bucketName: requireEnv("S3_BUCKET_NAME"),
    // R2 and many S3-compatible providers prefer path-style requests.
    forcePathStyle:
      forcePathStyleRaw === "1" ||
      forcePathStyleRaw === "true" ||
      forcePathStyleRaw === "yes",
  };
}

export function createS3Client(config: S3Config = getS3Config()): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function getS3BucketName(config: S3Config = getS3Config()): string {
  return config.bucketName;
}

