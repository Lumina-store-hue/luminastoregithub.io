// ===== APP PRINCIPAL =====
console.log('🚀 app.js cargado');

// === CONFIGURACIÓN ===
const WHATSAPP_NUMBER = '57XXXXXXXXX'; // Cambia por tu número

// === FUNCIONES AUXILIARES ===
function getPlaceholderImage(nombre) {
    return `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22300%22 viewBox=%220 0 300 300%22%3E%3Crect width=%22300%22 height=%22300%22 fill=%22%23f0e0e5%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 font-family=%22Arial%2C sans-serif%22 font-size=%2218%22 fill=%22%23999%22 text-anchor=%22middle%22 dominant-baseline=%22central%22%3E${encodeURIComponent(nombre)}%3C/text%3E%3C/svg%3E`;
}

function formatPrice(priceStr) {
    return parseInt(priceStr.replace(/[^0-9]/g, ''));
}

function getColorHex(colorName) {
    const map = {
        'Rosado': '#FFB6C1',
        'Blanco': '#FFFFFF',
        'Negro': '#222222',
        'Azul': '#3A7BD5',
        'Gris': '#808080',
        'Beige': '#F5F5DC',
        'Verde': '#32CD32',
        'Rojo': '#DC143C',
        'Azul marino': '#1B2A4A',
        'Blanco/Negro': 'linear-gradient(45deg, #FFFFFF 50%, #222222 50%)',
        'Rojo/Blanco': 'linear-gradient(45deg, #DC143C 50%, #FFFFFF 50%)',
        'Rojo/Cuadros': 'repeating-linear-gradient(45deg, #DC143C, #DC143C 10px, #FFFFFF 10px, #FFFFFF 20px)',
        'Rojo/Verde': 'linear-gradient(45deg, #DC143C 50%, #228B22 50%)'
    };
    return map[colorName] || colorName.toLowerCase();
}

// === ESTADO GLOBAL ===
let productos = [];
let currentProduct = null;
let selectedOptions = { talla: '', color: '' };
let favorites = JSON.parse(localStorage.getItem('lumina_favs') || '[]');
let cart = JSON.parse(localStorage.getItem('lumina_cart') || '[]');
let reviews = JSON.parse(localStorage.getItem('lumina_reviews') || '{}');
let currentPage = {};
let itemsPerPage = 6;
let activeFilters = {};
let searchTerms = {};
let editingId = null;

// === DOM HELPERS ===
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// === GESTIÓN DE PRODUCTOS ===
async function loadProducts() {
    const stored = localStorage.getItem('lumina_productos');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length) {
                productos = parsed;
                console.log('📦 Productos cargados desde localStorage:', productos.length);
                return;
            }
        } catch (e) { /* ignorar */ }
    }
    try {
        const respuesta = await fetch('productos.json');
        if (!respuesta.ok) throw new Error('Archivo no encontrado');
        const data = await respuesta.json();
        if (Array.isArray(data) && data.length) {
            productos = data;
            localStorage.setItem('lumina_productos', JSON.stringify(productos));
            console.log('✅ Productos cargados desde productos.json:', productos.length);
            return;
        }
    } catch (error) {
        console.warn('⚠️ No se pudo cargar productos.json, usando respaldo:', error);
    }
    if (typeof productosDefault !== 'undefined' && Array.isArray(productosDefault)) {
        productos = JSON.parse(JSON.stringify(productosDefault));
        localStorage.setItem('lumina_productos', JSON.stringify(productos));
        console.log('📦 Productos cargados desde productosDefault:', productos.length);
    } else {
        console.error('❌ No se encontraron productos.');
        productos = [];
    }
}

function saveProducts() {
    localStorage.setItem('lumina_productos', JSON.stringify(productos));
}

function getNextId() {
    let max = 0;
    productos.forEach(p => { if (p.id > max) max = p.id; });
    return max + 1;
}

// === RESEÑAS ===
function getProductReviews(productId) {
    return reviews[productId] || [];
}

function addReview(productId, nombre, calificacion, comentario) {
    if (!reviews[productId]) reviews[productId] = [];
    reviews[productId].push({
        nombre: nombre || 'Anónimo',
        calificacion: parseInt(calificacion) || 5,
        comentario: comentario || '',
        fecha: new Date().toLocaleDateString('es-CO')
    });
    localStorage.setItem('lumina_reviews', JSON.stringify(reviews));
    if (currentProduct && currentProduct.id === productId) {
        renderReviewsInModal(productId);
    }
    showToast('⭐ ¡Gracias por tu valoración!');
}

