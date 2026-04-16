const db = require('../config/db')

// GET /api/especies — lista todas las activas (publico para productores)
const getEspecies = (req, res) => {
    const { q } = req.query
    let query = `SELECT id, nombre, nombre_cientifico, descripcion FROM especies WHERE estado = 'activo'`
    const params = []

    if (q) {
        query += ` AND (nombre LIKE ? OR nombre_cientifico LIKE ?)`
        params.push(`%${q}%`, `%${q}%`)
    }

    query += ` ORDER BY nombre ASC`

    db.query(query, params, (err, results) => {
        if (err) { console.error(err); return res.status(500).json({ message: 'Error al obtener especies' }) }
        res.json(results)
    })
}

module.exports = { getEspecies }