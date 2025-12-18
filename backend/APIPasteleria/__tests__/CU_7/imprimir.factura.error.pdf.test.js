const request = require('supertest');
const pool = require('../../db/db');
const bcrypt = require('bcrypt');

// NOTA: Cargaremos 'app' dos veces: una real para crear la compra
// y otra con 'pdfkit' mockeado solo para el endpoint del PDF.
const realApp = require('../../app');

describe('CU_7 - Imprimir factura (fallo al generar PDF)', () => {
  let compraId, userId, productId, token;

  afterAll(async () => {
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
    } catch (e) {
      // ignore cleanup errors
    }
  });

  it('retorna 500 con mensaje de error y no corrompe la factura', async () => {
    const username = `diegoventas${Date.now()}`;
    const password = 'admin12345678';
    const productName = `ProdPdfErr_${Date.now()}`;

    // 1) Crear usuario ventas
    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await pool.query(
      `INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)`,
      [username, passwordHash, 'ventas']
    );
    userId = userResult.insertId;

    // 2) Asegurar categoría 'Pan'
    let [catRows] = await pool.query('SELECT id FROM categorias WHERE nombre = ?', ['Pan']);
    let categoriaId;
    if (catRows.length > 0) categoriaId = catRows[0].id;
    else {
      const [catRes] = await pool.query('INSERT INTO categorias (nombre) VALUES (?)', ['Pan']);
      categoriaId = catRes.insertId;
    }

    // 3) Crear producto
    const precio = 3.5;
    const stock = 3;
    const [prodRes] = await pool.query(
      'INSERT INTO productos (nombre, categoria_id, precio_unitario, stock, estado) VALUES (?, ?, ?, ?, ?)',
      [productName, categoriaId, precio, stock, 'disponible']
    );
    productId = prodRes.insertId;

    // 4) Login y token
    const loginRes = await request(realApp)
      .post('/api/usuarios/login')
      .send({ username, password })
      .expect('Content-Type', /json/)
      .expect(200);

    token = loginRes.body.token;

    // 5) Agregar al carrito
    await request(realApp)
      .post('/api/ventas/agregar')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: productName, cantidad: 1 })
      .expect('Content-Type', /json/)
      .expect(200);

    // 6) Pagar (visa)
    const pagarRes = await request(realApp)
      .post('/api/gestionarPagos/pagar/visa')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(pagarRes.body).toHaveProperty('compra');
    compraId = pagarRes.body.compra.id;

    // ===== Forzar error en generación de PDF mockeando pdfkit =====
    jest.resetModules();
    jest.doMock('pdfkit', () => {
      return jest.fn().mockImplementation(() => {
        throw new Error('PDF service unavailable');
      });
    });

    // Cargar una instancia de app que use el mock de pdfkit
    let appWithMock;
    jest.isolateModules(() => {
      appWithMock = require('../../app');
    });

    // 7) Intentar generar PDF -> debe fallar con 500 y mensaje
    const pdfErrRes = await request(appWithMock)
      .get(`/api/facturas/pdf/${compraId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /json/)
      .expect(500);

    expect(pdfErrRes.body).toHaveProperty('message', 'Error al generar PDF');

    // 8) Verificar que la factura NO está corrupta (sigue existiendo y con datos válidos)
    const [compras] = await pool.query(
      'SELECT id, total, metodo_pago, status, transaction_id FROM compras WHERE id = ? LIMIT 1',
      [compraId]
    );
    expect(compras.length).toBe(1);
    const factura = compras[0];
    expect(Number(factura.total)).toBeGreaterThan(0);
    expect(factura.metodo_pago).toBeTruthy();
    expect(factura.status).toBe('success');
    expect(factura.transaction_id).toBeTruthy();
  }, 25000);
});
