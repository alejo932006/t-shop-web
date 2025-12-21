const API_URL = 'https://api.tshoptechnology.com/api';
let allProducts = [];
let currentEditId = null;
let isLoggedIn = false;

async function authFetch(endpoint, options = {}) {
    const token = localStorage.getItem('manager_token');
    
    // Configurar headers
    const headers = options.headers || {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers: headers
    };

    const res = await fetch(`${API_URL}${endpoint}`, config);

    // Si el token expiró (Error 401 o 403), sacar al usuario
    if (res.status === 401 || res.status === 403) {
        alert("Tu sesión ha expirado. Por favor ingresa nuevamente.");
        localStorage.removeItem('manager_token');
        location.reload(); // Recarga para mostrar login
        return null;
    }
    
    return res;
}

function checkAuth() {
    if(!isLoggedIn) {
        document.getElementById('login-screen').style.display = 'flex';
        return false;
    }
    return true;
}


// ==========================================
// MÓDULO DE PEDIDOS (LOGÍSTICA) - ACTUALIZADO
// ==========================================
let allOrders = []; // Variable global para guardar pedidos

// C. ACTUALIZAR LOADORDERS (Para limpiar el input al recargar)
async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<p class="loading">Cargando pedidos...</p>';

    try {
        const res = await authFetch('/manager/orders');
        if(!res) return; // Si falló la auth, paramos
        allOrders = await res.json();
        
        // --- KPI logic (se mantiene igual) ---
        const pending = allOrders.filter(o => o.estado === 'PENDIENTE').length;
        document.getElementById('kpi-pending').innerText = pending;
        const today = new Date().toISOString().slice(0,10);
        const totalToday = allOrders
            .filter(o => o.fecha_pedido.startsWith(today) && o.estado !== 'CANCELADO')
            .reduce((acc, o) => acc + Number(o.total_venta), 0);
        document.getElementById('kpi-total-today').innerText = `$${totalToday.toLocaleString()}`;
        // -------------------------------------

        // LIMPIAR AMBOS CAMPOS DE FECHA
        document.getElementById('date-start').value = '';
        document.getElementById('date-end').value = '';
        
        renderOrdersList(allOrders);

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p>Error de conexión con el servidor.</p>';
    }
}
function renderOrdersList(listToRender = allOrders) { 
    const container = document.getElementById('orders-list');
    container.innerHTML = '';

    if(listToRender.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No se encontraron pedidos.</div>';
        return;
    }

    // Encabezado usando CLASE, no style inline
    const header = document.createElement('div');
    header.className = 'table-header'; // <--- CLASE NUEVA
    header.innerHTML = `
        <span>ID</span>
        <span>Cliente</span>
        <span>Fecha</span>
        <span>Estado</span>
        <span style="text-align:right">Total</span>
    `;
    container.appendChild(header);

    listToRender.forEach(o => {
        const div = document.createElement('div');
        div.className = 'table-row'; // <--- CLASE NUEVA (reemplaza order-row con estilos fijos)
        div.onclick = () => openOrderDetails(o.id);

        const statusColor = o.estado === 'PENDIENTE' ? '#FFC107' : '#00C853';

        div.innerHTML = `
            <span class="cell-id">#${o.id}</span>
            <span class="cell-client">${o.cliente_nombre}</span>
            <span class="cell-date">${new Date(o.fecha_pedido).toLocaleDateString()}</span>
            <span class="cell-status" style="color: ${statusColor}; border-color: ${statusColor};">${o.estado}</span>
            <span class="cell-total">$${Number(o.total_venta).toLocaleString()}</span>
        `;
        container.appendChild(div);
    });
}

