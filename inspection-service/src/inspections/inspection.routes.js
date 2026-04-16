const express = require('express');
const router = express.Router();

const {
    solicitarInspeccion,
    getMisSolicitudes,
    getDetalleSolicitud
} = require('./inspection.controller');

const { verifyToken, verifyProductor } = require('../middlewares/auth');

// Todas las rutas requieren token y rol productor
router.use(verifyToken, verifyProductor);

// POST /api/inspections/solicitar          → solicitar inspección (RF-04)
// GET  /api/inspections/mis-solicitudes    → ver todas mis solicitudes (?estado=pendiente)
// GET  /api/inspections/:id               → ver detalle de una solicitud

router.post('/solicitar',       solicitarInspeccion);
router.get('/mis-solicitudes',  getMisSolicitudes);
router.get('/:id',              getDetalleSolicitud);

module.exports = router;