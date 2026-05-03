require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initSchema } = require('./db/schema');

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Init DB
initSchema();

// Routes
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/teams',       require('./routes/teams'));
app.use('/api/invitations', require('./routes/invitations'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server launched to http://localhost:${PORT}`));