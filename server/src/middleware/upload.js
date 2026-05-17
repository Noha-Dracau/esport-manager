const multer = require('multer');
const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE      = 2 * 1024 * 1024; // 2 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
        cb(Object.assign(new Error('Only JPEG, PNG and WebP images are allowed'), { status: 400 }));
    }
});

/**
 * Returns an Express middleware that accepts a single file upload under the given field name.
 * Enforces JPEG/PNG/WebP mime types and a 2 MB size limit.
 * On error, responds with 400 and a descriptive message.
 *
 * @param {string} field - Form-data field name for the file.
 * @returns {import('express').RequestHandler}
 */
function uploadSingle(field) {
    return (req, res, next) => {
        upload.single(field)(req, res, (err) => {
            if (!err) return next();
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
                return res.status(400).json({ error: 'File too large (max 2 MB)' });
            return res.status(400).json({ error: err.message });
        });
    };
}

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Converts an image buffer to WebP (max 800×800, quality 85) and saves it to the uploads directory.
 *
 * @param {Buffer} buffer - Raw image data from multer memory storage.
 * @returns {Promise<string>} URL path relative to the server root (e.g. /uploads/filename.webp).
 */
async function saveImage(buffer) {
    const filename = Date.now() + '.webp';
    const filepath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filepath);
    return `/uploads/${filename}`;
}

/**
 * Deletes an uploaded file from disk. No-ops if the path is falsy or the file is already gone.
 *
 * @param {string | null | undefined} urlPath - URL path returned by saveImage (e.g. /uploads/foo.webp).
 */
function deleteUpload(urlPath) {
    if (!urlPath) return;
    try {
        fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(urlPath)));
    } catch { /* file already gone, ignore */ }
}

module.exports = { uploadSingle, saveImage, deleteUpload };
