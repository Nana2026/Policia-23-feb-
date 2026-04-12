require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString().slice(11,19)} ${req.method} ${req.path}`);
  next();
});

// Rutas (TEMPORAL SIMPLE)
app.get('/api/dashboard/resumen', (req, res) => {
  res.json({ mensaje: 'Backend funcionando 🚀' });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Arranque
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
