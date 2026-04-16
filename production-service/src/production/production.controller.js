const db = require('../config/db');

// ─────────────────────────────────────────────────────────────
// 🌱 CREAR LUGAR DE PRODUCCIÓN
// ─────────────────────────────────────────────────────────────
const createProduction = (req, res) => {
    const {
        nombre, numero_registro_ica, departamento, municipio,
        vereda_direccion, area_total_ha, coordenadas_lat, coordenadas_lng
    } = req.body;
    const productor_id = req.user.id;

    if (!nombre || !numero_registro_ica || !departamento || !municipio || !vereda_direccion || !area_total_ha) {
        return res.status(400).json({ message: 'Faltan datos obligatorios (nombre, registro ICA, departamento, municipio, vereda, área)' });
    }

    if (isNaN(area_total_ha) || parseFloat(area_total_ha) <= 0) {
        return res.status(400).json({ message: 'El área total debe ser un número mayor a cero' });
    }

    // ICA único a nivel nacional
    db.query(`SELECT id FROM lugares_produccion WHERE numero_registro_ica = ?`, [numero_registro_ica], (err, results) => {
        if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
        if (results.length > 0) return res.status(400).json({ message: 'El número de registro ICA ya existe en el sistema' });

        const insertQuery = `
            INSERT INTO lugares_produccion 
            (nombre, numero_registro_ica, departamento, municipio, vereda_direccion,
             area_total_ha, coordenadas_lat, coordenadas_lng, productor_id, estado, fecha_registro)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo', NOW())
        `;

        db.query(insertQuery, [
            nombre, numero_registro_ica, departamento, municipio, vereda_direccion,
            area_total_ha,
            coordenadas_lat || null,
            coordenadas_lng || null,
            productor_id
        ], (err, result) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error al crear lugar de producción' }); }
            res.status(201).json({ message: 'Lugar de producción registrado ✅', id: result.insertId });
        });
    });
};

// ─────────────────────────────────────────────────────────────
// 📋 LISTAR MIS LUGARES DE PRODUCCIÓN (con filtros opcionales)
// ?nombre=&estado=
// ─────────────────────────────────────────────────────────────
const getMyProductions = (req, res) => {
    const productor_id = req.user.id;
    const { nombre, estado } = req.query;

    let query = `
        SELECT id, nombre, numero_registro_ica, departamento, municipio,
               vereda_direccion, area_total_ha, coordenadas_lat, coordenadas_lng,
               estado, fecha_registro, fecha_ultima_inspeccion, fecha_proxima_inspeccion
        FROM lugares_produccion
        WHERE productor_id = ?
    `;
    const params = [productor_id];

    if (nombre) { query += ` AND nombre LIKE ?`; params.push(`%${nombre}%`); }
    if (estado) { query += ` AND estado = ?`; params.push(estado); }
    query += ` ORDER BY fecha_registro DESC`;

    db.query(query, params, (err, results) => {
        if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener lugares' }); }
        res.json(results);
    });
};

// ─────────────────────────────────────────────────────────────
// 🔍 VER DETALLE DE UN LUGAR (con sus lotes)
// ─────────────────────────────────────────────────────────────
const getProductionById = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT * FROM lugares_produccion WHERE id = ? AND productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lugar de producción no encontrado' });

            const lugar = results[0];

            // Traer lotes asociados
            db.query(
                `SELECT id, codigo, area_ha, estado, fecha_registro, cultivo_activo_id FROM lotes WHERE lugar_produccion_id = ?`,
                [id],
                (err, lotes) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener lotes' }); }
                    res.json({ ...lugar, lotes });
                }
            );
        }
    );
};

// ─────────────────────────────────────────────────────────────
// ✏️ EDITAR LUGAR DE PRODUCCIÓN
// (ICA no se puede modificar una vez asignado)
// ─────────────────────────────────────────────────────────────
const updateProduction = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;
    const { nombre, departamento, municipio, vereda_direccion, area_total_ha, coordenadas_lat, coordenadas_lng } = req.body;

    if (area_total_ha !== undefined && (isNaN(area_total_ha) || parseFloat(area_total_ha) <= 0)) {
        return res.status(400).json({ message: 'El área total debe ser un número mayor a cero' });
    }

    db.query(`SELECT id FROM lugares_produccion WHERE id = ? AND productor_id = ?`, [id, productor_id], (err, results) => {
        if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
        if (results.length === 0) return res.status(404).json({ message: 'Lugar de producción no encontrado' });

        const fields = [];
        const values = [];

        if (nombre)            { fields.push('nombre = ?');            values.push(nombre); }
        if (departamento)      { fields.push('departamento = ?');      values.push(departamento); }
        if (municipio)         { fields.push('municipio = ?');         values.push(municipio); }
        if (vereda_direccion)  { fields.push('vereda_direccion = ?');  values.push(vereda_direccion); }
        if (area_total_ha)     { fields.push('area_total_ha = ?');     values.push(area_total_ha); }
        if (coordenadas_lat !== undefined) { fields.push('coordenadas_lat = ?'); values.push(coordenadas_lat); }
        if (coordenadas_lng !== undefined) { fields.push('coordenadas_lng = ?'); values.push(coordenadas_lng); }

        if (fields.length === 0) return res.status(400).json({ message: 'No se enviaron campos para actualizar' });

        values.push(id);
        db.query(`UPDATE lugares_produccion SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error al actualizar' }); }
            res.json({ message: 'Lugar de producción actualizado ✅' });
        });
    });
};

// ─────────────────────────────────────────────────────────────
// 🗑️ ELIMINAR LUGAR DE PRODUCCIÓN (lógico si tiene lotes)
// ─────────────────────────────────────────────────────────────
const deleteProduction = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;

    db.query(`SELECT id FROM lugares_produccion WHERE id = ? AND productor_id = ?`, [id, productor_id], (err, results) => {
        if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
        if (results.length === 0) return res.status(404).json({ message: 'Lugar de producción no encontrado' });

        // Verificar si tiene lotes
        db.query(`SELECT COUNT(*) AS total FROM lotes WHERE lugar_produccion_id = ?`, [id], (err, countResult) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }

            if (countResult[0].total > 0) {
                // Tiene lotes: eliminación lógica
                db.query(`UPDATE lugares_produccion SET estado = 'inactivo' WHERE id = ?`, [id], (err) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error al desactivar' }); }
                    res.json({ message: 'Lugar marcado como inactivo (tiene lotes asociados, no se puede eliminar físicamente) ⚠️' });
                });
            } else {
                // Sin lotes: eliminación física
                db.query(`DELETE FROM lugares_produccion WHERE id = ?`, [id], (err) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error al eliminar' }); }
                    res.json({ message: 'Lugar de producción eliminado ✅' });
                });
            }
        });
    });
};

module.exports = { createProduction, getMyProductions, getProductionById, updateProduction, deleteProduction };