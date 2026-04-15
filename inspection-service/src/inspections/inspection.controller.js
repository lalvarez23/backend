const db = require('../config/db');
const axios = require('axios');

// 🔥 CREAR INSPECCIÓN (RF-04)
const createInspection = async (req, res) => {
    const { lugar_produccion_id, fecha_solicitada } = req.body;
    const productor_id = req.user.id;

    if (!lugar_produccion_id || !fecha_solicitada) {
        return res.status(400).json({ message: 'Faltan datos' });
    }

    // ✅ validar fecha futura
    const hoy = new Date();
    const fecha = new Date(fecha_solicitada);

    if (fecha < hoy) {
        return res.status(400).json({ message: 'Fecha inválida' });
    }

    try {
        // 🔥 VALIDAR LOTES DESDE production-service
        const response = await axios.get(
            `http://localhost:58761/api/lots/${lugar_produccion_id}`,
            {
                headers: {
                    Authorization: req.headers.authorization
                }
            }
        );

        if (response.data.length === 0) {
            return res.status(400).json({ message: 'No hay lotes activos' });
        }

        // 🔴 VALIDAR INSPECCIÓN DUPLICADA
        const checkQuery = `
            SELECT * FROM inspecciones 
            WHERE lugar_produccion_id = ? 
            AND estado IN ('pendiente', 'en_proceso')
        `;

        db.query(checkQuery, [lugar_produccion_id], (err, results) => {
            if (results.length > 0) {
                return res.status(400).json({ message: 'Ya existe una inspección pendiente' });
            }

            // 🔥 ASIGNACIÓN AUTOMÁTICA (simulada)
            const asistente_id = Math.floor(Math.random() * 5) + 1;

            const insertQuery = `
                INSERT INTO inspecciones 
                (lugar_produccion_id, productor_id, asistente_id, estado)
                VALUES (?, ?, ?, 'pendiente')
            `;

            db.query(insertQuery, [
                lugar_produccion_id,
                productor_id,
                asistente_id
            ], (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Error al crear inspección' });
                }

                res.json({
                    message: 'Inspección solicitada y asignada ✅',
                    asistente_id
                });
            });
        });

    } catch (error) {
        return res.status(500).json({ message: 'Error al validar lotes' });
    }
};

// 🔥 VER INSPECCIONES
const getMyInspections = (req, res) => {
    const user_id = req.user.id;

    const query = `
        SELECT * FROM inspecciones 
        WHERE productor_id = ? OR asistente_id = ?
    `;

    db.query(query, [user_id, user_id], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error' });
        }

        res.json(results);
    });
};

// 🔥 INICIAR INSPECCIÓN (cambia estado)
const startInspection = (req, res) => {
    const { id } = req.params;

    const query = `
        UPDATE inspecciones 
        SET estado = 'en_proceso', fecha_inicio = NOW()
        WHERE id = ?
    `;

    db.query(query, [id], (err) => {
        if (err) {
            return res.status(500).json({ message: 'Error al iniciar' });
        }

        res.json({ message: 'Inspección iniciada 🔍' });
    });
};

module.exports = {
    createInspection,
    getMyInspections,
    startInspection
};