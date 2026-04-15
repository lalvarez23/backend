const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./config/db');

const productionRoutes = require('./production/production.routes');
const lotRoutes = require('./lots/lots.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/production', productionRoutes);
app.use('/api/lots', lotRoutes);

app.get('/', (req, res) => {
    res.send('Production Service funcionando 🌱');
});

app.listen(process.env.PORT, () => {
    console.log(`Production service en puerto ${process.env.PORT}`);
});