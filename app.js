// --- IMPORTACIONES (Actualizadas a v12.7.0) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js"; 

// --- CONFIGURACIÓN REAL DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAhoivPfV1D0qWYEH22xHQmQZgGWRu4BgU",
  authDomain: "tshopweb-6215b.firebaseapp.com",
  projectId: "tshopweb-6215b",
  storageBucket: "tshopweb-6215b.firebasestorage.app",
  messagingSenderId: "69888524320",
  appId: "1:69888524320:web:7f6f984aa312bd5cd8fc45",
  measurementId: "G-3V2RZNQJ8B"
};

// --- INICIALIZACIÓN ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// --- CONFIGURACIÓN FIJA ---
const API_BASE_URL = 'https://api.tshoptechnology.com'; // Tu servidor real

// --- ESTADO ---
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('tshop_cart')) || [];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    // Listeners UI Globales
    document.getElementById('cart-btn').onclick = () => toggleCart();
    document.getElementById('menu-btn').onclick = () => {
        const menu = document.getElementById('mobile-menu');
        menu.classList.toggle('hidden');
        menu.classList.toggle('flex');
    };
    
    // Listeners Checkout
    document.getElementById('back-to-cart-btn').onclick = showCartList;
    document.getElementById('checkout-form').onsubmit = submitOrder;

    updateCartUI();
    
    // CONEXIÓN AUTOMÁTICA AL INICIAR
    fetchTunnelData();
});

// --- API & DATA ---

async function fetchTunnelData() {
    showLoader(true);
    document.getElementById('error-message')?.classList.add('hidden');
    
    // Actualizar indicador visual (badge verde)
    const badge = document.getElementById('connection-badge');
    if(badge) badge.innerHTML = `<i data-lucide="loader" class="animate-spin w-3 h-3"></i> Conectando...`;

    try {
        // Usamos la URL fija de tu dominio
        const res = await fetch(`${API_BASE_URL}/api/products`);
        
        if (!res.ok) throw new Error("Error conectando a API");
        
        allProducts = await res.json();
        
        // Si hay éxito:
        generateFilters();
        // IMPORTANTE: Recuerda que cambiamos renderProducts para la paginación
        // Aquí llamamos a la función que inicia el renderizado
        renderProducts(allProducts); 
        
        // Renderizar carrusel si existe la función
        if(typeof renderCarousel === 'function') renderCarousel(allProducts);

        if(badge) {
            badge.className = "flex items-center gap-1 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-black border border-green-200 uppercase tracking-wide";
            badge.innerHTML = `<i data-lucide="wifi" class="w-3 h-3"></i> Online`;
        }
        
        showLoader(false);
    } catch (err) {
        console.error(err);
        showLoader(false);
        if(badge) {
            badge.className = "flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1 rounded-full text-[10px] font-black border border-red-200 uppercase tracking-wide";
            badge.innerHTML = `<i data-lucide="wifi-off" class="w-3 h-3"></i> Offline`;
        }
        
        // Mostrar mensaje de error amigable en la grilla
        const grid = document.getElementById('products-grid');
        grid.innerHTML = `
            <div class="col-span-full text-center py-10">
                <p class="text-gray-400">No se pudo conectar con el servidor.</p>
                <button onclick="fetchTunnelData()" class="mt-4 text-brand-orange font-bold underline">Reintentar</button>
            </div>
        `;
    }
    lucide.createIcons();
}

// --- RENDERIZADO PRODUCTOS ---

// --- VARIABLES GLOBALES DE PAGINACIÓN ---
let currentListForDisplay = []; // Lista filtrada actual (para búsqueda/filtros)
let itemsShown = 0;             // Contador actual
const ITEMS_PER_BATCH = 12;     // Cuántos mostrar por vez

// --- REEMPLAZA TU FUNCIÓN renderProducts POR ESTA ---
function renderProducts(products) {
    // 1. Guardamos la lista completa que recibimos (sea todos, filtrados o búsqueda)
    currentListForDisplay = products;
    
    // 2. Reseteamos el contador
    itemsShown = 0;
    
    // 3. Limpiamos el grid
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    // 4. Manejo de estado vacío
    const emptyState = document.getElementById('empty-state');
    if (!products || products.length === 0) {
        grid.classList.add('hidden');
        if(emptyState) emptyState.classList.remove('hidden');
        document.getElementById('load-more-container').classList.add('hidden'); // Ocultar botón
        return;
    }
    
    grid.classList.remove('hidden');
    if(emptyState) emptyState.classList.add('hidden');

    // 5. LLAMAMOS A LA FUNCIÓN QUE DIBUJA EL PRIMER LOTE
    loadMoreProducts();
}

