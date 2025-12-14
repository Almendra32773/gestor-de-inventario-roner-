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

class InventoryProtector {
    constructor() {
        this.spaceCheckInterval = null;
        this.lastWarning = null;
    }
    
    startMonitoring() {
        // Verificar espacio cada 5 minutos
        this.spaceCheckInterval = setInterval(() => {
            this.checkStorageHealth();
        }, 5 * 60 * 1000);
        
        // Verificar al inicio
        setTimeout(() => this.checkStorageHealth(), 3000);
    }
    
    checkStorageHealth() {
        const espacioTotal = this.getTotalSpaceUsed();
        const espacioMB = espacioTotal / (1024 * 1024);
        
        console.log(`📊 Salud almacenamiento: ${espacioMB.toFixed(2)}MB usados`);
        
        // Niveles de alerta
        if (espacioMB > 4) { // Más de 4MB
            this.showWarning('alto', espacioMB);
        } else if (espacioMB > 3) { // Más de 3MB
            this.showWarning('medio', espacioMB);
        } else if (espacioMB > 2) { // Más de 2MB
            this.showWarning('bajo', espacioMB);
        }
    }
    
    showWarning(nivel, espacioMB) {
        // No mostrar advertencias muy seguido
        const ahora = Date.now();
        if (this.lastWarning && (ahora - this.lastWarning < 5 * 60 * 1000)) {
            return; // Esperar al menos 5 minutos entre advertencias
        }
        
        this.lastWarning = ahora;
        
        const mensajes = {
            bajo: `📊 El almacenamiento está al ${Math.round((espacioMB/5)*100)}%.\nConsidera exportar un backup pronto.`,
            medio: `⚠️ El almacenamiento está al ${Math.round((espacioMB/5)*100)}%.\nExporta un backup para prevenir problemas.`,
            alto: `🚨 El almacenamiento está al ${Math.round((espacioMB/5)*100)}%.\nExporta un backup AHORA para proteger tu inventario.`
        };
        
        // Mostrar notificación no intrusiva
        if (window.backupManager) {
            window.backupManager.mostrarNotificacion(mensajes[nivel], nivel === 'alto' ? 'error' : 'warning');
        } else {
            console.warn(mensajes[nivel]);
        }
        
        // Si es nivel alto, mostrar alerta más prominente
        if (nivel === 'alto') {
            setTimeout(() => {
                if (confirm(mensajes.alto + '\n\n¿Quieres exportar un backup ahora?')) {
                    if (window.exportarBackupManual) {
                        window.exportarBackupManual();
                    }
                }
            }, 1000);
        }
    }
    
    getTotalSpaceUsed() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            total += key.length + value.length;
        }
        return total;
    }
    
    getSpaceBreakdown() {
        const breakdown = {
            inventory: 0,
            sales: 0,
            settings: 0,
            backups: 0,
            other: 0
        };
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            const size = key.length + value.length;
            
            if (key === 'inventory') breakdown.inventory = size;
            else if (key === 'sales') breakdown.sales = size;
            else if (key === 'settings') breakdown.settings = size;
            else if (key.includes('backup')) breakdown.backups += size;
            else breakdown.other += size;
        }
        
        return breakdown;
    }
}

// Inicializar protector
const inventoryProtector = new InventoryProtector();

// ==================== SISTEMA DE BACKUP ====================
// ==================== SISTEMA DE BACKUP ====================
class BackupManager {
    constructor() {
        this.clavePrincipal = 'inventario_app';
        this.claveBackup = 'inventario_backup';
        this.claveImagenes = 'imagenes_cache';
        this.claveMetadata = 'app_metadata';
        this.maxBackups = 5;
        this.maxImagenesCache = 15;
        this.init();
    }
    
    init() {
        console.log('🔧 BackupManager iniciado');
        this.verificarIntegridad();
    }
    
