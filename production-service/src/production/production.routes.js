const express = require('express');
const router = express.Router();
const controller = require('./production.controller');
const { verifyToken, verifyProductor } = require('../middlewares/auth');

router.use(verifyToken, verifyProductor);

router.post('/',      controller.createProduction);
router.get('/',       controller.getMyProductions);
router.get('/:id',    controller.getProductionById);
router.put('/:id',    controller.updateProduction);
router.delete('/:id', controller.deleteProduction);

module.exports = router;