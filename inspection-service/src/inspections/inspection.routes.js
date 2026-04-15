const express = require('express');
const router = express.Router();

const {
    createInspection,
    getMyInspections,
    startInspection
} = require('./inspection.controller');

const verifyToken = require('../middlewares/auth');

router.post('/', verifyToken, createInspection);
router.get('/', verifyToken, getMyInspections);
router.put('/:id/start', verifyToken, startInspection);

module.exports = router;