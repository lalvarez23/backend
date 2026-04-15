const express = require('express');
const router = express.Router();

const controller = require('./production.controller');
const verifyToken = require('../middlewares/auth');

console.log('controller:', controller);
console.log('verifyToken:', verifyToken);

router.post('/', verifyToken, controller.createProduction);
router.get('/', verifyToken, controller.getMyProductions);

module.exports = router;