    // En la clase BackupManager, después del método init(), agrega:
    verificarEspacioDisponible() {
        try {
            // Test simple de espacio
            const testData = 'test';
            localStorage.setItem('__space_test__', testData);
            localStorage.removeItem('__space_test__');
            
            const espacioUsado = JSON.stringify(localStorage).length;
            console.log(`📊 Espacio usado: ${Math.round(espacioUsado / 1024)}KB`);
            
            // Si usa más de 4MB, mostrar advertencia
            if (espacioUsado > 4 * 1024 * 1024) {
                console.warn('⚠️ Mucho espacio usado (>4MB)');
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Error verificando espacio:', error);
            return false;
        }
    }

    verificarIntegridad() {
        console.log('🔍 Verificando integridad de datos...');
        const inventarioGuardado = localStorage.getItem('inventory');
        if (!inventarioGuardado) {
            console.warn('⚠️ No se encontró inventario, buscando backup...');
            this.recuperarBackup();
        } else {
            try {
                JSON.parse(inventarioGuardado);
                console.log('✅ Inventario verificado correctamente');
            } catch (error) {
                console.error('❌ Inventario corrupto:', error);
                this.recuperarBackup();
            }
        }
    }
    
    crearBackupAutomatico() {
        try {
            const timestamp = new Date().toISOString();
            const backupData = {
                inventory: JSON.parse(localStorage.getItem('inventory') || '[]'),
                sales: JSON.parse(localStorage.getItem('sales') || '[]'),
                settings: JSON.parse(localStorage.getItem('settings') || '{}'),
                timestamp: timestamp,
                version: '2.0'
            };
            
            const backupKey = `${this.claveBackup}_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backupData));
            this.limpiarBackupsAntiguos();
            console.log('💾 Backup automático creado:', backupKey);
            this.guardarMetadata('ultimo_backup', timestamp);
            
        } catch (error) {
            console.error('❌ Error creando backup:', error);
        }
    }
    
    recuperarBackup() {
        console.log('🔄 Intentando recuperar desde backup...');
        const backups = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.claveBackup + '_')) {
                try {
                    const backup = JSON.parse(localStorage.getItem(key));
                    if (backup && backup.inventory) {
                        backups.push({
                            key: key,
                            timestamp: backup.timestamp,
                            data: backup
                        });
                    }
                } catch (e) {}
            }
        }
        
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (backups.length > 0) {
            console.log('✅ Backup encontrado, recuperando...');
            const backup = backups[0].data;
            localStorage.setItem('inventory', JSON.stringify(backup.inventory));
            localStorage.setItem('sales', JSON.stringify(backup.sales));
            localStorage.setItem('settings', JSON.stringify(backup.settings));
            
            this.mostrarNotificacion(
                `Se recuperaron ${backup.inventory.length} productos del backup automático`,
                'success'
            );
            
            return backup.inventory;
        } else {
            console.warn('⚠️ No se encontraron backups');
            this.mostrarNotificacion(
                'No se encontraron datos guardados. Iniciando inventario vacío.',
                'warning'
            );
            return [];
        }
    }
    
    limpiarBackupsAntiguos() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.claveBackup + '_')) {
                const timestamp = parseInt(key.split('_').pop());
                backups.push({ key, timestamp });
            }
        }
        
        backups.sort((a, b) => b.timestamp - a.timestamp);
        
        if (backups.length > this.maxBackups) {
            const eliminar = backups.slice(this.maxBackups);
            eliminar.forEach(b => {
                localStorage.removeItem(b.key);
                console.log('🗑️ Backup eliminado:', b.key);
            });
        }
    }
    
    guardarMetadata(clave, valor) {
        try {
            const metadata = JSON.parse(
                localStorage.getItem(this.claveMetadata) || '{}'
            );
            metadata[clave] = valor;
            localStorage.setItem(this.claveMetadata, JSON.stringify(metadata));
        } catch (error) {}
    }
    
    mostrarNotificacion(mensaje, tipo = 'info') {
        const colores = {
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444',
            info: '#3B82F6'
        };
        
        const notificacion = document.createElement('div');
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colores[tipo]};
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        notificacion.textContent = mensaje;
        document.body.appendChild(notificacion);
        
        setTimeout(() => {
            notificacion.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notificacion.parentNode) {
                    notificacion.parentNode.removeChild(notificacion);
                }
            }, 300);
        }, 5000);
        
        if (!document.querySelector('#notificacion-estilos')) {
            const estilos = document.createElement('style');
            estilos.id = 'notificacion-estilos';
            estilos.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(estilos);
        }
    }
    
    mostrarDiagnostico() {
        const espacioUsado = JSON.stringify(localStorage).length;
        const backups = this.obtenerBackupsInfo();
        
        return `
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <h3 style="margin-top: 0;">🩺 Diagnóstico del Sistema</h3>
                <p><strong>📊 Espacio usado:</strong> ${Math.round(espacioUsado / 1024)}KB</p>
                <p><strong>🔒 Backups disponibles:</strong> ${backups.length}</p>
                <p><strong>📦 Productos en inventario:</strong> ${inventory.length}</p>
                <p><strong>💰 Ventas registradas:</strong> ${sales.length}</p>
                ${backups.length > 0 ? 
                    `<p><strong>🕒 Último backup:</strong> ${new Date(backups[0].timestamp).toLocaleString()}</p>` : 
                    ''
                }
            </div>
        `;
    }
    
    obtenerBackupsInfo() {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.claveBackup + '_')) {
                try {
                    const backup = JSON.parse(localStorage.getItem(key));
                    if (backup && backup.timestamp) {
                        backups.push({
                            key: key,
                            timestamp: backup.timestamp,
                            items: backup.inventory?.length || 0
                        });
                    }
                } catch (e) {}
            }
        }
        return backups;
    }
}

// Instanciar el BackupManager
const backupManager = new BackupManager();
window.backupManager = backupManager;

// Cloudinary (reemplaza con tus datos reales)
const cloudName = "dett4nahi";          // lo ves en el dashboard
const uploadPreset = "inventario_unsigned"; // nombre del upload preset


// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    updateStoreName();
    checkAutoDelete();

    // ✅ AGREGAR ESTO:
    // Inicializar sistema de notificaciones
    if (typeof mostrarNotificacion === 'undefined') {
        // Asegurar que la función existe
        window.mostrarNotificacion = function(mensaje, tipo) {
            console.log(`[${tipo}] ${mensaje}`);
        };
    }
    
    // Mostrar recordatorio de backup si nunca se ha exportado
    setTimeout(() => {
        const ultimoExport = localStorage.getItem('ultimo_export_backup');
        if (!ultimoExport && inventory.length > 0) {
            setTimeout(() => {
                if (confirm('💡 ¿Deseas exportar un backup de tu inventario?\n\nRecomendado para proteger tus datos.')) {
                    exportarBackupManual();
                }
            }, 5000);
        }
    }, 3000);
});

// Cerrar sesión al cerrar pestaña
window.addEventListener('beforeunload', function() {
    logout();
});

// Cargar datos del localStorage CON RECUPERACIÓN
function loadData() {
    console.log('🔍 Cargando datos...');
    
    let cargadoCorrectamente = true;
    
    // Cargar inventario con recuperación
    try {
        const savedInventory = localStorage.getItem('inventory');
        if (savedInventory) {
            inventory = JSON.parse(savedInventory);
            console.log(`✅ Inventario cargado: ${inventory.length} productos`);
        } else {
            console.warn('⚠️ No se encontró inventario');
            cargadoCorrectamente = false;
        }
    } catch (error) {
        console.error('❌ Error cargando inventario:', error);
        inventory = [];
        cargadoCorrectamente = false;
    }
    
    // Cargar ventas
    try {
        const savedSales = localStorage.getItem('sales');
        if (savedSales) {
            sales = JSON.parse(savedSales);
            console.log(`✅ Ventas cargadas: ${sales.length} registros`);
        }
    } catch (error) {
        console.error('❌ Error cargando ventas:', error);
        sales = [];
    }
    
    // Cargar configuración
    try {
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
            console.log('✅ Configuración cargada');
        }
    } catch (error) {
        console.error('❌ Error cargando configuración:', error);
        // Mantener configuración por defecto
    }
    
    // Si no se cargó correctamente, intentar recuperar
    if (!cargadoCorrectamente) {
        console.log('🔄 Intentando recuperar desde backup...');
        const datosRecuperados = backupManager.recuperarBackup();
        if (datosRecuperados && datosRecuperados.length > 0) {
            inventory = datosRecuperados;
            console.log(`🔄 Inventario recuperado: ${inventory.length} productos`);
        }
    }
    
    // Verificar espacio después de cargar
    setTimeout(() => backupManager.verificarEspacioDisponible(), 1000);
}

// Guardar datos en localStorage CON PROTECCIÓN DEL INVENTARIO

function saveData() {
    console.log('💾 Intentando guardar datos...');
    
    try {
        // 1. PRIMERO intentar guardar normal
        localStorage.setItem('inventory', JSON.stringify(inventory));
        localStorage.setItem('sales', JSON.stringify(sales));
        localStorage.setItem('settings', JSON.stringify(settings));
        
        // 2. Crear backup automático
        if (window.backupManager) {
            setTimeout(() => backupManager.crearBackupAutomatico(), 100);
        }
        
        console.log('✅ Datos guardados normalmente');
        return true;
        
    } catch (error) {
        console.error('❌ Error al guardar:', error);
        
        // 3. SI HAY ERROR DE ESPACIO, proteger inventario
        if (error.name === 'QuotaExceededError') {
            console.error('💥 ESPACIO LLENO! Protegiendo inventario...');
            return protectInventoryOnFullStorage();
        }
        
        return false;
    }
}


// Función ESPECÍFICA para proteger el inventario cuando el almacenamiento está lleno
// AGREGAR después de saveData()
function protectInventoryOnFullStorage() {
    console.log('🛡️ Activando protección de inventario...');
    
    try {
        // PASO 1: Eliminar SOLO backups antiguos
        console.log('🗑️ Eliminando backups antiguos...');
        eliminarTodosLosBackupsExcepto(1);
        
        // Intentar guardar de nuevo
        localStorage.setItem('inventory', JSON.stringify(inventory));
        localStorage.setItem('sales', JSON.stringify(sales));
        localStorage.setItem('settings', JSON.stringify(settings));
        
        console.log('✅ Guardado exitoso después de limpiar backups');
        return true;
        
    } catch (error) {
        console.error('❌ Aún sin espacio después de limpiar backups');
        
        try {
            // PASO 2: Eliminar VENTAS para salvar INVENTARIO
            console.log('🔥 EMERGENCIA: Eliminando ventas para salvar inventario...');
            
            // 1. Guardar SOLO el inventario
            localStorage.setItem('inventory', JSON.stringify(inventory));
            
            // 2. Eliminar TODO lo demás
            eliminarTodoExceptoInventario();
            
            // 3. Guardar configuración mínima
            const configMinima = {
                pin: settings.pin,
                currency: settings.currency,
                storeName: settings.storeName,
                stockWarning: settings.stockWarning
            };
            localStorage.setItem('settings', JSON.stringify(configMinima));
            
            // 4. Vaciar array de ventas en memoria
            sales = [];
            
            console.log('✅ INVENTARIO SALVADO (ventas sacrificadas)');
            mostrarAlertaEmergencia();
            return true;
            
        } catch (error2) {
            console.error('💀 ERROR CRÍTICO: No se pudo salvar ni el inventario');
            sessionStorage.setItem('inventory_emergency', JSON.stringify(inventory));
            
            alert('🚨 EMERGENCIA: El almacenamiento está completamente lleno.\n\n' +
                  'El inventario se guardó temporalmente en memoria.\n' +
                  'EXPORTA UN BACKUP AHORA MISMO antes de cerrar la pestaña.');
            return false;
        }
    }
}

// Eliminar todos los backups excepto N más recientes
function eliminarTodosLosBackupsExcepto(mantener = 1) {
    const backups = [];
    
    // Encontrar todos los backups
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('backup') || key.startsWith('inventario_backup_')) {
            try {
                // Extraer timestamp del nombre
                const match = key.match(/_(\d+)$/);
                if (match) {
                    backups.push({
                        key: key,
                        timestamp: parseInt(match[1])
                    });
                }
            } catch (e) {
                // Si no se puede leer, eliminar
                localStorage.removeItem(key);
            }
        }
    }
    
    // Ordenar por timestamp (más viejo primero)
    backups.sort((a, b) => a.timestamp - b.timestamp);
    
    // Eliminar los más antiguos
    if (backups.length > mantener) {
        const eliminar = backups.slice(0, backups.length - mantener);
        eliminar.forEach(b => {
            localStorage.removeItem(b.key);
            console.log(`🗑️ Backup eliminado: ${b.key}`);
        });
    }
}

// Eliminar TODO excepto el inventario
function eliminarTodoExceptoInventario() {
    const clavesAEliminar = [];
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== 'inventory') {
            clavesAEliminar.push(key);
        }
    }
    
    clavesAEliminar.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Eliminado para liberar espacio: ${key}`);
    });
}