function renderReviewsInModal(productId) {
    const container = document.getElementById('reviewsContainer');
    if (!container) return;
    const productReviews = getProductReviews(productId);
    if (productReviews.length === 0) {
        container.innerHTML = '<p class="empty-msg">No hay reseñas aún. ¡Sé el primero en opinar!</p>';
        return;
    }
    container.innerHTML = productReviews.map(r => `
        <div class="review-item">
            <div class="stars">${'★'.repeat(r.calificacion)}${'☆'.repeat(5 - r.calificacion)}</div>
            <span class="review-author">${r.nombre}</span>
            <span class="review-date">${r.fecha}</span>
            <div class="review-text">${r.comentario}</div>
        </div>
    `).join('');
}

function renderReviewForm(productId) {
    const container = document.getElementById('reviewFormContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="review-form">
            <h4>Deja tu opinión</h4>
            <input type="text" id="reviewName" placeholder="Tu nombre (opcional)" style="max-width:200px;">
            <select id="reviewStars">
                <option value="5">⭐⭐⭐⭐⭐ (Excelente)</option>
                <option value="4">⭐⭐⭐⭐ (Bueno)</option>
                <option value="3">⭐⭐⭐ (Regular)</option>
                <option value="2">⭐⭐ (Malo)</option>
                <option value="1">⭐ (Pésimo)</option>
            </select>
            <textarea id="reviewComment" placeholder="Escribe tu opinión aquí..." rows="2"></textarea>
            <button class="btn btn-primary" id="submitReviewBtn">Enviar reseña</button>
        </div>
    `;
    document.getElementById('submitReviewBtn').addEventListener('click', function() {
        const nombre = document.getElementById('reviewName').value.trim() || 'Anónimo';
        const calificacion = document.getElementById('reviewStars').value;
        const comentario = document.getElementById('reviewComment').value.trim();
        if (!comentario) {
            showToast('⚠️ Por favor escribe un comentario.');
            return;
        }
        addReview(productId, nombre, calificacion, comentario);
        document.getElementById('reviewFormContainer').innerHTML = '<p>✅ ¡Gracias por tu reseña!</p>';
    });
}

// === CARRITO ===
function addToCart(productId, talla, color, cantidad = 1) {
    const product = productos.find(p => p.id === productId);
    if (!product) return false;
    if (product.stockPorTalla && product.stockPorTalla[talla] < cantidad) {
        showToast('⚠️ No hay suficiente stock para esta talla');
        return false;
    }
    const existing = cart.find(item => item.id === productId && item.talla === talla && item.color === color);
    if (existing) {
        existing.cantidad += cantidad;
    } else {
        cart.push({
            id: productId,
            nombre: product.nombre,
            precio: product.precio,
            talla: talla,
            color: color,
            cantidad: cantidad,
            imagen: product.imagenes && product.imagenes[0] ? product.imagenes[0] : getPlaceholderImage(product.nombre)
        });
    }
    localStorage.setItem('lumina_cart', JSON.stringify(cart));
    updateCartBadge();
    showToast(`✅ Agregado al carrito: ${product.nombre} (${talla})`);
    return true;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('lumina_cart', JSON.stringify(cart));
    updateCartBadge();
    renderCartModal();
}

function updateCartQuantity(index, newQty) {
    if (newQty < 1) { removeFromCart(index); return; }
    const item = cart[index];
    const product = productos.find(p => p.id === item.id);
    if (product && product.stockPorTalla && product.stockPorTalla[item.talla] < newQty) {
        showToast('⚠️ No hay suficiente stock');
        return;
    }
    cart[index].cantidad = newQty;
    localStorage.setItem('lumina_cart', JSON.stringify(cart));
    updateCartBadge();
    renderCartModal();
}

function clearCart() {
    cart = [];
    localStorage.setItem('lumina_cart', JSON.stringify(cart));
    updateCartBadge();
    renderCartModal();
    showToast('🗑️ Carrito vaciado');
}

function updateCartBadge() {
    const badge = $('#cartCount');
    if (badge) {
        const total = cart.reduce((sum, item) => sum + item.cantidad, 0);
        badge.textContent = total;
    }
}

function getCartTotal() {
    return cart.reduce((sum, item) => {
        const price = formatPrice(item.precio);
        return sum + (price * item.cantidad);
    }, 0);
}

function renderCartModal() {
    const container = $('#cartItems');
    if (!container) return;
    container.innerHTML = '';
    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-msg">Tu carrito está vacío.</p>';
        $('#cartTotal').textContent = '$0';
        return;
    }
    cart.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        const imgSrc = item.imagen || getPlaceholderImage(item.nombre);
        div.innerHTML = `
            <img src="${imgSrc}" alt="${item.nombre}" onerror="this.src='${getPlaceholderImage(item.nombre)}'">
            <div class="info">
                <div class="name">${item.nombre}</div>
                <div class="details">Talla: ${item.talla} | Color: ${item.color || 'N/A'}</div>
                <div class="details">${item.precio}</div>
            </div>
            <div class="qty">
                <button data-index="${index}" data-action="decrement">−</button>
                <span>${item.cantidad}</span>
                <button data-index="${index}" data-action="increment">+</button>
            </div>
            <button class="remove-item" data-index="${index}">✕</button>
        `;
        container.appendChild(div);
    });
    container.querySelectorAll('[data-action="decrement"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            const item = cart[idx];
            updateCartQuantity(idx, item.cantidad - 1);
        });
    });
    container.querySelectorAll('[data-action="increment"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            const item = cart[idx];
            updateCartQuantity(idx, item.cantidad + 1);
        });
    });
    container.querySelectorAll('.remove-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            removeFromCart(idx);
        });
    });
    const total = getCartTotal();
    $('#cartTotal').textContent = '$' + total.toLocaleString('es-CO');
}

function sendCartByWhatsApp() {
    if (cart.length === 0) {
        showToast('⚠️ El carrito está vacío');
        return;
    }
    let msg = 'Hola, quiero realizar el siguiente pedido:\n\n';
    cart.forEach((item, i) => {
        msg += `${i+1}. ${item.nombre} - Talla: ${item.talla}`;
        if (item.color) msg += ` - Color: ${item.color}`;
        msg += ` - Cantidad: ${item.cantidad} - ${item.precio}\n`;
    });
    const total = getCartTotal();
    msg += `\nTotal: $${total.toLocaleString('es-CO')}`;
    msg += '\n\n¡Gracias!';
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    clearCart();
}

// === FAVORITOS ===
function toggleFavorite(productId) {
    const idx = favorites.indexOf(productId);
    if (idx > -1) favorites.splice(idx, 1);
    else favorites.push(productId);
    localStorage.setItem('lumina_favs', JSON.stringify(favorites));
    renderAllSections();
    updateFavBadge();
}

function updateFavBadge() {
    const badge = $('#favCount');
    if (badge) badge.textContent = favorites.length;
}

function openFavoritesModal() {
    const modal = $('#favoritesModal');
    const list = $('#favoritesList');
    const favProducts = productos.filter(p => favorites.includes(p.id));
    list.innerHTML = '';
    if (favProducts.length === 0) {
        list.innerHTML = '<p class="empty-msg">No tienes productos favoritos aún.</p>';
    } else {
        favProducts.forEach(prod => {
            const imgSrc = prod.imagenes && prod.imagenes[0] ? prod.imagenes[0] : getPlaceholderImage(prod.nombre);
            const item = document.createElement('div');
            item.className = 'fav-item';
            item.innerHTML = `
                <img src="${imgSrc}" alt="${prod.nombre}" onerror="this.src='${getPlaceholderImage(prod.nombre)}'">
                <div class="info">
                    <strong>${prod.nombre}</strong>
                    <span>${prod.precio}</span>
                </div>
                <button class="remove-fav" data-id="${prod.id}">✕</button>
            `;
            item.querySelector('.remove-fav').addEventListener('click', () => {
                toggleFavorite(prod.id);
                openFavoritesModal();
            });
            list.appendChild(item);
        });
    }
    modal.classList.add('open');
}

// === RENDERIZADO ===
function createProductCard(product) {
    const isFav = favorites.includes(product.id);
    const card = document.createElement('div');
    card.className = 'product-card';
    
    const imgSrc = product.imagenes && product.imagenes[0] ? product.imagenes[0] : getPlaceholderImage(product.nombre);
    const colorDots = product.colores ? product.colores.map(c => `<span class="color-dot" style="background:${getColorHex(c)}" title="${c}"></span>`).join('') : '';
    const productReviews = getProductReviews(product.id);
    const avgRating = productReviews.length > 0 ? (productReviews.reduce((sum, r) => sum + r.calificacion, 0) / productReviews.length) : 0;
    const starsHTML = avgRating > 0 ? `<span style="color:#f5b342;font-size:0.8rem;">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5 - Math.round(avgRating))}</span> <span style="font-size:0.7rem;color:var(--color-text-light);">(${productReviews.length})</span>` : '';
    
    let badges = '';
    if (product.nuevo) badges += `<span class="badge badge-nuevo">Nuevo</span>`;
    if (product.destacado) badges += `<span class="badge badge-destacado">Destacado</span>`;
    if (product.agotado || (product.stockPorTalla && Object.values(product.stockPorTalla).every(s => s === 0))) {
        badges += `<span class="badge badge-agotado">Agotado</span>`;
    } else {
        const totalStock = Object.values(product.stockPorTalla || {}).reduce((a, b) => a + b, 0);
        if (totalStock < 3) badges += `<span class="badge badge-stock-bajo">¡Últimas unidades!</span>`;
    }
    
    card.innerHTML = `
        <div class="image">
            <img src="${imgSrc}" alt="${product.nombre}" loading="lazy" onerror="this.src='${getPlaceholderImage(product.nombre)}'">
        </div>
        <h3>${product.nombre}</h3>
        <div class="price">${product.precio}</div>
        <div class="categoria">${product.categoria} ${starsHTML}</div>
        ${badges ? `<div class="badges">${badges}</div>` : ''}
        ${colorDots ? `<div class="colors">${colorDots}</div>` : ''}
        <div class="actions">
            <button class="btn-detail" data-id="${product.id}">Ver Detalles</button>
            <button class="btn-cart" data-id="${product.id}">🛒 Agregar</button>
            <button class="btn-fav ${isFav ? 'active' : ''}" data-id="${product.id}">${isFav ? '❤️' : '♡'}</button>
        </div>
    `;
    
    card.querySelector('.btn-detail').addEventListener('click', () => openProductModal(product));
    card.querySelector('.btn-cart').addEventListener('click', (e) => {
        e.stopPropagation();
        openProductModal(product, true);
    });
    card.querySelector('.btn-fav').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(product.id);
    });
    
    return card;
}

function renderProducts(productsList, containerId, paginationId, page = 1) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (productsList.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:30px;color:var(--color-text-light);">No hay productos que coincidan con los filtros.</p>';
        const pagContainer = document.getElementById(paginationId);
        if (pagContainer) pagContainer.innerHTML = '';
        return;
    }
    const totalPages = Math.ceil(productsList.length / itemsPerPage);
    const start = (page - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, productsList.length);
    const pageItems = productsList.slice(start, end);
    pageItems.forEach(p => container.appendChild(createProductCard(p)));
    const pagContainer = document.getElementById(paginationId);
    if (pagContainer) {
        pagContainer.innerHTML = '';
        if (totalPages > 1) {
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = i === page ? 'active' : '';
                btn.dataset.page = i;
                btn.addEventListener('click', () => {
                    const category = containerId.replace('Grid', '');
                    const catMap = { 'inicioGrid': 'inicio', 'mujerGrid': 'mujer', 'hombreGrid': 'hombre', 'ninosGrid': 'ninos', 'parejasGrid': 'parejas' };
                    const cat = catMap[containerId] || 'inicio';
                    currentPage[cat] = i;
                    applyFiltersAndRender(cat);
                });
                pagContainer.appendChild(btn);
            }
        }
    }
}

// === FILTROS ===
function getFilteredProducts(category) {
    let products = productos.filter(p => p.categoria === category);
    const filters = activeFilters[category] || {};
    if (filters.talla && filters.talla !== 'todas') {
        products = products.filter(p => p.tallas && p.tallas.includes(filters.talla));
    }
    if (filters.color && filters.color !== 'todos') {
        products = products.filter(p => p.colores && p.colores.some(c => c.toLowerCase().includes(filters.color.toLowerCase())));
    }
    if (filters.precio && filters.precio !== 'todos') {
        const [min, max] = filters.precio.split('-').map(Number);
        products = products.filter(p => {
            const price = formatPrice(p.precio);
            return price >= min && price <= max;
        });
    }
    if (filters.orden === 'precio-asc') {
        products.sort((a, b) => formatPrice(a.precio) - formatPrice(b.precio));
    } else if (filters.orden === 'precio-desc') {
        products.sort((a, b) => formatPrice(b.precio) - formatPrice(a.precio));
    } else if (filters.orden === 'nuevo') {
        products.sort((a, b) => (b.nuevo ? 1 : 0) - (a.nuevo ? 1 : 0));
    }
    if (searchTerms[category]) {
        const term = searchTerms[category].toLowerCase();
        products = products.filter(p => p.nombre.toLowerCase().includes(term));
    }
    return products;
}

function applyFiltersAndRender(category) {
    const filtered = getFilteredProducts(category);
    const page = currentPage[category] || 1;
    const gridId = category + 'Grid';
    const pagId = 'pagination-' + category;
    renderProducts(filtered, gridId, pagId, page);
}

function renderAllSections() {
    const inicioProducts = productos.filter(p => p.destacado || p.nuevo);
    renderProducts(inicioProducts, 'inicioGrid', null, 1);
    ['mujer', 'hombre', 'ninos', 'parejas'].forEach(cat => applyFiltersAndRender(cat));
    updateFavBadge();
    updateCartBadge();
}

// === NAVEGACIÓN ===
function navigateTo(sectionId) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${sectionId}`);
    if (target) {
        target.classList.add('active');
        if (['mujer', 'hombre', 'ninos', 'parejas'].includes(sectionId)) {
            applyFiltersAndRender(sectionId);
        }
    }
    $$('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });
    const nav = document.getElementById('nav');
    const toggle = document.getElementById('navToggle');
    if (nav && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleHashChange() {
    const hash = window.location.hash.slice(1) || 'inicio';
    navigateTo(hash);
}

// === MODAL DE PRODUCTO ===
function openProductModal(product, modoCarrito = false) {
    currentProduct = product;
    selectedOptions = { talla: '', color: '' };
    const overlay = $('#productModal');
    const content = $('#modalContent');
    
    const imgSrc = product.imagenes && product.imagenes[0] ? product.imagenes[0] : getPlaceholderImage(product.nombre);
    const tallasOptions = product.tallas ? product.tallas.map(t => `<option value="${t}">${t}</option>`).join('') : '';
    const coloresOptions = product.colores ? product.colores.map(c => `<option value="${c}">${c}</option>`).join('') : '';
    
    let stockHTML = '';
    if (product.stockPorTalla) {
        stockHTML = '<div class="stock-tallas">';
        product.tallas.forEach(t => {
            const stock = product.stockPorTalla[t] || 0;
            const disponible = stock > 0;
            stockHTML += `
                <div class="stock-talla-item">
                    <span class="talla">${t}</span>
                    <span class="${disponible ? 'disponible' : 'agotado'}">${disponible ? '✅ ' + stock : '❌ Agotado'}</span>
                </div>
            `;
        });
        stockHTML += '</div>';
    }
    
    const productReviews = getProductReviews(product.id);
    const avgRating = productReviews.length > 0 ? (productReviews.reduce((sum, r) => sum + r.calificacion, 0) / productReviews.length) : 0;
    const starsDisplay = productReviews.length > 0 ? `<span style="color:#f5b342;font-size:1.1rem;">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5 - Math.round(avgRating))}</span> <span style="font-size:0.85rem;color:var(--color-text-light);">(${productReviews.length} reseñas)</span>` : '';
    
    let relacionadosHTML = '';
    const relacionados = productos.filter(p => p.categoria === product.categoria && p.id !== product.id).slice(0, 4);
    if (relacionados.length > 0) {
        relacionadosHTML = `
            <div class="related-products">
                <h4>También te puede interesar</h4>
                <div class="related-grid">
                    ${relacionados.map(p => `
                        <div class="related-card" data-id="${p.id}">
                            <img src="${p.imagenes && p.imagenes[0] ? p.imagenes[0] : getPlaceholderImage(p.nombre)}" alt="${p.nombre}" onerror="this.src='${getPlaceholderImage(p.nombre)}'">
                            <div class="name">${p.nombre}</div>
                            <div class="price">${p.precio}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    const botonTexto = modoCarrito ? '🛒 Agregar al carrito' : '📱 Comprar por WhatsApp';
    const botonId = modoCarrito ? 'modalAddToCart' : 'modalWhatsapp';
    
    content.innerHTML = `
        <button class="close" id="modalClose">&times;</button>
        <div class="modal-image">
            <img src="${imgSrc}" alt="${product.nombre}" onerror="this.src='${getPlaceholderImage(product.nombre)}'">
        </div>
        <div class="modal-title">${product.nombre}</div>
        <div class="modal-price">${product.precio}</div>
        <div class="modal-desc">${product.descripcion || 'Sin descripción disponible.'}</div>
        ${starsDisplay}
        ${product.tallas && product.tallas.length ? `
        <div class="modal-options">
            <div>
                <label>Talla</label>
                <select id="modalTalla">
                    <option value="">Seleccionar</option>
                    ${tallasOptions}
                </select>
            </div>
        </div>` : ''}
        ${product.colores && product.colores.length ? `
        <div class="modal-options">
            <div>
                <label>Color</label>
                <select id="modalColor">
                    <option value="">Seleccionar</option>
                    ${coloresOptions}
                </select>
            </div>
        </div>` : ''}
        ${stockHTML}
        ${product.agotado || (product.stockPorTalla && Object.values(product.stockPorTalla).every(s => s === 0)) ? `
            <button class="btn btn-outline" disabled style="width:100%;">❌ Producto agotado</button>
        ` : `
            <button class="btn-whatsapp" id="${botonId}">${botonTexto}</button>
        `}
        <div class="reviews-section">
            <h4>⭐ Reseñas y valoraciones</h4>
            <div id="reviewsContainer"></div>
            <div id="reviewFormContainer"></div>
        </div>
        ${relacionadosHTML}
    `;
    
    overlay.classList.add('open');
    
    renderReviewsInModal(product.id);
    renderReviewForm(product.id);
    
    if (modoCarrito) {
        const btn = document.getElementById('modalAddToCart');
        if (btn) {
            btn.addEventListener('click', function() {
                const talla = document.getElementById('modalTalla') ? document.getElementById('modalTalla').value : '';
                const color = document.getElementById('modalColor') ? document.getElementById('modalColor').value : '';
                if (!talla) { showToast('⚠️ Selecciona una talla'); return; }
                if (product.stockPorTalla && product.stockPorTalla[talla] < 1) {
                    showToast('⚠️ No hay stock disponible para esta talla');
                    return;
                }
                addToCart(product.id, talla, color, 1);
                closeModal('productModal');
            });
        }
    } else {
        const btn = document.getElementById('modalWhatsapp');
        if (btn) {
            btn.addEventListener('click', function() {
                const talla = document.getElementById('modalTalla') ? document.getElementById('modalTalla').value : '';
                const color = document.getElementById('modalColor') ? document.getElementById('modalColor').value : '';
                if (!talla) { showToast('⚠️ Selecciona una talla'); return; }
                let msg = product.whatsapp || `Hola, quiero el producto: ${product.nombre}`;
                if (talla || color) {
                    msg += '. Detalles:';
                    if (talla) msg += ` Talla: ${talla}`;
                    if (color) msg += ` Color: ${color}`;
                }
                window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');
            });
        }
    }
    
    content.querySelectorAll('.related-card').forEach(card => {
        card.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            const p = productos.find(prod => prod.id === id);
            if (p) {
                closeModal('productModal');
                setTimeout(() => openProductModal(p, modoCarrito), 300);
            }
        });
    });
    
    document.getElementById('modalClose').addEventListener('click', () => closeModal('productModal'));
    overlay.addEventListener('click', function(e) {
        if (e.target === this) closeModal('productModal');
    });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
}

// === PANEL ADMIN ===
function openAdminPanel() {
    const panel = $('#adminPanel');
    if (panel) {
        panel.classList.add('open');
        renderAdminProductList();
    }
}

function closeAdminPanel() {
    const panel = $('#adminPanel');
    if (panel) panel.classList.remove('open');
}

function renderAdminProductList() {
    const list = $('#adminProductList');
    if (!list) return;
    list.innerHTML = '';
    productos.forEach(p => {
        const item = document.createElement('div');
        item.className = 'admin-product-item';
        const stockStr = p.stockPorTalla ? Object.entries(p.stockPorTalla).map(([t, s]) => `${t}:${s}`).join(' ') : 'Sin stock';
        item.innerHTML = `
            <div class="info">
                <span class="name">${p.nombre}</span>
                <span class="price">${p.precio}</span>
                <span class="cat">${p.categoria} | Stock: ${stockStr}</span>
            </div>
            <div class="actions">
                <button class="edit-btn" data-id="${p.id}">✏️ Editar</button>
                <button class="delete-btn" data-id="${p.id}">🗑️ Eliminar</button>
            </div>
        `;
        item.querySelector('.edit-btn').addEventListener('click', () => editProduct(p.id));
        item.querySelector('.delete-btn').addEventListener('click', () => deleteProduct(p.id));
        list.appendChild(item);
    });
}

function resetForm() {
    $('#editId').value = '';
    $('#adminNombre').value = '';
    $('#adminPrecio').value = '';
    $('#adminCategoria').value = 'mujer';
    $('#adminDescripcion').value = '';
    $('#adminImagenes').value = '';
    $('#adminStockPorTalla').value = '';
    $('#adminColores').value = '';
    $('#adminNuevo').checked = false;
    $('#adminDestacado').checked = false;
    $('#adminAgotado').checked = false;
    $('#formTitle').textContent = 'Agregar Producto';
    editingId = null;
}

function editProduct(id) {
    const p = productos.find(prod => prod.id === id);
    if (!p) return;
    editingId = id;
    $('#editId').value = id;
    $('#adminNombre').value = p.nombre || '';
    $('#adminPrecio').value = p.precio || '';
    $('#adminCategoria').value = p.categoria || 'mujer';
    $('#adminDescripcion').value = p.descripcion || '';
    $('#adminImagenes').value = (p.imagenes || []).join(', ');
    const stockStr = p.stockPorTalla ? Object.entries(p.stockPorTalla).map(([t, s]) => `${t}:${s}`).join(', ') : '';
    $('#adminStockPorTalla').value = stockStr;
    $('#adminColores').value = (p.colores || []).join(', ');
    $('#adminNuevo').checked = !!p.nuevo;
    $('#adminDestacado').checked = !!p.destacado;
    $('#adminAgotado').checked = !!p.agotado;
    $('#formTitle').textContent = 'Editar Producto';
    document.querySelector('.admin-form').scrollIntoView({ behavior: 'smooth' });
}

function saveProductFromForm() {
    const nombre = $('#adminNombre').value.trim();
    const precio = $('#adminPrecio').value.trim();
    const categoria = $('#adminCategoria').value;
    const descripcion = $('#adminDescripcion').value.trim();
    const imagenes = $('#adminImagenes').value.split(',').map(s => s.trim()).filter(Boolean);
    const stockPorTalla = {};
    const stockStr = $('#adminStockPorTalla').value.trim();
    if (stockStr) {
        stockStr.split(',').forEach(part => {
            const [talla, stock] = part.trim().split(':');
            if (talla && stock) stockPorTalla[talla.trim()] = parseInt(stock.trim()) || 0;
        });
    }
    const colores = $('#adminColores').value.split(',').map(s => s.trim()).filter(Boolean);
    const nuevo = $('#adminNuevo').checked;
    const destacado = $('#adminDestacado').checked;
    const agotado = $('#adminAgotado').checked;
    
    if (!nombre || !precio) {
        showToast('⚠️ Nombre y precio son obligatorios');
        return;
    }
    
    const tallas = Object.keys(stockPorTalla);
    const editId = parseInt($('#editId').value);
    if (editId) {
        const index = productos.findIndex(p => p.id === editId);
        if (index !== -1) {
            productos[index] = {
                ...productos[index],
                nombre,
                precio,
                categoria,
                descripcion,
                imagenes: imagenes.length ? imagenes : [getPlaceholderImage(nombre)],
                tallas,
                stockPorTalla,
                colores,
                nuevo,
                destacado,
                agotado,
                whatsapp: `Hola, quiero el producto: ${nombre}`
            };
            showToast('✅ Producto actualizado');
        }
    } else {
        const newProduct = {
            id: getNextId(),
            nombre,
            precio,
            categoria,
            descripcion,
            imagenes: imagenes.length ? imagenes : [getPlaceholderImage(nombre)],
            tallas,
            stockPorTalla,
            colores,
            nuevo,
            destacado,
            agotado,
            whatsapp: `Hola, quiero el producto: ${nombre}`
        };
        productos.push(newProduct);
        showToast('✅ Producto agregado');
    }
    
    saveProducts();
    resetForm();
    renderAdminProductList();
    renderAllSections();
    if (['mujer', 'hombre', 'ninos', 'parejas'].includes(categoria)) {
        applyFiltersAndRender(categoria);
    }
}

function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    productos = productos.filter(p => p.id !== id);
    saveProducts();
    renderAdminProductList();
    renderAllSections();
    showToast('🗑️ Producto eliminado');
}

