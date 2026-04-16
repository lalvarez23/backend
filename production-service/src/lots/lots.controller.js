const db = require('../config/db');

// Helper: registrar cambio de estado en historial
const registrarHistorial = (lote_id, estado_anterior, estado_nuevo, observacion, callback) => {
    db.query(
        `INSERT INTO historial_estado_lote (lote_id, estado_anterior, estado_nuevo, fecha_cambio, observacion)
         VALUES (?, ?, ?, NOW(), ?)`,
        [lote_id, estado_anterior, estado_nuevo, observacion || null],
        callback
    );
};

// ─────────────────────────────────────────────────────────────
// 📦 CREAR LOTE
// Tu BD: lotes(id, codigo, lugar_produccion_id, area_ha, estado, fecha_registro, cultivo_activo_id)
// ─────────────────────────────────────────────────────────────
const createLot = (req, res) => {
    const { codigo, lugar_produccion_id, area_ha, estado } = req.body;
    const productor_id = req.user.id;

    if (!codigo || !lugar_produccion_id || !area_ha) {
        return res.status(400).json({ message: 'Faltan datos obligatorios (codigo, lugar_produccion_id, area_ha)' });
    }

    if (isNaN(area_ha) || parseFloat(area_ha) <= 0) {
        return res.status(400).json({ message: 'El área debe ser un número mayor a cero' });
    }

    const estadosValidos = ['activo', 'inactivo', 'en_preparacion', 'cosechado'];
    const estadoFinal = estado || 'activo';
    if (!estadosValidos.includes(estadoFinal)) {
        return res.status(400).json({ message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
    }

    // Verificar que el lugar pertenece al productor y está activo
    db.query(
        `SELECT id FROM lugares_produccion WHERE id = ? AND productor_id = ? AND estado = 'activo'`,
        [lugar_produccion_id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lugar de producción no encontrado o no pertenece al productor' });

            // Código único dentro del mismo lugar
            db.query(
                `SELECT id FROM lotes WHERE codigo = ? AND lugar_produccion_id = ?`,
                [codigo, lugar_produccion_id],
                (err, dup) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
                    if (dup.length > 0) return res.status(400).json({ message: 'Ya existe un lote con ese código en este lugar de producción' });

                    db.query(
                        `INSERT INTO lotes (codigo, lugar_produccion_id, area_ha, estado, fecha_registro)
                         VALUES (?, ?, ?, ?, NOW())`,
                        [codigo, lugar_produccion_id, area_ha, estadoFinal],
                        (err, result) => {
                            if (err) { console.error(err); return res.status(500).json({ message: 'Error al crear lote' }); }

                            registrarHistorial(result.insertId, null, estadoFinal, 'Creación del lote', () => {});

                            res.status(201).json({ message: 'Lote creado ✅', id: result.insertId });
                        }
                    );
                }
            );
        }
    );
};

// ─────────────────────────────────────────────────────────────
// 📋 LISTAR LOTES POR LUGAR
// ─────────────────────────────────────────────────────────────
const getLotsByProduction = (req, res) => {
    const { lugar_id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT id FROM lugares_produccion WHERE id = ? AND productor_id = ?`,
        [lugar_id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lugar de producción no encontrado' });

            // Traer lotes con su cultivo activo si tiene
            db.query(
                `SELECT l.id, l.codigo, l.area_ha, l.estado, l.fecha_registro,
                        c.id AS cultivo_id, c.variedad, c.fecha_siembra, c.estado AS estado_cultivo
                 FROM lotes l
                 LEFT JOIN cultivos c ON c.lote_id = l.id AND c.estado = 'activo'
                 WHERE l.lugar_produccion_id = ?
                 ORDER BY l.fecha_registro DESC`,
                [lugar_id],
                (err, lotes) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener lotes' }); }
                    res.json(lotes);
                }
            );
        }
    );
};

// ─────────────────────────────────────────────────────────────
// 🔍 VER LOTE POR ID (con historial)
// ─────────────────────────────────────────────────────────────
const getLoteById = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT l.* FROM lotes l
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE l.id = ? AND lp.productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });

            const lote = results[0];

            db.query(
                `SELECT * FROM historial_estado_lote WHERE lote_id = ? ORDER BY fecha_cambio DESC`,
                [id],
                (err, historial) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener historial' }); }
                    res.json({ ...lote, historial });
                }
            );
        }
    );
};

// ─────────────────────────────────────────────────────────────
// ✏️ EDITAR LOTE
// ─────────────────────────────────────────────────────────────
const updateLot = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;
    const { area_ha } = req.body;

    if (area_ha !== undefined && (isNaN(area_ha) || parseFloat(area_ha) <= 0)) {
        return res.status(400).json({ message: 'El área debe ser un número mayor a cero' });
    }

    db.query(
        `SELECT l.id FROM lotes l
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE l.id = ? AND lp.productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });

            if (area_ha === undefined) return res.status(400).json({ message: 'No se enviaron campos para actualizar' });

            db.query(`UPDATE lotes SET area_ha = ? WHERE id = ?`, [area_ha, id], (err) => {
                if (err) { console.error(err); return res.status(500).json({ message: 'Error al actualizar lote' }); }
                res.json({ message: 'Lote actualizado ✅' });
            });
        }
    );
};

