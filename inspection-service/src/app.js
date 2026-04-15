const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./config/db');

const inspectionRoutes = require('./inspections/inspection.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/inspections', inspectionRoutes);

app.get('/', (req, res) => {
    res.send('Inspection Service funcionando 🔍');
});

app.listen(process.env.PORT, () => {
    console.log(`Inspection service en puerto ${process.env.PORT}`);
});