import { v2 as cloudinary } from 'cloudinary';

export const getGallery = async (req, res, next) => {
  try {
    const { galleryRepo } = req.repos;
    const images = await galleryRepo.findAll();
    const mapped = images.map(i => { const p = i.toJSON(); p._id = p.id; return p; });
    res.status(200).json({ success: true, images: mapped });
  } catch (error) {
    next(error);
  }
};

export const uploadImage = async (req, res, next) => {
  try {
    const { galleryRepo } = req.repos;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    let imageUrl = '';
    let publicId = '';

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
          { folder: 'indoor-sports-gallery', resource_type: 'auto' },
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
      const base64Image = req.file.buffer.toString('base64');
      imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;
      publicId = `local_mock_${Date.now()}`;
    }

    const { is360, mediaType } = req.body;
    const count = await galleryRepo.count();
    const newImage = await galleryRepo.create({
      imageUrl,
      publicId,
      is360: is360 === 'true' || is360 === true,
      mediaType: mediaType || 'image',
      order: count,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('gallery-updated');
    }

    const plain = newImage.toJSON();
    plain._id = plain.id;
    res.status(201).json({ success: true, image: plain });
  } catch (error) {
    next(error);
  }
};

export const deleteImage = async (req, res, next) => {
  try {
    const { galleryRepo } = req.repos;
    const { id } = req.params;
    const image = await galleryRepo.findById(id);
    if (!image) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

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

    await galleryRepo.delete(id);

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
    const { galleryRepo } = req.repos;
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ success: false, message: 'Orders must be an array' });
    }

    const promises = orders.map((item) =>
      galleryRepo.updateOrder(item.id, item.order)
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
