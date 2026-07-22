// ===== CONFIGURACIÓN =====
const WHATSAPP_NUMBER = '57XXXXXXXXX';

// ===== DICCIONARIO DE COLORES =====
const COLOR_MAP = {
    'Rosado': '#FFB6C1',
    'Blanco': '#FFFFFF',
    'Negro': '#222222',
    'Azul': '#3A7BD5',
    'Gris': '#808080',
    'Beige': '#F5F5DC',
    'Celeste': '#87CEEB',
    'Amarillo': '#FFD700',
    'Verde': '#32CD32',
    'Lila': '#C8A2C8',
    'Azul marino': '#1B2A4A',
    'Blanco/Negro': 'linear-gradient(45deg, #FFFFFF 50%, #222222 50%)',
    'Rojo': '#DC143C',
    'Rojo/Blanco': 'linear-gradient(45deg, #DC143C 50%, #FFFFFF 50%)',
    'Rojo/Cuadros': 'repeating-linear-gradient(45deg, #DC143C, #DC143C 10px, #FFFFFF 10px, #FFFFFF 20px)',
    'Rojo/Verde': 'linear-gradient(45deg, #DC143C 50%, #228B22 50%)',
    'Gris oscuro': '#404040'
};

// ===== ESTADO GLOBAL =====
let currentProduct = null;
let selectedOptions = { talla: '', color: '' };
let favorites = JSON.parse(localStorage.getItem('lumina_favs') || '[]');
let currentPage = {};
let itemsPerPage = 6;
let activeFilters = {};
let searchTerms = {};
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== FUNCIONES AUXILIARES =====
function formatPrice(priceStr) {
    return parseInt(priceStr.replace(/[^0-9]/g, ''));
}

function getColorHex(colorName) {
    return COLOR_MAP[colorName] || colorName.toLowerCase();
}

function getProductWhatsappLink(product, options = {}) {
    let msg = product.whatsapp || `Hola, estoy interesada en el producto: ${product.nombre}`;
    if (options.talla || options.color) {
        msg += '. Detalles:';
        if (options.talla) msg += ` Talla: ${options.talla}`;
        if (options.color) msg += ` Color: ${options.color}`;
    }
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function toggleFavorite(productId) {
    const index = favorites.indexOf(productId);
    if (index > -1) favorites.splice(index, 1);
    else favorites.push(productId);
    localStorage.setItem('lumina_favs', JSON.stringify(favorites));
    updateFavCount();
    renderAllSections();
    renderFavoritesModalContent();
}

function updateFavCount() {
    const badge = $('#favCount');
    if (badge) badge.textContent = favorites.length;
}

// ===== ORDENACIÓN =====
function sortProducts(products, order) {
    const copy = [...products];
    switch(order) {
        case 'precio-asc': return copy.sort((a,b) => formatPrice(a.precio) - formatPrice(b.precio));
        case 'precio-desc': return copy.sort((a,b) => formatPrice(b.precio) - formatPrice(a.precio));
        case 'nuevo': return copy.sort((a,b) => (b.nuevo ? 1 : 0) - (a.nuevo ? 1 : 0) || a.id - b.id);
        default: return copy;
    }
}

// ===== RENDERIZADO =====
function createProductCard(product) {
    const isFav = favorites.includes(product.id);
    const card = document.createElement('div');
    card.className = 'product-card';
    const imgSrc = product.imagenes[0] || 'img/placeholder.jpg';
    const colorDots = product.colores && product.colores.length ?
        product.colores.map(c => `<span class="color-dot" style="background:${getColorHex(c)}" title="${c}"></span>`).join('') : '';
    card.innerHTML = `
        <div class="product-card__image">
            <img src="${imgSrc}" alt="${product.nombre}" loading="lazy">
            <div class="product-card__badges">
                ${product.nuevo ? '<span class="badge-tag badge-tag--new">Nuevo</span>' : ''}
                ${product.destacado ? '<span class="badge-tag badge-tag--sale">Destacado</span>' : ''}
                ${product.agotado ? '<span class="badge-tag badge-tag--soldout">Agotado</span>' : ''}
                ${!product.agotado && product.stock < 3 ? '<span class="badge-tag badge-tag--urgent">¡Últimas unidades!</span>' : ''}
            </div>
            <div class="product-card__actions">
                <button class="fav-btn" data-id="${product.id}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'var(--color-accent)' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </button>
                <button class="share-btn" data-id="${product.id}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg></button>
            </div>
        </div>
        <div class="product-card__info">
            <h3 class="product-card__name">${product.nombre}</h3>
            <p class="product-card__price">${product.precio}</p>
            ${colorDots ? `<div class="product-card__colors">${colorDots}</div>` : ''}
        </div>
        <div class="product-card__footer">
            <button class="btn btn--outline detail-btn" data-id="${product.id}">Ver Detalles</button>
            <button class="btn btn--primary whatsapp-btn" data-id="${product.id}" style="background:#25D366;border-color:#25D366;padding:10px;">WhatsApp</button>
        </div>
    `;
    card.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(product.id);
    });
    card.querySelector('.detail-btn').addEventListener('click', () => openProductModal(product));
    card.querySelector('.whatsapp-btn').addEventListener('click', () => openProductModal(product));
    card.querySelector('.share-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        shareProduct(product);
    });
    return card;
}