// Mostrar alerta de emergencia al usuario
function mostrarAlertaEmergencia() {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #DC2626;
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 99999;
        box-shadow: 0 10px 25px rgba(220, 38, 38, 0.3);
        max-width: 500px;
        text-align: center;
        animation: slideDown 0.5s ease;
    `;
    
    alertDiv.innerHTML = `
        <h3 style="margin-top: 0; color: white;">🚨 ALERTA DE EMERGENCIA</h3>
        <p>El almacenamiento local estaba <strong>completamente lleno</strong>.</p>
        <p><strong>Se eliminaron las ventas para salvar el inventario.</strong></p>
        <p>Exporta un backup AHORA para evitar pérdida de datos.</p>
        <div style="margin-top: 15px;">
            <button onclick="exportarBackupEmergencia()" style="
                background: white;
                color: #DC2626;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                font-weight: bold;
                cursor: pointer;
                margin-right: 10px;
            ">
                💾 EXPORTAR BACKUP AHORA
            </button>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: transparent;
                color: white;
                border: 1px solid white;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">
                Entendido
            </button>
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Agregar animación si no existe
    if (!document.querySelector('#alert-animation')) {
        const style = document.createElement('style');
        style.id = 'alert-animation';
        style.textContent = `
            @keyframes slideDown {
                from { top: -100px; opacity: 0; }
                to { top: 20px; opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Auto-eliminar después de 30 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.style.animation = 'slideUp 0.5s ease';
            setTimeout(() => alertDiv.remove(), 500);
        }
    }, 30000);
}

// Función rápida para exportar en emergencia
function exportarBackupEmergencia() {
    if (window.backupManager) {
        const resultado = window.backupManager.exportarDatos();
        alert('✅ ' + resultado + '\n\nGuarda este archivo en un lugar seguro.');
    } else {
        // Exportación manual simple
        const datos = {
            inventory: inventory,
            settings: settings,
            exportado: new Date().toISOString(),
            emergencia: true
        };
        
        const blob = new Blob([JSON.stringify(datos, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario_emergencia_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('✅ Backup de emergencia exportado. Guárdalo en un lugar seguro.');
    }
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
    const imageUrlInput = document.getElementById('productImageUrl').value.trim();
    
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
async function uploadImageToCloudinary(file) {
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

// ==================== FUNCIONES DE BACKUP UI ====================

function mostrarPanelBackup() {
    const pin = prompt('Ingrese su PIN para acceder a la gestión de backups:');
    if (pin !== settings.pin) {
        alert('PIN incorrecto');
        return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'backupModal';
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 10000;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        font-family: Arial, sans-serif;
    `;
    
    let diagnostico = '';
    if (window.backupManager) {
        diagnostico = backupManager.mostrarDiagnostico();
    } else {
        diagnostico = generarDiagnosticoBasico();
    }
    
    let backupsList = '<h4 style="color: #667eea; margin-top: 20px;">📁 Backups disponibles:</h4>';
    const backups = obtenerBackupsDisponibles();
    
    if (backups.length > 0) {
        backupsList += '<ul style="max-height: 150px; overflow-y: auto; padding-left: 20px;">';
        backups.forEach(backup => {
            const fecha = new Date(backup.timestamp).toLocaleString();
            backupsList += `<li style="margin: 5px 0;">${fecha} - ${backup.items || 0} productos</li>`;
        });
        backupsList += '</ul>';
    } else {
        backupsList += '<p style="color: #999;">No hay backups disponibles</p>';
    }
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
            <h2 style="margin: 0; color: #333;">🔒 Gestión de Backups</h2>
            <button onclick="cerrarPanelBackup()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
        </div>
        
        ${diagnostico}
        
        ${backupsList}
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 30px;">
            <button onclick="exportarBackupManual()" style="padding: 12px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">💾 Exportar Backup</button>
            <button onclick="mostrarImportarBackup()" style="padding: 12px; background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">📤 Importar Backup</button>
            <button onclick="crearBackupManual()" style="padding: 12px; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">⚡ Crear Backup Ahora</button>
            <button onclick="mostrarAyudaBackup()" style="padding: 12px; background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">❓ Ayuda</button>
        </div>
        
        <input type="file" id="importBackupFile" accept=".json" style="display: none;" onchange="importarBackupManual(this.files[0])">
        
        <div style="margin-top: 20px; text-align: center; color: #666; font-size: 0.9em;"><p>💡 Los datos se guardan solo en esta computadora</p></div>
    `;
    
    const overlay = document.createElement('div');
    overlay.id = 'backupOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
    `;
    overlay.onclick = cerrarPanelBackup;
    
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

function generarDiagnosticoBasico() {
    const espacioUsado = JSON.stringify(localStorage).length;
    return `
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #333;">🩺 Diagnóstico del Sistema</h3>
            <p><strong>📊 Espacio usado:</strong> ${Math.round(espacioUsado / 1024)}KB</p>
            <p><strong>📦 Productos en inventario:</strong> ${inventory.length}</p>
            <p><strong>💰 Ventas registradas:</strong> ${sales.length}</p>
            <p><strong>🔐 PIN configurado:</strong> ${settings.pin ? 'Sí' : 'No'}</p>
        </div>
    `;
}

function obtenerBackupsDisponibles() {
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('backup') || key.startsWith('inventario_backup_')) {
            try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.timestamp) {
                    backups.push({
                        key: key,
                        timestamp: data.timestamp,
                        items: data.inventory ? data.inventory.length : 0
                    });
                }
            } catch (e) {}
        }
    }
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return backups;
}