function openOrderDetails(id) {
    // Buscar el pedido en memoria
    const o = allOrders.find(order => String(order.id) === String(id));
    if(!o) return;

    // 1. Llenar datos básicos
    document.getElementById('detail-id').innerText = o.id;
    document.getElementById('detail-client').innerText = o.cliente_nombre;
    document.getElementById('detail-cedula').innerText = `CC: ${o.cliente_cedula || '---'}`;
    document.getElementById('detail-phone').innerText = `📞 ${o.cliente_telefono}`;
    document.getElementById('detail-city').innerText = `${o.cliente_ciudad} - ${o.cliente_departamento}`;
    document.getElementById('detail-address').innerText = o.cliente_direccion;
    document.getElementById('detail-barrio').innerText = o.cliente_barrio ? `Barrio: ${o.cliente_barrio}` : '';
    document.getElementById('detail-date').innerText = new Date(o.fecha_pedido).toLocaleString();
    document.getElementById('detail-total').innerText = `$${Number(o.total_venta).toLocaleString()}`;

    // 2. Configurar Botón WhatsApp
    const msg = `Hola ${o.cliente_nombre}, te escribo de T-Shop respecto a tu pedido #${o.id}.`;
    const waUrl = `https://wa.me/57${o.cliente_telefono}?text=${encodeURIComponent(msg)}`;
    document.getElementById('btn-whatsapp').href = waUrl;

    // 3. Llenar lista de productos
    const prodsContainer = document.getElementById('detail-products');
    try {
        const items = JSON.parse(o.detalle_productos);
        prodsContainer.innerHTML = items.map(i => `
            <div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #222; font-size:0.9rem;">
                <span>${i.qty}x ${i.nombre}</span>
                <span style="color:#aaa;">$${Number(i.precio * i.qty).toLocaleString()}</span>
            </div>
        `).join('');
    } catch(e) { prodsContainer.innerHTML = 'Error mostrando productos'; }

    // 4. Botón de Acción (Despachar)
    const actionsContainer = document.getElementById('detail-actions');
    if(o.estado === 'PENDIENTE') {
        actionsContainer.innerHTML = `<button onclick="changeStatus(${o.id}, 'DESPACHADO')" class="primary" style="background:var(--success);">✅ Marcar Despachado</button>`;
    } else {
        actionsContainer.innerHTML = `<span style="color:var(--success); font-weight:bold;">🚀 Pedido Completado</span>`;
    }

    // Mostrar Modal
    document.getElementById('modal-order-details').classList.remove('hidden');
}

function closeOrderModal() {
    document.getElementById('modal-order-details').classList.add('hidden');
}

