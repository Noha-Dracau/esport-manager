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

module.exports = { uploadSingle, saveImage };
