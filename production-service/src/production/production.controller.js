const db = require('../config/db');

// 🔥 CREAR LUGAR
const createProduction = (req, res) => {
    const {
        nombre,
        numero_registro_ica,
        departamento,
        municipio,
        vereda_direccion,
        area_total_ha,
        coordenadas_lat,
        coordenadas_lng
    } = req.body;

    const productor_id = req.user.id; // viene del token

    // ✅ validaciones
    if (!nombre || !numero_registro_ica || !area_total_ha) {
        return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    if (area_total_ha <= 0) {
        return res.status(400).json({ message: 'Área debe ser mayor a 0' });
    }

    // 🔴 validar ICA único
    const checkQuery = `SELECT * FROM lugares_produccion WHERE numero_registro_ica = ?`;

    db.query(checkQuery, [numero_registro_ica], (err, results) => {
        if (results.length > 0) {
            return res.status(400).json({ message: 'Registro ICA ya existe' });
        }

        const insertQuery = `
            INSERT INTO lugares_produccion 
            (nombre, numero_registro_ica, departamento, municipio, vereda_direccion,
            area_total_ha, coordenadas_lat, coordenadas_lng, productor_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(insertQuery, [
            nombre,
            numero_registro_ica,
            departamento,
            municipio,
            vereda_direccion,
            area_total_ha,
            coordenadas_lat,
            coordenadas_lng,
            productor_id
        ], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error al crear lugar' });
            }

            res.json({ message: 'Lugar de producción creado ✅' });
        });
    });
};

// 🔥 OBTENER MIS LUGARES
const getMyProductions = (req, res) => {
    const productor_id = req.user.id;

    const query = `SELECT * FROM lugares_produccion WHERE productor_id = ?`;

    db.query(query, [productor_id], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error al obtener datos' });
        }

        res.json(results);
    });
};

module.exports = { createProduction, getMyProductions };