// Mantener la función changeStatus original, pero agregarle cierre de modal
async function changeStatus(id, newStatus) {
    if(!confirm(`¿Confirmas que el pedido #${id} ya fue despachado?`)) return;
    
    try {
        await authFetch(`/manager/orders/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ estado: newStatus })
        });
        closeOrderModal(); // Cerrar modal al guardar
        loadOrders(); // Recargar lista
    } catch (e) {
        alert("Error al actualizar estado");
    }
}
// ==========================================
// MÓDULO DE INVENTARIO & FOTOS
// ==========================================
// En manager.js

// 1. MODIFICA la función loadInventory existente para calcular los contadores
async function loadInventory() {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '<p class="loading">Cargando catálogo completo...</p>';
    
    try {
        const res = await authFetch('/manager/products-all');
        
        if (res) {
            allProducts = await res.json();
            
            // --- NUEVO: CALCULAR CONTADORES ---
            updatePhotoCounters(); 
            // ----------------------------------

            renderProducts(allProducts);
        }
    } catch(e) {
        console.error(e);
        container.innerHTML = '<p>Error al cargar productos.</p>';
    }
}

// 2. AGREGA estas nuevas funciones al final de tu archivo (o donde prefieras)

function updatePhotoCounters() {
    // Calculamos totales
    const total = allProducts.length;
    const withPhoto = allProducts.filter(p => p.imagen_url && p.imagen_url.trim() !== '').length;
    const withoutPhoto = total - withPhoto;

    // Actualizamos el HTML
    document.getElementById('count-all').innerText = total;
    document.getElementById('count-with').innerText = withPhoto;
    document.getElementById('count-without').innerText = withoutPhoto;
}

function filterPhotos(mode, btn) {
    // 1. Gestión visual de botones activos
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');

    // 2. Lógica de filtrado
    let filteredList = [];

    if (mode === 'all') {
        filteredList = allProducts;
    } else if (mode === 'with') {
        filteredList = allProducts.filter(p => p.imagen_url && p.imagen_url.trim() !== '');
    } else if (mode === 'without') {
        filteredList = allProducts.filter(p => !p.imagen_url || p.imagen_url.trim() === '');
    }

    // 3. Renderizamos la lista filtrada
    renderProducts(filteredList);

    // 4. Limpiamos el buscador de texto para evitar confusión
    document.getElementById('search-prod').value = '';
}

function renderProducts(list) {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';

    // 1. DEFINICIÓN LIMPIA DEL PLACEHOLDER (PAISAJE GRIS)
    // Usamos comillas dobles dentro del HTML para evitar conflictos luego.
    // Todo en una sola línea para evitar errores de saltos de línea en JavaScript.
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    
    const placeholderHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1a1a1a;">${svgIcon}</div>`;

    // 2. PREPARAR STRING PARA EL ERROR (ONERROR)
    // El truco: Para meter HTML dentro de un atributo onerror="this.outerHTML='...'",
    // el contenido NO puede tener comillas simples. Reemplazamos las dobles por comillas simples escapadas si fuera necesario,
    // pero aquí usaremos comillas dobles dentro (escapadas como &quot;) para que el envoltorio '...' funcione.
    const safeErrorHTML = placeholderHTML.replace(/"/g, "&quot;");

    list.forEach(p => {
        const div = document.createElement('div');
        div.className = 'prod-card';
        
        const precioFormateado = Number(p.precio).toLocaleString('es-CO', { maximumFractionDigits: 0 });
        const stockFormateado = Number(p.cantidad); 

        // 3. LÓGICA DE IMAGEN ROBUSTA
        // Si hay URL, creamos la etiqueta IMG. Si falla, el onerror reemplaza la etiqueta por el div del paisaje.
        // Si NO hay URL, ponemos el div del paisaje directamente.
        let imgDisplay;
        if (p.imagen_url && p.imagen_url.trim() !== '') {
            imgDisplay = `<img src="${p.imagen_url}" alt="${p.nombre}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.outerHTML='${safeErrorHTML}'">`;
        } else {
            imgDisplay = placeholderHTML;
        }

        // Verificamos si ya tiene descripción para el color del botón
        const hasDesc = p.descripcion && !p.descripcion.startsWith('Stock disponible');
        const btnColor = hasDesc ? 'var(--accent)' : '#666';

        // 4. INYECTAR HTML
        div.innerHTML = `
            <div class="prod-img" style="height: 180px;">
                ${imgDisplay}
                <button class="btn-photo" onclick="openPhotoModal('${p.id}', '${p.nombre}')">
                    <span class="material-icons-round">add_a_photo</span>
                </button>
                <span style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.7); color:white; font-size:0.6rem; font-weight:bold; padding:4px 8px; border-radius:4px; backdrop-filter:blur(4px); letter-spacing: 1px;">
                    ${p.orientacion === 'horizontal' ? 'HORIZ' : 'VERT'}
                </span>
            </div>
            
            <div class="prod-body" style="padding: 20px;">
                <div class="prod-title" title="${p.nombre}" style="font-size: 1.1rem; margin-bottom: 20px;">${p.nombre}</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding-bottom: 15px; border-bottom: 1px solid #333;">
                    <div style="text-align: center;">
                        <label style="font-size: 0.7rem; color: #888; letter-spacing: 1px; display: block; margin-bottom: 5px; font-weight: bold;">PRECIO</label>
                        <div style="font-size: 1.3rem; font-weight: 900; color: var(--success); letter-spacing: -0.5px;">
                            $${precioFormateado}
                        </div>
                    </div>
                    <div style="text-align: center; border-left: 1px solid #333;">
                        <label style="font-size: 0.7rem; color: #888; letter-spacing: 1px; display: block; margin-bottom: 5px; font-weight: bold;">STOCK</label>
                        <div style="font-size: 1.3rem; font-weight: 900; color: white; letter-spacing: -0.5px;">
                            ${stockFormateado} <span style="font-size: 0.8rem; font-weight: normal; color: #aaa;">UND</span>
                        </div>
                    </div>
                </div>

                <button onclick="openDescModal('${p.id}')" 
                        style="width: 100%; margin-top: 15px; background: #222; border: 1px solid #333; color: #ccc; padding: 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s;">
                    <span class="material-icons-round" style="font-size: 18px; color: ${btnColor};">description</span>
                    <span style="font-size: 0.85rem; font-weight: bold;">Editar Descripción Web</span>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function searchProducts(term) {
    // Convertimos lo que escribes a minúsculas para comparar fácil
    const lower = term.toLowerCase();
    
    const filtered = allProducts.filter(p => {
        // 1. Buscamos en el NOMBRE
        const nameMatch = p.nombre.toLowerCase().includes(lower);
        
        // 2. Buscamos en el ID (que es tu CÓDIGO)
        // Convertimos el ID a string (texto) por si es un número puro
        const codeMatch = String(p.id).toLowerCase().includes(lower);
        
        // Retornamos los que coincidan con uno O con el otro
        return nameMatch || codeMatch;
    });

    renderProducts(filtered);
}

// --- EDICIÓN RÁPIDA (PRECIO/STOCK) ---
async function updateProduct(id) {
    const priceInput = document.getElementById(`price-${id}`).value;
    const stockInput = document.getElementById(`stock-${id}`).value;
    
    // Limpieza de datos
    const cleanPrice = priceInput.replace(/\./g, '').replace(/,/g, '').replace('$', '').trim();
    
    const btn = document.querySelector(`button[onclick="updateProduct('${id}')"]`);
    const originalText = btn.innerText;
    
    btn.innerText = 'Guardando...';
    btn.style.background = '#333';

    try {
        // CORRECCIÓN AQUÍ: Usamos authFetch y quitamos ${API_URL} porque authFetch ya lo incluye
        await authFetch(`/manager/products/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                precio: cleanPrice, 
                stock: stockInput 
            })
        });
        
        btn.innerText = '¡Guardado!';
        btn.style.background = 'var(--success)';
        
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = ''; 
        }, 2000);
        
    } catch(e) {
        alert("Error al guardar conexión");
        btn.innerText = 'Error';
        btn.style.background = 'var(--danger)';
    }
}

