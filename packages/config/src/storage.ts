import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

const storageEnvironmentSchema = z.object({
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  S3_REGION: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
});

export function createStorageClient() {
  const environment = storageEnvironmentSchema.parse({
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    S3_REGION: process.env.S3_REGION,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  });

  const client = new S3Client({
    credentials: {
      accessKeyId: environment.S3_ACCESS_KEY_ID,
      secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
    },
    endpoint: environment.S3_ENDPOINT,
    forcePathStyle: environment.S3_FORCE_PATH_STYLE,
    region: environment.S3_REGION,
  });

  return { bucket: environment.S3_BUCKET, client };
}

export type StorageClient = ReturnType<typeof createStorageClient>;
