const jwt = require('jsonwebtoken');

// ✅ Verificar token JWT
const verifyToken = (req, res, next) => {
    const header = req.headers['authorization'];

    if (!header) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    const token = header.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido o expirado' });
        }
        req.user = decoded;
        next();
    });
};

// ✅ Verificar que sea admin (se usa DESPUÉS de verifyToken)
const verifyAdmin = (req, res, next) => {
    if (req.user.rol !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado: solo administradores' });
    }
    next();
};

module.exports = { verifyToken, verifyAdmin };