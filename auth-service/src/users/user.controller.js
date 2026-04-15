const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ─────────────────────────────────────────────
// 🔓 PÚBLICO — REGISTRO (productor o tecnico)
// ─────────────────────────────────────────────
const register = async (req, res) => {
    const { nombre_completo, correo, password, rol, num_identificacion, telefono } = req.body;

    if (!nombre_completo || !correo || !password || !rol) {
        return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    // Solo se puede registrar como productor o tecnico
    if (!['productor', 'tecnico'].includes(rol)) {
        return res.status(403).json({ message: 'Rol no permitido. Solo puedes registrarte como productor o tecnico' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener mínimo 6 caracteres' });
    }

    try {
        const checkQuery = `SELECT id FROM usuarios WHERE correo = ?`;

        db.query(checkQuery, [correo], async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error del servidor' });
            }

            if (results.length > 0) {
                return res.status(400).json({ message: 'El correo ya está registrado' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const insertQuery = `
                INSERT INTO usuarios 
                (nombre_completo, correo, contrasena_hash, rol, estado, num_identificacion, telefono)
                VALUES (?, ?, ?, ?, 'pendiente', ?, ?)
            `;

            db.query(insertQuery, [
                nombre_completo,
                correo,
                hashedPassword,
                rol,
                num_identificacion || null,
                telefono || null
            ], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: 'Error al registrar usuario' });
                }

                res.status(201).json({
                    message: 'Solicitud enviada. Tu cuenta está pendiente de aprobación por el administrador ✅'
                });
            });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// 🔓 PÚBLICO — LOGIN
// ─────────────────────────────────────────────
const login = (req, res) => {
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }

    const query = `SELECT * FROM usuarios WHERE correo = ?`;

    db.query(query, [correo], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error del servidor' });
        }

        // Mensaje genérico por seguridad
        if (results.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const user = results[0];

        if (user.estado === 'pendiente') {
            return res.status(403).json({ message: 'Tu cuenta está pendiente de aprobación. Contacta al administrador' });
        }

        if (user.estado === 'inactivo' || user.estado === 'rechazado') {
            return res.status(403).json({ message: 'Tu cuenta no está activa. Contacta al administrador' });
        }

        const validPassword = await bcrypt.compare(password, user.contrasena_hash);

        if (!validPassword) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, rol: user.rol },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            message: 'Login exitoso ✅',
            token,
            user: {
                id: user.id,
                nombre: user.nombre_completo,
                rol: user.rol,
                correo: user.correo
            }
        });
    });
};

// ─────────────────────────────────────────────
// 🔒 ADMIN — LISTAR TODOS LOS USUARIOS
// ─────────────────────────────────────────────
const getAllUsers = (req, res) => {
    const { estado, rol } = req.query;

    let query = `
        SELECT id, nombre_completo, correo, rol, estado, num_identificacion, telefono, fecha_registro
        FROM usuarios WHERE 1=1
    `;
    const params = [];

    if (estado) { query += ` AND estado = ?`; params.push(estado); }
    if (rol)    { query += ` AND rol = ?`;    params.push(rol); }

    query += ` ORDER BY fecha_registro DESC`;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener usuarios' });
        }
        res.json(results);
    });
};

// ─────────────────────────────────────────────
// 🔒 ADMIN — VER UN USUARIO POR ID
// ─────────────────────────────────────────────
const getUserById = (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT id, nombre_completo, correo, rol, estado, num_identificacion, telefono, fecha_registro
        FROM usuarios WHERE id = ?
    `;

    db.query(query, [id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener usuario' });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        res.json(results[0]);
    });
};

// ─────────────────────────────────────────────
// 🔒 ADMIN — EDITAR USUARIO
// ─────────────────────────────────────────────
const updateUser = (req, res) => {
    const { id } = req.params;
    const { nombre_completo, telefono, rol, estado } = req.body;
    const adminId = req.user.id;

    if (parseInt(id) === adminId && estado === 'inactivo') {
        return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
    }

    if (rol && !['productor', 'tecnico', 'admin'].includes(rol)) {
        return res.status(400).json({ message: 'Rol no válido' });
    }

    if (estado && !['activo', 'inactivo', 'pendiente'].includes(estado)) {
        return res.status(400).json({ message: 'Estado no válido' });
    }

    db.query(`SELECT id FROM usuarios WHERE id = ?`, [id], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error del servidor' });
        if (results.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

        const fields = [];
        const values = [];

        if (nombre_completo)        { fields.push('nombre_completo = ?'); values.push(nombre_completo); }
        if (telefono !== undefined)  { fields.push('telefono = ?');        values.push(telefono); }
        if (rol)                     { fields.push('rol = ?');             values.push(rol); }
        if (estado)                  { fields.push('estado = ?');          values.push(estado); }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No se enviaron campos para actualizar' });
        }

        values.push(id);
        db.query(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error al actualizar usuario' });
            }
            res.json({ message: 'Usuario actualizado ✅' });
        });
    });
};

// ─────────────────────────────────────────────
// 🔒 ADMIN — ACTIVAR / DESACTIVAR CUENTA
// ─────────────────────────────────────────────
const toggleUserStatus = (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    const adminId = req.user.id;

    if (!['activo', 'inactivo'].includes(estado)) {
        return res.status(400).json({ message: 'Estado inválido. Usa: activo | inactivo' });
    }

    if (parseInt(id) === adminId && estado === 'inactivo') {
        return res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
    }

    db.query(`SELECT id FROM usuarios WHERE id = ?`, [id], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error del servidor' });
        if (results.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

        db.query(`UPDATE usuarios SET estado = ? WHERE id = ?`, [estado, id], (err) => {
            if (err) return res.status(500).json({ message: 'Error al cambiar estado' });
            res.json({ message: `Cuenta ${estado === 'activo' ? 'activada' : 'desactivada'} ✅` });
        });
    });
};

module.exports = {
    register,
    login,
    getAllUsers,
    getUserById,
    updateUser,
    toggleUserStatus
};