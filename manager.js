const API_URL = 'https://api.tshoptechnology.com/api';
let allProducts = [];
let currentEditId = null;

// --- NAVEGACIÓN ---
function switchView(viewName, btn) {
    // 1. Ocultar TODAS las vistas (Agregamos la de destacados a la lista de ocultar)
    document.getElementById('view-orders').style.display = 'none';
    document.getElementById('view-inventory').style.display = 'none';
    
    // Verificamos si existe la sección antes de ocultarla (para evitar errores si no ha cargado)
    const featuredSection = document.getElementById('view-featured');
    if (featuredSection) featuredSection.style.display = 'none';
    
    // 2. Gestionar clases activas del menú (Visual del botón presionado)
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    // 3. Mostrar la vista deseada
    const viewToShow = document.getElementById(`view-${viewName}`);
    if (viewToShow) viewToShow.style.display = 'block';

    // 4. Cargar datos frescos según la pestaña
    if(viewName === 'orders') loadOrders();
    if(viewName === 'inventory') loadInventory();
    if(viewName === 'featured') loadFeaturedView(); // <--- Asegúrate de que esta línea esté aquí
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
        const res = await fetch(`${API_URL}/manager/orders`);
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
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">No se encontraron pedidos en esta fecha.</div>';
        return;
    }

    // Encabezado de la "Tabla"
    const header = document.createElement('div');
    header.style.cssText = "display: grid; grid-template-columns: 0.5fr 1.5fr 1fr 1fr 1fr; padding: 10px; background: #333; font-weight: bold; border-radius: 8px 8px 0 0; color: #aaa; font-size: 0.9rem;";
    header.innerHTML = `
        <span>ID</span>
        <span>Cliente</span>
        <span>Fecha</span>
        <span>Estado</span>
        <span style="text-align:right">Total</span>
    `;
    container.appendChild(header);

    // Filas (Usamos listToRender en lugar de allOrders)
    listToRender.forEach(o => {
        const div = document.createElement('div');
        div.className = 'order-row';
        div.style.cssText = "display: grid; grid-template-columns: 0.5fr 1.5fr 1fr 1fr 1fr; padding: 15px 10px; border-bottom: 1px solid #333; cursor: pointer; transition: background 0.2s; align-items: center;";
        div.onmouseover = () => div.style.background = '#222';
        div.onmouseout = () => div.style.background = 'transparent';
        div.onclick = () => openOrderDetails(o.id);

        const statusColor = o.estado === 'PENDIENTE' ? '#FFC107' : '#00C853';

        div.innerHTML = `
            <span style="color: var(--accent); font-weight:bold;">#${o.id}</span>
            <span>${o.cliente_nombre}</span>
            <span style="font-size: 0.85rem; color: #888;">${new Date(o.fecha_pedido).toLocaleDateString()}</span>
            <span style="color: ${statusColor}; font-size: 0.8rem; font-weight: bold; border: 1px solid ${statusColor}; padding: 2px 6px; border-radius: 4px; display: inline-block; text-align: center; width: fit-content;">${o.estado}</span>
            <span style="text-align:right; font-weight:bold;">$${Number(o.total_venta).toLocaleString()}</span>
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
        await fetch(`${API_URL}/manager/orders/${id}`, {
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
async function loadInventory() {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '<p class="loading">Cargando catálogo...</p>';
    
    try {
        const res = await fetch(`${API_URL}/products`);
        allProducts = await res.json();
        renderProducts(allProducts);
    } catch(e) {
        console.error(e);
        container.innerHTML = '<p>Error al cargar productos.</p>';
    }
}

function renderProducts(list) {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';

    // 1. Definimos el HTML del icono genérico (placeholder)
    // Usamos comillas simples para facilitar su inserción dentro del atributo onerror
    const placeholderHTML = `
        <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1a1a1a;">
            <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
        </div>`;

        // Eliminamos saltos de línea y escapamos comillas para el onerror
        const safePlaceholderManager = placeholderHTML.replace(/\n/g, '').replace(/"/g, "&quot;");  

    list.forEach(p => {
        const div = document.createElement('div');
        div.className = 'prod-card';
        
        const precioFormateado = Number(p.precio).toLocaleString('es-CO', { maximumFractionDigits: 0 });
        const stockFormateado = Number(p.cantidad); 

        // 2. Lógica de la imagen con manejo de errores (onerror)
        // Si hay URL, intentamos cargar la imagen.
        // Si falla (onerror), reemplazamos la etiqueta <img> por el placeholderHTML.
        // Si no hay URL, mostramos directamente el placeholderHTML.
        const imgDisplay = p.imagen_url 
            ? `<img src="${p.imagen_url}" alt="${p.nombre}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.outerHTML = '${placeholderHTML}'">` 
            : placeholderHTML;

        // Verificamos si ya tiene descripción
        const hasDesc = p.descripcion && !p.descripcion.startsWith('Stock disponible');
        const btnColor = hasDesc ? 'var(--accent)' : '#666';

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
    const lower = term.toLowerCase();
    const filtered = allProducts.filter(p => p.nombre.toLowerCase().includes(lower));
    renderProducts(filtered);
}

// --- EDICIÓN RÁPIDA (PRECIO/STOCK) ---
async function updateProduct(id) {
    const priceInput = document.getElementById(`price-${id}`).value;
    const stockInput = document.getElementById(`stock-${id}`).value;
    
    // LIMPIEZA DE DATOS: Quitamos puntos, comas y signos para enviar solo números
    // Ejemplo: "5.500.000" -> "5500000"
    const cleanPrice = priceInput.replace(/\./g, '').replace(/,/g, '').replace('$', '').trim();
    
    const btn = document.querySelector(`button[onclick="updateProduct('${id}')"]`);
    const originalText = btn.innerText;
    
    // Feedback visual inmediato
    btn.innerText = 'Guardando...';
    btn.style.background = '#333';

    try {
        await fetch(`${API_URL}/manager/products/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                precio: cleanPrice, 
                stock: stockInput 
            })
        });
        
        btn.innerText = '¡Guardado!';
        btn.style.background = 'var(--success)';
        
        // Restaurar botón después de 2 segundos
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = ''; // Vuelve al estilo CSS original
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
    
    // Obtener la orientación seleccionada (asegúrate de tener los radio buttons en el HTML)
    let orientation = 'vertical';
    const radio = document.querySelector('input[name="img-orient"]:checked');
    if(radio) orientation = radio.value;
    
    if(!file || !currentEditId) return alert("Selecciona una imagen primero.");
    
    const formData = new FormData();
    formData.append('image', file);
    formData.append('productId', currentEditId);
    formData.append('orientation', orientation); // Enviamos la decisión de diseño
    
    const btn = document.querySelector('.actions button.primary');
    btn.innerText = 'Subiendo...';
    
    try {
        const res = await fetch(`${API_URL}/manager/upload-image`, {
            method: 'POST',
            body: formData
        });
        
        if(res.ok) {
            closeModal();
            loadInventory(); // Recargar grilla para ver la nueva foto
        } else {
            const errorMsg = await res.text();
            alert("Error del servidor: " + errorMsg);
        }
    } catch(e) {
        alert("Error de conexión. Verifica que el servidor esté encendido.");
    } finally {
        btn.innerText = 'Guardar y Subir';
    }
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
        await fetch(`${API_URL}/manager/feature/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ status })
        });
        // Actualizar localmente y recargar UI
        const p = allProducts.find(x => String(x.id) === String(id));
        if(p) p.destacado = status;
        renderFeaturedUI();
        document.getElementById('featured-search-list').innerHTML = ''; // Limpiar búsqueda
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
        const res = await fetch(`${API_URL}/manager/description/${currentDescId}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ description: text })
        });
        
        if(res.ok) {
            // Actualizar localmente
            const p = allProducts.find(x => String(x.id) === String(currentDescId));
            if(p) p.descripcion = text;
            
            closeDescModal();
            renderProducts(allProducts); // Recargar para ver si cambia el color del icono
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

loadOrders();