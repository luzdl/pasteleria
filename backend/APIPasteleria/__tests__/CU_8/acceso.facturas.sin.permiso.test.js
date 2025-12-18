const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/db');
const bcrypt = require('bcrypt');

describe('CU_8 - Acceso a facturas (sin permiso)', () => {
  it('bloquea el acceso a usuario con rol inventario', async () => {
    const username = 'laurainventario';
    const password = 'admin12345678';

    // Insertar o actualizar usuario de inventario
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO usuarios (username, password, rol)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password), rol = VALUES(rol)`,
      [username, hash, 'inventario']
    );

    // Login para obtener token
    const loginRes = await request(app)
      .post('/api/usuarios/login')
      .send({ username, password })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(loginRes.body).toHaveProperty('token');
    const token = loginRes.body.token;

    // Intentar acceder a historial de facturas
    const res = await request(app)
      .get('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /json/);

    // Debe ser acceso denegado por rol
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('message', 'Acceso denegado');

    // Limpieza del usuario de prueba
    await pool.query('DELETE FROM usuarios WHERE username = ?', [username]);
  });
});
