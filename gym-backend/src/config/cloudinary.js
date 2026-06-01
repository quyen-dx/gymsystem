import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'gympro/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 400, height: 400, crop: 'fill' }],
    },
});

const feedbackStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'gympro/feedback',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    },
});

export const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
});

export const feedbackUpload = multer({
    storage: feedbackStorage,
    limits: { fileSize: 5 * 1024 * 1024, files: 3 },
    fileFilter: (_req, file, cb) => {
        if (!['image/png', 'image/jpg', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
            return cb(new Error('Bắt buộc tải lên file ảnh'));
        }
        return cb(null, true);
    },
});

export default cloudinary;
