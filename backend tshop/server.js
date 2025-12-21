require('dotenv').config(); // <--- Carga las variables del archivo .env
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken'); // <--- Librería de seguridad

const app = express();
const port = process.env.PORT || 3000;


const allowedOrigins = [
    'https://tshoptechnology.com',       // Tu dominio principal
    'https://www.tshoptechnology.com',   // Tu dominio con www
    'http://localhost:3000',             // Para pruebas backend
    'http://127.0.0.1:5500',             // Para pruebas frontend (Live Server)
    'http://localhost:5500'              // Variación de Live Server
  ];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como las de Postman o Apps móviles)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      // Si el origen no está en la lista, lo bloqueamos
      const msg = 'La política CORS no permite el acceso desde este origen.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Autorizamos explicitamente los headers que usas
  credentials: true // Permite cookies/headers seguros si se requieren a futuro
}));

// Configuración de almacenamiento de imágenes
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Base de Datos (AHORA USANDO VARIABLES DE ENTORNO OCULTAS)
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD, // <--- Ya no se ve la contraseña aquí
  port: process.env.DB_PORT,
});

// --- MIDDLEWARE DE SEGURIDAD (El "Portero") ---
// Esta función revisa si la petición trae el Token válido
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

    if (!token) return res.status(403).json({ message: "Acceso denegado: Token requerido" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(401).json({ message: "Token inválido o expirado" });
        req.user = user;
        next(); // Si el token es bueno, deja pasar
    });
};

// ==========================================
// RUTAS PÚBLICAS (TIENDA - CLIENTES)
// ==========================================
// Estas NO llevan 'verifyToken' porque cualquiera puede comprar

// --- 1. AGREGA ESTA FUNCIÓN AUXILIAR (Puede ir antes de las rutas) ---
const registrarVisita = async (req) => {
    try {
        // Intenta obtener la IP real (incluso si estás detrás de proxies)
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const dispositivo = req.headers['user-agent']; // Navegador/Celular usado
        
        // Guardamos en BD (sin await para no frenar la carga del producto)
        pool.query('INSERT INTO visitas (ip, dispositivo) VALUES ($1, $2)', [ip, dispositivo]);
    } catch (err) {
        console.error("Error registrando visita:", err.message);
    }
};

