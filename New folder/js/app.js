(() => {
      "use strict";
      const STORAGE_KEY = "nativa-minisuper-demo-v1";
      const SUPABASE_URL_KEY = "nativa-minisuper-supabase-url";
      const SUPABASE_PUBLIC_KEY = "nativa-minisuper-supabase-public-key";
      const SUPABASE_SESSION_KEY = "nativa-minisuper-supabase-session";
      const SUPABASE_PENDING_KEY = "nativa-minisuper-supabase-pending";
      const SUGGESTED_PRICE_UPDATES = {
        p1: { code: "7501055300078", previous: 28, next: 26 },
        p2: { code: "7501000111123", previous: 45, next: 39 },
        p3: { code: "7501030422011", previous: 79, next: 69 },
        p4: { code: "7501055300214", previous: 46, next: 42 },
        p5: { code: "7501000123004", previous: 34, next: 28 },
        p6: { code: "7501031311308", previous: 39, next: 30 },
        p7: { code: "7501055300054", previous: 41, next: 34 },
        p8: { code: "7501000119884", previous: 22, next: 17 },
        p9: { code: "7501031312459", previous: 16, next: 14 },
        p10: { code: "7501000124025", previous: 36, next: 32 },
        p11: { code: "7501055300306", previous: 65, next: 55 },
        p12: { code: "7501031310806", previous: 20, next: 18 }
      };
      const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
      const money = value => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(roundMoney(value) || 0);
      const todayKey = () => {
        const now = new Date();
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      };
      const dateOffset = days => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      };
      const dateKey = value => {
        const date = new Date(value);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      };
      const { products: demoProducts, sales: sampleSales } = window.NativaDemoData;
      const emptyState = () => ({
        products: demoProducts.map(item => ({ ...item })),
        sales: sampleSales.map(item => ({ ...item, items: item.items.map(product => ({ ...product })) })),
        suppliers: [], purchaseOrders: [], movements: []
      });
      const loadState = () => {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (!saved) return emptyState();
          const parsed = JSON.parse(saved);
          if (!Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) throw new Error("El formato de los datos guardados no es válido.");
          return {
            ...parsed,
            suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
            purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : [],
            movements: Array.isArray(parsed.movements) ? parsed.movements : [],
            sales: parsed.sales.map(sale => sale.cashier === "Andrea Martínez" || sale.cashier === "Caja de demostración" ? { ...sale, cashier: "Caja Miranda" } : sale)
          };
        } catch (error) {
          console.error("No se pudieron leer los datos guardados de Minisuper Miranda:", error);
          return emptyState();
        }
      };
      let state = loadState();
      let cart = [];
      let purchaseDraft = [];
      let activeCategory = "Todos";
      let toastTimer;
      let supabaseClient = null;
      let supabaseSession = null;
      let databaseRevision = 0;
      let hasLocalSnapshot = false;
      try { hasLocalSnapshot = localStorage.getItem(STORAGE_KEY) !== null; }
      catch (error) { console.error("No se pudo comprobar el respaldo local:", error); }
      let remoteSaveQueue = Promise.resolve();
      let remoteSaveTimer;
      const byId = id => document.getElementById(id);
      const safe = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
      const createId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const imageForCategory = category => {
        const normalized = String(category || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
        if (normalized.includes("lact") || normalized.includes("ques") || normalized.includes("huev")) return "assets/dairy.jpg";
        if (normalized.includes("pan") || normalized.includes("gallet")) return "assets/bakery.jpg";
        if (normalized.includes("beb") || normalized.includes("jug") || normalized.includes("agua") || normalized.includes("refres")) return "assets/drinks.jpg";
        if (normalized.includes("frut") || normalized.includes("verd") || normalized.includes("produce")) return "assets/produce.jpg";
        return "assets/pantry.jpg";
      };
      const productImage = product => {
        const demoProduct = demoProducts.find(item => item.id === product.id || item.code === product.code);
        const savedImage = product.image || demoProduct?.image || "";
        if (demoProduct && demoProduct.image.startsWith("assets/photos/")) return demoProduct.image;
        if (savedImage.endsWith(".svg")) return imageForCategory(product.category);
        return savedImage || imageForCategory(product.category);
      };
      const photoMarkup = (product, className = "product-thumb") => `<span class="${className} has-photo"><img src="${safe(productImage(product))}" alt="" loading="lazy" onerror="this.hidden=true"><span aria-hidden="true">${safe(product.emoji || "📦")}</span></span>`;
      const setMobileMenu = open => {
        byId("sidebar").classList.toggle("open", open);
        byId("mobileScrim").classList.toggle("active", open);
        byId("menuToggle").setAttribute("aria-expanded", String(open));
      };
      const persist = () => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
          console.error("No se pudieron guardar los datos de Minisuper Miranda:", error);
          showToast("No se pudieron guardar los cambios en este navegador.");
        }
        if (supabaseClient) {
          try { localStorage.setItem(SUPABASE_PENDING_KEY, "true"); }
          catch (error) { console.error("No se pudo registrar la sincronización pendiente:", error); }
          updateConnection("syncing");
          clearTimeout(remoteSaveTimer);
          remoteSaveTimer = setTimeout(syncRemoteState, 350);
        }
      };
      const formatTime = date => new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
      const formatDate = date => new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
      const itemsQuantity = items => (items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const itemCountLabel = items => {
        const quantity = itemsQuantity(items);
        return `${quantity} ${quantity === 1 ? "artículo" : "artículos"}`;
      };
      const showToast = message => {
        byId("toastText").textContent = message;
        byId("toast").classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => byId("toast").classList.remove("show"), 2800);
      };
      const updateConnection = status => {
        const title = byId("connectionTitle");
        const text = byId("connectionText");
        const dot = byId("connectionDot");
        const messages = {
          local: ["Solo este navegador", "Los cambios aún se guardan en este navegador."],
          connecting: ["Conectando…", "Verificando tu cuenta y la base de Supabase."],
          connected: ["Supabase conectado", "Inventario, ventas, compras y movimientos sincronizados."],
          syncing: ["Sincronizando…", "Guardando los cambios en la base de Supabase."],
          error: ["Error de sincronización", "Revisa tu sesión y la conexión a Supabase antes de continuar."]
        };
        const [heading, description] = messages[status] || messages.local;
        title.textContent = heading;
        text.textContent = description;
        dot.classList.toggle("connected", status === "connected");
        dot.classList.toggle("syncing", status === "syncing" || status === "connecting");
        dot.classList.toggle("error", status === "error");
        byId("configureSupabaseButton").textContent = supabaseClient ? "Administrar Supabase" : "Configurar Supabase";
      };
      const addInventoryMovement = (product, type, quantity, before, reference, notes = "") => {
        state.movements.unshift({
          id: createId("MOV"),
          date: new Date().toISOString(), productId: product.id, productName: product.name,
          type, quantity, before, after: Number(product.stock), reference, notes
        });
      };
      const lowStock = () => state.products.filter(product => Number(product.stock) <= Number(product.minStock));
      const renderDashboard = () => {
        const today = todayKey();
        const salesToday = state.sales.filter(sale => dateKey(sale.date) === today);
        const revenue = roundMoney(salesToday.reduce((sum, sale) => sum + Number(sale.total), 0));
        byId("todaySalesValue").textContent = money(revenue);
        byId("todaySalesCount").textContent = `${salesToday.length} ${salesToday.length === 1 ? "venta registrada" : "ventas registradas"}`;
        byId("productCountValue").textContent = state.products.length;
        byId("lowStockValue").textContent = lowStock().length;
        byId("lowStockBadge").textContent = lowStock().length;
        byId("averageTicketValue").textContent = money(salesToday.length ? revenue / salesToday.length : 0);
        byId("lowStockList").innerHTML = lowStock().length
          ? lowStock().slice(0, 4).map(product => `<div class="stock-row">${photoMarkup(product)}<div style="min-width:0"><div class="stock-name">${safe(product.name)}</div><div class="stock-category">${safe(product.category)}</div></div><div class="stock-count"><strong>${Number(product.stock)} pzas.</strong><span>mín. ${Number(product.minStock)}</span></div></div>`).join("")
          : `<div class="empty-state">¡Todo en orden! No tienes productos por reabastecer.</div>`;
        byId("recentSalesBody").innerHTML = state.sales.slice(0, 5).map(sale => `<tr><td class="sale-id">#${safe(sale.id)}</td><td>${formatTime(sale.date)}</td><td>${safe(sale.cashier || "Caja Miranda")}</td><td class="sale-product">${itemCountLabel(sale.items)}</td><td><strong>${money(sale.total)}</strong></td><td><span class="status">Completada</span></td></tr>`).join("") || `<tr><td colspan="6" class="empty-state">Todavía no hay ventas registradas.</td></tr>`;
        drawChart(byId("chartPeriod").value);
      };
      const drawChart = period => {
        const canvas = byId("salesChart");
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        const ctx = canvas.getContext("2d");
        ctx.scale(ratio, ratio);
        const days = period === "month" ? 14 : 7;
        const labels = [];
        const values = [];
        const counts = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const key = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
          const daySales = state.sales.filter(sale => dateKey(sale.date) === key);
          values.push(roundMoney(daySales.reduce((sum, sale) => sum + Number(sale.total), 0)));
          counts.push(daySales.length);
          labels.push(period === "month" ? `${date.getDate()}` : new Intl.DateTimeFormat("es-MX", { weekday: "short" }).format(date).replace(".", ""));
        }
        const width = rect.width;
        const height = rect.height;
        const pad = { top: 14, right: 7, bottom: 25, left: 37 };
        const chartW = width - pad.left - pad.right;
        const chartH = height - pad.top - pad.bottom;
        const max = Math.max(100, Math.ceil(Math.max(...values, 0) / 100) * 100);
        ctx.clearRect(0, 0, width, height);
        ctx.font = "9px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        for (let i = 0; i < 4; i++) {
          const y = pad.top + chartH * i / 3;
          ctx.beginPath(); ctx.strokeStyle = "#eef1ec"; ctx.lineWidth = 1; ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
          ctx.fillStyle = "#9aa29a"; ctx.textAlign = "right";
          ctx.fillText(i === 3 ? "$0" : `$${Math.round(max * (3 - i) / 3)}`, pad.left - 8, y);
        }
        const points = values.map((value, i) => ({ x: pad.left + chartW * (days === 1 ? .5 : i / (days - 1)), y: pad.top + chartH * (1 - value / max) }));
        const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
        gradient.addColorStop(0, "rgba(57,112,75,.19)");
        gradient.addColorStop(1, "rgba(57,112,75,0)");
        ctx.beginPath();
        points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, height - pad.bottom);
        ctx.lineTo(points[0].x, height - pad.bottom);
        ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
        ctx.beginPath();
        points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.strokeStyle = "#3e7852"; ctx.lineWidth = 2.1; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
        points.forEach(point => { ctx.beginPath(); ctx.arc(point.x, point.y, 3, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#3e7852"; ctx.lineWidth = 1.8; ctx.stroke(); });
        labels.forEach((label, index) => {
          if (period === "month" && index % 2 !== 0 && index !== labels.length - 1) return;
          ctx.fillStyle = "#969e96"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
          ctx.fillText(label, points[index].x, height - 5);
        });
        canvas.onmousemove = event => {
          const bounds = canvas.getBoundingClientRect();
          const x = event.clientX - bounds.left;
          const index = points.reduce((best, point, current) => Math.abs(point.x - x) < Math.abs(points[best].x - x) ? current : best, 0);
          const tooltip = byId("chartTooltip");
          tooltip.textContent = `${labels[index]} · ${money(values[index])} · ${counts[index]} ${counts[index] === 1 ? "venta" : "ventas"}`;
          tooltip.style.left = `${points[index].x}px`;
          tooltip.style.top = `${Math.max(14, points[index].y)}px`;
          tooltip.style.display = "block";
        };
        canvas.onmouseleave = () => { byId("chartTooltip").style.display = "none"; };
      };
      const renderInventory = () => {
        const query = byId("inventorySearch").value.trim().toLocaleLowerCase("es");
        const category = byId("inventoryCategory").value;
        const stockFilter = byId("stockFilter").value;
        const products = state.products.filter(product => {
          const matchesQuery = !query || `${product.name} ${product.code} ${product.category}`.toLocaleLowerCase("es").includes(query);
          const matchesCategory = !category || product.category === category;
          const isLow = Number(product.stock) <= Number(product.minStock);
          return matchesQuery && matchesCategory && (!stockFilter || (stockFilter === "low" ? isLow : !isLow));
        });
        byId("inventoryCount").textContent = `${products.length} ${products.length === 1 ? "producto" : "productos"}`;
        byId("inventorySummary").textContent = `Mostrando ${products.length} de ${state.products.length} productos`;
        byId("inventoryBody").innerHTML = products.map(product => `<tr><td><div class="product-cell">${photoMarkup(product)}<div><strong>${safe(product.name)}</strong><small>${safe(product.category)}</small></div></div></td><td>${safe(product.code)}</td><td>${safe(product.category)}</td><td>${money(product.cost)}</td><td><strong>${money(product.price)}</strong></td><td><span class="stock-chip ${Number(product.stock) <= Number(product.minStock) ? "low" : ""}">${Number(product.stock)} pzas.</span></td><td>${Number(product.minStock)} pzas.</td><td><div class="row-actions"><button class="mini-icon" data-restock="${safe(product.id)}" aria-label="Reponer ${safe(product.name)}" title="Sumar 10 unidades"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button><button class="mini-icon" data-edit="${safe(product.id)}" aria-label="Editar ${safe(product.name)}" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="mini-icon" data-delete="${safe(product.id)}" aria-label="Eliminar ${safe(product.name)}" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg></button></div></td></tr>`).join("") || `<tr><td colspan="8" class="empty-state">No encontramos productos con esos filtros.</td></tr>`;
      };
      const renderPurchases = () => {
        const supplierSelect = byId("purchaseSupplier");
        const selectedSupplier = supplierSelect.value;
        supplierSelect.innerHTML = `<option value="">Selecciona un proveedor</option>${state.suppliers.map(supplier => `<option value="${safe(supplier.id)}">${safe(supplier.name)}</option>`).join("")}`;
        supplierSelect.value = state.suppliers.some(supplier => supplier.id === selectedSupplier) ? selectedSupplier : "";

        const productSelect = byId("purchaseProduct");
        const selectedProduct = productSelect.value;
        productSelect.innerHTML = `<option value="">Selecciona un producto</option>${state.products.map(product => `<option value="${safe(product.id)}">${safe(product.name)} · ${safe(product.code)}</option>`).join("")}`;
        productSelect.value = state.products.some(product => product.id === selectedProduct) ? selectedProduct : "";

        byId("supplierCount").textContent = `${state.suppliers.length} ${state.suppliers.length === 1 ? "proveedor" : "proveedores"}`;
        byId("supplierList").innerHTML = state.suppliers.length
          ? state.suppliers.map(supplier => `<div class="supplier-row"><div class="supplier-avatar" aria-hidden="true">${safe(supplier.name.slice(0, 1).toLocaleUpperCase("es"))}</div><div class="supplier-info"><strong>${safe(supplier.name)}</strong><span>${safe(supplier.contact || supplier.phone || supplier.email || "Sin datos de contacto")}</span></div><div class="supplier-actions"><button class="mini-icon" type="button" data-edit-supplier="${safe(supplier.id)}" aria-label="Editar proveedor ${safe(supplier.name)}" title="Editar proveedor"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button class="mini-icon" type="button" data-delete-supplier="${safe(supplier.id)}" aria-label="Eliminar proveedor ${safe(supplier.name)}" title="Eliminar proveedor"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg></button></div></div>`).join("")
          : `<div class="empty-state">Agrega proveedores para crear pedidos.</div>`;

        byId("purchaseDraftBody").innerHTML = purchaseDraft.length
          ? purchaseDraft.map((item, index) => `<tr><td>${safe(item.name)}</td><td>${item.qty}</td><td>${money(item.cost)}</td><td><strong>${money(item.qty * item.cost)}</strong></td><td><button class="mini-icon" type="button" data-remove-purchase-item="${index}" aria-label="Quitar ${safe(item.name)}">×</button></td></tr>`).join("")
          : `<tr><td colspan="5" class="empty-state">Agrega productos al pedido.</td></tr>`;
        const total = roundMoney(purchaseDraft.reduce((sum, item) => sum + item.qty * item.cost, 0));
        byId("purchaseDraftTotal").textContent = money(total);
        byId("createPurchaseOrder").disabled = !purchaseDraft.length || !supplierSelect.value;

        const orders = [...state.purchaseOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
        byId("purchaseCount").textContent = `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"}`;
        byId("purchaseOrdersBody").innerHTML = orders.map(order => {
          const received = order.status === "recibido";
          return `<tr><td class="sale-id">#${safe(order.id)}</td><td>${formatDate(order.date)}</td><td>${safe(order.supplierName)}</td><td>${itemsQuantity(order.items)}</td><td><strong>${money(order.total)}</strong></td><td><span class="status ${received ? "" : "pending-status"}">${received ? "Recibido" : "Pendiente"}</span></td><td>${received ? `<span class="count-label">Existencias actualizadas</span>` : `<button class="button subtle receive-order" type="button" data-receive-order="${safe(order.id)}">Recibir pedido</button>`}</td></tr>`;
        }).join("") || `<tr><td colspan="7" class="empty-state">Todavía no hay pedidos. Crea uno para registrar una compra.</td></tr>`;
      };
      const renderCategories = () => {
        const categories = [...new Set(state.products.map(product => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
        const select = byId("inventoryCategory");
        const current = select.value;
        select.innerHTML = `<option value="">Todas las categorías</option>${categories.map(category => `<option value="${safe(category)}">${safe(category)}</option>`).join("")}`;
        select.value = categories.includes(current) ? current : "";
        byId("categoryOptions").innerHTML = categories.map(category => `<option value="${safe(category)}"></option>`).join("");
        const tabValues = ["Todos", ...categories];
        if (!tabValues.includes(activeCategory)) activeCategory = "Todos";
        byId("categoryTabs").innerHTML = tabValues.map(category => `<button class="category-tab ${category === activeCategory ? "active" : ""}" data-category="${safe(category)}">${safe(category)}</button>`).join("");
      };
      const renderPOSProducts = () => {
        const query = byId("posSearch").value.trim().toLocaleLowerCase("es");
        const products = state.products.filter(product => (!query || `${product.name} ${product.code}`.toLocaleLowerCase("es").includes(query)) && (activeCategory === "Todos" || product.category === activeCategory));
        byId("posProductCount").textContent = `${products.length} productos`;
        byId("posProductGrid").innerHTML = products.map(product => `<button class="pos-product" data-add="${safe(product.id)}" ${Number(product.stock) <= 0 ? "disabled" : ""}><span class="product-photo"><img src="${safe(productImage(product))}" alt="" loading="lazy" onerror="this.hidden=true"><span class="emoji" aria-hidden="true">${safe(product.emoji || "📦")}</span>${Number(product.stock) <= Number(product.minStock) ? `<span class="photo-stock ${Number(product.stock) <= 3 ? "critical" : ""}">${Number(product.stock) <= 0 ? "Agotado" : Number(product.stock) <= 3 ? "Últimas piezas" : "Pocas piezas"}</span>` : ""}</span><span class="pos-product-body"><strong>${safe(product.name)}</strong><small>${safe(product.category)} · ${Number(product.stock)} disponibles</small><span class="price">${money(product.price)} <em>Agregar +</em></span></span></button>`).join("") || `<div class="empty-state" style="grid-column:1/-1">No hay productos que coincidan con tu búsqueda.</div>`;
      };
      const addProductToCart = product => {
        if (!product || Number(product.stock) <= 0) return;
        const item = cart.find(entry => entry.id === product.id);
        if ((item ? item.qty : 0) >= Number(product.stock)) { showToast(`No hay más existencias de ${product.name}.`); return; }
        if (item) item.qty++;
        else cart.push({ id: product.id, name: product.name, price: Number(product.price), qty: 1, emoji: product.emoji || "📦" });
        renderCart();
      };
      const renderCart = () => {
        const quantity = itemsQuantity(cart);
        const total = roundMoney(cart.reduce((sum, item) => sum + item.qty * item.price, 0));
        const cash = roundMoney(byId("cashReceived").value);
        byId("cartCount").textContent = quantity;
        byId("clearCartButton").disabled = cart.length === 0;
        byId("cashPresets").querySelectorAll("[data-cash]").forEach(button => {
          button.disabled = !cart.length || (button.dataset.cash !== "exact" && Number(button.dataset.cash) < total);
        });
        byId("cartItems").innerHTML = cart.length ? cart.map(item => {
          const product = state.products.find(entry => entry.id === item.id);
          return `<div class="cart-row"><span class="cart-thumb">${product ? photoMarkup(product, "cart-product-photo") : safe(item.emoji || "📦")}</span><div class="cart-item-info"><div class="cart-item-name">${safe(item.name)}</div><div class="cart-item-price">${money(item.price)} c/u · ${money(item.qty * item.price)}</div></div><div class="quantity"><button data-qty="${safe(item.id)}" data-delta="-1" aria-label="Quitar una unidad">−</button><strong>${item.qty}</strong><button data-qty="${safe(item.id)}" data-delta="1" aria-label="Agregar una unidad">+</button></div></div>`;
        }).join("") : `<div class="cart-empty"><div><span>🛒</span>Tu venta está vacía.<br>Agrega productos del catálogo.</div></div>`;
        byId("cartSubtotal").textContent = money(total);
        byId("cartTotal").textContent = money(total);
        byId("changeAmount").textContent = money(Math.max(0, roundMoney(cash - total)));
        byId("checkoutButton").disabled = cart.length === 0 || cash < total;
      };
      const reportDates = () => {
        const period = byId("reportPeriod").value;
        const endInput = byId("reportEndDate").value;
        const startInput = byId("reportStartDate").value;
        let start = null;
        let end = null;
        if (startInput || endInput) {
          start = startInput || "0000-01-01";
          end = endInput || "9999-12-31";
        } else if (period === "today") start = end = todayKey();
        else if (period === "week") { start = dateOffset(-6); end = todayKey(); }
        else if (period === "month") {
          const now = new Date();
          start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
          end = todayKey();
        }
        return { start, end };
      };
      const filteredSales = () => {
        const { start, end } = reportDates();
        return state.sales.filter(sale => {
          const day = dateKey(sale.date);
          return (!start || day >= start) && (!end || day <= end);
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
      };
      const renderReports = () => {
        const sales = filteredSales();
        const revenue = roundMoney(sales.reduce((sum, sale) => sum + Number(sale.total), 0));
        byId("reportRevenue").textContent = money(revenue);
        byId("reportSaleCount").textContent = sales.length;
        byId("reportAverage").textContent = money(sales.length ? revenue / sales.length : 0);
        byId("reportsSummary").textContent = `${sales.length} ${sales.length === 1 ? "venta encontrada" : "ventas encontradas"}`;
        byId("reportsBody").innerHTML = sales.map(sale => `<tr><td class="sale-id">#${safe(sale.id)}</td><td>${formatDate(sale.date)} · ${formatTime(sale.date)}</td><td>${safe(sale.cashier || "Caja Miranda")}</td><td class="sale-product">${(sale.items || []).map(item => safe(item.name)).join(", ")}</td><td>${itemsQuantity(sale.items)}</td><td><strong>${money(sale.total)}</strong></td><td><button class="mini-icon" data-ticket="${safe(sale.id)}" title="Imprimir ticket" aria-label="Imprimir ticket ${safe(sale.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg></button></td></tr>`).join("") || `<tr><td colspan="7" class="empty-state">No hay ventas en el periodo seleccionado.</td></tr>`;
      };
      const renderAll = () => {
        renderDashboard(); renderCategories(); renderInventory(); renderPOSProducts(); renderCart(); renderReports(); renderPurchases();
      };
      const switchView = name => {
        document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
        document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === name));
        const labels = { dashboard: "Resumen", inventory: "Inventario", purchases: "Compras", pos: "Punto de venta", reports: "Reportes" };
        byId("breadcrumb").textContent = labels[name] || "Resumen";
        setMobileMenu(false);
        if (name === "dashboard") requestAnimationFrame(() => drawChart(byId("chartPeriod").value));
      };
      const openProductModal = product => {
        byId("productForm").reset();
        byId("editProductId").value = product ? product.id : "";
        byId("modalTitle").textContent = product ? "Editar producto" : "Agregar producto";
        byId("productName").value = product ? product.name : "";
        byId("productCode").value = product ? product.code : "";
        byId("productCategory").value = product ? product.category : "";
        byId("productPreviewImage").src = product ? productImage(product) : imageForCategory("");
        byId("productCost").value = product ? product.cost : "";
        byId("productPrice").value = product ? product.price : "";
        byId("productStock").value = product ? product.stock : "";
        byId("productMinimum").value = product ? product.minStock : "";
        byId("productModal").classList.add("open");
        setTimeout(() => byId("productName").focus(), 40);
      };
      const closeModals = () => document.querySelectorAll(".modal-backdrop.open").forEach(modal => modal.classList.remove("open"));
      const escapeHtml = safe;
      const printTicket = sale => {
        const popup = window.open("", "_blank", "width=420,height=700");
        if (!popup) { showToast("Permite las ventanas emergentes para imprimir el ticket."); return; }
        const lines = sale.items.map(item => `<tr><td>${escapeHtml(item.name)}<br><small>${item.qty} × ${money(item.price)}</small></td><td style="text-align:right">${money(item.qty * item.price)}</td></tr>`).join("");
        popup.document.write(`<!doctype html><html lang="es"><meta charset="utf-8"><title>Ticket ${escapeHtml(sale.id)}</title><style>body{width:300px;margin:25px auto;color:#222;font:12px Arial,sans-serif}header{text-align:center;border-bottom:1px dashed #aaa;padding-bottom:14px}h1{font-size:21px;margin:0 0 5px}p{margin:4px 0;color:#555}table{width:100%;margin:16px 0;border-collapse:collapse}td{padding:7px 0;vertical-align:top}small{color:#777}.total{display:flex;justify-content:space-between;padding-top:10px;border-top:1px dashed #aaa;font-weight:bold;font-size:16px}.thanks{text-align:center;margin-top:24px;color:#555}@media print{body{margin:0 auto}}</style><body><header><h1>MINISUPER MIRANDA</h1><p>TIENDA DE CONFIANZA</p><p>Ticket ${escapeHtml(sale.id)}</p><p>${formatDate(sale.date)} · ${formatTime(sale.date)}</p><p>Atendió: ${escapeHtml(sale.cashier)}</p></header><table>${lines}</table><div class="total"><span>TOTAL</span><span>${money(sale.total)}</span></div><p style="display:flex;justify-content:space-between"><span>Efectivo</span><span>${money(sale.cash)}</span></p><p style="display:flex;justify-content:space-between"><span>Cambio</span><span>${money(sale.change)}</span></p><div class="thanks">¡Gracias por tu compra!<br>Vuelve pronto ✦</div><script>window.onload=()=>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
        popup.document.close();
      };
      const storeSupabaseSession = () => {
        try {
          if (supabaseSession) localStorage.setItem(SUPABASE_SESSION_KEY, JSON.stringify(supabaseSession));
          else localStorage.removeItem(SUPABASE_SESSION_KEY);
        } catch (error) {
          console.error("No se pudo guardar la sesión de Supabase:", error);
          showToast("La sesión no se pudo guardar; tendrás que iniciar sesión de nuevo.");
        }
      };
      const saveLocalSnapshot = () => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          localStorage.setItem(SUPABASE_PENDING_KEY, "false");
        } catch (error) {
          console.error("No se pudieron guardar los datos sincronizados de Minisuper Miranda:", error);
          showToast("Supabase se actualizó, pero no se pudo guardar el respaldo local.");
        }
      };
      const syncRemoteState = () => {
        if (!supabaseClient) return;
        remoteSaveQueue = remoteSaveQueue.then(async () => {
          const snapshot = JSON.parse(JSON.stringify(state));
          const result = await supabaseClient.save(snapshot, databaseRevision);
          databaseRevision = Number(result.revision);
          supabaseSession = supabaseClient.getSession();
          storeSupabaseSession();
          saveLocalSnapshot();
          updateConnection("connected");
        }).catch(error => {
          console.error("No se pudieron sincronizar los datos con Supabase:", error);
          updateConnection("error");
          showToast(`No se sincronizó con Supabase: ${error.message}`);
        });
      };
      const storeSupabaseSettings = (url, key) => {
        try {
          localStorage.setItem(SUPABASE_URL_KEY, url);
          localStorage.setItem(SUPABASE_PUBLIC_KEY, key);
        } catch (error) {
          console.error("No se pudo guardar la configuración de Supabase:", error);
          showToast("No se pudo guardar la configuración en este navegador.");
        }
      };
      const normalizeRemoteState = value => {
        if (!value || !Array.isArray(value.products) || !Array.isArray(value.sales)) {
          throw new Error("La fila de Supabase tiene un formato de datos no válido.");
        }
        return {
          ...value,
          suppliers: Array.isArray(value.suppliers) ? value.suppliers : [],
          purchaseOrders: Array.isArray(value.purchaseOrders) ? value.purchaseOrders : [],
          movements: Array.isArray(value.movements) ? value.movements : []
        };
      };
      const applySuggestedPrices = products => {
        const updated = [];
        products.forEach(product => {
          const suggestion = SUGGESTED_PRICE_UPDATES[product.id];
          if (!suggestion || product.code !== suggestion.code || Number(product.price) !== suggestion.previous) return;
          product.price = suggestion.next;
          updated.push(product.name);
        });
        return updated;
      };
      const connectSupabase = async (url, key, email, password) => {
        const client = window.NativaSupabase.createClient(url, key);
        updateConnection("connecting");
        await client.signIn(email, password);
        const remote = await client.load();
        const revision = Number(remote.revision);
        let nextState = normalizeRemoteState(remote.state);

        if (revision === 0 && !Object.values(nextState).some(items => items.length)) {
          const initialize = window.confirm(
            `Supabase está vacío. ¿Importar ${state.products.length} productos locales como catálogo inicial? Se excluirán las ventas de demostración y se conservarán las ventas reales guardadas en este navegador.`
          );
          if (!initialize) throw new Error("Conexión cancelada; no se modificaron los datos locales ni la base.");
          nextState = {
            products: JSON.parse(JSON.stringify(state.products)),
            sales: state.sales.filter(sale => !sampleSales.some(sample => sample.id === sale.id)).map(sale => ({ ...sale, items: sale.items.map(item => ({ ...item })) })),
            suppliers: JSON.parse(JSON.stringify(state.suppliers)),
            purchaseOrders: JSON.parse(JSON.stringify(state.purchaseOrders)),
            movements: JSON.parse(JSON.stringify(state.movements))
          };
          const result = await client.save(nextState, revision);
          databaseRevision = Number(result.revision);
        } else {
          if (hasLocalSnapshot && !window.confirm("La base de Supabase ya tiene datos. ¿Cargarla y reemplazar los datos locales de este navegador?")) {
            throw new Error("Conexión cancelada; se conservaron los datos locales.");
          }
          databaseRevision = revision;
        }

        const updatedPrices = applySuggestedPrices(nextState.products);
        if (updatedPrices.length) {
          const result = await client.save(JSON.parse(JSON.stringify(nextState)), databaseRevision);
          databaseRevision = Number(result.revision);
        }
        state = nextState;
        supabaseClient = client;
        supabaseSession = client.getSession();
        storeSupabaseSettings(url, key);
        storeSupabaseSession();
        saveLocalSnapshot();
        renderAll();
        updateConnection("connected");
        byId("supabasePassword").value = "";
        byId("supabaseSignOutButton").hidden = false;
        closeModals();
        showToast(updatedPrices.length
          ? `Conectado. Se actualizaron ${updatedPrices.length} precios de muestra; las ventas anteriores no cambiaron.`
          : "Conectado a Supabase.");
      };
      const restoreSupabaseConnection = async (url, key, savedSession) => {
        const client = window.NativaSupabase.createClient(url, key);
        await client.restoreSession(savedSession);
        const remote = await client.load();
        if (localStorage.getItem(SUPABASE_PENDING_KEY) === "true"
          && !window.confirm("Hay cambios locales pendientes de sincronización. ¿Cargar la versión de Supabase y descartar esos cambios locales?")) {
          client.setSession(null);
          return;
        }
        const nextState = normalizeRemoteState(remote.state);
        databaseRevision = Number(remote.revision);
        const updatedPrices = applySuggestedPrices(nextState.products);
        if (updatedPrices.length) {
          const result = await client.save(JSON.parse(JSON.stringify(nextState)), databaseRevision);
          databaseRevision = Number(result.revision);
        }
        state = nextState;
        supabaseClient = client;
        supabaseSession = client.getSession();
        storeSupabaseSession();
        saveLocalSnapshot();
        renderAll();
        updateConnection("connected");
        if (updatedPrices.length) {
          showToast(`Se actualizaron ${updatedPrices.length} precios de muestra; las ventas anteriores no cambiaron.`);
        }
      };
      const showConnectionError = error => {
        console.error("No se pudo conectar con Supabase:", error);
        updateConnection(supabaseClient ? "error" : "local");
        showToast(`No se pudo conectar: ${error.message}`);
      };

      document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
      document.querySelectorAll("[data-goto]").forEach(button => button.addEventListener("click", () => switchView(button.dataset.goto)));
      byId("menuToggle").addEventListener("click", () => setMobileMenu(!byId("sidebar").classList.contains("open")));
      byId("mobileScrim").addEventListener("click", () => setMobileMenu(false));
      byId("helpButton").addEventListener("click", () => byId("helpModal").classList.add("open"));
      byId("configureSupabaseButton").addEventListener("click", () => {
        try {
          byId("supabaseUrl").value = localStorage.getItem(SUPABASE_URL_KEY) || "";
          byId("supabaseKey").value = localStorage.getItem(SUPABASE_PUBLIC_KEY) || "";
        } catch (error) {
          console.error("No se pudo leer la configuración guardada de Supabase:", error);
          showToast("No se pudo leer la configuración guardada de Supabase.");
        }
        byId("supabaseSignOutButton").hidden = !supabaseClient;
        byId("supabaseModal").classList.add("open");
      });
      byId("supabaseForm").addEventListener("submit", async event => {
        event.preventDefault();
        const button = byId("connectSupabaseButton");
        button.disabled = true;
        try {
          await connectSupabase(
            byId("supabaseUrl").value.trim(),
            byId("supabaseKey").value.trim(),
            byId("supabaseEmail").value.trim(),
            byId("supabasePassword").value
          );
        } catch (error) {
          showConnectionError(error);
        } finally {
          button.disabled = false;
        }
      });
      byId("supabaseSignOutButton").addEventListener("click", async () => {
        try {
          if (supabaseClient) await supabaseClient.signOut();
        } catch (error) {
          console.error("No se pudo cerrar la sesión remota de Supabase:", error);
        }
        if (supabaseClient) supabaseClient.setSession(null);
        supabaseClient = null;
        supabaseSession = null;
        databaseRevision = 0;
        try { localStorage.removeItem(SUPABASE_SESSION_KEY); }
        catch (error) { console.error("No se pudo borrar la sesión de Supabase:", error); }
        byId("supabaseSignOutButton").hidden = true;
        closeModals();
        updateConnection("local");
        showToast("Sesión de Supabase cerrada; los datos locales se conservaron.");
      });
      byId("addSupplierButton").addEventListener("click", () => {
        byId("supplierForm").reset();
        byId("editSupplierId").value = "";
        byId("supplierModalTitle").textContent = "Agregar proveedor";
        byId("supplierName").setCustomValidity("");
        byId("supplierModal").classList.add("open");
        setTimeout(() => byId("supplierName").focus(), 40);
      });
      byId("supplierList").addEventListener("click", event => {
        const editButton = event.target.closest("[data-edit-supplier]");
        const deleteButton = event.target.closest("[data-delete-supplier]");
        if (editButton) {
          const supplier = state.suppliers.find(item => item.id === editButton.dataset.editSupplier);
          if (!supplier) return;
          byId("supplierForm").reset();
          byId("editSupplierId").value = supplier.id;
          byId("supplierModalTitle").textContent = "Editar proveedor";
          byId("supplierName").value = supplier.name;
          byId("supplierContact").value = supplier.contact;
          byId("supplierPhone").value = supplier.phone;
          byId("supplierEmail").value = supplier.email;
          byId("supplierAddress").value = supplier.address;
          byId("supplierNotes").value = supplier.notes;
          byId("supplierName").setCustomValidity("");
          byId("supplierModal").classList.add("open");
          setTimeout(() => byId("supplierName").focus(), 40);
          return;
        }
        if (deleteButton) {
          const supplier = state.suppliers.find(item => item.id === deleteButton.dataset.deleteSupplier);
          if (!supplier) return;
          if (state.purchaseOrders.some(order => order.supplierId === supplier.id)) {
            showToast("No se puede eliminar: el proveedor tiene pedidos asociados.");
            return;
          }
          if (!window.confirm(`¿Eliminar al proveedor "${supplier.name}"?`)) return;
          state.suppliers = state.suppliers.filter(item => item.id !== supplier.id);
          persist();
          renderAll();
          showToast("Proveedor eliminado.");
        }
      });
      byId("supplierForm").addEventListener("submit", event => {
        event.preventDefault();
        const id = byId("editSupplierId").value;
        const name = byId("supplierName").value.trim();
        if (state.suppliers.some(supplier => supplier.id !== id && supplier.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
          byId("supplierName").setCustomValidity("Ya existe un proveedor con ese nombre.");
          byId("supplierName").reportValidity();
          return;
        }
        const supplier = {
          id: id || createId("pr"), name, contact: byId("supplierContact").value.trim(),
          phone: byId("supplierPhone").value.trim(), email: byId("supplierEmail").value.trim(),
          address: byId("supplierAddress").value.trim(), notes: byId("supplierNotes").value.trim()
        };
        byId("supplierName").setCustomValidity("");
        if (id) state.suppliers = state.suppliers.map(item => item.id === id ? supplier : item);
        else state.suppliers.unshift(supplier);
        persist();
        renderAll();
        closeModals();
        byId("purchaseSupplier").value = supplier.id;
        renderPurchases();
        showToast(`Proveedor "${supplier.name}" ${id ? "actualizado" : "guardado"}.`);
      });
      byId("supplierName").addEventListener("input", event => event.target.setCustomValidity(""));
      byId("purchaseProduct").addEventListener("change", event => {
        const product = state.products.find(item => item.id === event.target.value);
        byId("purchaseCost").value = product ? Number(product.cost).toFixed(2) : "";
      });
      byId("addPurchaseItem").addEventListener("click", () => {
        const product = state.products.find(item => item.id === byId("purchaseProduct").value);
        const quantity = Number(byId("purchaseQuantity").value);
        const cost = Number(byId("purchaseCost").value);
        if (!product) { showToast("Selecciona un producto para el pedido."); return; }
        if (!Number.isInteger(quantity) || quantity < 1) { showToast("La cantidad debe ser un número entero mayor que cero."); return; }
        if (!Number.isFinite(cost) || cost < 0) { showToast("Captura un costo unitario válido."); return; }
        purchaseDraft.push({ productId: product.id, name: product.name, qty: quantity, cost: roundMoney(cost) });
        byId("purchaseProduct").value = "";
        byId("purchaseQuantity").value = "1";
        byId("purchaseCost").value = "";
        renderPurchases();
      });
      byId("purchaseDraftBody").addEventListener("click", event => {
        const button = event.target.closest("[data-remove-purchase-item]");
        if (!button) return;
        purchaseDraft.splice(Number(button.dataset.removePurchaseItem), 1);
        renderPurchases();
      });
      byId("purchaseSupplier").addEventListener("change", renderPurchases);
      byId("createPurchaseOrder").addEventListener("click", () => {
        const supplier = state.suppliers.find(item => item.id === byId("purchaseSupplier").value);
        if (!supplier || !purchaseDraft.length) { showToast("Selecciona un proveedor y agrega al menos un producto."); return; }
        const items = purchaseDraft.map(item => ({ ...item }));
        const order = {
          id: createId("PC"), supplierId: supplier.id, supplierName: supplier.name,
          date: new Date().toISOString(), status: "pendiente",
          total: roundMoney(items.reduce((sum, item) => sum + item.qty * item.cost, 0)),
          receivedAt: "", items
        };
        state.purchaseOrders.unshift(order);
        purchaseDraft = [];
        persist();
        renderAll();
        showToast(`Pedido ${order.id} guardado. El inventario cambiará al recibirlo.`);
      });
      byId("purchaseOrdersBody").addEventListener("click", event => {
        const button = event.target.closest("[data-receive-order]");
        if (!button) return;
        const order = state.purchaseOrders.find(item => item.id === button.dataset.receiveOrder);
        if (!order || order.status === "recibido") return;
        const missing = order.items.find(item => !state.products.some(product => product.id === item.productId));
        if (missing) { showToast(`No se puede recibir: "${missing.name}" ya no está en el inventario.`); return; }
        if (!window.confirm(`¿Marcar el pedido ${order.id} como recibido y sumar ${itemsQuantity(order.items)} unidades al inventario?`)) return;
        order.items.forEach(item => {
          const product = state.products.find(entry => entry.id === item.productId);
          const before = Number(product.stock);
          product.stock = before + Number(item.qty);
          product.cost = Number(item.cost);
          addInventoryMovement(product, "compra", Number(item.qty), before, order.id, `Recepción de ${order.supplierName}`);
        });
        order.status = "recibido";
        order.receivedAt = new Date().toISOString();
        persist();
        renderAll();
        showToast(`Pedido ${order.id} recibido; inventario actualizado.`);
      });
      document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeModals));
      document.querySelectorAll(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModals(); }));
      document.addEventListener("keydown", event => {
        if (event.key === "Escape") { closeModals(); setMobileMenu(false); return; }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          switchView("pos");
          byId("posSearch").focus();
          return;
        }
        if (!byId("view-pos").classList.contains("active")) return;
        if (event.key === "F2") { event.preventDefault(); byId("posSearch").focus(); }
        if (event.key === "F4") { event.preventDefault(); byId("cashReceived").focus(); }
        if (event.key === "F8" && !byId("checkoutButton").disabled) { event.preventDefault(); byId("checkoutButton").click(); }
      });
      byId("chartPeriod").addEventListener("change", event => drawChart(event.target.value));
      window.addEventListener("resize", () => { if (byId("view-dashboard").classList.contains("active")) drawChart(byId("chartPeriod").value); });
      ["inventorySearch", "inventoryCategory", "stockFilter"].forEach(id => byId(id).addEventListener("input", renderInventory));
      byId("inventoryCategory").addEventListener("change", renderInventory);
      byId("posSearch").addEventListener("input", renderPOSProducts);
      byId("posSearch").addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        const code = event.currentTarget.value.trim().toLocaleLowerCase("es");
        const product = state.products.find(item => String(item.code).trim().toLocaleLowerCase("es") === code);
        if (!product) return;
        event.preventDefault();
        addProductToCart(product);
        event.currentTarget.value = "";
        renderPOSProducts();
      });
      byId("categoryTabs").addEventListener("click", event => {
        const button = event.target.closest("[data-category]");
        if (!button) return;
        activeCategory = button.dataset.category;
        renderCategories(); renderPOSProducts();
      });
      byId("posProductGrid").addEventListener("click", event => {
        const button = event.target.closest("[data-add]");
        if (!button) return;
        const product = state.products.find(item => item.id === button.dataset.add);
        addProductToCart(product);
      });
      byId("cartItems").addEventListener("click", event => {
        const button = event.target.closest("[data-qty]");
        if (!button) return;
        const product = state.products.find(item => item.id === button.dataset.qty);
        const item = cart.find(entry => entry.id === button.dataset.qty);
        if (!item) return;
        const next = item.qty + Number(button.dataset.delta);
        if (next > Number(product?.stock || 0)) { showToast(`Solo hay ${Number(product.stock)} unidades disponibles.`); return; }
        if (next <= 0) cart = cart.filter(entry => entry.id !== item.id);
        else item.qty = next;
        renderCart();
      });
      byId("clearCartButton").addEventListener("click", () => {
        cart = [];
        byId("cashReceived").value = "";
        renderCart();
      });
      byId("cashPresets").addEventListener("click", event => {
        const button = event.target.closest("[data-cash]");
        if (!button || button.disabled) return;
        const total = roundMoney(cart.reduce((sum, item) => sum + item.qty * item.price, 0));
        byId("cashReceived").value = button.dataset.cash === "exact" ? total.toFixed(2) : button.dataset.cash;
        renderCart();
      });
      byId("cashReceived").addEventListener("input", renderCart);
      byId("checkoutButton").addEventListener("click", () => {
        if (!cart.length) return;
        const total = roundMoney(cart.reduce((sum, item) => sum + item.qty * item.price, 0));
        const cash = roundMoney(byId("cashReceived").value);
        if (!Number.isFinite(cash) || cash < total) { showToast("El efectivo recibido no alcanza para completar la venta."); return; }
        for (const item of cart) {
          const product = state.products.find(entry => entry.id === item.id);
          if (!product || Number(product.stock) < item.qty) { showToast(`Existencias insuficientes para ${item.name}. Revisa la venta.`); return; }
        }
        const sale = { id: createId("NV"), date: new Date().toISOString(), cashier: "Caja Miranda", items: cart.map(item => ({ productId: item.id, name: item.name, qty: item.qty, price: item.price, emoji: item.emoji })), total, cash, change: roundMoney(cash - total) };
        cart.forEach(item => {
          const product = state.products.find(entry => entry.id === item.id);
          const before = Number(product.stock);
          product.stock = before - item.qty;
          addInventoryMovement(product, "venta", -item.qty, before, sale.id, `Venta en caja`);
        });
        state.sales.unshift(sale);
        persist();
        cart = [];
        byId("cashReceived").value = "";
        renderAll();
        showToast(`Venta ${sale.id} registrada. ¡Gracias!`);
        switchView("dashboard");
        printTicket(sale);
      });
      byId("addProductButton").addEventListener("click", () => openProductModal(null));
      byId("inventoryBody").addEventListener("click", event => {
        const restockButton = event.target.closest("[data-restock]");
        const editButton = event.target.closest("[data-edit]");
        const deleteButton = event.target.closest("[data-delete]");
        if (restockButton) {
          const product = state.products.find(item => item.id === restockButton.dataset.restock);
          if (product) {
            const before = Number(product.stock);
            product.stock = Number(product.stock) + 10;
            addInventoryMovement(product, "ajuste", 10, before, "Ajuste manual", "Reposición rápida de 10 unidades");
            persist(); renderAll(); showToast(`${product.name}: 10 unidades agregadas al inventario.`);
          }
        } else if (editButton) {
          const product = state.products.find(item => item.id === editButton.dataset.edit);
          if (product) openProductModal(product);
        } else if (deleteButton) {
          const product = state.products.find(item => item.id === deleteButton.dataset.delete);
          if (product && window.confirm(`¿Eliminar "${product.name}" del inventario? Esta acción no se puede deshacer.`)) {
            if (Number(product.stock) !== 0) addInventoryMovement(product, "baja", -Number(product.stock), Number(product.stock), "Baja de producto", "Producto eliminado del catálogo");
            state.products = state.products.filter(item => item.id !== product.id);
            cart = cart.filter(item => item.id !== product.id);
            persist(); renderAll(); showToast("Producto eliminado del inventario.");
          }
        }
      });
      byId("productForm").addEventListener("submit", event => {
        event.preventDefault();
        const id = byId("editProductId").value;
        const code = byId("productCode").value.trim();
        const existing = state.products.find(product => product.code.toLocaleLowerCase("es") === code.toLocaleLowerCase("es") && product.id !== id);
        if (existing) { byId("productCode").setCustomValidity("Ya existe un producto con ese código."); byId("productCode").reportValidity(); return; }
        byId("productCode").setCustomValidity("");
        const original = state.products.find(product => product.id === id);
        const product = {
          id: id || createId("p"), code, name: byId("productName").value.trim(), category: byId("productCategory").value.trim(),
          cost: Number(byId("productCost").value), price: Number(byId("productPrice").value), stock: Number(byId("productStock").value),
          minStock: Number(byId("productMinimum").value), emoji: original?.emoji || "📦"
        };
        if (id) {
          state.products = state.products.map(item => item.id === id ? product : item);
          const quantityChange = product.stock - Number(original.stock);
          if (quantityChange) addInventoryMovement(product, "ajuste", quantityChange, Number(original.stock), "Edición de producto", "Existencias modificadas desde inventario");
        } else {
          state.products.unshift(product);
          if (product.stock) addInventoryMovement(product, "alta", product.stock, 0, "Alta de producto", "Existencias iniciales");
        }
        persist(); closeModals(); renderAll(); showToast(id ? "Producto actualizado correctamente." : "Producto agregado al inventario.");
      });
      byId("productCode").addEventListener("input", event => event.target.setCustomValidity(""));
      byId("productCategory").addEventListener("input", event => { byId("productPreviewImage").src = imageForCategory(event.target.value); });
      byId("reportPeriod").addEventListener("change", () => { byId("reportStartDate").value = ""; byId("reportEndDate").value = ""; renderReports(); });
      ["reportStartDate", "reportEndDate"].forEach(id => byId(id).addEventListener("change", renderReports));
      byId("printReport").addEventListener("click", () => window.print());
      byId("exportCsv").addEventListener("click", () => {
        const sales = filteredSales();
        const rows = [["ID de venta", "Fecha", "Atendió", "Productos", "Unidades", "Total", "Efectivo", "Cambio"], ...sales.map(sale => [sale.id, new Date(sale.date).toLocaleString("es-MX"), sale.cashier, sale.items.map(item => `${item.qty} x ${item.name}`).join(" | "), itemsQuantity(sale.items), Number(sale.total).toFixed(2), Number(sale.cash).toFixed(2), Number(sale.change).toFixed(2)])];
        const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
        const link = document.createElement("a");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        link.href = url; link.download = `minisuper-miranda-ventas-${todayKey()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
        showToast("Reporte CSV descargado.");
      });
      byId("reportsBody").addEventListener("click", event => {
        const button = event.target.closest("[data-ticket]");
        if (!button) return;
        const sale = state.sales.find(item => item.id === button.dataset.ticket);
        if (sale) printTicket(sale);
      });
      byId("resetDemo").addEventListener("click", () => {
        if (supabaseClient) { showToast("Cierra la sesión de Supabase antes de restablecer los datos locales."); return; }
        if (!window.confirm("¿Restablecer el inventario y las ventas de demostración? Se perderán tus cambios guardados en este navegador.")) return;
        localStorage.removeItem(STORAGE_KEY);
        state = loadState(); cart = []; purchaseDraft = []; byId("cashReceived").value = ""; renderAll(); showToast("Datos locales de demostración restablecidos.");
      });
      byId("todayLabel").textContent = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date()).replace(/\./g, "");
      byId("greetingLine").textContent = `${new Intl.DateTimeFormat("es-MX", { weekday: "long" }).format(new Date())}, un buen día para vender`;
      renderAll();
      updateConnection("local");
      try {
        localStorage.removeItem("nativa-minisuper-apps-script-url");
        localStorage.removeItem("nativa-minisuper-apps-script-token");
        localStorage.removeItem("nativa-minisuper-sheets-revision");
        localStorage.removeItem("nativa-minisuper-sheets-pending");
        const savedUrl = localStorage.getItem(SUPABASE_URL_KEY);
        const savedKey = localStorage.getItem(SUPABASE_PUBLIC_KEY);
        const savedSession = JSON.parse(localStorage.getItem(SUPABASE_SESSION_KEY) || "null");
        if (savedUrl && savedKey && savedSession) {
          restoreSupabaseConnection(savedUrl, savedKey, savedSession).catch(showConnectionError);
        }
      } catch (error) {
        console.error("No se pudo restaurar la conexión con Supabase:", error);
        showConnectionError(error);
      }
      if ("serviceWorker" in navigator && window.isSecureContext && location.protocol !== "file:") {
        navigator.serviceWorker.register("service-worker.js").catch(error => console.error("No se pudo habilitar el modo sin conexión:", error));
      }
    })();