function exportProductsJSON() {
    const data = JSON.stringify(productos, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos_lumina.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Productos exportados');
}

function importProductsJSON(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported) && imported.length) {
                imported.forEach(p => {
                    if (!p.stockPorTalla && p.tallas) {
                        p.stockPorTalla = {};
                        p.tallas.forEach(t => p.stockPorTalla[t] = p.stock || 0);
                    }
                    if (!p.imagenes || !p.imagenes.length) {
                        p.imagenes = [getPlaceholderImage(p.nombre)];
                    }
                });
                productos = imported;
                saveProducts();
                renderAdminProductList();
                renderAllSections();
                showToast(`📤 ${imported.length} productos importados`);
            } else {
                showToast('⚠️ Archivo inválido');
            }
        } catch (err) {
            showToast('⚠️ Error al leer el archivo');
        }
    };
    reader.readAsText(file);
}

function resetToDefaultProducts() {
    if (!confirm('¿Restaurar productos por defecto? Se perderán los cambios actuales.')) return;
    if (typeof productosDefault !== 'undefined') {
        productos = JSON.parse(JSON.stringify(productosDefault));
        saveProducts();
        renderAdminProductList();
        renderAllSections();
        showToast('🔄 Productos restaurados');
    } else {
        showToast('⚠️ No hay productos por defecto disponibles');
    }
}

