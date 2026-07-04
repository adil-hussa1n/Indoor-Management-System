import { v2 as cloudinary } from 'cloudinary';

export const uploadToCloudinary = async (fileBuffer, folder, mimetype = 'image/png') => {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'mock'
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(fileBuffer);
    });
    return result.secure_url;
  } else {
    // Local Base64 fallback
    return `data:${mimetype};base64,${fileBuffer.toString('base64')}`;
  }
};
