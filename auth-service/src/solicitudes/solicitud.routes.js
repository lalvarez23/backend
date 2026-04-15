const express = require('express');
const router = express.Router();

const {
    getSolicitudes,
    getSolicitudById,
    aprobarSolicitud,
    rechazarSolicitud
} = require('./solicitud.controller');

const { verifyToken, verifyAdmin } = require('../middlewares/auth');

// Todas las rutas de solicitudes requieren token + ser admin
router.use(verifyToken, verifyAdmin);

// GET  /api/solicitudes              → listar (filtros: ?estado=pendiente&rol=productor)
// GET  /api/solicitudes/:id          → ver detalle
// PUT  /api/solicitudes/:id/aprobar  → aprobar
// PUT  /api/solicitudes/:id/rechazar → rechazar (body: { motivo })

router.get('/', getSolicitudes);
router.get('/:id', getSolicitudById);
router.put('/:id/aprobar', aprobarSolicitud);
router.put('/:id/rechazar', rechazarSolicitud);

module.exports = router;