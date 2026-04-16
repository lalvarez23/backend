const db   = require('../config/db');
const axios = require('axios');

const PRODUCTION_URL = process.env.PRODUCTION_SERVICE_URL || 'http://localhost:58761';
const AUTH_URL       = process.env.AUTH_SERVICE_URL       || 'http://localhost:3001';

// ─────────────────────────────────────────────────────────────
// HELPER: tecnico con menor carga consultando al auth-service
// ─────────────────────────────────────────────────────────────
const obtenerTecnicoConMenorCarga = async (authHeader) => {
    try {
        const resp = await axios.get(
            `${AUTH_URL}/api/users?rol=tecnico&estado=activo`,
            { headers: { Authorization: authHeader } }
        );

        const tecnicos = resp.data || [];
        if (tecnicos.length === 0) return null;

        // Contar inspecciones activas de cada tecnico en esta BD
        const cargas = await Promise.all(
            tecnicos.map(t => new Promise(resolve => {
                db.query(
                    `SELECT COUNT(*) AS total FROM inspecciones
                     WHERE asistente_id = ? AND estado IN ('pendiente', 'en_proceso')`,
                    [t.id],
                    (err, rows) => resolve({ id: t.id, carga: err ? 999 : rows[0].total })
                );
            }))
        );

        cargas.sort((a, b) => a.carga - b.carga);
        return cargas[0].id;

    } catch (err) {
        // Si el token del productor no puede listar usuarios o
        // el auth-service no responde, dejamos sin asignar
        console.warn('No se pudo consultar tecnicos al auth-service:', err.message);
        return null;
    }
};

// ═══════════════════════════════════════════════════════════════
// PRODUCTOR - SOLICITAR INSPECCION (RF-04)
// ═══════════════════════════════════════════════════════════════
const solicitarInspeccion = async (req, res) => {
    const { lugar_produccion_id, fecha_solicitada } = req.body;
    const productor_id = req.user.id;

    if (!lugar_produccion_id || !fecha_solicitada) {
        return res.status(400).json({ message: 'Debes enviar lugar_produccion_id y fecha_solicitada' });
    }

    // Validar fecha no anterior a hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(fecha_solicitada);
    if (isNaN(fecha.getTime())) {
        return res.status(400).json({ message: 'Formato de fecha invalido. Usa YYYY-MM-DD' });
    }
    if (fecha < hoy) {
        return res.status(400).json({ message: 'La fecha solicitada no puede ser anterior a la fecha actual' });
    }

    try {
        // Verificar lotes activos en production-service
        const lotesResp = await axios.get(
            `${PRODUCTION_URL}/api/lots/lugar/${lugar_produccion_id}`,
            { headers: { Authorization: req.headers.authorization } }
        );

        const lotesActivos = (lotesResp.data || []).filter(l => l.estado === 'activo');

        if (lotesActivos.length === 0) {
            return res.status(400).json({
                message: 'No se puede solicitar inspeccion: el lugar no tiene lotes en estado Activo'
            });
        }

        // Verificar inspeccion activa existente para este lugar
        db.query(
            `SELECT id FROM inspecciones
             WHERE lugar_produccion_id = ? AND estado IN ('pendiente', 'en_proceso')`,
            [lugar_produccion_id],
            async (err, activas) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ message: 'Error del servidor' });
                }

                if (activas.length > 0) {
                    return res.status(400).json({
                        message: 'Ya existe una inspeccion Pendiente o En proceso para este lugar. Espera a que finalice.'
                    });
                }

                // Asignacion automatica via auth-service
                const asistente_id = await obtenerTecnicoConMenorCarga(req.headers.authorization);
                const sinAsistente = asistente_id === null;

                // Crear la inspeccion
                db.query(
                    `INSERT INTO inspecciones
                     (lugar_produccion_id, productor_id, asistente_id, estado, fecha_solicitud)
                     VALUES (?, ?, ?, 'pendiente', NOW())`,
                    [lugar_produccion_id, productor_id, asistente_id],
                    (err, result) => {
                        if (err) {
                            console.error(err);
                            return res.status(500).json({ message: 'Error al registrar la solicitud' });
                        }

                        res.status(201).json({
                            message: sinAsistente
                                ? 'Inspeccion solicitada. Sin tecnicos disponibles, el administrador asignara uno manualmente.'
                                : 'Inspeccion solicitada y asignada automaticamente.',
                            inspeccion_id:      result.insertId,
                            lugar_produccion_id,
                            fecha_solicitada,
                            estado:             'pendiente',
                            asistente_asignado:  asistente_id,
                            lotes_activos:       lotesActivos.length
                        });
                    }
                );
            }
        );

    } catch (error) {
        console.error(error);
        return res.status(502).json({
            message: 'Error al comunicarse con el servicio de produccion. Verifica que este activo.'
        });
    }
};

// ═══════════════════════════════════════════════════════════════
// PRODUCTOR - VER MIS SOLICITUDES
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
        if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener solicitudes' }); }
        res.json(results);
    });
};

// ═══════════════════════════════════════════════════════════════
// PRODUCTOR - VER DETALLE DE UNA SOLICITUD
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
            if (err) { console.error(err); return res.status(500).json({ message: 'Error del servidor' }); }
            if (results.length === 0) return res.status(404).json({ message: 'Solicitud no encontrada' });
            res.json(results[0]);
        }
    );
};

module.exports = {
    solicitarInspeccion,
    getMisSolicitudes,
    getDetalleSolicitud
};