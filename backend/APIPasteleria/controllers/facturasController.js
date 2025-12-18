const db = require("../db/db");
const PDFDocument = require("pdfkit");

// ✅ Obtener todas las facturas
const getFacturas = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const offset = (page - 1) * limit;

        const [rows] = await db.query(
            "SELECT id AS idFactura, DATE_FORMAT(fecha, '%Y-%m-%d %H:%i:%s') AS fechaEmision, total, metodo_pago, status FROM compras ORDER BY fecha DESC LIMIT ? OFFSET ?",
            [limit, offset]
        );

        const [[{ total }]] = await db.query("SELECT COUNT(*) as total FROM compras");

        // Si no hay facturas, devolver un mensaje explícito para que la UI lo muestre
        if (!rows || rows.length === 0) {
            return res.json({
                facturas: [],
                total,
                page,
                limit,
                message: 'No hay facturas registradas'
            });
        }

        res.json({
            facturas: rows,
            total,
            page,
            limit,
        });
    } catch (error) {
        console.error("❌ Error al obtener facturas:", error);
        res.status(500).json({ message: "Error al obtener facturas" });
    }
};

// ✅ Obtener factura por ID
const getFacturaById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            "SELECT id AS idFactura, fecha AS fechaEmision, total, metodo_pago, status FROM compras WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Factura no encontrada" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("❌ Error al obtener la factura:", error);
        res.status(500).json({ message: "Error al obtener la factura" });
    }
};

// ✅ Generar PDF con formato profesional tipo plantilla mejorado
const generarFacturaPDF = async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar datos de la factura
        const [compras] = await db.query(
            `SELECT 
                id AS idFactura, 
                fecha AS fechaEmision, 
                total, 
                metodo_pago, 
                status,
                monto_recibido,
                cambio
            FROM compras 
            WHERE id = ?`,
            [id]
        );

        if (compras.length === 0) {
            return res.status(404).json({ message: "Factura no encontrada" });
        }

        const factura = compras[0];
        factura.total = parseFloat(factura.total) || 0;

        // Fecha legible
        const fechaLegible = new Date(factura.fechaEmision).toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        // Productos
        const [detalles] = await db.query(
            "SELECT nombre, cantidad, precio_unitario, total FROM detalle_compra WHERE compra_id = ?",
            [id]
        );

        // Crear PDF
        const doc = new PDFDocument({ margin: 50, size: "A4" });
        res.setHeader("Content-Disposition", `inline; filename=factura_${id}.pdf`);
        res.setHeader("Content-Type", "application/pdf");
        doc.pipe(res);

        // === 🧾 ENCABEZADO ===
        // Logo opcional
        // doc.image("assets/logo.png", 50, 40, { width: 80 }); // (opcional)

        // Título centrado
        doc.font("Helvetica-Bold").fontSize(22).text(`Factura #${factura.idFactura}`, { align: "center" });
        doc.moveDown(1.5);

        // Datos generales
        doc.fontSize(11);
        doc.font("Helvetica-Bold").text("Fecha de emisión:", { continued: true })
            .font("Helvetica").text(` ${fechaLegible}`);
        doc.font("Helvetica-Bold").text("Método de pago:", { continued: true })
            .font("Helvetica").text(` ${factura.metodo_pago}`);
        doc.font("Helvetica-Bold").text("Estado:", { continued: true })
            .font("Helvetica").text(` ${factura.status}`);

        // Datos de la panadería
        doc.moveDown(0.5);
        doc.font("Helvetica-Bold").text("Panadería Alemana");
        doc.font("Helvetica").text("8-8888-8888");
        doc.text("Alto Boquete, Chiriquí, Panamá");

        // Línea divisoria
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#aaaaaa").stroke();

        // === 🧁 SECCIÓN PRODUCTOS ===
        doc.moveDown(1.2);
        doc.rect(50, doc.y, 500, 22).fillAndStroke("#f2f2f2", "#f2f2f2");
        doc.fillColor("#000").font("Helvetica-Bold").text("Productos", 60, doc.y + 6);
        doc.moveDown(2);

        if (detalles.length > 0) {
            detalles.forEach((item, index) => {
                const precio = parseFloat(item.precio_unitario) || 0;
                const total = parseFloat(item.total) || 0;
                const y = doc.y;

                doc.font("Helvetica").fontSize(12);
                doc.text(item.nombre, 60, y, { width: 230 });
                doc.text(`$${precio.toFixed(2)} x ${item.cantidad}`, 330, y, { width: 100, align: "right" });
                doc.text(`$${total.toFixed(2)}`, 500, y, { width: 50, align: "right" });

                // Línea separadora entre filas
                if (index < detalles.length - 1) {
                    doc.moveTo(60, doc.y + 12).lineTo(550, doc.y + 12).strokeColor("#e0e0e0").stroke();
                }
                doc.moveDown(1.2);
            });
        } else {
            doc.text("No hay productos registrados en esta compra.");
        }

        // Línea antes de totales
        doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor("#aaaaaa").stroke();

        // === 💰 TOTALES ===
            doc.moveDown(1.5);

            // Si el pago fue en efectivo → mostrar monto recibido y cambio
            if (factura.metodo_pago === "efectivo") {

                const recibido = parseFloat(factura.monto_recibido) || 0;
                const cambio = parseFloat(factura.cambio) || 0;

                doc.font("Helvetica-Bold")
                    .text("Monto recibido:", 400, doc.y, { continued: true })
                    .font("Helvetica")
                    .text(` $${recibido.toFixed(2)}`);

                doc.font("Helvetica-Bold")
                    .text("Cambio:", 400, doc.y, { continued: true })
                    .font("Helvetica")
                    .text(` $${cambio.toFixed(2)}`);

                doc.moveDown(1);
            }

            // Total final
            doc.font("Helvetica-Bold")
                .text("Total:", 400, doc.y, { continued: true })
                .font("Helvetica")
                .text(` $${factura.total.toFixed(2)}`);


        // === 📞 FOOTER FIJO ===
        const footerY = doc.page.height - 100;
        doc.moveTo(50, footerY - 10).lineTo(550, footerY - 10).strokeColor("#999").stroke();

        doc.fontSize(10).fillColor("#000");
        doc.font("Helvetica-Bold").text("Detalles Bancarios:", 50, footerY);
        doc.font("Helvetica").text("Banco General\n0-12345-6789", 50, footerY + 15);

        doc.font("Helvetica-Bold").text("Datos de Contacto:", 350, footerY);
        doc.font("Helvetica").text("pasteleriaalemana@gmail.com\n6666-6666", 350, footerY + 15);

        doc.end();

    } catch (error) {
        console.error("❌ Error al generar PDF:", error);
        res.status(500).json({ message: "Error al generar PDF" });
    }
};

// ✅ Exportar todas las funciones necesarias
module.exports = {
    getFacturas,
    getFacturaById,
    generarFacturaPDF
};