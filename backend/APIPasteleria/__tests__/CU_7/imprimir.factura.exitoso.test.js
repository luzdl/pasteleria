const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/db');
const bcrypt = require('bcrypt');

describe('CU_7 - Imprimir factura (caso exitoso)', () => {
  let compraId, userId, productId;

  afterAll(async () => {
    // Limpieza
    try {
      if (compraId) {
        await pool.query('DELETE FROM detalle_compra WHERE compra_id = ?', [compraId]);
        await pool.query('DELETE FROM compras WHERE id = ?', [compraId]);
      }
      if (userId) {
        await pool.query('DELETE FROM carrito WHERE usuario_id = ?', [userId]);
        await pool.query('DELETE FROM usuarios WHERE id = ?', [userId]);
      }
      if (productId) {
        await pool.query('DELETE FROM productos WHERE id = ?', [productId]);
      }
    } catch (error) {
      console.error('Error en la limpieza', error);
    }
  });

  it('completa venta, genera PDF', async () => {
    const username = `diegoventas${Date.now()}`; // Generar datos únicos para evitar colisiones
    const password = 'admin12345678';
    const productName = `FacturaTestProd_${Date.now()}`;

    try {
      // Crear usuario ventas
      const passwordHash = await bcrypt.hash(password, 10);
      const [userResult] = await pool.query(
        `INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)`,
        [username, passwordHash, 'ventas']
      );
      userId = userResult.insertId;

      // Asegurar categoría
      let [catRows] = await pool.query('SELECT id FROM categorias WHERE nombre = ?', ['Pan']);
      let categoriaId;
      if (catRows.length > 0) {
        categoriaId = catRows[0].id;
      } else {
        const [catRes] = await pool.query('INSERT INTO categorias (nombre) VALUES (?)', ['Pan']);
        categoriaId = catRes.insertId;
      }

      // Crear producto
      const precio = 10.0;
      const stock = 5;
      const [prodRes] = await pool.query(
        'INSERT INTO productos (nombre, categoria_id, precio_unitario, stock, estado) VALUES (?, ?, ?, ?, ?)',
        [productName, categoriaId, precio, stock, 'disponible']
      );
      productId = prodRes.insertId;

      // Login obtener token
      const loginRes = await request(app)
        .post('/api/usuarios/login')
        .send({ username, password })
        .expect('Content-Type', /json/)
        .expect(200);

      const token = loginRes.body.token;

      // Agregar producto al carrito
      await request(app)
        .post('/api/ventas/agregar')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: productName, cantidad: 1 })
        .expect('Content-Type', /json/)
        .expect(200);

      // Pagar con método digital
      const pagarRes = await request(app)
        .post('/api/gestionarPagos/pagar/visa')
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(pagarRes.body).toHaveProperty('compra');
      compraId = pagarRes.body.compra.id;

      // Solicitar el PDF
      const pdfRes = await request(app)
        .get(`/api/facturas/pdf/${compraId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect('Content-Type', /pdf/)
        .expect(200);

      // Validar headers
      expect(pdfRes.headers).toHaveProperty('content-disposition');
      expect(pdfRes.headers['content-disposition']).toMatch(new RegExp(`factura_${compraId}\.pdf`));

      // Validar que el PDF tiene contenido (body debe ser un Buffer con datos)
      expect(pdfRes.body).toBeDefined();
      expect(Buffer.isBuffer(pdfRes.body) || pdfRes.body.length > 0).toBe(true);
    } catch (error) {
      throw new Error(`Falló el test: ${error.message}`);
    }
  }, 30000); // Timeout aumentado a 30 segundos
});