function renderProducts(products, containerId, paginationId, page = 1) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (products.length === 0) {
        container.innerHTML = '<p class="no-results">No hay productos que coincidan con los filtros.</p>';
        return;
    }
    const totalPages = Math.ceil(products.length / itemsPerPage);
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageItems = products.slice(start, end);
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
                    const catMap = {
                        'inicioGrid': 'inicio',
                        'mujerGrid': 'mujer',
                        'hombreGrid': 'hombre',
                        'ninosGrid': 'ninos',
                        'parejasGrid': 'parejas'
                    };
                    const cat = catMap[containerId] || 'inicio';
                    currentPage[cat] = i;
                    applyFiltersAndRender(cat);
                });
                pagContainer.appendChild(btn);
            }
        }
    }
}

// ===== FILTROS Y BÚSQUEDA =====
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
    if (searchTerms[category]) {
        const term = searchTerms[category].toLowerCase();
        products = products.filter(p => p.nombre.toLowerCase().includes(term));
    }
    if (filters.orden && filters.orden !== 'relevancia') {
        products = sortProducts(products, filters.orden);
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
    const destacados = productos.filter(p => p.destacado);
    renderProducts(destacados, 'inicioGrid', null, 1);
    ['mujer', 'hombre', 'ninos', 'parejas'].forEach(cat => applyFiltersAndRender(cat));
    updateFavCount();
}

