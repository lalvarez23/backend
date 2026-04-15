const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const header = req.headers['authorization'];

    if (!header) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    const token = header.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido' });
        }

        req.user = decoded;
        next();
    });
};

module.exports = verifyToken; // 🔥 ESTO ES CLAVE