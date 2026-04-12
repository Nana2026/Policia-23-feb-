const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const prisma = require('../db');
const { autenticar, soloAdmin } = require('../middleware/auth');

// GET /api/usuarios — solo admin
router.get('/', autenticar, soloAdmin, async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: { rol: true },
      orderBy: { nombre: 'asc' },
    });
    res.json(usuarios.map(u => ({
      id:         u.id,
      nombre:     u.nombre,
      email:      u.email,
      rol:        u.rol.nombre,
      activo:     u.activo,
      created_at: u.created_at,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/usuarios — crear usuario (solo admin)
router.post('/',
  autenticar, soloAdmin,
  body('nombre').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('rol').isIn(['admin', 'operador']),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });

    try {
      const { nombre, email, password, rol: rolNombre } = req.body;
      const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
      if (!rol) return res.status(400).json({ error: 'Rol inválido' });

      const existe = await prisma.usuario.findUnique({ where: { email } });
      if (existe) return res.status(409).json({ error: 'Email ya registrado' });

      const usuario = await prisma.usuario.create({
        data: { nombre, email, password_hash: bcrypt.hashSync(password, 10), rol_id: rol.id },
        include: { rol: true },
      });
      res.status(201).json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol.nombre });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// PATCH /api/usuarios/:id
router.patch('/:id', autenticar, soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, activo, rol: rolNombre, password } = req.body;
    const data = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (activo !== undefined) data.activo = activo;
    if (password)             data.password_hash = bcrypt.hashSync(password, 10);
    if (rolNombre) {
      const rol = await prisma.rol.findUnique({ where: { nombre: rolNombre } });
      if (!rol) return res.status(400).json({ error: 'Rol inválido' });
      data.rol_id = rol.id;
    }
    await prisma.usuario.update({ where: { id }, data });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