// ===== NAVEGACIÓN =====
function navigateTo(sectionId) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${sectionId}`);
    if (target) {
        target.classList.add('active');
        if (['mujer','hombre','ninos','parejas'].includes(sectionId)) applyFiltersAndRender(sectionId);
    }
    $$('.nav__link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });
    const navList = $('#navList');
    if (navList) navList.classList.remove('open');
    const navToggle = $('#navToggle');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleHashChange() {
    const hash = window.location.hash.slice(1) || 'inicio';
    navigateTo(hash);
}

// ===== MODAL =====
function openProductModal(product) {
    currentProduct = product;
    selectedOptions = { talla: '', color: '' };
    const modal = $('#productModal');
    const body = $('#modalBody');
    let currentImageIndex = 0;
    const images = product.imagenes || ['img/placeholder.jpg'];

    const colorDots = product.colores && product.colores.length ?
        product.colores.map(c => `<span class="color-dot" style="background:${getColorHex(c)}" title="${c}"></span>`).join('') : '';

    body.innerHTML = `
        <div class="modal__gallery">
            <div class="modal__gallery-main" id="galleryMain">
                <img src="${images[0]}" alt="${product.nombre}" id="mainImage">
            </div>
            <button class="modal__gallery-nav prev" id="galleryPrev">‹</button>
            <button class="modal__gallery-nav next" id="galleryNext">›</button>
            <div class="modal__thumbnails" id="thumbnails">
                ${images.map((img, i) => `<img src="${img}" alt="Vista ${i+1}" class="${i===0?'active':''}" data-index="${i}">`).join('')}
            </div>
        </div>
        <div class="modal__details">
            <h2>${product.nombre}</h2>
            <p class="price">${product.precio}</p>
            <p class="desc">${product.descripcion}</p>
            ${product.tallas && product.tallas.length ? `
            <div class="tallas">
                <span>Talla:</span>
                <div class="tallas-options" id="tallasOptions">
                    ${product.tallas.map(t => `<button class="talla-btn" data-talla="${t}">${t}</button>`).join('')}
                </div>
            </div>` : ''}
            ${product.colores && product.colores.length ? `
            <div class="colores">
                <span>Color:</span>
                <div class="colores-options" id="coloresOptions">
                    ${product.colores.map(c => `<button class="color-btn" data-color="${c}">${c}</button>`).join('')}
                </div>
                <div class="color-preview" id="colorPreview">${colorDots}</div>
            </div>` : ''}
            <p class="disponibilidad">${product.agotado ? '❌ Agotado' : '✅ Disponible'}</p>
            ${product.agotado ? `
                <button class="btn btn--outline" disabled style="width:100%;">Avisarme cuando esté disponible</button>
            ` : `
                <button class="btn-whatsapp" id="modalWhatsappBtn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149..."/></svg>
                    Comprar por WhatsApp
                </button>
            `}
            <div class="share-buttons">
                <button class="share-btn-icon" data-share="whatsapp">📱 WhatsApp</button>
                <button class="share-btn-icon" data-share="facebook">📘 Facebook</button>
                <button class="share-btn-icon" data-share="twitter">🐦 Twitter</button>
                <button class="share-btn-icon" data-share="copy">🔗 Copiar enlace</button>
            </div>
            <div class="related-products" id="relatedProducts">
                <h4>También te puede interesar</h4>
                <div class="related-grid" id="relatedGrid"></div>
            </div>
        </div>
    `;

    // Galería
    const mainImg = $('#mainImage');
    const thumbs = body.querySelectorAll('#thumbnails img');
    const prevBtn = $('#galleryPrev');
    const nextBtn = $('#galleryNext');

    function updateGallery(index) {
        currentImageIndex = index;
        mainImg.src = images[index];
        thumbs.forEach((t, i) => t.classList.toggle('active', i === index));
    }
    prevBtn.addEventListener('click', () => updateGallery((currentImageIndex - 1 + images.length) % images.length));
    nextBtn.addEventListener('click', () => updateGallery((currentImageIndex + 1) % images.length));
    thumbs.forEach((t, i) => t.addEventListener('click', () => updateGallery(i)));

    // Zoom
    const galleryMain = $('#galleryMain');
    galleryMain.addEventListener('click', () => galleryMain.classList.toggle('zoomed'));

    // Selección de talla y color
    body.querySelectorAll('.talla-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentElement.querySelectorAll('.talla-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedOptions.talla = this.dataset.talla;
            updateWhatsappLink();
        });
    });
    body.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.parentElement.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedOptions.color = this.dataset.color;
            const preview = document.getElementById('colorPreview');
            if (preview) {
                preview.innerHTML = `<span class="color-dot" style="background:${getColorHex(selectedOptions.color)}"></span>`;
            }
            updateWhatsappLink();
        });
    });

    function updateWhatsappLink() {
        const btn = $('#modalWhatsappBtn');
        if (btn && !product.agotado) {
            btn.onclick = function() {
                window.open(getProductWhatsappLink(product, selectedOptions), '_blank');
            };
        }
    }
    // Enlace inicial
    const initialBtn = $('#modalWhatsappBtn');
    if (initialBtn && !product.agotado) {
        initialBtn.onclick = function() {
            window.open(getProductWhatsappLink(product, selectedOptions), '_blank');
        };
    }

    // Productos relacionados
    const relatedGrid = $('#relatedGrid');
    if (relatedGrid) {
        const related = productos.filter(p => p.categoria === product.categoria && p.id !== product.id).slice(0, 3);
        relatedGrid.innerHTML = '';
        related.forEach(p => {
            const card = document.createElement('div');
            card.className = 'related-card';
            card.innerHTML = `
                <img src="${p.imagenes[0]}" alt="${p.nombre}" loading="lazy">
                <div class="related-info">
                    <p class="related-name">${p.nombre}</p>
                    <p class="related-price">${p.precio}</p>
                    <button class="btn btn--outline btn--sm related-btn" data-id="${p.id}">Ver</button>
                </div>
            `;
            card.querySelector('.related-btn').addEventListener('click', () => {
                closeModal('productModal');
                setTimeout(() => openProductModal(p), 300);
            });
            relatedGrid.appendChild(card);
        });
        if (related.length === 0) relatedGrid.innerHTML = '<p class="no-results">No hay productos relacionados.</p>';
    }

    // Compartir
    body.querySelectorAll('[data-share]').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.dataset.share;
            const url = encodeURIComponent(window.location.href.split('?')[0] + '?producto=' + product.id);
            const text = encodeURIComponent(`Mira este producto: ${product.nombre} - ${product.precio}`);
            let shareUrl = '';
            if (type === 'whatsapp') shareUrl = `https://wa.me/?text=${text}%20${url}`;
            else if (type === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            else if (type === 'twitter') shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
            else if (type === 'copy') {
                navigator.clipboard.writeText(decodeURIComponent(url)).then(() => showToast('Enlace copiado al portapapeles'));
                return;
            }
            if (shareUrl) window.open(shareUrl, '_blank');
        });
    });

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = $(`#${modalId}`);
    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        selectedOptions = {};
    }
}

function shareProduct(product) {
    const url = window.location.href.split('?')[0] + '?producto=' + product.id;
    if (navigator.share) {
        navigator.share({ title: product.nombre, text: product.descripcion, url });
    } else {
        navigator.clipboard.writeText(url).then(() => showToast('Enlace copiado al portapapeles'));
    }
}

