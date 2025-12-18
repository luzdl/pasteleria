const express = require("express");
const router = express.Router();
const { getFacturas, getFacturaById, generarFacturaPDF } = require("../controllers/facturasController");
const { verifyToken, requireRole } = require("../auth/auth");

// Protección: solo usuarios con rol 'ventas' pueden acceder a facturas
router.get("/", verifyToken, requireRole("ventas"), getFacturas);
router.get("/:id", verifyToken, requireRole("ventas"), getFacturaById);
router.get("/pdf/:id", verifyToken, requireRole("ventas"), generarFacturaPDF);

module.exports = router;
