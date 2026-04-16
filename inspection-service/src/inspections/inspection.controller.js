const db = require('../config/db');
const axios = require('axios');

const PRODUCTION_URL = process.env.PRODUCTION_SERVICE_URL || 'http://localhost:58761';

// ═══════════════════════════════════════════════════════════════
// 🌱 PRODUCTOR — SOLICITAR INSPECCIÓN (RF-04)
// ═══════════════════════════════════════════════════════════════
const solicitarInspeccion = async (req, res) => {
    const { lugar_produccion_id, fecha_solicitada } = req.body;
    const productor_id = req.user.id;

    // Validar campos obligatorios
    if (!lugar_produccion_id || !fecha_solicitada) {
        return res.status(400).json({ message: 'Debes enviar lugar_produccion_id y fecha_solicitada' });
    }

    // Validar que la fecha no sea anterior a hoy (RF-04)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fecha_solicitada);
    if (isNaN(fecha.getTime())) {
        return res.status(400).json({ message: 'Formato de fecha inválido. Usa YYYY-MM-DD' });
    }
    if (fecha < hoy) {
        return res.status(400).json({ message: 'La fecha solicitada no puede ser anterior a la fecha actual' });
    }

    try {
        // Verificar lotes activos en production-service (RF-04)
        const lotesResp = await axios.get(
            `${PRODUCTION_URL}/api/lots/lugar/${lugar_produccion_id}`,
            { headers: { Authorization: req.headers.authorization } }
        );

        const lotesActivos = (lotesResp.data || []).filter(l => l.estado === 'activo');

        if (lotesActivos.length === 0) {
            return res.status(400).json({
                message: 'No se puede solicitar inspección: el lugar de producción no tiene lotes en estado Activo'
            });
        }

        // Verificar que no exista inspección activa para este lugar (RF-04)
        db.query(
            `SELECT id FROM inspecciones 
             WHERE lugar_produccion_id = ? AND estado IN ('pendiente', 'en_proceso')`,
            [lugar_produccion_id],
            (err, activas) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: 'Error del servidor' });
                }

                if (activas.length > 0) {
                    return res.status(400).json({
                        message: 'Ya existe una inspección Pendiente o En proceso para este lugar. Espera a que finalice antes de solicitar otra.'
                    });
                }

                // Asignación automática: técnico activo con menor carga (RF-04)
                db.query(
                    `SELECT u.id, COUNT(i.id) AS carga
                     FROM usuarios u
                     LEFT JOIN inspecciones i 
                       ON i.asistente_id = u.id 
                       AND i.estado IN ('pendiente', 'en_proceso')
                     WHERE u.rol = 'tecnico' AND u.estado = 'activo'
                     GROUP BY u.id
                     ORDER BY carga ASC
                     LIMIT 1`,
                    [],
                    (err, tecnicos) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({ message: 'Error al buscar técnicos disponibles' });
                        }

                        // Si no hay técnicos: queda pendiente sin asignar (A1 del caso de uso)
                        const asistente_id = tecnicos.length > 0 ? tecnicos[0].id : null;
                        const sinAsistente = asistente_id === null;

                        // Crear la inspección
                        db.query(
                            `INSERT INTO inspecciones 
                             (lugar_produccion_id, productor_id, asistente_id, estado, fecha_solicitud)
                             VALUES (?, ?, ?, 'pendiente', NOW())`,
                            [lugar_produccion_id, productor_id, asistente_id],
                            (err, result) => {
                                if (err) {
                                    console.error(err);
                                    return res.status(500).json({ message: 'Error al registrar la solicitud de inspección' });
                                }

                                res.status(201).json({
                                    message: sinAsistente
                                        ? 'Inspección solicitada. No hay técnicos disponibles en este momento, el administrador asignará uno manualmente ⚠️'
                                        : 'Inspección solicitada y asignada automáticamente ✅',
                                    inspeccion_id: result.insertId,
                                    lugar_produccion_id,
                                    fecha_solicitada,
                                    estado: 'pendiente',
                                    asistente_asignado: asistente_id,
                                    lotes_activos: lotesActivos.length
                                });
                            }
                        );
                    }
                );
            }
        );

    } catch (error) {
        console.error(error);
        return res.status(502).json({ message: 'Error al comunicarse con el servicio de producción. Verifica que esté activo.' });
    }
};

// ═══════════════════════════════════════════════════════════════
// 📋 PRODUCTOR — VER MIS SOLICITUDES DE INSPECCIÓN
// ═══════════════════════════════════════════════════════════════
const getMisSolicitudes = (req, res) => {
    const productor_id = req.user.id;
    const { estado } = req.query;

    let query = `
        SELECT id, lugar_produccion_id, asistente_id, estado,
               fecha_solicitud, fecha_inicio, fecha_cierre, concepto_tecnico
        FROM inspecciones
        WHERE productor_id = ?
    `;
    const params = [productor_id];

    if (estado) { query += ` AND estado = ?`; params.push(estado); }
    query += ` ORDER BY fecha_solicitud DESC`;

    db.query(query, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error al obtener solicitudes' });
        }
        res.json(results);
    });
};

// ═══════════════════════════════════════════════════════════════
// 🔍 PRODUCTOR — VER DETALLE DE UNA SOLICITUD
// ═══════════════════════════════════════════════════════════════
const getDetalleSolicitud = (req, res) => {
    const { id } = req.params;
    const productor_id = req.user.id;

    db.query(
        `SELECT id, lugar_produccion_id, asistente_id, estado,
                fecha_solicitud, fecha_inicio, fecha_cierre,
                observaciones_generales, recomendaciones, concepto_tecnico
         FROM inspecciones
         WHERE id = ? AND productor_id = ?`,
        [id, productor_id],
        (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ message: 'Error del servidor' });
            }
            if (results.length === 0) {
                return res.status(404).json({ message: 'Solicitud no encontrada' });
            }
            res.json(results[0]);
        }
    );
};

module.exports = {
    solicitarInspeccion,
    getMisSolicitudes,
    getDetalleSolicitud
};