const jwt = require('jsonwebtoken');

/**
 * Express middleware that verifies the JWT Bearer token in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 * Returns 401 if the header is missing or the token is invalid/expired.
 *
 * @param {import('express').Request}      req
 * @param {import('express').Response}     res
 * @param {import('express').NextFunction} next
 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Missing token!' });

    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token!' });
    }
}

module.exports = authMiddleware;