// --- GESTIÓN DE SUBIDA DE FOTOS ---
function openPhotoModal(id, name) {
    currentEditId = id;
    document.getElementById('modal-prod-name').innerText = name;
    document.getElementById('modal-photo').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal-photo').classList.add('hidden');
    document.getElementById('file-input').value = '';
    currentEditId = null;
}

async function uploadPhoto() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    
    // Obtener la orientación seleccionada
    let orientation = 'vertical';
    const radio = document.querySelector('input[name="img-orient"]:checked');
    if(radio) orientation = radio.value;
    
    if(!file || !currentEditId) return alert("Selecciona una imagen primero.");
    
    const btn = document.querySelector('.actions button.primary');
    const originalText = btn.innerText;
    btn.innerText = 'Mejorando foto...'; // Feedback visual
    btn.disabled = true;

    // --- AQUÍ LLAMAMOS A LA NUEVA FUNCIÓN ---
    processImage(file, async function(processedBlob) {
        // Ahora 'processedBlob' es la foto mejorada y ligera
        
        const formData = new FormData();
        formData.append('image', processedBlob, "foto-optimizada.jpg"); // Le ponemos nombre nuevo
        formData.append('productId', currentEditId);
        formData.append('orientation', orientation);
        
        btn.innerText = 'Subiendo...';
        
        try {
            const token = localStorage.getItem('manager_token');
            const res = await fetch(`${API_URL}/manager/upload-image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}` 
                },
                body: formData
            });
            
            if(res.ok) {
                closeModal();
                loadInventory(); // Recargar grilla
                alert("¡Foto mejorada y subida con éxito!");
            } else {
                const errorMsg = await res.text();
                alert("Error del servidor: " + errorMsg);
            }
        } catch(e) {
            console.error(e);
            alert("Error de conexión.");
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

// --- LÓGICA DE DESTACADOS ---

function loadFeaturedView() {
    // Reutilizamos allProducts que ya cargó en loadInventory, o los cargamos si está vacío
    if(allProducts.length === 0) fetch('http://localhost:3000/api/products').then(r=>r.json()).then(d=>{allProducts=d; renderFeaturedUI();});
    else renderFeaturedUI();
}

function renderFeaturedUI() {
    const activeContainer = document.getElementById('featured-active-list');
    
    // Filtrar los que son destacados = true
    const active = allProducts.filter(p => p.destacado);

    activeContainer.innerHTML = active.length ? '' : '<p style="color:#666">No hay destacados aún.</p>';

    active.forEach(p => {
        const div = document.createElement('div');
        div.className = 'order-card'; // Reutilizamos estilo
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="${p.imagen_url || ''}" style="width:40px; height:40px; object-fit:contain; background:#fff; border-radius:4px;">
                <strong>${p.nombre}</strong>
            </div>
            <button onclick="toggleFeature('${p.id}', false)" style="background:var(--danger); color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Quitar</button>
        `;
        activeContainer.appendChild(div);
    });
}

function searchForFeature(term) {
    const container = document.getElementById('featured-search-list');
    if(term.length < 2) { container.innerHTML = ''; return; }

    const lower = term.toLowerCase();
    // Buscar productos que NO estén destacados ya
    const matches = allProducts.filter(p => !p.destacado && p.nombre.toLowerCase().includes(lower));

    container.innerHTML = '';
    matches.slice(0, 5).forEach(p => { // Mostrar máx 5
        const div = document.createElement('div');
        div.className = 'order-card';
        div.innerHTML = `
            <span>${p.nombre}</span>
            <button onclick="toggleFeature('${p.id}', true)" style="background:var(--success); color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Destacar</button>
        `;
        container.appendChild(div);
    });
}

async function toggleFeature(id, status) {
    try {
        // CORRECCIÓN AQUÍ: authFetch
        await authFetch(`/manager/feature/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status })
        });
        
        // Actualizar localmente y recargar UI
        const p = allProducts.find(x => String(x.id) === String(id));
        if(p) p.destacado = status;
        renderFeaturedUI();
        document.getElementById('featured-search-list').innerHTML = ''; 
    } catch(e) { alert("Error al actualizar"); }
}

