import Gallery from '../models/Gallery.js';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary client is configured dynamically inside controllers before call to avoid static ESM import race conditions

export const getGallery = async (req, res, next) => {
  try {
    const images = await Gallery.find().sort({ order: 1, createdAt: -1 });
    res.status(200).json({ success: true, images });
  } catch (error) {
    next(error);
  }
};

export const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    let imageUrl = '';
    let publicId = '';

    // Check if Cloudinary is configured
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_CLOUD_NAME !== 'mock'
    ) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'indoor-sports-gallery' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
      publicId = result.public_id;
    } else {
      // Local fallback: we save buffer to a public file path or simulate upload
      // Since it's a mock, we will generate a base64 Data URL or mock URL
      // If we use base64 data URL, we don't need local uploads directory configurations
      const base64Image = req.file.buffer.toString('base64');
      imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;
      publicId = `local_mock_${Date.now()}`;
    }

    const count = await Gallery.countDocuments();
    const newImage = await Gallery.create({
      imageUrl,
      publicId,
      order: count,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('gallery-updated');
    }

    res.status(201).json({ success: true, image: newImage });
  } catch (error) {
    next(error);
  }
};

export const deleteImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const image = await Gallery.findById(id);
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    // Try deleting from Cloudinary if applicable
    if (
      image.publicId &&
      !image.publicId.startsWith('local_mock_') &&
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_CLOUD_NAME !== 'mock'
    ) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      try {
        await cloudinary.uploader.destroy(image.publicId);
      } catch (err) {
        console.error('Cloudinary deletion failed:', err.message);
      }
    }

    await Gallery.findByIdAndDelete(id);

    const io = req.app.get('io');
    if (io) {
      io.emit('gallery-updated');
    }

    res.status(200).json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const reorderGallery = async (req, res, next) => {
  try {
    const { orders } = req.body; // Array of { id, order }
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: 'Orders must be an array' });
    }

    const promises = orders.map((item) =>
      Gallery.findByIdAndUpdate(item.id, { order: item.order })
    );
    await Promise.all(promises);

    const io = req.app.get('io');
    if (io) {
      io.emit('gallery-updated');
    }

    res.status(200).json({ success: true, message: 'Gallery reordered successfully' });
  } catch (error) {
    next(error);
  }
};
