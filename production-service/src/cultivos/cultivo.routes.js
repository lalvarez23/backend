const express = require('express');
const router = express.Router();
const controller = require('./cultivo.controller');
const { verifyToken, verifyProductor } = require('../middlewares/auth');

router.use(verifyToken, verifyProductor);

// POST  /api/cultivos                    → registrar cultivo en un lote
// GET   /api/cultivos/lote/:lote_id      → historial cultivos del lote
// PUT   /api/cultivos/:id                → editar cultivo
// DELETE /api/cultivos/:id               → eliminar cultivo

router.post('/',                      controller.createCultivo);
router.get('/lote/:lote_id',          controller.getCultivosByLote);
router.put('/:id',                    controller.updateCultivo);
router.delete('/:id',                 controller.deleteCultivo);

module.exports = router;