app.get('/api/products', async (req, res) => {
    registrarVisita(req);
    try {
      // MODIFICACIÓN: Agregamos WHERE estado = 'Activo'
      const result = await pool.query("SELECT *, es_destacado FROM productos WHERE estado = 'Activo' ORDER BY nombre");
      
      const productos = result.rows.map(p => ({
          id: p.codigo,
          nombre: p.nombre,
          precio: p.precio_venta,
          cantidad: p.cantidad,
          unidad: p.unidad_medida,
          linea: p.area_encargada,
          descripcion: p.descripcion ? p.descripcion : `Stock disponible: ${p.cantidad} ${p.unidad_medida}`,
          orientacion: p.imagen_orientacion || 'vertical',
          imagen_url: p.imagen_url ? `https://api.tshoptechnology.com${p.imagen_url}` : null,
          destacado: p.es_destacado
      }));
      res.json(productos);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/checkout', async (req, res) => {
    const { nombre, cedula, telefono, email, departamento, ciudad, barrio, direccion, metodo, total, productos } = req.body;
    const resumen = JSON.stringify(productos);
    
    try {
        const query = `INSERT INTO pedidos (cliente_nombre, cliente_cedula, cliente_telefono, cliente_email, cliente_departamento, cliente_ciudad, cliente_barrio, cliente_direccion, metodo_pago, total_venta, detalle_productos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`;
        const values = [nombre, cedula, telefono, email, departamento, ciudad, barrio, direccion, metodo, total, resumen];
        
        const result = await pool.query(query, values);
        res.json({ success: true, orderId: result.rows[0].id });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// RUTAS DE AUTENTICACIÓN (LOGIN)
// ==========================================

app.post('/api/manager/login', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM usuariosmanager WHERE usuario = $1 AND password = $2', [usuario, password]);
        
        if (result.rows.length > 0) {
            const user = result.rows[0];
            // GENERAMOS EL TOKEN AQUÍ
            const token = jwt.sign(
                { id: user.id, usuario: user.usuario }, 
                process.env.JWT_SECRET, 
                { expiresIn: '8h' } // El token dura 8 horas
            );

            res.json({ success: true, token: token, user: user.usuario });
        } else {
            res.status(401).json({ success: false, message: "Credenciales incorrectas" });
        }
    } catch (err) { res.status(500).send(err.message); }
});

// ==========================================
// RUTAS PRIVADAS (MANAGER) - ¡PROTEGIDAS!
// ==========================================
// Todas estas rutas ahora tienen 'verifyToken' como segundo argumento.
// Si no envías el token desde el frontend, el servidor rechazará la petición.

// 1. Obtener pedidos
app.get('/api/manager/orders', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM pedidos ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

// 2. Cambiar estado
app.patch('/api/manager/orders/:id', verifyToken, async (req, res) => {
    const { estado } = req.body;
    const { id } = req.params;
    try {
        await pool.query('UPDATE pedidos SET estado = $1 WHERE id = $2', [estado, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 3. Subir Imagen
app.post('/api/manager/upload-image', verifyToken, upload.single('image'), async (req, res) => {
  const { productId, orientation } = req.body; 
  const file = req.file;
  
  if (!file) return res.status(400).send('No image uploaded');
  const imageUrl = `/uploads/${file.filename}`;

  try {
      await pool.query(
          'UPDATE productos SET imagen_url = $1, imagen_orientacion = $2 WHERE codigo = $3', 
          [imageUrl, orientation, productId]
      );
      res.json({ success: true, imageUrl: `https://api.tshoptechnology.com${imageUrl}` });
  } catch (err) { res.status(500).send(err.message); }
});

// 4. Actualizar Stock/Precio
app.patch('/api/manager/products/:id', verifyToken, async (req, res) => {
    const { precio, stock } = req.body;
    const { id } = req.params;
    try {
        await pool.query('UPDATE productos SET precio_venta = $1, cantidad = $2 WHERE codigo = $3', [precio, stock, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 5. Destacar producto
app.patch('/api/manager/feature/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query('UPDATE productos SET es_destacado = $1 WHERE codigo = $2', [status, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

// 6. Descripción
app.patch('/api/manager/description/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { description } = req.body;
    try {
        await pool.query('UPDATE productos SET descripcion = $1 WHERE codigo = $2', [description, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/manager/products-all', verifyToken, async (req, res) => {
    try {
      // Aquí NO filtramos por estado, para que tú veas todo el inventario
      const result = await pool.query("SELECT *, es_destacado FROM productos WHERE estado = 'Activo' ORDER BY nombre");
      
      // Mapeamos igual que antes para mantener compatibilidad con tu manager.js
      const productos = result.rows.map(p => ({
          id: p.codigo,
          nombre: p.nombre,
          precio: p.precio_venta,
          cantidad: p.cantidad,
          unidad: p.unidad_medida,
          linea: p.area_encargada,
          descripcion: p.descripcion,
          orientacion: p.imagen_orientacion || 'vertical',
          imagen_url: p.imagen_url ? `https://api.tshoptechnology.com${p.imagen_url}` : null,
          destacado: p.es_destacado,
          estado: p.estado // Incluimos el estado para que lo veas en el manager si quieres
      }));
      res.json(productos);
    } catch (err) { res.status(500).send(err.message); }
});

// --- GESTIÓN DE USUARIOS (PROTEGIDAS) ---

app.get('/api/manager/users', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, usuario FROM usuariosmanager ORDER BY id');
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.post('/api/manager/users', verifyToken, async (req, res) => {
    const { usuario, password } = req.body;
    try {
        await pool.query('INSERT INTO usuariosmanager (usuario, password) VALUES ($1, $2)', [usuario, password]);
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ success: false, message: "Error (quizás el usuario ya existe)" }); 
    }
});

app.delete('/api/manager/users/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM usuariosmanager WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/manager/visitors', verifyToken, async (req, res) => {
    try {
        // Agrupamos por IP para no repetir, mostrando la última visita
        const query = `
            SELECT ip, COUNT(*) as conteo, MAX(fecha) as ultima_fecha, MAX(dispositivo) as dispositivo 
            FROM visitas 
            GROUP BY ip 
            ORDER BY ultima_fecha DESC 
            LIMIT 50
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.listen(port, () => {
  console.log(`🔥 Backend Manager SEGURO listo en http://localhost:${port}`);
});