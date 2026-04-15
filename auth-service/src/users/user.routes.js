const express = require('express');
const router = express.Router();

const {
    register,
    login,
    getAllUsers,
    getUserById,
    updateUser,
    toggleUserStatus
} = require('./user.controller');

const { verifyToken, verifyAdmin } = require('../middlewares/auth');

// ─── PÚBLICAS ────────────────────────────────
router.post('/register', register);
router.post('/login', login);

// ─── SOLO ADMIN ──────────────────────────────
router.get('/', verifyToken, verifyAdmin, getAllUsers);
router.get('/:id', verifyToken, verifyAdmin, getUserById);
router.put('/:id', verifyToken, verifyAdmin, updateUser);
router.patch('/:id/estado', verifyToken, verifyAdmin, toggleUserStatus);

module.exports = router;