const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/db');
const bcrypt = require('bcrypt');

describe('CU_8 - Ver historial de facturas (sin registros)', () => {
  it('muestra mensaje adecuado cuando no existen facturas registradas', async () => {
    // Crear usuario venta temporal
    const username = `ventas_empty_${Date.now()}`;
    const password = 'ventasEmpty123';
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuarios (username, password, rol)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password), rol = VALUES(rol)`,
      [username, passwordHash, 'ventas']
    );

    // Login
    const loginRes = await request(app)
      .post('/api/usuarios/login')
      .send({ username, password })
      .expect('Content-Type', /json/)
      .expect(200);

    const token = loginRes.body.token;

    // Solicitar una página alta que garantice resultados vacíos
    const res = await request(app)
      .get('/api/facturas?page=99999&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Debe devolver arreglo vacío y mensaje de ausencia de facturas
    expect(Array.isArray(res.body.facturas)).toBe(true);
    expect(res.body.facturas.length).toBe(0);
    expect(res.body).toHaveProperty('message', 'No hay facturas registradas');

    // Limpieza
    await pool.query('DELETE FROM usuarios WHERE username = ?', [username]);
  });
});
