const db = require('../config/db');

// 🔥 CREAR LOTE
const createLot = (req, res) => {
    const {
        codigo,
        lugar_produccion_id,
        area_ha,
        cultivo_activo_id
    } = req.body;

    if (!codigo || !lugar_produccion_id || !area_ha) {
        return res.status(400).json({ message: 'Faltan datos' });
    }

    if (area_ha <= 0) {
        return res.status(400).json({ message: 'Área inválida' });
    }

    // 🔴 validar código único por lugar
    const checkQuery = `
        SELECT * FROM lotes 
        WHERE codigo = ? AND lugar_produccion_id = ?
    `;

    db.query(checkQuery, [codigo, lugar_produccion_id], (err, results) => {
        if (results.length > 0) {
            return res.status(400).json({ message: 'Código ya existe en este lugar' });
        }

        const insertQuery = `
            INSERT INTO lotes 
            (codigo, lugar_produccion_id, area_ha, cultivo_activo_id)
            VALUES (?, ?, ?, ?)
        `;

        db.query(insertQuery, [
            codigo,
            lugar_produccion_id,
            area_ha,
            cultivo_activo_id
        ], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Error al crear lote' });
            }

            res.json({ message: 'Lote creado ✅' });
        });
    });
};

// 🔥 VER LOTES POR LUGAR
const getLotsByProduction = (req, res) => {
    const { lugar_id } = req.params;

    const query = `SELECT * FROM lotes WHERE lugar_produccion_id = ?`;

    db.query(query, [lugar_id], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error' });
        }

        res.json(results);
    });
};

module.exports = { createLot, getLotsByProduction };