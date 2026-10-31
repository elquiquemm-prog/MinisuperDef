window.NativaDemoData = {
  products: [
        { id: "p1", code: "7501055300078", name: "Leche entera 1 L", category: "Lácteos", cost: 20.5, price: 26, stock: 5, minStock: 8, emoji: "🥛", image: "assets/photos/leche.jpg" },
        { id: "p2", code: "7501000111123", name: "Pan de caja clásico", category: "Panadería", cost: 28, price: 39, stock: 4, minStock: 6, emoji: "🍞", image: "assets/photos/pan.jpg" },
        { id: "p3", code: "7501030422011", name: "Café molido 250 g", category: "Abarrotes", cost: 54, price: 69, stock: 13, minStock: 5, emoji: "☕", image: "assets/photos/cafe.jpg" },
        { id: "p4", code: "7501055300214", name: "Huevo blanco 12 pzas", category: "Lácteos", cost: 35, price: 42, stock: 8, minStock: 7, emoji: "🥚", image: "assets/photos/huevo.jpg" },
        { id: "p5", code: "7501000123004", name: "Arroz 1 kg", category: "Abarrotes", cost: 21, price: 28, stock: 22, minStock: 8, emoji: "🍚", image: "assets/photos/arroz.jpg" },
        { id: "p6", code: "7501031311308", name: "Jugo de naranja 1 L", category: "Bebidas", cost: 24, price: 30, stock: 3, minStock: 6, emoji: "🍊", image: "assets/photos/jugo.jpg" },
        { id: "p7", code: "7501055300054", name: "Yogur natural 1 L", category: "Lácteos", cost: 27, price: 34, stock: 11, minStock: 5, emoji: "🥣", image: "assets/photos/yogur.jpg" },
        { id: "p8", code: "7501000119884", name: "Galletas de avena", category: "Panadería", cost: 13, price: 17, stock: 17, minStock: 5, emoji: "🍪", image: "assets/photos/galletas.jpg" },
        { id: "p9", code: "7501031312459", name: "Agua natural 1.5 L", category: "Bebidas", cost: 9, price: 14, stock: 30, minStock: 10, emoji: "💧", image: "assets/photos/agua.jpg" },
        { id: "p10", code: "7501000124025", name: "Frijol negro 900 g", category: "Abarrotes", cost: 23, price: 32, stock: 2, minStock: 7, emoji: "🫘", image: "assets/photos/frijol.jpg" },
        { id: "p11", code: "7501055300306", name: "Queso panela 400 g", category: "Lácteos", cost: 46, price: 55, stock: 9, minStock: 5, emoji: "🧀", image: "assets/photos/queso.jpg" },
        { id: "p12", code: "7501031310806", name: "Refresco cola 600 ml", category: "Bebidas", cost: 12, price: 18, stock: 24, minStock: 8, emoji: "🥤", image: "assets/photos/refresco.jpg" }
  ],
  sales: [
        { id: "NV-1048", date: new Date().toISOString(), cashier: "Caja Miranda", items: [{ productId: "p1", name: "Leche entera 1 L", qty: 2, price: 26, emoji: "🥛" }, { productId: "p5", name: "Arroz 1 kg", qty: 1, price: 28, emoji: "🍚" }], total: 80, cash: 100, change: 20 },
        { id: "NV-1047", date: new Date(Date.now() - 1000 * 60 * 38).toISOString(), cashier: "Caja Miranda", items: [{ productId: "p3", name: "Café molido 250 g", qty: 1, price: 69, emoji: "☕" }, { productId: "p8", name: "Galletas de avena", qty: 2, price: 17, emoji: "🍪" }], total: 103, cash: 150, change: 47 },
        { id: "NV-1046", date: new Date(Date.now() - 1000 * 60 * 105).toISOString(), cashier: "Caja Miranda", items: [{ productId: "p9", name: "Agua natural 1.5 L", qty: 3, price: 14, emoji: "💧" }, { productId: "p7", name: "Yogur natural 1 L", qty: 1, price: 34, emoji: "🥣" }], total: 76, cash: 100, change: 24 },
        { id: "NV-1045", date: new Date(Date.now() - 86400000).toISOString(), cashier: "Caja Miranda", items: [{ productId: "p4", name: "Huevo blanco 12 pzas", qty: 1, price: 42, emoji: "🥚" }, { productId: "p2", name: "Pan de caja clásico", qty: 1, price: 39, emoji: "🍞" }], total: 81, cash: 100, change: 19 },
        { id: "NV-1044", date: new Date(Date.now() - 2 * 86400000).toISOString(), cashier: "Caja Miranda", items: [{ productId: "p12", name: "Refresco cola 600 ml", qty: 2, price: 18, emoji: "🥤" }, { productId: "p10", name: "Frijol negro 900 g", qty: 1, price: 32, emoji: "🫘" }], total: 68, cash: 100, change: 32 },
        { id: "NV-1043", date: new Date(Date.now() - 3 * 86400000).toISOString(), cashier: "Caja Miranda", items: [{ productId: "p6", name: "Jugo de naranja 1 L", qty: 2, price: 30, emoji: "🍊" }, { productId: "p11", name: "Queso panela 400 g", qty: 1, price: 55, emoji: "🧀" }], total: 115, cash: 200, change: 85 }
  ]
};
