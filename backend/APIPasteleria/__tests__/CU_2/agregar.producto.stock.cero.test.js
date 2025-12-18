const request = require('supertest');
const app = require('../../app');
const { generarToken } = require('../../auth/auth');
const pool = require('../../db/db');

describe('CU_2 - Agregar producto (caso fallido)', () => {
  it("no agrega producto cuando stock = 0", async () => {
    const token = generarToken({ id: 9998, username: 'test-inventario', rol: 'inventario' });

    const nuevoProducto = {
      nombre: 'Pan integral',
      categoria: 'Pan',
      precio_unitario: 2.0,
      stock: 0
    };

    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${token}`)
      .send(nuevoProducto)
      .expect('Content-Type', /json/);

    // Debe rechazar con 400 y mensaje de validación específico
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('mensaje', "El campo 'stock' debe ser un número entero mayor que 0");

    // Verificar que el producto no fue creado en la BD
    const [rows] = await pool.query(
      'SELECT id FROM productos WHERE nombre = ? AND precio_unitario = ? LIMIT 1',
      [nuevoProducto.nombre, nuevoProducto.precio_unitario]
    );

    expect(rows.length).toBe(0);
  });
});
