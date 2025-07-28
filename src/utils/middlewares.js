import jwt from 'jsonwebtoken';

export async function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

    try {
        const payload = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET || 'dev_secret');
        req.user = payload;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

export function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
}

export function instanceAccessMiddleware(req, res, next) {
    const instanceId = req.params.id || req.params.instanceId;
    if (req.user.role === 'admin' || req.user.instanceIds.includes(instanceId)) return next();
    return res.status(403).json({ error: 'No access to this instance' });
}
