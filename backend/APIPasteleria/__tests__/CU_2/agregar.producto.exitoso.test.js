const request = require('supertest');
const app = require('../../app');
const { generarToken } = require('../../auth/auth');
const pool = require('../../db/db');

describe('CU_2 - Agregar producto', () => {
  it('agregar un producto correctamente', async () => {
    // Generamos un token con rol 'inventario' para pasar la validación de rol
    const token = generarToken({ id: 9999, username: 'test-inventario', rol: 'inventario' });

    const nuevoProducto = {
      nombre: 'Pie de maracuya',
      categoria: 'Postre',
      precio_unitario: 4.5,
      stock: 15
    };

    const res = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${token}`)
      .send(nuevoProducto)
      .expect('Content-Type', /json/);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mensaje', 'Producto creado');
    expect(res.body).toHaveProperty('productoId');
    expect(res.body).toHaveProperty('estado', 'disponible');

    const productoId = res.body.productoId;

    // Verificar en la base de datos que el producto quedó guardado con los valores correctos
    const [rows] = await pool.query(
      `SELECT p.id, p.nombre, p.precio_unitario, p.stock, p.categoria_id, c.nombre as categoria
       FROM productos p
       JOIN categorias c ON p.categoria_id = c.id
       WHERE p.id = ?`,
      [productoId]
    );

    expect(rows.length).toBe(1);
    const dbProd = rows[0];
    expect(dbProd.nombre).toBe(nuevoProducto.nombre);
    expect(parseFloat(dbProd.precio_unitario)).toBeCloseTo(nuevoProducto.precio_unitario);
    expect(dbProd.stock).toBe(nuevoProducto.stock);
    expect(dbProd.categoria).toBe(nuevoProducto.categoria);

    // Limpieza: eliminar producto creado
    await pool.query('DELETE FROM productos WHERE id = ?', [productoId]);

    // Si la categoría quedó sin productos, eliminarla también (para dejar DB limpia)
    const [catCountRows] = await pool.query('SELECT COUNT(*) as count FROM productos WHERE categoria_id = ?', [dbProd.categoria_id]);
    const catCount = catCountRows[0].count;
    if (catCount === 0) {
      await pool.query('DELETE FROM categorias WHERE id = ?', [dbProd.categoria_id]);
    }
  });
});
