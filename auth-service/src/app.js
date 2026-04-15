const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./config/db');

const userRoutes = require('./users/user.routes');
const solicitudRoutes = require('./solicitudes/solicitud.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/solicitudes', solicitudRoutes);

app.get('/', (req, res) => {
    res.send('Auth Service funcionando 🔐');
});

app.listen(process.env.PORT, () => {
    console.log(`Auth service corriendo en puerto ${process.env.PORT}`);
});