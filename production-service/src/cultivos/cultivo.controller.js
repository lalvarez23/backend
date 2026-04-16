const db = require('../config/db');

// ─────────────────────────────────────────────────────────────
// 🌿 REGISTRAR CULTIVO EN UN LOTE
// Regla: solo un cultivo ACTIVO por lote a la vez
// ─────────────────────────────────────────────────────────────
const createCultivo = (req, res) => {
    const { lote_id, especie_id, variedad, fecha_siembra } = req.body;
    const productor_id = req.user.id;

    if (!lote_id || !especie_id || !fecha_siembra) {
        return res.status(400).json({ message: 'Faltan datos obligatorios (lote_id, especie_id, fecha_siembra)' });
    }

    // E5: Fecha de siembra no puede ser futura
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const siembra = new Date(fecha_siembra);
    if (siembra > hoy) {
        return res.status(400).json({ message: 'La fecha de siembra no puede ser futura' });
    }

    // Verificar que el lote pertenece al productor y está activo
    db.query(
        `SELECT l.id, l.estado FROM lotes l
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE l.id = ? AND lp.productor_id = ?`,
        [lote_id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lote no encontrado o no pertenece al productor' });

            // Verificar especie válida en el catálogo
            db.query(`SELECT id FROM especies WHERE id = ? AND estado = 'activo'`, [especie_id], (err, especies) => {
                if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
                if (especies.length === 0) return res.status(400).json({ message: 'La especie seleccionada no existe o está inactiva en el catálogo' });

                // Solo un cultivo activo por lote
                db.query(
                    `SELECT id FROM cultivos WHERE lote_id = ? AND estado = 'activo'`,
                    [lote_id],
                    (err, activos) => {
                        if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
                        if (activos.length > 0) {
                            return res.status(400).json({ message: 'El lote ya tiene un cultivo activo. Finaliza el cultivo actual antes de registrar uno nuevo.' });
                        }

                        db.query(
                            `INSERT INTO cultivos (lote_id, especie_id, variedad, fecha_siembra, estado, fecha_registro)
                             VALUES (?, ?, ?, ?, 'activo', NOW())`,
                            [lote_id, especie_id, variedad || null, fecha_siembra],
                            (err, result) => {
                                if (err) { console.error(err); return res.status(500).json({ message: 'Error al registrar cultivo' }); }

                                // Actualizar cultivo_activo_id en el lote
                                db.query(`UPDATE lotes SET cultivo_activo_id = ? WHERE id = ?`, [result.insertId, lote_id], () => {});

                                res.status(201).json({ message: 'Cultivo registrado ✅', id: result.insertId });
                            }
                        );
                    }
                );
            });
        }
    );
};

