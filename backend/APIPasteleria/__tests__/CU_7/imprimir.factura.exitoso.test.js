const request = require('supertest');
const app = require('../../app');
const pool = require('../../db/db');
const bcrypt = require('bcrypt');

describe('CU_7 - Imprimir factura (caso exitoso)', () => {
  it('completa venta, genera PDF y prepara para impresión', async () => {
    const username = `ventas_print_${Date.now()}`;
    const password = 'PrintPass123';
    const productName = `FacturaTestProd_${Date.now()}`;

    // Crear usuario ventas
    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await pool.query(
      `INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)`,
      [username, passwordHash, 'ventas']
    );
    const userId = userResult.insertId;

    // Asegurar categoría (usar 'Pan' existente si está, si no crear)
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
    const productId = prodRes.insertId;

    // Login obtener token
    const loginRes = await request(app)
      .post('/api/usuarios/login')
      .send({ username, password })
      .expect('Content-Type', /json/)
      .expect(200);

    const token = loginRes.body.token;

    // Agregar producto al carrito (usa búsqueda por nombre)
    await request(app)
      .post('/api/ventas/agregar')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: productName, cantidad: 1 })
      .expect('Content-Type', /json/)
      .expect(200);

    // Pagar con método digital (visa)
    const pagarRes = await request(app)
      .post('/api/gestionarPagos/pagar/visa')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(pagarRes.body).toHaveProperty('compra');
    const compraId = pagarRes.body.compra.id || pagarRes.body.compraId || pagarRes.body.compra?.id;
    expect(compraId).toBeDefined();

    // Solicitar el PDF de la factura
    const pdfRes = await request(app)
      .get(`/api/facturas/pdf/${compraId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /pdf/)
      .expect(200);

    // Verificar headers para impresión
    expect(pdfRes.headers).toHaveProperty('content-disposition');
    expect(pdfRes.headers['content-disposition']).toMatch(new RegExp(`factura_${compraId}\.pdf`));

    // Body should be binary data (Buffer) or have length
    expect(pdfRes.body && pdfRes.body.length).toBeGreaterThan(0);

    // Limpieza: eliminar detalle_compra, compras, carrito (por si quedó algo), producto y usuario
    await pool.query('DELETE FROM detalle_compra WHERE compra_id = ?', [compraId]);
    await pool.query('DELETE FROM compras WHERE id = ?', [compraId]);
    await pool.query('DELETE FROM carrito WHERE usuario_id = ?', [userId]);
    await pool.query('DELETE FROM productos WHERE id = ?', [productId]);
    // NOT delete category 'Pan' since it may be shared
    await pool.query('DELETE FROM usuarios WHERE id = ?', [userId]);
  }, 20000); // aumentar timeout
});
