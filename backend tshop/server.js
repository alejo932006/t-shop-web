require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer'); // Para subir fotos
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Configuración de almacenamiento de imágenes
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir); // Crear carpeta si no existe
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Nombre único: id_producto + timestamp + extensión
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
// Servir la carpeta de imágenes públicamente
app.use('/uploads', express.static('uploads'));

// Base de Datos
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'FacturaAPP', // Tu DB real
  password: '0534', // Pon tu contraseña real aquí
  port: 5432,
});

// --- RUTAS PÚBLICAS (TIENDA) ---

app.get('/api/products', async (req, res) => {
    try {
      // AÑADIMOS "es_destacado" A LA CONSULTA
      const result = await pool.query('SELECT *, es_destacado FROM productos ORDER BY nombre');
      const productos = result.rows.map(p => ({
          // ... (tus campos actuales)
          id: p.codigo,
          nombre: p.nombre,
          precio: p.precio_venta,
          cantidad: p.cantidad,
          unidad: p.unidad_medida,
          linea: p.area_encargada,
          descripcion: `Stock: ${p.cantidad} ${p.unidad_medida}`,
          orientacion: p.imagen_orientacion || 'vertical',
          imagen_url: p.imagen_url ? `https://api.tshoptechnology.com${p.imagen_url}` : null,
          destacado: p.es_destacado // <--- NUEVO CAMPO
      }));
      res.json(productos);
    } catch (err) { res.status(500).send(err.message); }
  });

app.post('/api/checkout', async (req, res) => {
    // 1. Recibimos TODOS los datos nuevos
    const { 
        nombre, cedula, telefono, email, 
        departamento, ciudad, barrio, direccion, 
        metodo, total, productos 
    } = req.body;
    
    const resumen = JSON.stringify(productos);
    
    try {
        // 2. Query Actualizado
        const query = `
            INSERT INTO pedidos (
                cliente_nombre, cliente_cedula, cliente_telefono, cliente_email,
                cliente_departamento, cliente_ciudad, cliente_barrio, cliente_direccion,
                metodo_pago, total_venta, detalle_productos
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `;
        
        const values = [
            nombre, cedula, telefono, email, 
            departamento, ciudad, barrio, direccion, 
            metodo, total, resumen
        ];
        
        const result = await pool.query(query, values);
        res.json({ success: true, orderId: result.rows[0].id });
        
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

// --- RUTAS PRIVADAS (MANAGER) ---

// 1. Obtener todos los pedidos
app.get('/api/manager/orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pedidos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// 2. Cambiar estado de pedido
app.patch('/api/manager/orders/:id', async (req, res) => {
    const { estado } = req.body;
    const { id } = req.params;
    try {
        await pool.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 3. Subir Imagen de Producto
app.post('/api/manager/upload-image', upload.single('image'), async (req, res) => {
  // Ahora leemos también el campo 'orientation' que enviará el Manager
  const { productId, orientation } = req.body; 
  const file = req.file;
  
  if (!file) return res.status(400).send('No image uploaded');

  const imageUrl = `/uploads/${file.filename}`;

  try {
      // Actualizamos URL y ORIENTACIÓN al mismo tiempo
      await pool.query(
          'UPDATE productos SET imagen_url = $1, imagen_orientacion = $2 WHERE codigo = $3', 
          [imageUrl, orientation, productId]
      );
      res.json({ success: true, imageUrl: `https://api.tshoptechnology.com${imageUrl}` });
  } catch (err) { res.status(500).send(err.message); }
});

// 4. Actualizar Stock/Precio Rápido
app.patch('/api/manager/products/:id', async (req, res) => {
    const { precio, stock } = req.body;
    const { id } = req.params;
    try {
        await pool.query(
            'UPDATE productos SET precio_venta = $1, cantidad = $2 WHERE codigo = $3', 
            [precio, stock, id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

  // 2. Agrega esta NUEVA ruta al final (antes del app.listen):
  app.patch('/api/manager/feature/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // true o false
    try {
        await pool.query('UPDATE productos SET es_destacado = $1 WHERE codigo = $2', [status, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(port, () => {
  console.log(`🔥 Backend Manager listo en http://localhost:${port}`);
});