function cerrarPanelBackup() {
    const modal = document.getElementById('backupModal');
    const overlay = document.getElementById('backupOverlay');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
}

function exportarBackupManual() {
    const datos = {
        inventory: inventory,
        sales: sales,
        settings: settings,
        metadata: {
            exportado: new Date().toISOString(),
            version: '1.0',
            totalProductos: inventory.length,
            totalVentas: sales.length
        }
    };
    
    const blob = new Blob([JSON.stringify(datos, null, 2)], {
        type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    if (window.backupManager) {
        backupManager.mostrarNotificacion(`Backup exportado con ${inventory.length} productos`, 'success');
    } else {
        alert(`✅ Backup exportado con ${inventory.length} productos`);
    }
    
    cerrarPanelBackup();
}

function mostrarImportarBackup() {
    document.getElementById('importBackupFile').click();
}

async function importarBackupManual(file) {
    if (!file) return;
    
    if (!confirm('⚠️ ¿Importar backup? Esto reemplazará TODOS los datos actuales.')) {
        return;
    }
    
    try {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const datos = JSON.parse(e.target.result);
                
                if (!datos.inventory || !Array.isArray(datos.inventory)) {
                    throw new Error('Formato de archivo inválido');
                }
                
                const opcion = prompt(
                    '¿Qué datos importar?\n\n' +
                    '1. Todo (inventario, ventas, configuración)\n' +
                    '2. Solo inventario\n' +
                    '3. Solo ventas\n' +
                    '4. Solo configuración\n\n' +
                    'Ingrese el número (1-4):'
                );
                
                switch(opcion) {
                    case '1':
                        inventory = datos.inventory;
                        sales = datos.sales || [];
                        settings = datos.settings || settings;
                        break;
                    case '2':
                        inventory = datos.inventory;
                        break;
                    case '3':
                        sales = datos.sales || [];
                        break;
                    case '4':
                        settings = datos.settings || settings;
                        break;
                    default:
                        alert('Opción inválida');
                        return;
                }
                
                saveData();
                renderInventory();
                updateCart();
                loadSettings();
                
                alert(`✅ Datos importados exitosamente\nProductos: ${inventory.length}\nVentas: ${sales.length}`);
                
                cerrarPanelBackup();
                
            } catch (error) {
                alert('Error: ' + error.message);
            }
        };
        
        reader.onerror = () => alert('Error leyendo archivo');
        reader.readAsText(file);
        
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function crearBackupManual() {
    if (window.backupManager) {
        backupManager.crearBackupAutomatico();
        backupManager.mostrarNotificacion('✅ Backup creado manualmente', 'success');
    } else {
        const timestamp = new Date().toISOString();
        const backupData = {
            inventory: inventory,
            sales: sales,
            settings: settings,
            timestamp: timestamp,
            version: '1.0'
        };
        
        const backupKey = `inventario_backup_${Date.now()}`;
        localStorage.setItem(backupKey, JSON.stringify(backupData));
        
        alert(`Backup creado: ${inventory.length} productos`);
    }
    
    cerrarPanelBackup();
}

function mostrarAyudaBackup() {
    alert(`🔒 GUÍA DE BACKUP - INVENTARIO LOCAL\n\n📌 IMPORTANTE:\n• Los datos SOLO se guardan en ESTA computadora\n• No se sincronizan con otras dispositivos\n• Sin internet requerido\n\n💾 Exportar (RECOMENDADO):\n1. Haz clic en "Exportar Backup"\n2. Se descargará un archivo .json\n3. Guárdalo en USB, correo o nube\n4. Haz esto SEMANALMENTE\n\n📤 Importar:\n• Restaura desde un archivo .json\n• REEMPLAZA los datos actuales\n\n⚠️ CONSEJOS DE SEGURIDAD:\n1. Exporta backup CADA SEMANA\n2. Guarda en al menos 2 lugares diferentes\n3. Mantén tu PIN seguro`);
}
// ==================== FIN FUNCIONES BACKUP UI ====================