// ─────────────────────────────────────────────────────────────
// 📋 LISTAR CULTIVOS DE UN LOTE (historial completo)
// ─────────────────────────────────────────────────────────────
const getCultivosByLote = (req, res) => {
    const { lote_id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT l.id FROM lotes l
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE l.id = ? AND lp.productor_id = ?`,
        [lote_id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Lote no encontrado' });

            db.query(
                `SELECT c.*, e.nombre AS especie_nombre, e.nombre_cientifico
                 FROM cultivos c
                 JOIN especies e ON e.id = c.especie_id
                 WHERE c.lote_id = ?
                 ORDER BY c.fecha_registro DESC`,
                [lote_id],
                (err, cultivos) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener cultivos' }); }
                    res.json(cultivos);
                }
            );
        }
    );
};

// ─────────────────────────────────────────────────────────────
// ✏️ EDITAR CULTIVO
// No se puede cambiar especie si hay inspecciones asociadas
// ─────────────────────────────────────────────────────────────
const updateCultivo = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;
    const { variedad, estado, fecha_fin, especie_id } = req.body;

    const estadosValidos = ['activo', 'en_crecimiento', 'cosechado', 'inactivo'];
    if (estado && !estadosValidos.includes(estado)) {
        return res.status(400).json({ message: `Estado inválido. Opciones: ${estadosValidos.join(', ')}` });
    }

    db.query(
        `SELECT c.id, c.lote_id, c.especie_id, c.estado FROM cultivos c
         JOIN lotes l ON l.id = c.lote_id
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE c.id = ? AND lp.productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Cultivo no encontrado' });

            const cultivo = results[0];

            const continuar = () => {
                const fields = [];
                const values = [];

                if (variedad !== undefined)  { fields.push('variedad = ?');  values.push(variedad); }
                if (estado)                  { fields.push('estado = ?');    values.push(estado); }
                if (fecha_fin !== undefined)  { fields.push('fecha_fin = ?'); values.push(fecha_fin); }
                if (especie_id)              { fields.push('especie_id = ?'); values.push(especie_id); }

                if (fields.length === 0) return res.status(400).json({ message: 'No se enviaron campos para actualizar' });

                values.push(id);
                db.query(`UPDATE cultivos SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error al actualizar cultivo' }); }

                    // Si el cultivo se finaliza/cosecha, limpiar cultivo_activo_id del lote
                    if (estado && ['cosechado', 'inactivo'].includes(estado)) {
                        db.query(`UPDATE lotes SET cultivo_activo_id = NULL WHERE id = ? AND cultivo_activo_id = ?`,
                            [cultivo.lote_id, id], () => {});
                    }

                    res.json({ message: 'Cultivo actualizado ✅' });
                });
            };

            // Si intenta cambiar especie, verificar inspecciones
            if (especie_id && especie_id !== cultivo.especie_id) {
                db.query(
                    `SELECT COUNT(*) AS total FROM inspecciones WHERE lugar_produccion_id = (
                        SELECT lugar_produccion_id FROM lotes WHERE id = ?
                     )`,
                    [cultivo.lote_id],
                    (err, inspResult) => {
                        if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
                        if (inspResult[0].total > 0) {
                            return res.status(400).json({ message: 'No se puede cambiar la especie porque ya hay inspecciones asociadas a este lote' });
                        }
                        continuar();
                    }
                );
            } else {
                continuar();
            }
        }
    );
};

// ─────────────────────────────────────────────────────────────
// 🗑️ ELIMINAR CULTIVO
// No se puede eliminar si hay inspecciones asociadas → marcar inactivo
// ─────────────────────────────────────────────────────────────
const deleteCultivo = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT c.id, c.lote_id FROM cultivos c
         JOIN lotes l ON l.id = c.lote_id
         JOIN lugares_produccion lp ON lp.id = l.lugar_produccion_id
         WHERE c.id = ? AND lp.productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Cultivo no encontrado' });

            const { lote_id } = results[0];

            db.query(
                `SELECT COUNT(*) AS total FROM inspecciones WHERE lugar_produccion_id = (
                    SELECT lugar_produccion_id FROM lotes WHERE id = ?
                 )`,
                [lote_id],
                (err, inspResult) => {
                    if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }

                    if (inspResult[0].total > 0) {
                        // Con inspecciones: eliminación lógica
                        db.query(`UPDATE cultivos SET estado = 'inactivo' WHERE id = ?`, [id], (err) => {
                            if (err) { console.error(err); return res.status(500).json({ message: 'Error al desactivar cultivo' }); }
                            db.query(`UPDATE lotes SET cultivo_activo_id = NULL WHERE id = ? AND cultivo_activo_id = ?`, [lote_id, id], () => {});
                            res.json({ message: 'Cultivo marcado como inactivo (tiene inspecciones asociadas, no se puede eliminar físicamente) ⚠️' });
                        });
                    } else {
                        db.query(`DELETE FROM cultivos WHERE id = ?`, [id], (err) => {
                            if (err) { console.error(err); return res.status(500).json({ message: 'Error al eliminar cultivo' }); }
                            db.query(`UPDATE lotes SET cultivo_activo_id = NULL WHERE id = ? AND cultivo_activo_id = ?`, [lote_id, id], () => {});
                            res.json({ message: 'Cultivo eliminado ✅' });
                        });
                    }
                }
            );
        }
    );
};

module.exports = { createCultivo, getCultivosByLote, updateCultivo, deleteCultivo };