require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app = express();

// ─── Middleware global ────────────────────────────────────────

app.use(cors({
  origin:      process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger simple
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString().slice(11,19)} ${req.method} ${req.path}`);
  next();
});

// ─── Rutas ───────────────────────────────────────────────────

const { routerEspacios, routerArboles, routerArt } = require('./routes/modulos');

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/dormitorios',  require('./routes/dormitorios'));
app.use('/api/aulas',        require('./routes/aulas'));
app.use('/api/espacios',     routerEspacios);
app.use('/api/arboles',      routerArboles);
app.use('/api/art',          routerArt);
app.use('/api/historial',    require('./routes/historial'));
app.use('/api/usuarios',     require('./routes/usuarios'));

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, env: process.env.NODE_ENV }));

// ─── Error handler ────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Arranque ─────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 ISSP API corriendo en http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB:       ${process.env.DATABASE_URL?.slice(0, 40)}...\n`);
});

module.exports = app;
