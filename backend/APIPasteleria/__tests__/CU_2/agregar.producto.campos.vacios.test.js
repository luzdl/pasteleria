const request = require('supertest');
const app = require('../../app');
const { generarToken } = require('../../auth/auth');
const pool = require('../../db/db');

describe('CU_2 - Agregar producto (campos vacíos)', () => {
  it("rechaza el registro cuando hay campos obligatorios vacíos", async () => {
    const token = generarToken({ id: 9997, username: 'test-inventario', rol: 'inventario' });

    const nuevoProducto = {
      nombre: '', // campo vacío
      categoria: 'Pan',
      precio_unitario: '', // campo vacío
      stock: '' // campo vacío
    };

    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${token}`)
      .send(nuevoProducto)
      .expect('Content-Type', /json/);

    // Debe devolver 400 y mensaje indicando el primer campo obligatorio faltante
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('mensaje', "El campo 'nombre' es obligatorio");

    // Verificar que no se creó el producto en la BD (no debe existir producto con nombre vacío en la categoría 'Pan')
    const [rows] = await pool.query(
      `SELECT p.id FROM productos p
       JOIN categorias c ON p.categoria_id = c.id
       WHERE c.nombre = ? AND p.nombre = '' LIMIT 1`,
      ['Pan']
    );

    expect(rows.length).toBe(0);
  });
});
