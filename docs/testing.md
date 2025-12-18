# Plan de Pruebas - API Pastelería

## Descripción General

Este documento describe el plan de pruebas automatizadas para el backend de la API Pastelería. Las pruebas se ejecutan con Jest y generan reportes en formato JUnit XML y LCOV para integración con CI/CD y SonarCloud.

## Configuración de Entorno de Pruebas

### Precondiciones (CI)

Antes de ejecutar las pruebas, el script `scripts/seed-ci.js` prepara la base de datos:

1. **Crea la base de datos** si no existe
2. **Crea las tablas**: usuarios, categorias, productos, carrito, compras, detalle_compra, insumos
3. **Inserta seeds mínimos**:
   - Categorías: (1, 'Galletas'), (2, 'Pan')
   - Usuario de prueba: definido por `TEST_LOGIN_USER` con password hasheada
   - Usuario adicional: `diegoventas` con rol `ventas`

### Variables de Entorno Requeridas

| Variable | Descripción | Valor CI |
|----------|-------------|----------|
| `DB_HOST` | Host de MySQL | `127.0.0.1` |
| `DB_PORT` | Puerto de MySQL | `3306` |
| `DB_USER` | Usuario de MySQL | `ciuser` |
| `DB_PASSWORD` | Contraseña de MySQL | `cipassword123` |
| `DB_NAME` | Nombre de la base de datos | `pasteleriadb` |
| `TEST_LOGIN_USER` | Usuario para pruebas de login | `testuser` |
| `TEST_LOGIN_PASSWORD` | Contraseña para pruebas de login | `testpass123` |
| `TEST_LOGIN_ROLE` | Rol del usuario de prueba | `ventas` |
| `JWT_SECRET` | Secret para firmar tokens JWT | (secret) |

## Convención de Nombres

Los tests siguen la convención: `CU{N}-CP{N} {Descripción}`

- **CU**: Caso de Uso (ej: CU1 = Autenticación)
- **CP**: Caso de Prueba dentro del CU

Ejemplo: `CU1-CP1 Login exitoso con credenciales válidas`

## Tabla de Trazabilidad CU/CP → Tests

### CU1 - Autenticación de Usuarios

| ID | Caso de Prueba | Archivo | Nombre del Test | Precondiciones | Resultado Esperado |
|----|----------------|---------|-----------------|----------------|-------------------|
| CU1-CP1 | Login exitoso | `__tests__/CU_1/auth.login.success.test.js` | `CU1-CP1 Login exitoso con credenciales válidas` | Usuario seedeado en BD | Status 200, token JWT en respuesta |
| CU1-CP2 | Campo vacío (falta usuario) | `__tests__/CU_1/auth.login.empty-field.test.js` | `CU1-CP2 Campo vacío - Debe ingresar usuario y contraseña` | - | Status 400, mensaje "Debe ingresar usuario y contraseña" |
| CU1-CP3 | Campo vacío (falta contraseña) | `__tests__/CU_1/auth.login.empty-password.test.js` | `CU1-CP3 Campo vacío - Falta contraseña` | - | Status 400, mensaje "Debe ingresar usuario y contraseña" |
| CU1-CP4 | Contraseña inválida | `__tests__/CU_1/auth.login.wrong-password.test.js` | `CU1-CP4 Contraseña inválida - Contraseña incorrecta` | Usuario existente en BD | Status 401, mensaje "Contraseña incorrecta" |

### CU02 - Gestión de Productos

| ID | Caso de Prueba | Archivo | Nombre del Test | Precondiciones | Resultado Esperado |
|----|----------------|---------|-----------------|----------------|-------------------|
| CU02-CP01 | Listar productos | `__tests__/CU_2/productos.list.test.js` | `CU02-CP01 Listar productos con token válido` | Token JWT válido | Status 200, array de productos |
| CU02-CP02 | Crear producto | `__tests__/CU_2/productos.create.test.js` | `CU02-CP02 Crear producto con rol inventario` | Token con rol inventario | Status 201, producto creado |

### CU03 - Gestión de Insumos

| ID | Caso de Prueba | Archivo | Nombre del Test | Precondiciones | Resultado Esperado |
|----|----------------|---------|-----------------|----------------|-------------------|
| CU03-CP01 | Listar insumos | `__tests__/CU_3/insumos.list.test.js` | `CU03-CP01 Listar insumos con token válido` | Token JWT válido | Status 200, array de insumos |

### CU04 - Gestión de Ventas (Carrito)

| ID | Caso de Prueba | Archivo | Nombre del Test | Precondiciones | Resultado Esperado |
|----|----------------|---------|-----------------|----------------|-------------------|
| CU04-CP01 | Listar carrito | `__tests__/CU_4/ventas.cart.test.js` | `CU04-CP01 Listar carrito con rol ventas` | Token con rol ventas | Status 200, items del carrito |
| CU04-CP02 | Agregar al carrito | `__tests__/CU_4/ventas.cart.test.js` | `CU04-CP02 Agregar producto al carrito` | Token con rol ventas, producto existente | Status 200/201, item agregado |

### CU05 - Gestión de Pagos

| ID | Caso de Prueba | Archivo | Nombre del Test | Precondiciones | Resultado Esperado |
|----|----------------|---------|-----------------|----------------|-------------------|
| CU05-CP01 | Pagar con efectivo | `__tests__/CU_5/pagos.test.js` | `CU05-CP01 Pagar con efectivo` | Carrito con items, token ventas | Status 200, compra registrada |

### CU06 - Reportes

| ID | Caso de Prueba | Archivo | Nombre del Test | Precondiciones | Resultado Esperado |
|----|----------------|---------|-----------------|----------------|-------------------|
| CU06-CP01 | Reporte de ventas | `__tests__/CU_6/reportes.test.js` | `CU06-CP01 Obtener reporte de ventas` | - | Status 200, datos del reporte |
| CU06-CP02 | Reporte de inventario | `__tests__/CU_6/reportes.test.js` | `CU06-CP02 Obtener reporte de inventario` | - | Status 200, datos del reporte |

## Ejecución de Pruebas

### Local

```bash
# Ejecutar todas las pruebas
npm test

# Ejecutar con cobertura
npm run test:coverage

# Ejecutar para CI (con JUnit XML)
npm run test:ci
```

### CI/CD (GitHub Actions)

El workflow `.github/workflows/sonarcloud.yml` ejecuta automáticamente:

1. Levanta MySQL 8 como servicio
2. Ejecuta `seed-ci.js` para preparar la BD
3. Ejecuta `npm run test:ci`
4. Sube artifacts:
   - `test-results-junit`: Reporte JUnit XML
   - `coverage-report`: Reporte de cobertura LCOV
5. Ejecuta análisis SonarCloud

## Artifacts Generados

| Artifact | Ruta | Descripción |
|----------|------|-------------|
| JUnit XML | `test-results/junit.xml` | Reporte de ejecución de tests en formato JUnit |
| LCOV | `coverage/lcov.info` | Reporte de cobertura de código |
| HTML Coverage | `coverage/lcov-report/` | Reporte visual de cobertura |

## Evidencia de Ejecución

Cada ejecución de CI genera evidencia descargable:

1. **GitHub Actions** → Seleccionar workflow run → **Artifacts**
2. Descargar `test-results-junit` para ver qué tests pasaron/fallaron
3. Descargar `coverage-report` para ver cobertura detallada

Los artifacts se retienen por **30 días** y están vinculados al commit/PR específico.