function filterOrders() {
    const startVal = document.getElementById('date-start').value;
    const endVal = document.getElementById('date-end').value;

    // Si no hay fechas seleccionadas, mostrar todo
    if (!startVal && !endVal) {
        renderOrdersList(allOrders);
        return;
    }

    const filtered = allOrders.filter(o => {
        // Tomamos solo la parte YYYY-MM-DD de la fecha del pedido (primeros 10 caracteres)
        // Ejemplo: "2025-12-04T15:30:00" -> "2025-12-04"
        const orderDate = o.fecha_pedido.substring(0, 10);

        // Lógica de validación
        // 1. Si hay fecha inicio, la orden debe ser mayor o igual
        if (startVal && orderDate < startVal) return false;
        
        // 2. Si hay fecha fin, la orden debe ser menor o igual
        if (endVal && orderDate > endVal) return false;

        return true;
    });
    
    renderOrdersList(filtered);
}

// --- GESTIÓN DE DESCRIPCIONES ---
let currentDescId = null;

function openDescModal(id) {
    currentDescId = id;
    const p = allProducts.find(x => String(x.id) === String(id));
    if(!p) return;

    document.getElementById('desc-prod-name').innerText = p.nombre;
    
    // Si la descripción es la genérica de stock, mostramos el campo vacío para escribir desde cero
    const isGeneric = p.descripcion && p.descripcion.startsWith('Stock disponible');
    document.getElementById('desc-text-input').value = isGeneric ? '' : (p.descripcion || '');
    
    document.getElementById('modal-desc-edit').classList.remove('hidden');
}