// ─────────────────────────────────────────────────────────────
// 🔄 CAMBIAR ESTADO DEL LOTE (con historial)
// ─────────────────────────────────────────────────────────────
const changeLoteEstado = (req, res) => {
    const { id } = req.params;
    const { estado, observacion } = req.body;
    const productor_id = req.user.id;

    const estadosValidos = ['activo', 'inactivo', 'en_preparacion', 'cosechado'];
    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
    }

    db.query(
        `SELECT l.id, l.estado FROM lotes l
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE l.id = ? AND lp.productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });

            const estadoAnterior = results[0].estado;
            if (estadoAnterior === estado) return res.status(400).json({ message: `El lote ya tiene el estado '${estado}'` });

            db.query(`UPDATE lotes SET estado = ? WHERE id = ?`, [estado, id], (err) => {
                if (err) { console.error(err); return res.status(500).json({ message: 'Error al cambiar estado' }); }
                registrarHistorial(id, estadoAnterior, estado, observacion || null, () => {});
                res.json({ message: `Estado actualizado: ${estadoAnterior} → ${estado} ✅` });
            });
        }
    );
};

// ─────────────────────────────────────────────────────────────
// 📜 HISTORIAL DE ESTADOS
// ─────────────────────────────────────────────────────────────
const getHistorialLote = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT l.id FROM lotes l
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE l.id = ? AND lp.productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });

            db.query(
                `SELECT * FROM historial_estado_lote WHERE lote_id = ? ORDER BY fecha_cambio DESC`,
                [id],
                (err, historial) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
                    res.json(historial);
                }
            );
        }
    );
};

// ─────────────────────────────────────────────────────────────
// 🗑️ ELIMINAR LOTE
// ─────────────────────────────────────────────────────────────
const deleteLote = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT l.id FROM lotes l
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE l.id = ? AND lp.productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });

            // E5: Bloquear si tiene inspecciones
            db.query(
                `SELECT COUNT(*) AS total FROM inspecciones
                 WHERE lugar_produccion_id = (SELECT lugar_produccion_id FROM lotes WHERE id = ?)`,
                [id],
                (err, inspResult) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
                    if (inspResult[0].total > 0) {
                        return res.status(400).json({ message: 'No se puede eliminar el lote porque tiene inspecciones registradas. Cámbialo a estado Inactivo.' });
                    }

                    // E6: Advertir si tiene cultivos activos
                    db.query(
                        `SELECT COUNT(*) AS total FROM cultivos WHERE lote_id = ? AND estado = 'activo'`,
                        [id],
                        (err, cultivosResult) => {
                            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
                            if (cultivosResult[0].total > 0) {
                                return res.status(400).json({ message: 'El lote tiene cultivos activos. Finaliza los cultivos antes de eliminar el lote.' });
                            }

                            db.query(`DELETE FROM lotes WHERE id = ?`, [id], (err) => {
                                if (err) { console.error(err); return res.status(500).json({ message: 'Error al eliminar lote' }); }
                                res.json({ message: 'Lote eliminado ✅' });
                            });
                        }
                    );
                }
            );
        }
    );
};

module.exports = { createLot, getLotsByProduction, getLoteById, updateLot, changeLoteEstado, getHistorialLote, deleteLote };