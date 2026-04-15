const express = require('express');
const router = express.Router();

const { createLot, getLotsByProduction } = require('./lots.controller');
const verifyToken = require('../middlewares/auth');

router.post('/', verifyToken, createLot);
router.get('/:lugar_id', verifyToken, getLotsByProduction);

module.exports = router;