function closeDescModal() {
    document.getElementById('modal-desc-edit').classList.add('hidden');
    currentDescId = null;
}

async function saveDescription() {
    const text = document.getElementById('desc-text-input').value;
    const btn = document.querySelector('#modal-desc-edit .primary');
    const originalText = btn.innerText;
    
    btn.innerText = 'Guardando...';
    
    try {
        // CORRECCIÓN AQUÍ: authFetch
        const res = await authFetch(`/manager/description/${currentDescId}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ description: text })
        });
        
        // authFetch puede devolver null si falla la sesión, así que validamos 'res'
        if(res && res.ok) {
            const p = allProducts.find(x => String(x.id) === String(currentDescId));
            if(p) p.descripcion = text;
            
            closeDescModal();
            renderProducts(allProducts);
            alert("Descripción actualizada correctamente en la web.");
        } else {
            alert("Error al guardar.");
        }
    } catch(e) {
        alert("Error de conexión.");
    } finally {
        btn.innerText = originalText;
    }
}

// ==========================================
// MÓDULO DE LOGIN
// ==========================================
async function doLogin() {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const err = document.getElementById('login-error');

    if(!u || !p) { err.innerText = "Completa los campos"; err.style.display = 'block'; return; }

    try {
        const res = await fetch(`${API_URL}/manager/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuario: u, password: p })
        });
        const data = await res.json();

        if (data.success) {
            // AQUI GUARDAMOS EL TOKEN
            localStorage.setItem('manager_token', data.token);
            
            isLoggedIn = true;
            document.getElementById('login-screen').style.display = 'none';
            loadOrders(); 
        } else {
            err.innerText = data.message || "Credenciales incorrectas";
            err.style.display = 'block';
        }
    } catch(e) {
        console.error(e);
        err.innerText = "Error de conexión con el servidor";
        err.style.display = 'block';
    }
}