function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== FAVORITOS =====
function openFavoritesModal() {
    const modal = $('#favoritesModal');
    renderFavoritesModalContent();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function renderFavoritesModalContent() {
    const list = $('#favoritesList');
    const favProducts = productos.filter(p => favorites.includes(p.id));
    list.innerHTML = '';
    if (favProducts.length === 0) {
        list.innerHTML = '<p class="empty-msg">No tienes productos favoritos aún.</p>';
    } else {
        favProducts.forEach(prod => {
            const item = document.createElement('div');
            item.className = 'fav-item';
            item.innerHTML = `
                <img src="${prod.imagenes[0]}" alt="${prod.nombre}">
                <div class="info"><strong>${prod.nombre}</strong><br>${prod.precio}</div>
                <button class="remove-fav" data-id="${prod.id}">✕</button>
            `;
            item.querySelector('.remove-fav').addEventListener('click', () => {
                toggleFavorite(prod.id);
                renderFavoritesModalContent();
            });
            list.appendChild(item);
        });
    }
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    // Loader
    setTimeout(() => {
        const loader = $('#loader');
        if (loader) loader.classList.add('hidden');
    }, 800);

    // Navegación móvil
    const navToggle = $('#navToggle');
    const navList = $('#navList');
    if (navToggle && navList) {
        navToggle.addEventListener('click', () => {
            navList.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', navList.classList.contains('open'));
        });
    }

    // Enlaces del menú
    $$('.nav__link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;
            if (section) window.location.hash = section;
        });
    });

    // Scroll
    window.addEventListener('scroll', () => {
        const header = $('#header');
        if (header) header.classList.toggle('scrolled', window.scrollY > 50);
        const backToTop = $('#backToTop');
        if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 500);
    });

    // Back to top
    const backToTop = $('#backToTop');
    if (backToTop) {
        backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // Modo oscuro
    const themeToggle = $('#themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
        });
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.body.setAttribute('data-theme', savedTheme);
    }

    // Favoritos
    const favBtn = $('#favoritesBtn');
    if (favBtn) favBtn.addEventListener('click', openFavoritesModal);
    const favClose = $('#favClose');
    if (favClose) favClose.addEventListener('click', () => closeModal('favoritesModal'));
    const favBackdrop = $('#favBackdrop');
    if (favBackdrop) favBackdrop.addEventListener('click', () => closeModal('favoritesModal'));

    // Modal producto
    const modalClose = $('#modalClose');
    if (modalClose) modalClose.addEventListener('click', () => closeModal('productModal'));
    const modalBackdrop = $('#modalBackdrop');
    if (modalBackdrop) modalBackdrop.addEventListener('click', () => closeModal('productModal'));

    // Acordeón FAQ
    $$('.accordion__trigger').forEach(trigger => {
        trigger.addEventListener('click', function() {
            const item = this.parentElement;
            const isActive = item.classList.contains('active');
            document.querySelectorAll('.accordion__item').forEach(i => i.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });

    // Filtros
    $$('.filter-select').forEach(select => {
        select.addEventListener('change', function() {
            const container = this.closest('.filters');
            if (!container) return;
            const category = container.id.replace('filters-', '');
            const filterType = this.dataset.filter;
            const value = this.value;
            if (!activeFilters[category]) activeFilters[category] = {};
            activeFilters[category][filterType] = value;
            currentPage[category] = 1;
            applyFiltersAndRender(category);
        });
    });

    // Búsqueda
    $$('.search-input').forEach(input => {
        input.addEventListener('input', function() {
            const category = this.dataset.category;
            searchTerms[category] = this.value;
            currentPage[category] = 1;
            applyFiltersAndRender(category);
        });
    });

    // Limpiar filtros
    $$('.clear-filters').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;
            const filtersContainer = document.getElementById('filters-' + category);
            if (filtersContainer) {
                filtersContainer.querySelectorAll('select').forEach(sel => sel.value = 'todas');
                filtersContainer.querySelectorAll('select[data-filter="orden"]').forEach(sel => sel.value = 'relevancia');
            }
            const searchInput = document.querySelector(`.search-input[data-category="${category}"]`);
            if (searchInput) searchInput.value = '';
            searchTerms[category] = '';
            activeFilters[category] = {};
            currentPage[category] = 1;
            applyFiltersAndRender(category);
        });
    });

    // Newsletter (demo)
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

    // Inicializar
    updateFavCount();
    renderAllSections();

    // Hash
    window.addEventListener('hashchange', handleHashChange);
    if (!window.location.hash) window.location.hash = 'inicio';
    else handleHashChange();

    // Producto desde URL
    const params = new URLSearchParams(window.location.search);
    const prodId = params.get('producto');
    if (prodId) {
        const prod = productos.find(p => p.id == prodId);
        if (prod) openProductModal(prod);
    }
});

// Cerrar modales con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal('productModal');
        closeModal('favoritesModal');
    }
});