const express = require('express')
const cors = require('cors')
require('dotenv').config()

require('./config/db')

const productionRoutes = require('./production/production.routes')
const lotRoutes        = require('./lots/lots.routes')
const cultivoRoutes    = require('./cultivos/cultivo.routes')
const especiesRoutes   = require('./especies/especies.routes')

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/production', productionRoutes)
app.use('/api/lots',       lotRoutes)
app.use('/api/cultivos',   cultivoRoutes)
app.use('/api/especies',   especiesRoutes)

app.get('/', (req, res) => res.send('Production Service funcionando'))

app.listen(process.env.PORT, () => {
    console.log(`Production service en puerto ${process.env.PORT}`)
})
