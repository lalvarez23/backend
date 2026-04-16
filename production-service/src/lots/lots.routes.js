const express = require('express');
const router = express.Router();
const controller = require('./lots.controller');
const { verifyToken, verifyProductor } = require('../middlewares/auth');

router.use(verifyToken, verifyProductor);

// POST  /api/lots                      → crear lote
// GET   /api/lots/lugar/:lugar_id      → lotes por lugar
// GET   /api/lots/:id                  → detalle + historial estados
// PUT   /api/lots/:id                  → editar datos del lote
// PATCH /api/lots/:id/estado           → cambiar estado (registra historial)
// GET   /api/lots/:id/historial        → ver historial de estados
// DELETE /api/lots/:id                 → eliminar (con validaciones)

router.post('/',                       controller.createLot);
router.get('/lugar/:lugar_id',         controller.getLotsByProduction);
router.get('/:id',                     controller.getLoteById);
router.put('/:id',                     controller.updateLot);
router.patch('/:id/estado',            controller.changeLoteEstado);
router.get('/:id/historial',           controller.getHistorialLote);
router.delete('/:id',                  controller.deleteLote);

module.exports = router;