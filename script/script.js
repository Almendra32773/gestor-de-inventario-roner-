// Variables globales
let inventory = [];
let cart = [];
let sales = [];
let settings = {
    pin: '0000',
    currency: 'USD',
    convertTo: '',
    conversionRate: 1,
    storeName: 'Market',
    stockWarning: 20,
    autoDeleteSales: 'never',
    printerWidth: 55
};
let scannerActive = false;
let editMode = false;
let editingProductId = null;
// Cloudinary (reemplaza con tus datos reales)
const cloudName = "dett4nahi";          // lo ves en el dashboard
const uploadPreset = "inventario_unsigned"; // nombre del upload preset


// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    updateStoreName();
    checkAutoDelete();
});

// Cerrar sesión al cerrar pestaña
window.addEventListener('beforeunload', function() {
    logout();
});

// Cargar datos del localStorage
function loadData() {
    const savedInventory = localStorage.getItem('inventory');
    const savedSales = localStorage.getItem('sales');
    const savedSettings = localStorage.getItem('settings');
    
    if (savedInventory) {
        inventory = JSON.parse(savedInventory);
    }
    if (savedSales) {
        sales = JSON.parse(savedSales);
    }
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    }
}

// Guardar datos en localStorage
function saveData() {
    localStorage.setItem('inventory', JSON.stringify(inventory));
    localStorage.setItem('sales', JSON.stringify(sales));
    localStorage.setItem('settings', JSON.stringify(settings));
}

// Sistema de Login
function login() {
    const pinInput = document.getElementById('loginPinInput').value;
    const errorMsg = document.getElementById('loginError');
    
    if (pinInput === settings.pin) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        updateStoreName();
        renderInventory();
        updateCart();
        loadSettings();
        errorMsg.textContent = '';
    } else {
        errorMsg.textContent = 'PIN incorrecto. Intente nuevamente.';
    }
}

function logout() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginPinInput').value = '';
}

// Actualizar nombre de tienda
function updateStoreName() {
    document.getElementById('storeName').textContent = settings.storeName;
    document.getElementById('loginStoreName').textContent = settings.storeName;
    document.title = settings.storeName;
}

// Navegación entre secciones
function showSection(sectionName) {
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Remover clase active de todos los botones
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    // Mostrar sección seleccionada
    document.getElementById(sectionName).classList.add('active');
    document.getElementById('nav' + sectionName.charAt(0).toUpperCase() + sectionName.slice(1)).classList.add('active');
    
    // Pedir PIN para configuración
    if (sectionName === 'configuracion') {
        const pin = prompt('Ingrese su PIN para acceder a la configuración:');
        if (pin !== settings.pin) {
            alert('PIN incorrecto');
            showSection('nuevaVenta');
            return;
        }
    }
    
    // Actualizar vista según sección
    if (sectionName === 'inventario') {
        renderInventory();
    }
}

// ==================== NUEVA VENTA ====================

// Búsqueda de productos
document.getElementById('searchInput').addEventListener('input', function(e) {
    const query = e.target.value.toLowerCase();
    const resultsDiv = document.getElementById('searchResults');
    
    if (query.length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    const results = inventory.filter(product => 
        product.name.toLowerCase().includes(query) || 
        (product.barcode && product.barcode.toLowerCase().includes(query))
    );
    
    resultsDiv.innerHTML = '';
    results.forEach(product => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.textContent = `${product.name} ${product.size || ''} - ${formatCurrency(product.price)}`;
        div.onclick = () => {
            addToCart(product);
            document.getElementById('searchInput').value = '';
            resultsDiv.innerHTML = '';
        };
        resultsDiv.appendChild(div);
    });

    // Desactivar escáner cuando se usa la barra de búsqueda manual
    /*document.getElementById('searchInput').addEventListener('focus', function() {
        scannerActive = false;
        document.getElementById('scannerStatus').textContent = '';
    });*/


});

