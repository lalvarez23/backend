const express = require('express')
const router = express.Router()
const { getEspecies } = require('./especies.controller')
const { verifyToken } = require('../middlewares/auth')

router.get('/', verifyToken, getEspecies)

module.exports = router