// --- NUEVA FUNCIÓN PARA EL BOTÓN "CARGAR MÁS" ---
window.loadMoreProducts = () => {
    const grid = document.getElementById('products-grid');
    const btnContainer = document.getElementById('load-more-container');
    
    // Calcular el siguiente lote
    const nextBatch = currentListForDisplay.slice(itemsShown, itemsShown + ITEMS_PER_BATCH);
    
    // Renderizar este lote
    nextBatch.forEach(p => {
        const precio = formatCurrency(p.precio);
        let imgClass = p.orientacion === 'horizontal' 
            ? "h-56 w-full object-cover group-hover:scale-105 transition duration-500" 
            : "h-56 w-full object-contain p-4 group-hover:scale-105 transition duration-500 mix-blend-multiply";
        
        let containerClass = p.orientacion === 'horizontal'
            ? "h-56 w-full overflow-hidden bg-gray-100"
            : "h-56 w-full bg-white flex items-center justify-center";

            const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;

            const placeholderWeb = `<div class="h-56 w-full flex items-center justify-center bg-gray-50">${svgIcon}</div>`;
            
            // Sanitizamos el string para que no rompa el atributo HTML onerror
            const safePlaceholder = placeholderWeb.replace(/"/g, "&quot;");
            
            const imgContent = p.imagen_url 
                ? `<div class="${containerClass}"><img src="${p.imagen_url}" class="${imgClass}" loading="lazy" alt="${p.nombre}" onerror="this.parentElement.outerHTML = '${safePlaceholder}'"></div>`
                : placeholderWeb;

        const card = document.createElement('div');
        // Añadimos 'fade-in' para que los nuevos aparezcan suavemente
        card.className = "bg-white rounded-xl shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden group border border-gray-100 flex flex-col cursor-pointer fade-in relative";
        
        card.onclick = (e) => { if(!e.target.closest('.add-btn-direct')) openModal(p); };

        card.innerHTML = `
            ${imgContent}
            <div class="p-5 flex flex-col flex-grow">
                <div class="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider flex justify-between">
                    <span>${p.linea || 'General'}</span>
                    ${p.cantidad < 5 ? `<span class="text-red-500">¡Últimas ud!</span>` : ''}
                </div>
                <h4 class="font-bold text-gray-900 text-lg leading-tight mb-2 line-clamp-2" title="${p.nombre}">${p.nombre}</h4>
                <div class="mt-auto flex items-center justify-between pt-2">
                    <div>
                        <span class="block text-xl font-black text-gray-900">${precio}</span>
                        <span class="text-xs text-gray-400 font-medium">Disp: ${p.cantidad} ${p.unidad || 'Un'}</span>
                    </div>
                    <button onclick="addToCartById('${p.id}'); event.stopPropagation();" 
                        class="add-btn-direct w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white flex items-center justify-center transition-colors shadow-sm active:scale-95">
                        <i data-lucide="plus" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Actualizar contador
    itemsShown += nextBatch.length;
    
    // Actualizar textos del contador
    document.getElementById('showing-count').innerText = itemsShown;
    document.getElementById('total-count').innerText = currentListForDisplay.length;

    // Decidir si mostramos u ocultamos el botón
    if (itemsShown >= currentListForDisplay.length) {
        btnContainer.classList.add('hidden'); // Ya mostramos todo
    } else {
        btnContainer.classList.remove('hidden'); // Faltan productos
    }

    lucide.createIcons();
};

// --- LOGICA CARRITO Y CHECKOUT ---

window.showCheckoutForm = () => {
    if (cart.length === 0) return alert("El carrito está vacío");
    document.getElementById('cart-view-list').classList.add('hidden');
    document.getElementById('cart-view-checkout').classList.remove('hidden');
    document.getElementById('cart-title').innerText = "Finalizar Pedido";
    document.getElementById('back-to-cart-btn').classList.remove('hidden');
    
    // Forzamos la actualización inicial (para que calcule el total según el select por defecto)
    const currentMethod = document.getElementById('cust-method').value;
    updatePaymentInfo(currentMethod);
};
window.showCartList = () => {
    document.getElementById('cart-view-list').classList.remove('hidden');
    document.getElementById('cart-view-checkout').classList.add('hidden');
    document.getElementById('cart-title').innerText = "Tu Carrito";
    document.getElementById('back-to-cart-btn').classList.add('hidden');
};

// Busca tu función submitOrder existente y reemplázala por esta:

async function submitOrder(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    
    // Feedback visual de carga
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="animate-spin w-5 h-5"></i> Procesando...`;
    lucide.createIcons();

    // 1. Recolectar Datos
    const orderData = {
        nombre: document.getElementById('cust-name').value,
        cedula: document.getElementById('cust-cedula').value,
        telefono: document.getElementById('cust-phone').value,
        email: document.getElementById('cust-email').value,
        
        departamento: document.getElementById('cust-dept').value,
        ciudad: document.getElementById('cust-city').value,
        direccion: document.getElementById('cust-address').value,
        barrio: document.getElementById('cust-barrio').value,
        
        metodo: document.getElementById('cust-method').value,
        // Usamos tu función auxiliar para calcular el total con recargo si aplica
        total: getFinalTotal(), 
        productos: cart
    };

        const url = API_BASE_URL; 

        try {
            // 2. Guardar en Base de Datos (Backend)
            const res = await fetch(`${url}/api/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

        const data = await res.json();

        if (data.success) {
            // ============================================================
            // 3. LÓGICA DE WHATSAPP (NUEVO)
            // ============================================================
            
            // A. Construir lista de productos para el mensaje
            const itemsList = cart.map(i => `▪️ ${i.qty}x ${i.nombre}`).join('\n');
            
            // B. Mensaje personalizado según método de pago
            let actionText = "Quedo atento para coordinar el envío.";
            if (orderData.metodo === 'Transferencia') actionText = "Envíame los datos de Bancolombia/Nequi por favor.";
            if (orderData.metodo === 'MercadoPago') actionText = "Hola, solicito el Link de Pago.";

            // C. Armar el mensaje completo
            const waMessage = 
`Hola T-Shop! 👋 Acabo de hacer el pedido *#${data.orderId}* en la web.

👤 *Cliente:* ${orderData.nombre}
📍 *Ciudad:* ${orderData.ciudad}
💰 *Total:* ${formatCurrency(orderData.total)} (${orderData.metodo})

🛒 *Resumen:*
${itemsList}

${actionText}`;

            // D. Codificar URL (Asegúrate de poner TU número real, código 57 Colombia)
            // El número lo tomé de tu index.html (316 529 4505)
            const storePhone = "573165294505"; 
            const waUrl = `https://wa.me/${storePhone}?text=${encodeURIComponent(waMessage)}`;

            // 4. Confirmación y Redirección
            // Usamos confirm() nativo para que el usuario sepa que va a salir de la página
            if(confirm(`¡Pedido #${data.orderId} Guardado con Éxito! ✅\n\nPresiona ACEPTAR para finalizar tu compra en WhatsApp.`)) {
                window.open(waUrl, '_blank'); // Abre en nueva pestaña
            }

            // 5. Limpieza
            cart = []; 
            saveCart();
            updateCartUI();
            toggleCart(false); 
            showCartList(); 
            e.target.reset(); 

        } else {
            throw new Error(data.error || "Error desconocido");
        }
    } catch (err) {
        alert("Error al enviar pedido: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- FUNCIONES BASE CARRITO ---

window.addToCartById = (id) => {
    const product = allProducts.find(p => String(p.id) === String(id));
    if (!product) return;
    
    const existingItem = cart.find(item => String(item.id) === String(id));
    if (existingItem) existingItem.qty++;
    else cart.push({ ...product, qty: 1 });
    
    saveCart();
    updateCartUI();
    toggleCart(true); 
};

window.changeQty = (id, delta) => {
    const item = cart.find(i => String(i.id) === String(id));
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) window.removeFromCart(id);
    else {
        saveCart();
        updateCartUI();
    }
};

window.removeFromCart = (id) => {
    cart = cart.filter(i => String(i.id) !== String(id));
    saveCart();
    updateCartUI();
};

function saveCart() { localStorage.setItem('tshop_cart', JSON.stringify(cart)); }

function updateCartUI() {
    const container = document.getElementById('cart-items-container');
    const badge = document.getElementById('cart-counter');
    const totalEl = document.getElementById('cart-total');
    const emptyStateCart = document.getElementById('cart-empty-state');
    const btnCheckout = document.getElementById('btn-checkout-init');

    const totalQty = cart.reduce((acc, item) => acc + item.qty, 0);
    badge.innerText = totalQty;
    badge.classList.toggle('hidden', totalQty === 0);

    container.innerHTML = '';
    let totalPrice = 0;

    if (cart.length === 0) {
        emptyStateCart.classList.remove('hidden');
        btnCheckout.classList.add('hidden'); // Ocultar botón pagar si no hay items
    } else {
        emptyStateCart.classList.add('hidden');
        btnCheckout.classList.remove('hidden');
        
        cart.forEach(item => {
            const itemTotal = item.precio * item.qty;
            totalPrice += itemTotal;
            const li = document.createElement('li');
            li.className = "flex py-6 fade-in border-b border-gray-100 last:border-0";
            
            const imgHtml = item.imagen_url 
                ? `<img src="${item.imagen_url}" class="h-20 w-20 flex-none rounded-lg border border-gray-200 object-contain bg-white">`
                : `<div class="h-20 w-20 flex-none rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center"><i data-lucide="package" class="w-8 h-8 text-gray-300"></i></div>`;

            li.innerHTML = `
                ${imgHtml}
                <div class="ml-4 flex flex-1 flex-col justify-between">
                    <div>
                        <div class="flex justify-between text-base font-medium text-gray-900">
                            <h3 class="line-clamp-1 font-bold">${item.nombre}</h3>
                            <p class="ml-4 font-bold text-gray-900">${formatCurrency(itemTotal)}</p>
                        </div>
                        <p class="mt-1 text-xs text-gray-500 uppercase tracking-wide">${item.linea || 'General'}</p>
                    </div>
                    <div class="flex flex-1 items-end justify-between text-sm mt-2">
                        <div class="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                            <button onclick="changeQty('${item.id}', -1)" class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-l-lg text-gray-600 font-bold">-</button>
                            <span class="w-8 text-center text-gray-900 font-medium text-xs">${item.qty}</span>
                            <button onclick="changeQty('${item.id}', 1)" class="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-r-lg text-gray-600 font-bold">+</button>
                        </div>
                        <button type="button" onclick="removeFromCart('${item.id}')" class="font-medium text-red-500 hover:text-red-700 text-xs underline">Eliminar</button>
                    </div>
                </div>
            `;
            container.appendChild(li);
        });
    }
    totalEl.innerText = formatCurrency(totalPrice);
    // Si estamos en vista checkout, actualizamos también ese total
    const displayCheckout = document.getElementById('checkout-total-display');
    if(displayCheckout) displayCheckout.innerText = formatCurrency(totalPrice);
    
    lucide.createIcons();
}

// --- UTILIDADES ---

window.toggleCart = (forceOpen = null) => {
    const sidebar = document.getElementById('cart-sidebar');
    const panel = document.getElementById('cart-panel');
    const isOpen = !sidebar.classList.contains('hidden');
    const shouldOpen = forceOpen !== null ? forceOpen : !isOpen;

    if (shouldOpen) {
        sidebar.classList.remove('hidden');
        setTimeout(() => panel.classList.remove('translate-x-full'), 10);
    } else {
        // Reset a vista lista al cerrar
        setTimeout(showCartList, 500); 
        panel.classList.add('translate-x-full');
        setTimeout(() => sidebar.classList.add('hidden'), 500);
    }
};

window.openModal = (p) => {
    document.getElementById('modal-title').innerText = p.nombre;
    document.getElementById('modal-desc').innerText = p.descripcion || 'Sin descripción';
    document.getElementById('modal-price').innerText = formatCurrency(p.precio);
    document.getElementById('modal-stock').innerText = p.cantidad || 0;
    document.getElementById('modal-unit').innerText = p.unidad || 'UN';
    document.getElementById('modal-category').innerText = p.linea || 'General';

    const placeholderModal = '<i data-lucide="package" class="w-24 h-24 text-gray-300"></i>';
    const container = document.getElementById('modal-img-container');
    container.innerHTML = p.imagen_url 
        ? `<img src="${p.imagen_url}" class="max-h-full max-w-full object-contain" onerror="this.outerHTML = '${placeholderModal.replace(/"/g, "&quot;")}'">` 
        : placeholderModal;

    document.getElementById('modal-add-btn').onclick = () => {
        addToCartById(p.id);
        document.getElementById('product-modal').classList.add('hidden');
    };

    document.getElementById('product-modal').classList.remove('hidden');
    lucide.createIcons();
};

window.closeModal = () => document.getElementById('product-modal').classList.add('hidden');

function generateFilters() {
    const filterContainer = document.getElementById('category-filters');
    // Obtenemos las categorías únicas
    const lineas = ['Todas', ...new Set(allProducts.map(p => p.linea || 'General'))];

    // DEFINICIÓN DE COLORES POR CATEGORÍA
    // Puedes agregar más categorías aquí si tu inventario crece
    const categoryStyles = {
        'Todas': {
            active: 'bg-gray-900 text-white border-gray-900',
            inactive: 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
        },
        'Celulares': {
            active: 'bg-brand-orange text-white border-brand-orange',
            inactive: 'bg-white text-brand-orange border-brand-orange hover:bg-orange-50'
        },
        'Accesorios': { // Cables, Cargadores, etc.
            active: 'bg-brand-red text-white border-brand-red',
            inactive: 'bg-white text-brand-red border-brand-red hover:bg-red-50'
        },
        'Cases': { // Fundas
            active: 'bg-brand-yellow text-gray-900 border-brand-yellow',
            inactive: 'bg-white text-yellow-600 border-brand-yellow hover:bg-yellow-50'
        },
        // Estilo por defecto para categorías nuevas (ej: Tablets, Audio)
        'default': {
            active: 'bg-gray-700 text-white border-gray-700',
            inactive: 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
        }
    };

    // Función auxiliar para obtener las clases según el estado (activo/inactivo)
    const getBtnClasses = (catName, isActive) => {
        // Buscamos si existe el color específico, si no, usamos 'default'
        const style = categoryStyles[catName] || categoryStyles['default'];
        const baseClasses = "filter-btn px-5 py-2 rounded-full text-sm font-bold border transition-all duration-300 transform";
        
        // Efectos extra cuando está activo
        const stateClasses = isActive 
            ? `${style.active} shadow-lg scale-105 ring-2 ring-offset-1 ring-transparent` 
            : `${style.inactive} shadow-sm hover:scale-105`;

        return `${baseClasses} ${stateClasses}`;
    };

    // 1. Renderizamos los botones
    filterContainer.innerHTML = lineas.map(cat => `
        <button 
            onclick="filterBy('${cat}')" 
            data-category="${cat}"
            class="${getBtnClasses(cat, cat === 'Todas')}"> ${cat}
        </button>
    `).join('');
    
    // 2. Definimos la función global filterBy actualizada
    window.filterBy = (catName) => {
        // A. Actualizar visualmente los botones
        document.querySelectorAll('.filter-btn').forEach(btn => {
            const btnCat = btn.getAttribute('data-category');
            const isActive = btnCat === catName;
            
            // Re-calculamos las clases para cada botón según su estado nuevo
            btn.className = getBtnClasses(btnCat, isActive);
        });

        // B. Filtrar los productos (Lógica original)
        if (catName === 'Todas') renderProducts(allProducts);
        else renderProducts(allProducts.filter(p => (p.linea || 'General') === catName));
    };
}

function setMode(mode) {
    currentMode = mode;
    const fbControls = document.getElementById('firebase-controls');
    const tnControls = document.getElementById('tunnel-controls');
    if (mode === 'firebase') {
        fbControls.classList.remove('hidden');
        tnControls.classList.add('hidden');
        renderProducts([]);
    } else {
        fbControls.classList.add('hidden');
        tnControls.classList.remove('hidden');
        renderProducts([]);
    }
}

window.searchProductsFront = (term) => {
    const lowerTerm = term.toLowerCase();
    const filtered = allProducts.filter(p => 
        p.nombre.toLowerCase().includes(lowerTerm) || 
        (p.linea && p.linea.toLowerCase().includes(lowerTerm))
    );
    renderProducts(filtered);
    
    // Si no hay resultados, mostramos el estado vacío
    const emptyState = document.getElementById('empty-state');
    if (filtered.length === 0) {
        document.getElementById('products-grid').classList.add('hidden');
        if(emptyState) emptyState.classList.remove('hidden');
    }
};

function showLoader(show) { 
    document.getElementById('loader').classList.toggle('hidden', !show); 
}

function formatCurrency(val) {
    return Number(val).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

let currentSlide = 0;
let featuredProducts = [];

function renderCarousel(products) {
    // 1. Filtrar solo los destacados
    featuredProducts = products.filter(p => p.destacado);
    const section = document.getElementById('featured-section');
    const track = document.getElementById('carousel-track');
    const dotsContainer = document.getElementById('carousel-dots');

    if (featuredProducts.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    track.innerHTML = '';
    dotsContainer.innerHTML = '';

    featuredProducts.forEach((p, index) => {
        // Slide HTML
        const slide = document.createElement('div');
        slide.className = "w-full flex-shrink-0 flex flex-col md:flex-row items-center justify-center py-12 px-16 md:px-24 gap-4 relative";
        // Fondo con gradiente sutil
        slide.innerHTML = `
            <div class="absolute inset-0 bg-gradient-to-r from-gray-900 to-gray-800 z-0"></div>
            
            <div class="z-10 md:w-1/2 text-left space-y-4">
                <span class="inline-block px-3 py-1 bg-gradient-to-r from-brand-red to-brand-orange text-white text-xs font-bold rounded-full uppercase tracking-wider shadow-lg shadow-orange-500/30">
                    Producto Destacado
                </span>
                <h2 class="text-3xl md:text-5xl font-black text-white leading-tight">${p.nombre}</h2>
                <p class="text-gray-400 text-lg font-medium">$${Number(p.precio).toLocaleString()}</p>
                <button onclick="addToCartById('${p.id}')" class="mt-4 bg-white text-gray-900 hover:bg-brand-yellow hover:text-black font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2">
                    <i data-lucide="shopping-cart" class="w-4 h-4"></i> Comprar Ahora
                </button>
            </div>
            
            <div class="z-10 md:w-1/2 flex justify-center perspective-1000">
                <img src="${p.imagen_url || 'img/placeholder.png'}" class="h-64 md:h-80 object-contain drop-shadow-[0_20px_50px_rgba(255,152,0,0.3)] transform hover:scale-110 transition duration-500">
            </div>
        `;
        track.appendChild(slide);

        // Dot HTML
        const dot = document.createElement('button');
        dot.className = `w-3 h-3 rounded-full transition-all ${index === 0 ? 'bg-brand-orange w-8' : 'bg-gray-600'}`;
        dot.onclick = () => goToSlide(index);
        dotsContainer.appendChild(dot);
    });

    // Iniciar Auto-Play
    setInterval(() => moveCarousel(1), 5000); // Cambia cada 5 seg
}

window.moveCarousel = (direction) => {
    const total = featuredProducts.length;
    if (total === 0) return;
    
    currentSlide = (currentSlide + direction + total) % total;
    updateCarousel();
};

window.goToSlide = (index) => {
    currentSlide = index;
    updateCarousel();
};

function updateCarousel() {
    const track = document.getElementById('carousel-track');
    const dots = document.getElementById('carousel-dots').children;
    
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    
    Array.from(dots).forEach((dot, idx) => {
        dot.className = `w-3 h-3 rounded-full transition-all ${idx === currentSlide ? 'bg-brand-orange w-8' : 'bg-gray-600'}`;
    });
}

// Actualiza el mensaje azul según el método seleccionado
window.updatePaymentInfo = (method) => {
    const infoText = document.getElementById('payment-info-text');
    const alertBox = document.getElementById('payment-alert');
    const totalDisplay = document.getElementById('checkout-total-display');
    
    // 1. Actualizar estilos y mensajes
    alertBox.className = "mt-3 border-l-4 p-3 rounded-r-md flex gap-3 transition-all duration-300 bg-blue-50 border-blue-500";
    let iconHTML = `<i data-lucide="info" class="h-4 w-4 text-blue-500 mt-0.5"></i>`;

    if (method === 'Contraentrega') {
        infoText.innerHTML = `<strong>Pago seguro:</strong> Pagas en efectivo al recibir el producto.`;
    } 
    else if (method === 'Transferencia') {
        infoText.innerHTML = `<strong>Bancolombia / Nequi:</strong> Sin costos adicionales. Te enviaremos los datos por WhatsApp.`;
    } 
    else if (method === 'MercadoPago') {
        alertBox.className = "mt-3 border-l-4 p-3 rounded-r-md flex gap-3 transition-all duration-300 bg-sky-50 border-sky-600";
        iconHTML = `<i data-lucide="credit-card" class="h-4 w-4 text-sky-600 mt-0.5"></i>`;
        
        // AQUÍ AGREGAMOS LA INFORMACIÓN DEL AUMENTO
        infoText.innerHTML = `<strong>PSE y Tarjetas:</strong> Generaremos un Link de Pago Seguro de Mercado Pago y Te lo Enviaremos Por Whtasapp. <br><span class="text-red-600 font-bold text-[10px] mt-1 block">⚠️ Aplica comisión del 3.29% por uso de plataforma.</span>`;
    }

    // Actualizar icono
    const iconContainer = alertBox.querySelector('div');
    if(iconContainer) {
        iconContainer.innerHTML = iconHTML;
        lucide.createIcons();
    }

    // 2. ACTUALIZAR EL TOTAL VISUALMENTE
    const newTotal = getFinalTotal();
    totalDisplay.innerText = formatCurrency(newTotal);
    
    // Si hay recargo, podemos poner el texto en rojo o naranja para resaltar
    if (method === 'MercadoPago') {
        totalDisplay.classList.add('text-brand-orange');
        totalDisplay.classList.remove('text-gray-900');
    } else {
        totalDisplay.classList.add('text-gray-900');
        totalDisplay.classList.remove('text-brand-orange');
    }
};

// Función auxiliar para calcular el total con o sin comisión
function getFinalTotal() {
    const rawTotal = cart.reduce((acc, item) => acc + (item.precio * item.qty), 0);
    const method = document.getElementById('cust-method').value;
    
    // Si es MercadoPago, sumamos el 3.29%
    if (method === 'MercadoPago') {
        return rawTotal * 1.0329; // Multiplicar por 1.0329 es igual a sumar 3.29%
    }
    return rawTotal;
}

// Función para abrir/cerrar el modal de contacto
window.toggleContactModal = () => {
    const modal = document.getElementById('modal-contact');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        modal.classList.add('fade-in'); // Usamos tu animación existente
    } else {
        modal.classList.add('hidden');
    }
    // Recargar iconos por si acaso
    lucide.createIcons();
};

window.toggleHowItWorks = () => {
    const modal = document.getElementById('modal-how-it-works');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        modal.classList.add('fade-in'); 
    } else {
        modal.classList.add('hidden');
    }
    lucide.createIcons();
};

// --- FUNCIONES DEL MODAL DE POLÍTICAS ---

window.openPolicy = (type) => {
    // 1. Ocultar todos los contenidos primero
    document.querySelectorAll('.policy-content').forEach(el => el.classList.add('hidden'));
    
    // 2. Definir Título y Mostrar contenido específico
    const modal = document.getElementById('modal-policies');
    const title = document.getElementById('policy-title');
    
    if (type === 'warranty') {
        title.innerText = "🛡️ Política de Garantía";
        document.getElementById('content-warranty').classList.remove('hidden');
    } else if (type === 'shipping') {
        title.innerText = "📦 Envíos y Devoluciones";
        document.getElementById('content-shipping').classList.remove('hidden');
    } else if (type === 'privacy') {
        title.innerText = "🔒 Aviso de Privacidad";
        document.getElementById('content-privacy').classList.remove('hidden');
    } else if (type === 'faq') {
        title.innerText = "❓ Preguntas Frecuentes";
        document.getElementById('content-faq').classList.remove('hidden');
    }

    // 3. Mostrar el modal con animación
    modal.classList.remove('hidden');
    modal.classList.add('fade-in');
};

window.closePolicies = () => {
    document.getElementById('modal-policies').classList.add('hidden');
};


lucide.createIcons();