// Agregar producto al carrito
function addProductToCart() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const product = inventory.find(p => 
        p.name.toLowerCase() === query || 
        (p.barcode && p.barcode.toLowerCase() === query)
    );
    
    if (product) {
        addToCart(product);
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    } else {
        alert('Producto no encontrado');
    }
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            size: product.size || '',
            price: product.price,
            quantity: 1
        });
    }
    
    updateCart();
}

// Activar escáner
function activateScanner() {
    scannerActive = true;
    document.getElementById('scannerStatus').textContent = '📷 Escáner activado - Escanee código de barras';
}

// Escuchar entrada de escáner (simula entrada de teclado)
document.addEventListener('keypress', function(e) {
    if (scannerActive && e.key === 'Enter') {
        const barcode = document.getElementById('searchInput').value;
        const product = inventory.find(p => p.barcode === barcode);
        
        if (product) {
            addToCart(product);
            document.getElementById('searchInput').value = '';
        }
        
        document.getElementById('scannerStatus').textContent = '';
    }
});

// Actualizar carrito
function updateCart() {
    const tbody = document.getElementById('cartBody');
    tbody.innerHTML = '';
    
    let total = 0;
    
    cart.forEach(item => {
        const row = tbody.insertRow();
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        row.innerHTML = `
            <td>${item.name.substring(0, 35)}</td>
            <td>${item.size}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(itemTotal)}</td>
            <td><button class="btn-remove" onclick="removeFromCart('${item.id}')">X</button></td>
            <td><button class="btn-sum" onclick="addToCartFromCart('${item.id}')">+</button></td>
        `;
    });
    
    document.getElementById('totalAmount').textContent = formatCurrency(total);
    
    if (settings.convertTo && settings.convertTo !== settings.currency) {
        const converted = total * settings.conversionRate;
        document.getElementById('convertedAmount').textContent = 
            `≈ ${formatCurrency(converted, settings.convertTo)}`;
    } else {
        document.getElementById('convertedAmount').textContent = '';
    }
}

// Remover del carrito
function removeFromCart(productId) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity--;
        if (item.quantity <= 0) {
            cart = cart.filter(i => i.id !== productId);
        }
        updateCart();
    }
}

// Sumar en el carrito
function addToCartFromCart(productId) {
    const item = cart.find(i => i.id === productId);
    if (item) {
        item.quantity++;   // aquí sumas 1 en vez de restar
        updateCart();      // actualiza la vista del carrito
    }
}


// Registrar venta
function registerSale(paymentMethod) {
    if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    
    const now = new Date();
    const saleId = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0') + 
                   now.getHours().toString().padStart(2, '0') + 
                   now.getMinutes().toString().padStart(2, '0');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const sale = {
        id: saleId,
        date: now.toLocaleString('es-ES'),
        paymentMethod: paymentMethod,
        items: [...cart],
        total: total,
        convertedTotal: settings.convertTo ? total * settings.conversionRate : null
    };
    
    // Actualizar stock
    cart.forEach(cartItem => {
        const product = inventory.find(p => p.id === cartItem.id);
        if (product) {
            product.totalUnits -= cartItem.quantity;
            if (product.totalUnits < 0) product.totalUnits = 0;
        }
    });
    
    sales.push(sale);
    saveData();
    removeZeroStockProducts();
    checkLowStock();
    
    // Mostrar resumen
    showSaleReceipt(sale);
}

