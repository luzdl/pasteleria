const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/db');
const bcrypt = require('bcrypt');
const { generarToken } = require('../../auth/auth');

describe('CU_7 - Imprimir factura (sin autorización)', () => {
  let compraId, userVentasId, userInventarioId;

  beforeAll(async () => {
    // Crear una factura de prueba para intentar acceder
    const username = `ventas_auth_${Date.now()}`;
    const password = 'VentasAuth123';
    const passwordHash = await bcrypt.hash(password, 10);

    const [userResult] = await pool.query(
      'INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)',
      [username, passwordHash, 'ventas']
    );
    userVentasId = userResult.insertId;

    // Crear compra simple
    const [compraResult] = await pool.query(
      'INSERT INTO compras (usuario_id, fecha, total, metodo_pago, status, transaction_id) VALUES (?, NOW(), ?, ?, ?, ?)',
      [userVentasId, 10.0, 'visa', 'success', `tx_${Date.now()}`]
    );
    compraId = compraResult.insertId;

    // Crear usuario con rol 'inventario' para probar bloqueo
    const usernameInv = `inventario_auth_${Date.now()}`;
    const passwordInv = 'InventarioAuth123';
    const hashInv = await bcrypt.hash(passwordInv, 10);

    const [userInvResult] = await pool.query(
      'INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)',
      [usernameInv, hashInv, 'inventario']
    );
    userInventarioId = userInvResult.insertId;
  });

  afterAll(async () => {
    try {
      if (compraId) {
        await pool.query('DELETE FROM detalle_compra WHERE compra_id = ?', [compraId]);
        await pool.query('DELETE FROM compras WHERE id = ?', [compraId]);
      }
      if (userVentasId) {
        await pool.query('DELETE FROM usuarios WHERE id = ?', [userVentasId]);
      }
      if (userInventarioId) {
        await pool.query('DELETE FROM usuarios WHERE id = ?', [userInventarioId]);
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });

  it('bloquea impresión sin token (401 Unauthorized)', async () => {
    const res = await request(app)
      .get(`/api/facturas/pdf/${compraId}`)
      // NO enviamos Authorization header
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toHaveProperty('message', 'Token missing');
  });

  it('bloquea impresión con token inválido (401)', async () => {
    const res = await request(app)
      .get(`/api/facturas/pdf/${compraId}`)
      .set('Authorization', 'Bearer token_invalido_12345')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(res.body).toHaveProperty('message', 'Token inválido');
  });

  it('bloquea impresión con rol incorrecto - inventario (403 Forbidden)', async () => {
    // Generar token con rol 'inventario'
    const tokenInventario = generarToken({
      id: userInventarioId,
      username: 'inventario_user',
      rol: 'inventario'
    });

    const res = await request(app)
      .get(`/api/facturas/pdf/${compraId}`)
      .set('Authorization', `Bearer ${tokenInventario}`)
      .expect('Content-Type', /json/)
      .expect(403);

    expect(res.body).toHaveProperty('message', 'Acceso denegado');
  });

  it('permite impresión con rol ventas (200 OK)', async () => {
    // Generar token con rol 'ventas'
    const tokenVentas = generarToken({
      id: userVentasId,
      username: 'diegoventas',
      rol: 'ventas'
    });

    const res = await request(app)
      .get(`/api/facturas/pdf/${compraId}`)
      .set('Authorization', `Bearer ${tokenVentas}`)
      .expect('Content-Type', /pdf/)
      .expect(200);

    // Verificar que el PDF se genera correctamente
    expect(res.headers).toHaveProperty('content-disposition');
    expect(res.headers['content-disposition']).toMatch(new RegExp(`factura_${compraId}\.pdf`));
  });
});