// ==========================================
// MÓDULO DE USUARIOS (CRUD)
// ==========================================
async function loadUsers() {
    const container = document.getElementById('users-list');
    container.innerHTML = '<p class="loading">Cargando...</p>';
    try {
        // CORRECCIÓN: authFetch
        const res = await authFetch('/manager/users');
        if(!res) return;
        
        const users = await res.json();
        
        container.innerHTML = '';
        users.forEach(u => {
            const div = document.createElement('div');
            div.className = 'order-card';
            const deleteBtn = u.usuario === 'admin' 
                ? '<span style="color:#666; font-size:0.8rem;">(Principal)</span>' 
                : `<button onclick="deleteUser(${u.id})" style="background:var(--danger); color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Eliminar</button>`;
            
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="material-icons-round" style="color:#888;">person</span>
                    <strong>${u.usuario}</strong>
                </div>
                ${deleteBtn}
            `;
            container.appendChild(div);
        });
    } catch(e) { container.innerHTML = 'Error al cargar usuarios.'; }
}

async function createUser() {
    const u = document.getElementById('new-user-name').value;
    const p = document.getElementById('new-user-pass').value;
    if(!u || !p) return alert("Completa ambos campos");

    try {
        // CORRECCIÓN: authFetch
        const res = await authFetch('/manager/users', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ usuario: u, password: p })
        });
        
        if(!res) return;
        const data = await res.json();
        
        if(data.success) {
            document.getElementById('new-user-name').value = '';
            document.getElementById('new-user-pass').value = '';
            loadUsers();
            alert("Usuario creado correctamente");
        } else {
            alert(data.message);
        }
    } catch(e) { alert("Error al crear usuario"); }
}

async function deleteUser(id) {
    if(!confirm("¿Seguro que deseas eliminar este usuario?")) return;
    try {
        // CORRECCIÓN: authFetch
        await authFetch(`/manager/users/${id}`, { method: 'DELETE' });
        loadUsers();
    } catch(e) { alert("Error al eliminar"); }
}

// --- NAVEGACIÓN UNIFICADA ---
function switchView(viewName, btn) {
    if (!checkAuth()) return;

    // 1. Ocultar todas las vistas
    const views = ['orders', 'inventory', 'featured', 'users', 'visitors'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.style.display = 'none';
    });
    
    // 2. Mostrar la vista seleccionada
    const viewToShow = document.getElementById(`view-${viewName}`);
    if (viewToShow) viewToShow.style.display = 'block';

    // 3. GESTIÓN DE BOTONES (PC y MÓVIL)
    // Primero: Quitamos 'active' de TODOS los botones (PC y Móvil)
    document.querySelectorAll('.nav-item, .mob-item').forEach(b => b.classList.remove('active'));

    // Segundo: Si el click vino de un botón, lo activamos
    if(btn) {
        btn.classList.add('active');
    } else {
        // Si la función se llamó sin botón (ej: al cargar), buscamos qué botón corresponde a esta vista
        // Mapeo de vista -> icono para encontrar el botón móvil correcto
        const icons = {
            'orders': 'receipt_long',
            'inventory': 'inventory_2',
            'featured': 'star',
            'users': 'group',
            'visitors': 'public'
        };
        
        // Activar en Sidebar PC
        const pcBtns = document.querySelectorAll(`.nav-item`);
        pcBtns.forEach(b => { if(b.innerHTML.includes(icons[viewName])) b.classList.add('active'); });

        // Activar en Móvil
        const mobBtns = document.querySelectorAll(`.mob-item`);
        mobBtns.forEach(b => { if(b.innerHTML.includes(icons[viewName])) b.classList.add('active'); });
    }

    // 4. Cargar datos
    if(viewName === 'orders') loadOrders();
    if(viewName === 'inventory') loadInventory();
    if(viewName === 'featured') loadFeaturedView();
    if(viewName === 'users') loadUsers();
    if(viewName === 'visitors') loadVisitors();
}

// Función auxiliar para el menú "Más" en móvil
function toggleMobMenu() {
    const menu = document.getElementById('mob-menu-extra');
    if(menu) menu.classList.toggle('hidden');
}


// 2. Nueva función para cargar visitantes
async function loadVisitors() {
    const container = document.getElementById('visitors-list');
    container.innerHTML = '<p class="loading">Rastreando IPs...</p>';

    try {
        const res = await authFetch('/manager/visitors');
        if(!res) return;
        const data = await res.json();

        container.innerHTML = '';
        
        if(data.length === 0) {
            container.innerHTML = '<div style="padding:20px; text-align:center;">No hay registros aún.</div>';
            return;
        }

        // Encabezado
        const header = document.createElement('div');
        header.className = 'table-header visitor-header';
        header.innerHTML = `<span>IP</span><span>Visitas</span><span>Última</span><span>Disp.</span>`;
        container.appendChild(header);

        data.forEach(v => {
            const div = document.createElement('div');
            div.className = 'table-row visitor-row';
            
            const fecha = new Date(v.ultima_fecha).toLocaleString();
            let icon = 'computer';
            if(v.dispositivo && v.dispositivo.toLowerCase().includes('mobile')) icon = 'smartphone';

            div.innerHTML = `
                <span style="color: var(--accent); font-weight:bold;">${v.ip || 'Unknown'}</span>
                <span class="badge-count">${v.conteo}</span>
                <span style="font-size: 0.85rem; color: #888;">${fecha}</span>
                <div style="display:flex; align-items:center; gap:5px; font-size:0.8rem; color:#aaa;">
                    <span class="material-icons-round" style="font-size:16px;">${icon}</span>
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${v.dispositivo ? v.dispositivo.substring(0, 15) : 'N/A'}</span>
                </div>
            `;
            container.appendChild(div);
        });

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p>Error cargando visitantes.</p>';
    }
}
// ESTA ES LA FUNCIÓN QUE TE FALTA
async function clearVisitors() {
    if(!confirm("⚠️ ¿Estás SEGURO de vaciar todo el registro de IPs?\nEsta acción no se puede deshacer.")) {
        return;
    }

    // Buscamos el botón para ponerle efecto de carga (opcional)
    const btn = document.querySelector('button[onclick="clearVisitors()"]');
    if(btn) btn.innerHTML = '...';

    try {
        const res = await authFetch('/manager/visitors', { method: 'DELETE' });
        
        if (res && res.ok) {
            alert("Historial de visitas eliminado correctamente.");
            loadVisitors(); // Recargar la lista (ahora vacía)
        } else {
            alert("Error al intentar borrar el historial.");
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión.");
    } finally {
        if(btn) btn.innerHTML = '<span class="material-icons-round">delete_sweep</span>';
    }
}

// EN: manager.js (Agrega al final o cerca de uploadPhoto)

async function deleteCurrentPhoto() {
    if(!currentEditId) return;

    if(!confirm("¿Seguro que quieres quitar la foto de este producto?\nPasará a la lista de 'Sin Fotos'.")) {
        return;
    }

    const btn = document.querySelector('button[onclick="deleteCurrentPhoto()"]');
    btn.innerText = "Eliminando...";
    btn.disabled = true;

    try {
        const res = await authFetch(`/manager/product-image/${currentEditId}`, {
            method: 'DELETE'
        });

        if(res && res.ok) {
            closeModal();
            loadInventory(); // Recarga la lista: Ahora el producto aparecerá en "Sin Fotos"
            alert("Foto eliminada correctamente.");
        } else {
            alert("No se pudo eliminar la foto.");
        }
    } catch (e) {
        console.error(e);
        alert("Error de conexión.");
    } finally {
        btn.innerHTML = '<span class="material-icons-round" style="font-size: 16px; vertical-align: middle;">delete</span> Quitar foto actual';
        btn.disabled = false;
    }
}

// --- PROCESAMIENTO DE IMAGEN (Filtro Pro + Compresión) ---
function processImage(file, callback) {
    // 1. Configuración del "Filtro Profesional"
    const MAX_WIDTH = 1000; // Reducir a 1000px de ancho (estándar e-commerce ligero)
    const QUALITY = 0.8;    // Calidad JPG al 80% (imperceptible al ojo, ahorra 50% espacio)
    
    // Filtros: Aumentamos un poco el contraste y la saturación para que el producto "resalte"
    // Brightness: 1.05 (5% más luz)
    // Contrast: 1.10 (10% más contraste)
    // Saturate: 1.10 (10% más color)
    const FILTER_SETTINGS = "brightness(1.05) contrast(1.10) saturate(1.10)";

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = function(event) {
        const img = new Image();
        img.src = event.target.result;
        
        img.onload = function() {
            // 2. Calcular nuevas dimensiones (manteniendo proporción)
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
                height = Math.round(height * (MAX_WIDTH / width));
                width = MAX_WIDTH;
            }

            // 3. Crear el lienzo (Canvas) para dibujar la nueva foto
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            // 4. APLICAR EL FILTRO PROFESIONAL
            // Esta propiedad es mágica: aplica efectos tipo Instagram antes de dibujar
            ctx.filter = FILTER_SETTINGS;

            // 5. Dibujar la imagen redimensionada y filtrada
            ctx.drawImage(img, 0, 0, width, height);

            // 6. Exportar como archivo ligero (JPG comprimido)
            canvas.toBlob(function(blob) {
                callback(blob); // Devolvemos la foto ya procesada
            }, 'image/jpeg', QUALITY);
        };
    };
}

// loadOrders();