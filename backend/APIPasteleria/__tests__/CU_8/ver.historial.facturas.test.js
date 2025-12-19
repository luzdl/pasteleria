const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/db');
const bcrypt = require('bcrypt');

describe('CU_8 - Ver historial de facturas', () => {
  it('muestra la tabla de historial con facturas registradas', async () => {
    // Preparar usuario de ventas de prueba
    const username = `ventas_test_${Date.now()}`;
    const password = 'ventasPass123';
    const passwordHash = await bcrypt.hash(password, 10);

    const [userResult] = await pool.query(
      'INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)',
      [username, passwordHash, 'ventas']
    );
    const userId = userResult.insertId;

    // Insertar una compra (factura) de prueba
    const total = 42.5;
    const metodo_pago = 'visa';
    const status = 'success';
    const transaction_id = `tx_${Date.now()}`;

    const [compraResult] = await pool.query(
      'INSERT INTO compras (usuario_id, fecha, total, metodo_pago, status, transaction_id) VALUES (?, NOW(), ?, ?, ?, ?)',
      [userId, total, metodo_pago, status, transaction_id]
    );
    const compraId = compraResult.insertId;

    // Iniciar sesión como Admin/Ventas (usar el endpoint real para mayor fidelidad)
    const loginRes = await request(app)
      .post('/api/usuarios/login')
      .send({ username, password })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(loginRes.body).toHaveProperty('token');
    const token = loginRes.body.token;

    // Consultar historial de facturas
    const res = await request(app)
      .get('/api/facturas')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /json/)
      .expect(200);

    // Validar estructura de respuesta
    expect(res.body).toHaveProperty('facturas');
    expect(Array.isArray(res.body.facturas)).toBe(true);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');

    // Buscar la factura insertada en el arreglo
    const found = res.body.facturas.find(f => Number(f.idFactura) === Number(compraId));
    expect(found).toBeDefined();
    expect(found).toHaveProperty('fechaEmision');
    expect(found).toHaveProperty('total');
    expect(Number(found.total)).toBeCloseTo(total);
    expect(found).toHaveProperty('metodo_pago', metodo_pago);
    expect(found).toHaveProperty('status', status);

    // Limpieza
    await pool.query('DELETE FROM compras WHERE id = ?', [compraId]);
    await pool.query('DELETE FROM usuarios WHERE id = ?', [userId]);
  });
});
