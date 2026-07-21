// ===== CONFIGURACIÓN =====
const WHATSAPP_NUMBER = '57XXXXXXXXX'; // Cambia por tu número

// ===== ESTADO GLOBAL =====
let currentProduct = null;
let favorites = JSON.parse(localStorage.getItem('lumina_favs') || '[]');

// ===== DOM ELEMENTS =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== FUNCIONES AUXILIARES =====
function formatPrice(priceStr) {
  const num = parseInt(priceStr.replace(/[^0-9]/g, ''));
  return num;
}

function getProductWhatsappLink(product) {
  const msg = encodeURIComponent(product.whatsapp || `Hola, estoy interesada en el producto: ${product.nombre}. ¿Podrías darme más información?`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

function toggleFavorite(productId) {
  const index = favorites.indexOf(productId);
  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push(productId);
  }
  localStorage.setItem('lumina_favs', JSON.stringify(favorites));
  updateFavCount();
  renderAllProducts();
}

function updateFavCount() {
  const count = favorites.length;
  const badge = $('#favCount');
  if (badge) badge.textContent = count;
  if (count === 0) {
    badge.style.display = 'none';
  } else {
    badge.style.display = 'flex';
  }
}

// ===== RENDERIZADO DE PRODUCTOS =====
function createProductCard(product) {
  const isFav = favorites.includes(product.id);
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `
    <div class="product-card__image">
      <img src="${product.imagenes[0]}" alt="${product.nombre}" loading="lazy">
      <div class="product-card__badges">
        ${product.nuevo ? '<span class="badge-tag badge-tag--new">Nuevo</span>' : ''}
        ${product.destacado ? '<span class="badge-tag badge-tag--sale">Destacado</span>' : ''}
        ${product.agotado ? '<span class="badge-tag badge-tag--soldout">Agotado</span>' : ''}
      </div>
      <div class="product-card__actions">
        <button class="fav-btn" data-id="${product.id}" aria-label="Favorito">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'var(--color-accent)' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="share-btn" data-id="${product.id}" aria-label="Compartir"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg></button>
      </div>
    </div>
    <div class="product-card__info">
      <h3 class="product-card__name">${product.nombre}</h3>
      <p class="product-card__price">${product.precio}</p>
      ${product.colores && product.colores.length ? `<div class="product-card__colors">${product.colores.map(c => `<span class="color-dot" style="background:${c.toLowerCase()}" title="${c}"></span>`).join('')}</div>` : ''}
    </div>
    <div class="product-card__footer">
      <button class="btn btn--outline detail-btn" data-id="${product.id}">Ver Detalles</button>
      <a href="${getProductWhatsappLink(product)}" target="_blank" rel="noopener" class="btn btn--primary" style="background:#25D366;border-color:#25D366;padding:10px;">WhatsApp</a>
    </div>
  `;
  // Eventos
  card.querySelector('.fav-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  });
  card.querySelector('.detail-btn').addEventListener('click', () => openProductModal(product));
  card.querySelector('.share-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    shareProduct(product);
  });
  return card;
}

function renderProducts(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (products.length === 0) {
    container.innerHTML = '<p class="no-results">No se encontraron productos.</p>';
    return;
  }
  products.forEach(p => container.appendChild(createProductCard(p)));
}

// ===== FILTROS Y BÚSQUEDA =====
function getFilteredProducts() {
  const searchTerm = $('#searchInput')?.value.toLowerCase() || '';
  const category = $('#filterCategory')?.value || 'todas';
  const priceRange = $('#filterPrice')?.value || 'todos';
  const availability = $('#filterAvailability')?.value || 'todos';
  const onlyNew = $('#filterNew')?.checked || false;
  const onlyFeatured = $('#filterFeatured')?.checked || false;

  return productos.filter(p => {
    // Búsqueda textual
    const matchSearch = searchTerm === '' || 
      p.nombre.toLowerCase().includes(searchTerm) ||
      p.categoria.toLowerCase().includes(searchTerm) ||
      p.descripcion.toLowerCase().includes(searchTerm) ||
      (p.colores && p.colores.some(c => c.toLowerCase().includes(searchTerm)));

    // Categoría
    const matchCat = category === 'todas' || p.categoria === category;

    // Precio
    let matchPrice = true;
    const price = formatPrice(p.precio);
    if (priceRange === '0-50000') matchPrice = price <= 50000;
    else if (priceRange === '50000-100000') matchPrice = price > 50000 && price <= 100000;
    else if (priceRange === '100000-999999') matchPrice = price > 100000;

    // Disponibilidad
    const matchAvail = availability === 'todos' || 
      (availability === 'disponible' && !p.agotado) ||
      (availability === 'agotado' && p.agotado);

    // Nuevo / Destacado
    const matchNew = !onlyNew || p.nuevo;
    const matchFeatured = !onlyFeatured || p.destacado;

    return matchSearch && matchCat && matchPrice && matchAvail && matchNew && matchFeatured;
  });
}

function renderAllProducts() {
  const filtered = getFilteredProducts();
  // Catálogo general
  renderProducts(filtered, 'productsGrid');
  // Pijamas
  renderProducts(filtered.filter(p => p.categoria === 'Pijamas'), 'pijamasGrid');
  // Maquillaje (con subcategoría activa)
  const activeSubcat = document.querySelector('#maquillajeChips .chip.active')?.dataset.subcat || 'todas';
  const maquillajeProducts = activeSubcat === 'todas' 
    ? filtered.filter(p => p.categoria === 'Maquillaje')
    : filtered.filter(p => p.categoria === 'Maquillaje' && p.subcategoria === activeSubcat);
  renderProducts(maquillajeProducts, 'maquillajeGrid');
  // Nuevos
  renderProducts(filtered.filter(p => p.nuevo), 'nuevosGrid');
  // Destacados
  renderProducts(filtered.filter(p => p.destacado), 'destacadosGrid');
}

// ===== MODAL DE PRODUCTO =====
function openProductModal(product) {
  currentProduct = product;
  const modal = $('#productModal');
  const body = $('#modalBody');
  body.innerHTML = `
    <div class="modal__gallery">
      <div class="modal__gallery-main" id="galleryMain">
        <img src="${product.imagenes[0]}" alt="${product.nombre}" id="mainImage">
      </div>
      <div class="modal__thumbnails" id="thumbnails">
        ${product.imagenes.map((img, i) => `<img src="${img}" alt="Vista ${i+1}" class="${i===0?'active':''}" data-index="${i}">`).join('')}
      </div>
    </div>
    <div class="modal__details">
      <h2>${product.nombre}</h2>
      <p class="price">${product.precio}</p>
      <p class="desc">${product.descripcion}</p>
      ${product.tallas && product.tallas.length ? `
      <div class="tallas">
        <span>Talla:</span>
        <div class="tallas-options">${product.tallas.map(t => `<button class="talla-btn">${t}</button>`).join('')}</div>
      </div>` : ''}
      ${product.colores && product.colores.length ? `
      <div class="colores">
        <span>Color:</span>
        <div class="colores-options">${product.colores.map(c => `<button class="color-btn">${c}</button>`).join('')}</div>
      </div>` : ''}
      <p class="disponibilidad">${product.agotado ? '❌ Agotado' : '✅ Disponible'}</p>
      <a href="${getProductWhatsappLink(product)}" target="_blank" rel="noopener" class="btn-whatsapp">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149..."/></svg>
        Comprar por WhatsApp
      </a>
    </div>
  `;
  // Eventos galería
  const thumbs = body.querySelectorAll('#thumbnails img');
  const mainImg = $('#mainImage');
  thumbs.forEach(t => t.addEventListener('click', () => {
    mainImg.src = t.src;
    thumbs.forEach(tt => tt.classList.remove('active'));
    t.classList.add('active');
  }));
  // Zoom
  const galleryMain = $('#galleryMain');
  galleryMain.addEventListener('click', () => {
    galleryMain.classList.toggle('zoomed');
  });
  // Selección talla/color
  body.querySelectorAll('.talla-btn').forEach(btn => btn.addEventListener('click', function() {
    this.parentElement.querySelectorAll('.talla-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  }));
  body.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', function() {
    this.parentElement.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  }));

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  const modal = $(`#${modalId}`);
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function shareProduct(product) {
  const url = window.location.href.split('?')[0] + '?producto=' + product.id;
  if (navigator.share) {
    navigator.share({title: product.nombre, text: product.descripcion, url});
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

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  // Loader
  setTimeout(() => {
    $('#loader').classList.add('hidden');
  }, 800);

  // Navegación
  const navToggle = $('#navToggle');
  const navList = $('#navList');
  navToggle.addEventListener('click', () => {
    navList.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', navList.classList.contains('open'));
  });

  // Navegación suave y activa
  $$('.nav__link').forEach(link => {
    link.addEventListener('click', (e) => {
      navList.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      $$('.nav__link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Scroll header
  window.addEventListener('scroll', () => {
    const header = $('#header');
    header.classList.toggle('scrolled', window.scrollY > 50);
    // Back to top
    $('#backToTop').classList.toggle('visible', window.scrollY > 500);
  });

  // Back to top
  $('#backToTop').addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));

  // Modo oscuro
  const themeToggle = $('#themeToggle');
  themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);

  // Filtros
  $('#searchInput')?.addEventListener('input', renderAllProducts);
  $('#filterCategory')?.addEventListener('change', renderAllProducts);
  $('#filterPrice')?.addEventListener('change', renderAllProducts);
  $('#filterAvailability')?.addEventListener('change', renderAllProducts);
  $('#filterNew')?.addEventListener('change', renderAllProducts);
  $('#filterFeatured')?.addEventListener('change', renderAllProducts);

  // Chips maquillaje
  $$('#maquillajeChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#maquillajeChips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderAllProducts();
    });
  });

  // Favoritos modal
  $('#favoritesBtn').addEventListener('click', openFavoritesModal);
  $('#favClose').addEventListener('click', () => closeModal('favoritesModal'));
  $('#favBackdrop').addEventListener('click', () => closeModal('favoritesModal'));

  // Modal producto
  $('#modalClose').addEventListener('click', () => closeModal('productModal'));
  $('#modalBackdrop').addEventListener('click', () => closeModal('productModal'));

  // WhatsApp flotante
  $('#whatsappFloat').addEventListener('click', (e) => {
    // Si hay producto actual, usar ese mensaje
    if (currentProduct) {
      e.preventDefault();
      window.open(getProductWhatsappLink(currentProduct), '_blank');
    }
  });

  // Acordeón FAQ
  $$('.accordion__trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.parentElement;
      const isActive = item.classList.contains('active');
      document.querySelectorAll('.accordion__item').forEach(i => i.classList.remove('active'));
      if (!isActive) item.classList.add('active');
    });
  });

  // Inicializar favoritos
  updateFavCount();
  // Renderizar todo
  renderAllProducts();

  // Ver si hay producto en URL
  const params = new URLSearchParams(window.location.search);
  const prodId = params.get('producto');
  if (prodId) {
    const prod = productos.find(p => p.id == prodId);
    if (prod) openProductModal(prod);
  }
});

function openFavoritesModal() {
  const modal = $('#favoritesModal');
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
        openFavoritesModal(); // refrescar
      });
      list.appendChild(item);
    });
  }
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

// Cerrar modales con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('productModal');
    closeModal('favoritesModal');
  }
});