// Mostrar recibo de venta
function showSaleReceipt(sale) {
    const modal = document.getElementById('saleModal');
    const content = document.getElementById('receiptContent');
    
    let receipt = `
        <div style="text-align: center; margin-bottom: 15px;">
            <h3>${settings.storeName}</h3>
            <p>ID: ${sale.id}</p>
            <p>${sale.date}</p>
            <hr>
        </div>
        <table style="width: 100%; font-size: 0.9em;">
            <thead>
                <tr>
                    <th style="text-align: left;">Producto</th>
                    <th>Cant.</th>
                    <th style="text-align: right;">Precio</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sale.items.forEach(item => {
        receipt += `
            <tr>
                <td>${item.name} ${item.size}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${formatCurrency(item.price * item.quantity)}</td>
            </tr>
        `;
    });
    
    receipt += `
            </tbody>
        </table>
        <hr>
        <div style="text-align: right; font-size: 1.1em; font-weight: bold;">
            <p>TOTAL: ${formatCurrency(sale.total)}</p>
    `;
    
    if (sale.convertedTotal) {
        receipt += `<p style="font-size: 0.9em;">(${formatCurrency(sale.convertedTotal, settings.convertTo)})</p>`;
    }
    
    receipt += `
            <p style="margin-top: 10px;">Forma de pago: ${sale.paymentMethod}</p>
        </div>
    `;
    
    content.innerHTML = receipt;
    modal.style.display = 'block';
}

// Imprimir recibo
function printReceipt() {
    window.print();
    continueSale();
}

// Continuar después de venta
function continueSale() {
    document.getElementById('saleModal').style.display = 'none';
    cart = [];
    updateCart();
    removeZeroStockProducts();
}

// Cancelar venta
function cancelSale() {
    if (cart.length > 0) {
        if (confirm('¿Está seguro de cancelar la venta?')) {
            cart = [];
            updateCart();
        }
    }
}

// ==================== INVENTARIO ====================

// Renderizar inventario
function renderInventory() {
    const grid = document.getElementById('inventoryGrid');
    grid.innerHTML = '';
    
    if (inventory.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #999; padding: 50px;">No hay productos en el inventario</p>';
        return;
    }
    
    inventory.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Verificar stock bajo
        if (product.initialStock > 0) {
            const stockPercentage = (product.totalUnits / product.initialStock) * 100;
            if (stockPercentage <= settings.stockWarning) {
                card.classList.add('low-stock');
            }
        }
        
        const imgSrc = product.image || '/logodepestaña/Captura de pantalla 2025-11-19 143222.ico';
        
        card.innerHTML = `
            <img src="${imgSrc}" alt="${product.name}" onerror="this.src='/logodepestaña/Captura de pantalla 2025-11-19 143222.ico'">
            <p><strong>${product.name.substring(0, 35)}</strong></p>
            <p>${product.size || ''}</p>
        `;
        
        if (editMode) {
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Editar';
            editBtn.className = 'btn-primary';
            editBtn.style.width = '100%';
            editBtn.style.marginTop = '10px';
            editBtn.onclick = () => openEditProductModal(product.id);
            card.appendChild(editBtn);
        } else {
            card.onclick = () => showProductDetail(product);
        }
        
        grid.appendChild(card);
    });
}

// Mostrar detalle de producto
function showProductDetail(product) {
    const sidebar = document.getElementById('inventorySidebar');
    
    const imgSrc = product.image || '/logodepestaña/Captura de pantalla 2025-11-19 143222.ico';
    const stockDisplay = formatStock(product);
    const convertedPrice = settings.convertTo && settings.convertTo !== settings.currency 
        ? formatCurrency(product.price * settings.conversionRate, settings.convertTo) 
        : '';
    
    sidebar.innerHTML = `
        <div class="product-detail">
            <img src="${imgSrc}" alt="${product.name}" onerror="this.src='/logodepestaña/Captura de pantalla 2025-11-19 143222.ico'">
            <h3>${product.name}</h3>
            <p><strong>Código:</strong> ${product.barcode || 'N/A'}</p>
            <p><strong>Tamaño:</strong> ${product.size || 'N/A'}</p>
            <p><strong>Precio:</strong> ${formatCurrency(product.price)}</p>
            ${convertedPrice ? `<p><strong>Precio convertido:</strong> ${convertedPrice}</p>` : ''}
            <p><strong>Stock:</strong> ${stockDisplay}</p>
            <button class="btn-inventory" onclick="printProductSingle('${product.id}')">Imprimir</button>
        </div>
    `;
}

// Imprimir un solo producto
function printProductSingle(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;
    let printContent = `
        <html>
        <head>
            <title>Inventario - ${settings.storeName}</title>
            <style>
                @page {
                    size: ${settings.printerWidth}mm auto;
                    margin: 20mm;
                }
                body { 
                    font-family: Arial, sans-serif; 
                    width: ${settings.printerWidth}mm;
                    margin: 0;
                    padding: 0;
                }
                .product-page {
                    page-break-after: always;
                    padding: 8px;
                }
                .product-page:last-child {
                    page-break-after: auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 15px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 10px;
                }
                .store-name {
                    font-size: 1.4em;
                    font-weight: bold;
                    margin: 0;
                }
                .product-info {
                    margin-top: 15px;
                }
                .info-row {
                    margin: 8px 0;
                    display: flex;
                    justify-content: space-between;
                }
                .info-label {
                    font-weight: bold;
                }
                .info-value {
                    text-align: right;
                    margin-right: 10px;
                }
                .product-name {
                    font-size: 2em;
                    font-weight: bold;
                    margin: 10px 0;
                    text-align: center;
                }
            </style>
        </head>
        <body>
    `;
        const convertedPrice = settings.convertTo && settings.convertTo !== settings.currency
            ? formatCurrency(product.price * settings.conversionRate, settings.convertTo) 
            : '';
        
        printContent += `
            <div class="product-page">
                <hr>
                <div class="product-name">${product.name}</div>
                
                <div class="product-info">
                    <div class="info-row">
                        <span class="info-label">Código de Barras:</span>
                        <span class="info-value">${product.barcode || 'N/A'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Tamaño:</span>
                        <span class="info-value">${product.size || 'N/A'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Precio/Und:</span>
                        <span class="info-value">${formatCurrency(product.price)}</span>
                    </div>
                    
                    ${convertedPrice ? `
                    <div class="info-row">
                        <span class="info-label">Precio Bs:</span>
                        <span class="info-value">${convertedPrice}</span>
                    </div>
                    ` : ''}
                    
                </div>
                <hr>
            </div>
        `;
    
    printContent += `
        </body>
        </html>
    `;
    const printWindow = window.open('', '', 'width=600,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
};
                
// Formatear stock
function formatStock(product) {
    if (product.stockType === 'units') {
        return `${product.totalUnits} Unds`;
    } else if (product.stockType === 'packages') {
        const packages = Math.floor(product.totalUnits / product.unitsPerContainer);
        const units = product.totalUnits % product.unitsPerContainer;
        return `${packages} Paq${units > 0 ? ' + ' + units + ' Unds' : ''}`;
    } else if (product.stockType === 'bulk') {
        const bulks = Math.floor(product.totalUnits / product.unitsPerContainer);
        const units = product.totalUnits % product.unitsPerContainer;
        return `${bulks} Bult${units > 0 ? ' + ' + units + ' Unds' : ''}`;
    }
    return `${product.totalUnits} Unds`;
}

// Mostrar modal agregar producto
function showAddProductModal() {
    editingProductId = null;
    document.getElementById('addProductModal').style.display = 'block';
    document.getElementById('addProductForm').reset();
    document.querySelector('#addProductModal h2').textContent = 'Agregar Producto';
    
    // Ocultar botón de borrar
    const deleteBtn = document.getElementById('deleteProductBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
}

function closeAddProductModal() {
    document.getElementById('addProductModal').style.display = 'none';
    editingProductId = null;
}

// Abrir modal para editar producto
function openEditProductModal(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) return;
    
    editingProductId = productId;
    
    // Llenar el formulario con los datos del producto
    document.getElementById('productName').value = product.name;
    document.getElementById('productBarcode').value = product.barcode || '';
    
    // Extraer tamaño y unidad
    if (product.size) {
        const sizeMatch = product.size.match(/^([\d.]+)\s*(.+)$/);
        if (sizeMatch) {
            document.getElementById('productSize').value = sizeMatch[1];
            document.getElementById('productSizeUnit').value = sizeMatch[2];
        }
    }
    
    document.getElementById('productPrice').value = product.price;
    document.getElementById('stockType').value = product.stockType;
    
    if (product.stockType === 'units') {
        document.getElementById('stockQuantity').value = product.totalUnits;
    } else {
        const containers = Math.floor(product.totalUnits / product.unitsPerContainer);
        document.getElementById('stockQuantity').value = containers;
        document.getElementById('stockPerContainer').value = product.unitsPerContainer;
    }
    
    document.getElementById('productImageUrl').value = product.image || '';
    
    updateStockInputs();
    
    // Cambiar título del modal
    document.querySelector('#addProductModal h2').textContent = 'Editar Producto';
    
    // Mostrar botón de borrar
    let deleteBtn = document.getElementById('deleteProductBtn');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'deleteProductBtn';
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-cancel';
        deleteBtn.textContent = 'Borrar Producto';
        deleteBtn.style.marginTop = '10px';
        deleteBtn.onclick = deleteCurrentProduct;
        document.getElementById('addProductForm').appendChild(deleteBtn);
    }
    deleteBtn.style.display = 'block';
    
    document.getElementById('addProductModal').style.display = 'block';
}

// Borrar producto actual en edición
function deleteCurrentProduct() {
    if (!editingProductId) return;
    
    if (confirm('¿Está seguro de eliminar este producto?')) {
        inventory = inventory.filter(p => p.id !== editingProductId);
        saveData();
        renderInventory();
        closeAddProductModal();
        alert('Producto eliminado');
    }
}

// Actualizar inputs de stock
function updateStockInputs() {
    const stockType = document.getElementById('stockType').value;
    const stockPerContainer = document.getElementById('stockPerContainer');
    
    if (stockType === 'units') {
        stockPerContainer.style.display = 'none';
    } else {
        stockPerContainer.style.display = 'block';
    }
}

// Agregar o actualizar producto
document.getElementById('addProductForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('productName').value.trim();
    const barcode = document.getElementById('productBarcode').value.trim();
    const size = document.getElementById('productSize').value;
    const sizeUnit = document.getElementById('productSizeUnit').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const stockType = document.getElementById('stockType').value;
    const stockQuantity = parseInt(document.getElementById('stockQuantity').value) || 0;
    const stockPerContainer = parseInt(document.getElementById('stockPerContainer').value) || 1;
    const imageFile = document.getElementById('productImageFile').files[0];
    const imageUrl = document.getElementById('productImageUrl').value.trim();
    
    if (!name) {
        alert('Añada un nombre');
        return;
    }
    
    if (!price || price <= 0) {
        alert('Añada un precio válido');
        return;
    }
    
    const fullSize = size ? `${size} ${sizeUnit}` : '';
    const totalUnits = stockType === 'units' ? stockQuantity : stockQuantity * stockPerContainer;
    
    // Verificar si existe un producto con el mismo nombre, código de barras y tamaño
    const existingProduct = inventory.find(p => 
        p.id !== editingProductId &&
        p.name.toLowerCase() === name.toLowerCase() && 
        p.barcode === barcode && 
        p.size === fullSize
    );
    
    if (existingProduct && !editingProductId) {
        // Producto duplicado encontrado - fusionar stock
        existingProduct.totalUnits += totalUnits;
        existingProduct.initialStock += totalUnits;
        saveData();
        renderInventory();
        closeAddProductModal();
        alert('Producto ya existe. Stock sumado al producto existente.');
        return;
    }

    // 1. Determinar URL de imagen (Cloudinary / URL directa / fallback local)
    let finalImageUrl = '';

    try {
        if (imageFile) {
            //subir a Cloudinary
            finalImageUrl = await uploadImageToCloudinary(imageFile);
        } else if (imageUrlInput) {
            // Usar URL directa escrita por el usuario
            finalImageUrl = imageUrlInput;
        } else {
            // Fallback local
            finalImageUrl = '/logodepestaña/Captura de pantalla 2025-11-19 143222.ico';
        }
    } catch (error) {
        console.error(error);
        alert('No se pudo subir la imagen. se uasará imagen por defecto.');
        finalImageUrl = '/logodepestaña/Captura de pantalla 2025-11-19 143222.ico';
    }
    
    if (editingProductId) {
        // Modo edición - actualizar producto existente
        const product = inventory.find(p => p.id === editingProductId);
        if (product) {
            product.name = name;
            product.barcode = barcode;
            product.size = fullSize;
            product.price = price;
            product.stockType = stockType;
            product.unitsPerContainer = stockPerContainer;
            product.totalUnits = totalUnits;
            product.initialStock = totalUnits;
            product.image = finalImageUrl || product.image;
        }
        alert('Producto actualizado exitosamente');
    } else {
        // Modo agregar - crear nuevo producto
        const product = {
            id: Date.now().toString(),
            name: name,
            barcode: barcode,
            size: fullSize,
            price: price,
            stockType: stockType,
            unitsPerContainer: stockPerContainer,
            totalUnits: totalUnits,
            initialStock: totalUnits,
            image: finalImageUrl
        };
        
        inventory.push(product);
        alert('Producto agregado exitosamente');
    }
    
    saveData();
    renderInventory();
    removeZeroStockProducts();
    closeAddProductModal();
});

// Eliminar inventario
function deleteInventory() {
    const pin = prompt('Ingrese su PIN para eliminar el inventario:');
    if (pin !== settings.pin) {
        alert('PIN incorrecto');
        return;
    }
    
    if (confirm('¿Está seguro de eliminar TODO el inventario? Esta acción no se puede deshacer.')) {
        inventory = [];
        saveData();
        renderInventory();
        document.getElementById('inventorySidebar').innerHTML = '<p class="sidebar-placeholder">Seleccione un producto para ver detalles</p>';
        alert('Inventario eliminado');
    }
}

// Editar inventario
function editInventory() {
    const pin = prompt('Ingrese su PIN para editar el inventario:');
    if (pin !== settings.pin) {
        alert('PIN incorrecto');
        return;
    }
    
    editMode = !editMode;
    renderInventory();
    
    if (editMode) {
        alert('Modo de edición activado. Haga clic en los productos para editarlos.');
    }
}

// Imprimir inventario - cada producto en hoja separada
function printInventory() {
    let printContent = `
        <html>
        <head>
            <title>Inventario - ${settings.storeName}</title>
            <style>
                @page {
                    size: ${settings.printerWidth}mm auto;
                    margin: 20mm;
                }
                body { 
                    font-family: Arial, sans-serif; 
                    width: ${settings.printerWidth}mm;
                    margin: 0;
                    padding: 0;
                }
                .product-page {
                    page-break-after: always;
                    padding: 8px;
                }
                .product-page:last-child {
                    page-break-after: auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 15px;
                    border-bottom: 2px solid #000;
                    padding-bottom: 10px;
                }
                .store-name {
                    font-size: 1.4em;
                    font-weight: bold;
                    margin: 0;
                }
                .product-info {
                    margin-top: 15px;
                }
                .info-row {
                    margin: 8px 0;
                    display: flex;
                    justify-content: space-between;
                }
                .info-label {
                    font-weight: bold;
                }
                .info-value {
                    text-align: right;
                    margin-right: 10px;
                }
                .product-name {
                    font-size: 2em;
                    font-weight: bold;
                    margin: 10px 0;
                    text-align: center;
                }
            </style>
        </head>
        <body>
    `;
    
    inventory.forEach((product, index) => {
        const convertedPrice = settings.convertTo && settings.convertTo !== settings.currency 
            ? formatCurrency(product.price * settings.conversionRate, settings.convertTo) 
            : '';
        
        const stockDisplay = formatStock(product);
        
        printContent += `
            <div class="product-page">
                <hr>
                <div class="product-name">${product.name}</div>
                
                <div class="product-info">
                    <div class="info-row">
                        <span class="info-label">Código de Barras:</span>
                        <span class="info-value">${product.barcode || 'N/A'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Tamaño:</span>
                        <span class="info-value">${product.size || 'N/A'}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="info-label">Precio/Und:</span>
                        <span class="info-value">${formatCurrency(product.price)}</span>
                    </div>
                    
                    ${convertedPrice ? `
                    <div class="info-row">
                        <span class="info-label">Precio Bs:</span>
                        <span class="info-value">${convertedPrice}</span>
                    </div>
                    ` : ''}
                    
                </div>
                <hr>
            </div>
        `;
    });
    
    printContent += `
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '', 'width=600,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Verificar stock bajo
function checkLowStock() {
    inventory.forEach(product => {
        if (product.initialStock > 0) {
            const stockPercentage = (product.totalUnits / product.initialStock) * 100;
            if (stockPercentage <= settings.stockWarning && stockPercentage > 0) {
                alert(`⚠️ Queda poco Stock de ${product.name}`);
            }
        }
    });
}

//remover producto si se acaba el stock
// Eliminar del inventario todos los productos con stock 0
function removeZeroStockProducts() {
    inventory = inventory.filter(p => p.totalUnits > 0);
    saveData();      // ya la tienes, guarda en localStorage
    renderInventory(); 
}

// ==================== CONFIGURACIÓN ====================

// Cargar configuración
function loadSettings() {
    document.getElementById('currencySelect').value = settings.currency;
    document.getElementById('convertToSelect').value = settings.convertTo || '';
    document.getElementById('conversionRate').value = settings.conversionRate;
    document.getElementById('storeNameInput').value = settings.storeName;
    document.getElementById('stockWarning').value = settings.stockWarning;
    document.getElementById('autoDeleteSales').value = settings.autoDeleteSales;
    document.getElementById('printerWidth').value = settings.printerWidth;
}

// Guardar configuración
function saveSettings() {
    const newPin = document.getElementById('newPin').value;
    const confirmPin = document.getElementById('confirmPin').value;
    
    if (newPin && confirmPin) {
        if (newPin.length < 4 || newPin.length > 32) {
            alert('El PIN debe tener entre 4 y 32 dígitos');
            return;
        }
        if (newPin !== confirmPin) {
            alert('Los PINs no coinciden');
            return;
        }
        settings.pin = newPin;
    }
    
    settings.currency = document.getElementById('currencySelect').value;
    settings.convertTo = document.getElementById('convertToSelect').value;
    settings.conversionRate = parseFloat(document.getElementById('conversionRate').value) || 1;
    settings.storeName = document.getElementById('storeNameInput').value || 'Market';
    settings.stockWarning = parseInt(document.getElementById('stockWarning').value) || 20;
    settings.autoDeleteSales = document.getElementById('autoDeleteSales').value;
    settings.printerWidth = parseInt(document.getElementById('printerWidth').value) || 55;
    
    saveData();
    updateStoreName();
    updateCart();
    alert('Configuración guardada exitosamente');
    
    document.getElementById('newPin').value = '';
    document.getElementById('confirmPin').value = '';
}

// Ver registro de ventas
function viewSalesRecord() {
    const modal = document.getElementById('salesRecordModal');
    const content = document.getElementById('salesRecordContent');
    
    if (sales.length === 0) {
        content.innerHTML = '<p style="text-align: center; color: #999;">No hay ventas registradas</p>';
    } else {
        content.innerHTML = '';
        sales.slice().reverse().forEach(sale => {
            const div = document.createElement('div');
            div.className = 'sale-record-item';
            
            let itemsList = '';
            sale.items.forEach(item => {
                itemsList += `<p>${item.name} ${item.size} - Cant: ${item.quantity} - ${formatCurrency(item.price * item.quantity)}</p>`;
            });
            
            div.innerHTML = `
                <p><strong>ID:</strong> ${sale.id}</p>
                <p><strong>Fecha:</strong> ${sale.date}</p>
                <p><strong>Forma de pago:</strong> ${sale.paymentMethod}</p>
                <hr>
                ${itemsList}
                <hr>
                <p><strong>Total:</strong> ${formatCurrency(sale.total)}</p>
                ${sale.convertedTotal ? `<p><strong>Total convertido:</strong> ${formatCurrency(sale.convertedTotal, settings.convertTo)}</p>` : ''}
            `;
            
            content.appendChild(div);
        });
    }
    
    modal.style.display = 'block';
}

function closeSalesRecordModal() {
    document.getElementById('salesRecordModal').style.display = 'none';
}

// Exportar registro de ventas
function exportSalesRecord() {
    if (sales.length === 0) {
        alert('No hay ventas para exportar');
        return;
    }
    
    let exportContent = `
        <html>
        <head>
            <title>Registro de Ventas - ${settings.storeName}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .sale { margin-bottom: 30px; border: 1px solid #ccc; padding: 15px; }
                h1, h2 { color: #667eea; }
            </style>
        </head>
        <body>
            <h1>${settings.storeName}</h1>
            <h2>Registro de Ventas</h2>
    `;
    
    sales.forEach(sale => {
        exportContent += `
            <div class="sale">
                <p><strong>ID:</strong> ${sale.id}</p>
                <p><strong>Fecha:</strong> ${sale.date}</p>
                <p><strong>Forma de pago:</strong> ${sale.paymentMethod}</p>
                <hr>
        `;
        
        sale.items.forEach(item => {
            exportContent += `<p>${item.name} ${item.size} - Cantidad: ${item.quantity} - ${formatCurrency(item.price * item.quantity)}</p>`;
        });
        
        exportContent += `
                <hr>
                <p><strong>Total:</strong> ${formatCurrency(sale.total)}</p>
                ${sale.convertedTotal ? `<p><strong>Total convertido:</strong> ${formatCurrency(sale.convertedTotal, settings.convertTo)}</p>` : ''}
            </div>
        `;
    });
    
    exportContent += `
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(exportContent);
    printWindow.document.close();
    printWindow.print();
}

// Borrar registro de ventas
function deleteSalesRecord() {
    if (confirm('¿Está seguro de borrar todo el registro de ventas? Esta acción no se puede deshacer.')) {
        sales = [];
        saveData();
        alert('Registro de ventas eliminado');
    }
}

// Verificar borrado automático
function checkAutoDelete() {
    const lastCheck = localStorage.getItem('lastAutoDeleteCheck');
    const now = new Date();
    
    if (!lastCheck) {
        localStorage.setItem('lastAutoDeleteCheck', now.toISOString());
        return;
    }
    
    const lastCheckDate = new Date(lastCheck);
    const daysDiff = Math.floor((now - lastCheckDate) / (1000 * 60 * 60 * 24));
    
    let shouldDelete = false;
    
    switch (settings.autoDeleteSales) {
        case 'weekly':
            if (daysDiff >= 7) shouldDelete = true;
            break;
        case 'monthly':
            if (daysDiff >= 30) shouldDelete = true;
            break;
        case 'yearly':
            if (daysDiff >= 365) shouldDelete = true;
            break;
    }
    
    if (shouldDelete) {
        sales = [];
        saveData();
        localStorage.setItem('lastAutoDeleteCheck', now.toISOString());
    }
}

// ==================== UTILIDADES ====================

// Subir imagen a Cloudinary y devolver la URL
async function subirImagenACloudinary(file) {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(url, {
        method: "POST",
        body: formData
    });

    if (!res.ok) {
        throw new Error("Error al subir imagen a Cloudinary");
    }

    const data = await res.json();
    return data.secure_url; // URL pública de la imagen
}


// Formatear moneda
function formatCurrency(amount, currency = settings.currency) {
    const symbols = {
        'USD': '$',
        'EUR': '€',
        'BS': 'Bs'
    };
    
    const symbol = symbols[currency] || '$';
    
    if (currency === 'BS') {
        return `${amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} ${symbol}`;
    } else {
        return `${symbol}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}