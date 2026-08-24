import * as Minio from 'minio';

const endPoint = process.env.MINIO_ENDPOINT || 'storage.console.daruntech.com';
const port = parseInt(process.env.MINIO_PORT || '443', 10);
const useSSL = process.env.MINIO_USE_SSL !== 'false';
const accessKey = process.env.MINIO_ROOT_USER || 'daruntech.pvt.ltd.com';
const secretKey = process.env.MINIO_ROOT_PASSWORD || 'Darun@storage';
const bucketName = process.env.MINIO_BUCKET || 'indoor';
const publicUrlBase = process.env.MINIO_PUBLIC_URL || `${useSSL ? 'https' : 'http'}://${endPoint}/${bucketName}`;

let minioClient = null;

const getMinioClient = () => {
  if (!minioClient) {
    try {
      minioClient = new Minio.Client({
        endPoint,
        port,
        useSSL,
        accessKey,
        secretKey,
      });
    } catch (err) {
      console.error('Failed to initialize MinIO client:', err);
    }
  }
  return minioClient;
};

/**
 * Uploads a file buffer to MinIO S3 object storage (Bucket: indoor).
 * Falls back to Base64 data URI if storage service is unavailable or in offline dev mode.
 */
export const uploadToStorage = async (fileBuffer, folder = 'uploads', mimetype = 'image/png') => {
  const client = getMinioClient();
  const fileExt = (mimetype || 'image/png').split('/')[1] || 'png';
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  if (client) {
    try {
      const bucketExists = await client.bucketExists(bucketName).catch(() => false);
      if (!bucketExists) {
        await client.makeBucket(bucketName, 'us-east-1').catch(() => {});
      }

      await client.putObject(bucketName, fileName, fileBuffer, fileBuffer.length, {
        'Content-Type': mimetype,
      });

      return `${publicUrlBase}/${fileName}`;
    } catch (err) {
      console.warn('MinIO upload notice (using fallback):', err.message);
    }
  }

  // Base64 Data URI fallback
  return `data:${mimetype};base64,${fileBuffer.toString('base64')}`;
};

export const uploadToCloudinary = uploadToStorage;