// === TOAST ===
function showToast(msg) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM listo');
    
    await loadProducts();
    console.log('📦 Productos disponibles:', productos.length);
    
    setTimeout(() => {
        const loader = $('#loader');
        if (loader) loader.classList.add('hidden');
    }, 500);
    
    const navToggle = $('#navToggle');
    const nav = $('#nav');
    if (navToggle && nav) {
        navToggle.addEventListener('click', function() {
            const isOpen = nav.classList.toggle('open');
            this.classList.toggle('open');
            this.setAttribute('aria-expanded', isOpen);
        });
    }
    
    $$('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            if (section) window.location.hash = section;
        });
    });
    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash) window.location.hash = 'inicio';
    else handleHashChange();
    
    $$('.filter-select').forEach(select => {
        select.addEventListener('change', function() {
            const container = this.closest('.filters-container');
            const category = container ? container.dataset.category : 'inicio';
            const filterType = this.dataset.filter;
            const value = this.value;
            if (!activeFilters[category]) activeFilters[category] = {};
            activeFilters[category][filterType] = value;
            currentPage[category] = 1;
            applyFiltersAndRender(category);
        });
    });
    
    $$('.search-input').forEach(input => {
        input.addEventListener('input', function() {
            const category = this.dataset.category;
            searchTerms[category] = this.value;
            currentPage[category] = 1;
            applyFiltersAndRender(category);
        });
    });
    
    $$('.btn-clear').forEach(btn => {
        btn.addEventListener('click', function() {
            const container = this.closest('.filters-container');
            const category = container ? container.dataset.category : 'inicio';
            container.querySelectorAll('select').forEach(sel => sel.value = 'todas');
            const searchInput = container.querySelector('.search-input');
            if (searchInput) searchInput.value = '';
            activeFilters[category] = {};
            searchTerms[category] = '';
            currentPage[category] = 1;
            applyFiltersAndRender(category);
        });
    });
    
    $('#favoritesBtn').addEventListener('click', openFavoritesModal);
    $('#favModalClose').addEventListener('click', () => closeModal('favoritesModal'));
    $('#favoritesModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('favoritesModal');
    });
    
    $('#cartBtn').addEventListener('click', function() {
        renderCartModal();
        $('#cartModal').classList.add('open');
    });
    $('#cartModalClose').addEventListener('click', () => closeModal('cartModal'));
    $('#cartModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal('cartModal');
    });
    $('#cartWhatsappBtn').addEventListener('click', sendCartByWhatsApp);
    $('#cartClearBtn').addEventListener('click', clearCart);
    
    $$('.accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', function() {
            const item = this.parentElement;
            const isOpen = item.classList.contains('open');
            $$('.accordion-item').forEach(i => i.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });
    
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('newsletterEmail').value;
            const msg = document.getElementById('newsletterMsg');
            if (email && msg) {
                msg.textContent = '✅ Suscripción registrada. Próximamente recibirás novedades.';
                msg.style.color = 'var(--color-accent)';
                this.reset();
            }
        });
    }
    
    const themeToggle = $('#themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
        });
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
    }
    
    $('#adminToggle').addEventListener('click', openAdminPanel);
    $('#adminClose').addEventListener('click', closeAdminPanel);
    $('#adminPanel').addEventListener('click', function(e) {
        if (e.target === this) closeAdminPanel();
    });
    $('#adminSaveBtn').addEventListener('click', saveProductFromForm);
    $('#adminCancelBtn').addEventListener('click', resetForm);
    $('#adminExportBtn').addEventListener('click', exportProductsJSON);
    $('#adminImportBtn').addEventListener('click', function() {
        document.getElementById('adminFileInput').click();
    });
    $('#adminFileInput').addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            importProductsJSON(this.files[0]);
            this.value = '';
        }
    });
    $('#adminResetBtn').addEventListener('click', resetToDefaultProducts);
    
    updateFavBadge();
    updateCartBadge();
    renderAllSections();
    
    console.log('✅ App inicializada correctamente');
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal('productModal');
        closeModal('favoritesModal');
        closeModal('cartModal');
        closeAdminPanel();
    }
});