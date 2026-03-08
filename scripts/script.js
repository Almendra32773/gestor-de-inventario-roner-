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
let scannerBuffer = ''; // ✅ NUEVO: Buffer para acumular caracteres del escáner
let scannerTimeout = null; // ✅ NUEVO: Timeout para detectar fin de escaneo
let currentInputFocus = null; // ✅ NUEVO: Para saber qué input tiene el foco
// Variables para pago combinado
let combinedPayments = [];
let currentTotal = 0;

// ✅✅✅ AGREGAR ESTO DESPUÉS DE LAS VARIABLES GLOBALES ✅✅✅
// Configuración del escáner
const SCANNER_CONFIG = {
    DELAY: 50, // Tiempo entre caracteres para detectar escaneo (ms)
    MIN_LENGTH: 8, // Longitud mínima para considerar como código de barras
    MAX_LENGTH: 20, // Longitud máxima para código de barras
    TERMINATOR: 'Enter', // Tecla que termina el escaneo (usualmente Enter)
};

// Constantes para imágenes
const DEFAULT_IMAGE = '/icon/icon.ico';
const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23f0f0f0\'/%3E%3Ctext x=\'50\' y=\'50\' font-size=\'14\' text-anchor=\'middle\' dy=\'.3em\' fill=\'%23999\'%3ESin imagen%3C/text%3E%3C/svg%3E';

// ✅✅✅ AGREGAR ESTO EN SU LUGAR ✅✅✅
console.log('🔧 Script.js cargado - Sistema universal iniciado');

// ==================== SISTEMA DE ESCÁNER UNIVERSAL ====================
class ScannerManager {
    constructor() {
        this.buffer = '';
        this.timeout = null;
        this.lastKeyTime = 0;
        this.isScanning = false;
        this.active = true;
        this.initialize();
    }
    
    initialize() {
        console.log('🔧 ScannerManager iniciado');
        this.setupEventListeners();
        this.updateScannerStatus();
    }
    
    setupEventListeners() {
        // Escuchar todas las teclas presionadas
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keypress', (e) => this.handleKeyPress(e));
        
        // Trackear inputs activos
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                currentInputFocus = e.target;
                console.log(`📝 Input con foco: ${e.target.id || e.target.className}`);
            }
        });
        
        document.addEventListener('focusout', () => {
            currentInputFocus = null;
        });
    }
    
    handleKeyDown(e) {
        // Si es la tecla Enter, procesar buffer como código de barras
        if (e.key === 'Enter' && this.buffer.length >= SCANNER_CONFIG.MIN_LENGTH) {
            e.preventDefault();
            this.processBarcode(this.buffer);
            this.buffer = '';
            this.isScanning = false;
            return;
        }
        
        // Limpiar buffer si se presiona Escape
        if (e.key === 'Escape') {
            this.buffer = '';
            this.isScanning = false;
        }
    }
    
    handleKeyPress(e) {
        // Solo procesar si no está en un input manual (a menos que sea búsqueda)
        const isSearchInput = currentInputFocus && 
            (currentInputFocus.id === 'searchInput' || 
             currentInputFocus.id === 'productBarcode');
        
        // Si está en un input de búsqueda o código de barras, permitir entrada manual
        if (isSearchInput && e.key !== 'Enter') {
            return; // Dejar que el input maneje la entrada
        }
        
        // Si es un carácter imprimible y no en otro input
        if (e.key.length === 1 && !currentInputFocus) {
            const now = Date.now();
            
            // Si pasó mucho tiempo desde la última tecla, reiniciar buffer
            if (now - this.lastKeyTime > 200) {
                this.buffer = '';
            }
            
            this.buffer += e.key;
            this.lastKeyTime = now;
            this.isScanning = true;
            
            // Procesar automáticamente si alcanza longitud de código de barras
            if (this.buffer.length >= SCANNER_CONFIG.MIN_LENGTH) {
                clearTimeout(this.timeout);
                this.timeout = setTimeout(() => {
                    if (this.buffer.length >= SCANNER_CONFIG.MIN_LENGTH && 
                        this.buffer.length <= SCANNER_CONFIG.MAX_LENGTH) {
                        this.processBarcode(this.buffer);
                        this.buffer = '';
                        this.isScanning = false;
                    }
                }, SCANNER_CONFIG.DELAY);
            }
        }
    }
    
    processBarcode(barcode) {
        console.log(`📷 Código escaneado: ${barcode}`);
        
        // Limpiar barcode (remover caracteres especiales)
        const cleanBarcode = barcode.trim().replace(/[^a-zA-Z0-9]/g, '');
        
        // Determinar en qué sección estamos
        const activeSection = document.querySelector('.section.active');
        if (!activeSection) return;
        
        const sectionId = activeSection.id;
        
        switch(sectionId) {
            case 'nuevaVenta':
                this.handleSaleScan(cleanBarcode);
                break;
                
            case 'inventario':
                // Si el modal de agregar/editar producto está abierto
                if (document.getElementById('addProductModal').style.display === 'block') {
                    this.handleProductFormScan(cleanBarcode);
                }
                break;
                
            default:
                // Para cualquier otra sección, buscar producto
                this.searchProduct(cleanBarcode);
        }
    }
    
    handleSaleScan(barcode) {
        console.log(`🛒 Buscando producto para venta: ${barcode}`);
        
        // Buscar producto por código de barras
        const product = inventory.find(p => 
            p.barcode && p.barcode.toString() === barcode.toString()
        );
        
        if (product) {
            console.log(`✅ Producto encontrado: ${product.name}`);
            addToCart(product);
            
            // Mostrar notificación visual
            this.showScanNotification(`✓ ${product.name} agregado`, 'success');
            
            // Limpiar barra de búsqueda si tiene texto
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                document.getElementById('searchResults').innerHTML = '';
            }
        } else {
            console.log(`❌ Producto no encontrado: ${barcode}`);
            this.showScanNotification(`Producto no encontrado (${barcode})`, 'error');
            
            // Poner el código en la barra de búsqueda para búsqueda manual
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = barcode;
                searchInput.focus();
                // Disparar evento de búsqueda
                const event = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(event);
            }
        }
    }
    
    handleProductFormScan(barcode) {
        console.log(`📝 Rellenando código en formulario: ${barcode}`);
        
        const barcodeInput = document.getElementById('productBarcode');
        if (barcodeInput) {
            barcodeInput.value = barcode;
            this.showScanNotification(`Código ${barcode} asignado`, 'info');
            
            // Si estamos editando, buscar automáticamente el producto
            if (editingProductId) {
                this.searchProductInForm(barcode);
            }
        }
    }
    
    searchProductInForm(barcode) {
        // Buscar si ya existe un producto con este código
        const existingProduct = inventory.find(p => 
            p.barcode && p.barcode.toString() === barcode.toString() && 
            p.id !== editingProductId
        );
        
        if (existingProduct) {
            if (confirm(`⚠️ El código ${barcode} ya existe para: ${existingProduct.name}\n¿Deseas fusionar el stock?`)) {
                // Actualizar el producto que se está editando con los datos del existente
                const product = inventory.find(p => p.id === editingProductId);
                if (product) {
                    product.totalUnits += existingProduct.totalUnits;
                    product.initialStock += existingProduct.totalUnits;
                    
                    // Eliminar el producto duplicado
                    inventory = inventory.filter(p => p.id !== existingProduct.id);
                    
                    saveData();
                    this.showScanNotification(`Stock fusionado con ${existingProduct.name}`, 'success');
                }
            }
        }
    }
    
    searchProduct(barcode) {
        // Poner el código en la barra de búsqueda principal
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = barcode;
            searchInput.focus();
            
            // Disparar evento de búsqueda
            const event = new Event('input', { bubbles: true });
            searchInput.dispatchEvent(event);
            
            this.showScanNotification(`Buscando: ${barcode}`, 'info');
        }
    }
    
    showScanNotification(message, type = 'info') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = 'scan-notification';
        notification.textContent = message;
        
        // Estilos basados en el tipo
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            info: '#3B82F6',
            warning: '#F59E0B'
        };
        
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-eliminar después de 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
        
        // Agregar animaciones CSS si no existen
        if (!document.querySelector('#scan-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'scan-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    updateScannerStatus() {
        const statusElement = document.getElementById('scannerStatus');
        if (statusElement) {
            statusElement.textContent = this.active ? 
                '📷 Escáner activo - Escanee código de barras' : 
                '📴 Escáner desactivado';
            statusElement.style.color = this.active ? '#10B981' : '#6B7280';
        }
    }
    
    toggleScanner() {
        this.active = !this.active;
        this.updateScannerStatus();
        console.log(`Escáner ${this.active ? 'activado' : 'desactivado'}`);
        return this.active;
    }
    
    getStatus() {
        return {
            active: this.active,
            isScanning: this.isScanning,
            buffer: this.buffer,
            bufferLength: this.buffer.length
        };
    }
}

// Instanciar el ScannerManager
const scannerManager = new ScannerManager();
window.scannerManager = scannerManager;

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

// ==================== CONFIGURAR INPUTS PARA ESCÁNER ====================
// Configurar inputs cuando se abren modales
document.addEventListener('DOMContentLoaded', function() {
    // Configurar input de código de barras en formulario
    const barcodeInput = document.getElementById('productBarcode');
    if (barcodeInput) {
        barcodeInput.addEventListener('focus', function() {
            console.log('📝 Listo para escanear código de barras en formulario');
        });
    }
    
    // Configurar input de búsqueda
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('focus', function() {
            console.log('🔍 Listo para escanear en búsqueda');
        });
    }
});

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
    //Actualizar estado del escáner en la UI
    scannerManager.updateScannerStatus();
});

// Cerrar sesión al cerrar pestaña
window.addEventListener('beforeunload', function() {
    logout();
});

// Cargar datos del localStorage CON RECUPERACIÓN Y SUPABASE
async function loadData() {
    console.log('🔍 Cargando datos (Sistema Dual)...');
    
    // Opción 1: Intentar cargar desde Supabase primero
    if (window.usarSupabase && window.supabaseClient) {
        console.log('🔄 Intentando cargar desde Supabase...');
        const exito = await cargarDesdeSupabase();
        
        if (exito) {
            console.log(`✅ Datos cargados desde Supabase: ${inventory.length} productos`);
            return; // ¡Éxito! Salir de la función
        }
    }
    
    // Opción 2: Si Supabase falla, usar localStorage normal
    console.log('📴 Cargando desde localStorage...');
    cargarDesdeLocalStorage();
}

// Función para cargar desde Supabase - VERSIÓN MEJORADA
async function cargarDesdeSupabase() {
    try {
        console.log('🌐 Conectando a Supabase...');
        
        // Verificar que el cliente existe
        if (!window.supabaseClient) {
            console.error('❌ ERROR: window.supabaseClient no existe');
            return false;
        }
        
        console.log('✅ Cliente Supabase encontrado');
        
        // 1. CARGAR PRODUCTOS desde Supabase
        console.log('📥 Solicitando productos...');
        const { data: productos, error: errorProductos, count } = await window.supabaseClient
            .from('productos')
            .select('*', { count: 'exact' })
            .order('name', { ascending: true });
        
        if (errorProductos) {
            console.error('❌ ERROR CARGANDO PRODUCTOS:');
            console.error('   • Mensaje:', errorProductos.message);
            console.error('   • Detalles:', errorProductos.details);
            console.error('   • Código:', errorProductos.code);
            return false;
        }
        
        console.log(`📊 Supabase respondió: ${productos ? productos.length : 'null'} productos`);
        console.log(`📊 Conteo exacto: ${count} productos`);
        
        // VERIFICACIÓN CRÍTICA: productos podría ser null
        if (!productos) {
            console.error('❌ ERROR: productos es null o undefined');
            return false;
        }
        
        if (productos.length === 0) {
            console.log('📭 Supabase está vacío (0 productos)');
            return false;
        }
        
        // DEBUG: Mostrar primer producto para ver estructura
        console.log('🔍 Estructura del primer producto:', productos[0]);
        console.log('🔍 Campos disponibles:', Object.keys(productos[0]));
        
        // Convertir formato Supabase → Formato de tu app
        console.log('🗺️ Mapeando productos...');
        try {
            inventory = productos.map(p => ({
                id: p.id,
                name: p.name || 'Sin nombre',
                size: p.size || '',
                price: parseFloat(p.price) || 0,
                stockType: p.stocktype || 'units',
                unitsPerContainer: p.unitspercontainer || 1,
                totalUnits: p.totalunits || 0,
                initialStock: p.initialstock || 0,
                barcode: p.barcode || '',
                image: p.image || '/icon/icon.ico'
            }));
            
            console.log(`✅ ${inventory.length} productos mapeados correctamente`);
            
            // Verificar que se mapearon correctamente
            if (inventory.length === 0) {
                console.error('❌ ERROR: Mapeo resultó en 0 productos');
                return false;
            }
            
            // Guardar en localStorage como backup
            localStorage.setItem('inventory', JSON.stringify(inventory));
            console.log('💾 Inventario guardado en localStorage');
            
        } catch (mapeoError) {
            console.error('❌ ERROR EN MAPEO:', mapeoError);
            console.error('Producto problemático:', mapeoError.producto || 'desconocido');
            return false;
        }
        
        // 2. CARGAR VENTAS desde Supabase (opcional)
        console.log('💰 Cargando ventas...');
        try {
            const { data: ventas, error: errorVentas } = await window.supabaseClient
                .from('ventas')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500);
            
            if (errorVentas) {
                console.log('⚠️ No se pudieron cargar ventas:', errorVentas.message);
            } else if (ventas && ventas.length > 0) {
                sales = ventas.map(v => ({
                    id: v.id,
                    date: v.date || v.created_at,
                    paymentMethod: v.paymentmethod || 'Efectivo',
                    items: v.items,
                    total: parseFloat(v.total) || 0
                }));
                
                console.log(`✅ ${sales.length} ventas cargadas desde Supabase`);
                localStorage.setItem('sales', JSON.stringify(sales));
            } else {
                console.log('📭 No hay ventas en Supabase');
            }
        } catch (errorVentas) {
            console.log('⚠️ Error cargando ventas (no crítico):', errorVentas.message);
        }
        
        console.log('🎉 CARGA DESDE SUPABASE COMPLETADA EXITOSAMENTE');
        return true;
        
    } catch (error) {
        console.error('💥 ERROR GRAVE en cargarDesdeSupabase:');
        console.error('   • Mensaje:', error.message);
        console.error('   • Stack:', error.stack);
        console.error('   • Tipo:', error.name);
        return false;
    }
}

// Función para cargar desde localStorage (tu código original adaptado)
function cargarDesdeLocalStorage() {
    console.log('💾 Usando almacenamiento local...');
    
    let cargadoCorrectamente = true;
    
    // Cargar inventario con recuperación
    try {
        const savedInventory = localStorage.getItem('inventory');
        if (savedInventory) {
            inventory = JSON.parse(savedInventory);
            console.log(`✅ Inventario local: ${inventory.length} productos`);
        } else {
            console.warn('⚠️ No se encontró inventario en localStorage');
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
            console.log(`✅ Ventas locales: ${sales.length} registros`);
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
    
    // Si no se cargó correctamente, intentar recuperar desde backup
    if (!cargadoCorrectamente) {
        console.log('🔄 Intentando recuperar desde backup...');
        if (window.backupManager) {
            const datosRecuperados = window.backupManager.recuperarBackup();
            if (datosRecuperados && datosRecuperados.length > 0) {
                inventory = datosRecuperados;
                console.log(`🔄 Inventario recuperado: ${inventory.length} productos`);
            }
        }
    }
    
    // Verificar espacio después de cargar
    setTimeout(() => {
        if (window.backupManager) {
            window.backupManager.verificarEspacioDisponible();
        }
    }, 1000);
}

// Guardar datos en localStorage Y Supabase
async function saveData() {
    console.log('💾 Guardando datos (Sistema Dual)...');
    
    let guardadoLocal = false;
    let guardadoSupabase = false;
    
    // 1. PRIMERO: Guardar en localStorage (siempre)
    try {
        localStorage.setItem('inventory', JSON.stringify(inventory));
        localStorage.setItem('sales', JSON.stringify(sales));
        localStorage.setItem('settings', JSON.stringify(settings));
        
        console.log('✅ Datos guardados en localStorage');
        guardadoLocal = true;
        
        // Crear backup automático
        if (window.backupManager) {
            setTimeout(() => window.backupManager.crearBackupAutomatico(), 100);
        }
        
    } catch (error) {
        console.error('❌ Error al guardar en localStorage:', error);
        
        // Si hay error de espacio, activar protección
        if (error.name === 'QuotaExceededError') {
            console.error('💥 ESPACIO LLENO! Activando protección...');
        }
    }
    
    // 2. SEGUNDO: Intentar guardar en Supabase (si está disponible)
    if (window.usarSupabase && window.supabaseClient) {
        guardadoSupabase = await sincronizarConSupabase();
    }
    
    return guardadoLocal; // Devolver éxito del localStorage
}

// Función para sincronizar con Supabase
async function sincronizarConSupabase() {
    try {
        console.log('🔄 Sincronizando con Supabase...');
        
        let productosSincronizados = 0;
        let ventasSincronizadas = 0;
        
        // 1. SINCRONIZAR PRODUCTOS
        if (inventory.length > 0) {
            // Preparar TODOS los productos de una vez (más eficiente)
            const productosParaSupabase = inventory.map(producto => ({
                id: producto.id.toString(),
                codigo: producto.barcode || '',
                name: producto.name,
                size: producto.size || '',
                price: parseFloat(producto.price) || 0,
                stocktype: producto.stockType || 'units',
                unitspercontainer: parseInt(producto.unitsPerContainer) || 1,
                totalunits: parseInt(producto.totalUnits) || 0,
                initialstock: parseInt(producto.initialStock) || 0,
                barcode: producto.barcode || '',
                image: producto.image || '/icon/icon.ico'
            }));
            
            console.log(`📤 Enviando ${productosParaSupabase.length} productos...`);
            
            const { error: errorProductos } = await window.supabaseClient
                .from('productos')
                .upsert(productosParaSupabase, { onConflict: 'id' });
            
            if (errorProductos) {
                console.error('❌ Error sincronizando productos:', errorProductos);
                
                // Intentar uno por uno si falla el batch
                console.log('🔄 Intentando uno por uno...');
                for (const productoData of productosParaSupabase) {
                    try {
                        const { error } = await window.supabaseClient
                            .from('productos')
                            .upsert([productoData], { onConflict: 'id' });
                        
                        if (!error) productosSincronizados++;
                    } catch (e) {
                        console.error(`❌ Error con producto ${productoData.id}:`, e);
                    }
                }
            } else {
                productosSincronizados = inventory.length;
                console.log(`✅ ${productosSincronizados} productos sincronizados`);
            }
        }
        
        // 2. SINCRONIZAR VENTAS
        if (sales.length > 0) {
            // Tomar solo ventas recientes (últimas 50)
            const ventasRecientes = sales.slice(-50);
            const ventasParaSupabase = ventasRecientes.map(venta => ({
                id: venta.id,
                date: venta.date,
                paymentmethod: venta.paymentMethod || 'Efectivo',
                total: parseFloat(venta.total) || 0,
                items: venta.items // JSONB como lo definiste
            }));
            
            console.log(`📤 Enviando ${ventasParaSupabase.length} ventas...`);
            
            const { error: errorVentas } = await window.supabaseClient
                .from('ventas')
                .upsert(ventasParaSupabase, { onConflict: 'id' });
            
            if (errorVentas) {
                console.error('❌ Error sincronizando ventas:', errorVentas);
                
                // Intentar una por una
                for (const ventaData of ventasParaSupabase) {
                    try {
                        const { error } = await window.supabaseClient
                            .from('ventas')
                            .insert([ventaData])
                            .select(); // Agregar select() para mejor debugging
                        
                        if (!error) ventasSincronizadas++;
                    } catch (e) {
                        console.error(`❌ Error con venta ${ventaData.id}:`, e);
                    }
                }
            } else {
                ventasSincronizadas = ventasRecientes.length;
                console.log(`✅ ${ventasSincronizadas} ventas sincronizadas`);
            }
        }
        
        console.log(`🎉 Sincronización completada: ${productosSincronizados} productos, ${ventasSincronizadas} ventas`);
        return true;
        
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        return false;
    }
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
// ==================== MODIFICACIONES EN BÚSQUEDA ====================
// Modificar el event listener de búsqueda para que no interfiera con el escáner
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
});


// añadir producto al carrito desde búsqueda
function addProductToCart() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    // Buscar por código de barras primero
    const productByBarcode = inventory.find(p => 
        p.barcode && p.barcode.toString() === query.toString()
    );
    
    if (productByBarcode) {
        addToCart(productByBarcode);
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
        return;
    }
    
    // Si no encontró por código, buscar por nombre
    const productByName = inventory.find(p => 
        p.name.toLowerCase() === query.toLowerCase()
    );
    
    if (productByName) {
        addToCart(productByName);
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    } else {
        alert('Producto no encontrado');
    }
}

// agregar producto al carrito
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

// ==================== MODIFICACIONES EN FUNCIONES DE ESCÁNER ====================
function toggleScanner() {
    const isActive = scannerManager.toggleScanner();
    
    // Mostrar notificación visual
    scannerManager.showScanNotification(
        `Escáner ${isActive ? 'activado' : 'desactivado'}`,
        isActive ? 'success' : 'warning'
    );
    
    return isActive;
}

// Función para mostrar estado del escáner en diferentes inputs
function setupScannerForInput(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.addEventListener('focus', function() {
            console.log(`🔍 Scanner listo para: ${inputId}`);
            // No hacemos nada especial, el ScannerManager ya maneja esto
        });
    }
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
        paymentMethod: paymentMethod,  //AQUI SI HAY 
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
    
    // ✅ NUEVO: Sincronizar venta con Supabase
    // En registerSale(), después de sales.push(sale);
    if (window.usarSupabase && window.supabaseClient) {
        setTimeout(async () => {
            try {
                const ventaData = {
                    id: saleId,
                    date: now.toISOString(), // Usar formato ISO
                    paymentmethod: paymentMethod,
                    total: total,
                    items: cart
                };
                
                console.log('💰 Registrando venta en Supabase:', ventaData);
                
                const { data, error } = await window.supabaseClient
                    .from('ventas')
                    .insert([ventaData]);
                
                if (error) {
                    console.error('❌ Error registrando venta:', error);
                } else {
                    console.log('✅ Venta registrada en Supabase');
                    
                    // Actualizar stock de cada producto en Supabase
                    for (const cartItem of cart) {
                        const product = inventory.find(p => p.id === cartItem.id);
                        if (product) {
                            await window.supabaseClient
                                .from('productos')
                                .update({ 
                                    totalunits: product.totalUnits 
                                })
                                .eq('id', product.id);
                        }
                    }
                }
            } catch (error) {
                console.error('⚠️ Error en registro Supabase:', error);
            }
        }, 100);
    }
    
    // Mostrar resumen
    showSaleReceipt(sale);
}

// ==================== PAGO COMBINADO ====================

// Mostrar modal de pago combinado
function showCombinedPaymentModal() {
    if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    
    // Calcular total
    currentTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Inicializar con un método de pago
    combinedPayments = [{
        method: 'Efectivo',
        amount: 0
    }];
    
    updateCombinedPaymentModal();
    document.getElementById('combinedPaymentModal').style.display = 'block';
}

// Cerrar modal
function closeCombinedPaymentModal() {
    document.getElementById('combinedPaymentModal').style.display = 'none';
    combinedPayments = [];
}

// Actualizar contenido del modal
function updateCombinedPaymentModal() {
    const container = document.getElementById('combinedMethods');
    const totalSpan = document.getElementById('combinedTotalAmount');
    const remainingSpan = document.getElementById('remainingAmount');
    
    // Actualizar total
    totalSpan.textContent = formatCurrency(currentTotal);
    
    // Calcular suma de pagos
    const paidTotal = combinedPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    const remaining = currentTotal - paidTotal;
    remainingSpan.textContent = formatCurrency(Math.max(0, remaining));
    
    // Cambiar color según estado
    if (remaining <= 0) {
        remainingSpan.style.color = '#10ff7c';
    } else {
        remainingSpan.style.color = '#ff6b6b';
    }
    
    // Habilitar/deshabilitar botón de procesar
    const processBtn = document.getElementById('processCombinedBtn');
    processBtn.disabled = remaining > 0;
    processBtn.style.opacity = remaining > 0 ? '0.5' : '1';
    processBtn.style.cursor = remaining > 0 ? 'not-allowed' : 'pointer';
    
    // Generar filas de métodos de pago
    container.innerHTML = '';
    combinedPayments.forEach((payment, index) => {
        const row = document.createElement('div');
        row.className = 'payment-method-row';
        row.innerHTML = `
            <select class="payment-method-select" onchange="updatePaymentMethod(${index}, 'method', this.value)">
                <option value="Efectivo" ${payment.method === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                <option value="Punto de Venta" ${payment.method === 'Punto de Venta' ? 'selected' : ''}>Punto de Venta</option>
                <option value="Transferencia" ${payment.method === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                <option value="Pago P2P" ${payment.method === 'Pago P2P' ? 'selected' : ''}>Pago P2P</option>
                <option value="Biopago" ${payment.method === 'Biopago' ? 'selected' : ''}>Biopago</option>
                <option value="Divisas" ${payment.method === 'Divisas' ? 'selected' : ''}>Divisas</option>
            </select>
            <span>Monto:</span>
            <input type="number" step="0.01" min="0" value="${payment.amount}" 
                   onchange="updatePaymentMethod(${index}, 'amount', this.value)" 
                   placeholder="0.00">
            <button class="btn-remove-method" onclick="removePaymentMethod(${index})" 
                    ${combinedPayments.length === 1 ? 'disabled style="opacity:0.3;"' : ''}>×</button>
        `;
        container.appendChild(row);
    });
}

// Actualizar un método de pago
function updatePaymentMethod(index, field, value) {
    if (field === 'amount') {
        value = parseFloat(value) || 0;
    }
    
    combinedPayments[index][field] = value;
    updateCombinedPaymentModal();
}

// Agregar nuevo método de pago
function addPaymentMethod() {
    combinedPayments.push({
        method: 'Efectivo',
        amount: 0
    });
    updateCombinedPaymentModal();
}

// Eliminar método de pago
function removePaymentMethod(index) {
    if (combinedPayments.length > 1) {
        combinedPayments.splice(index, 1);
        updateCombinedPaymentModal();
    }
}

// Procesar pago combinado
function processCombinedPayment() {
    if (cart.length === 0) return;
    
    const paidTotal = combinedPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    
    if (paidTotal < currentTotal) {
        if (!confirm(`Faltan ${formatCurrency(currentTotal - paidTotal)}. ¿Registrar venta con deuda?`)) {
            return;
        }
    }
    
    // Crear descripción del pago combinado
    const paymentDescription = combinedPayments
        .filter(p => p.amount > 0)
        .map(p => `${p.method}: ${formatCurrency(p.amount)}`)
        .join(' + ');
    
    const cambio = paidTotal > currentTotal ? paidTotal - currentTotal : 0;
    const paymentMethodText = cambio > 0 
        ? `Pago Combinado (${paymentDescription}) - Cambio: ${formatCurrency(cambio)}`
        : `Pago Combinado (${paymentDescription})`;
    
    // Registrar la venta
    registerSale(paymentMethodText);
    
    // Cerrar modal
    closeCombinedPaymentModal();
    
    // Mostrar resumen detallado si hay cambio
    if (cambio > 0) {
        setTimeout(() => {
            alert(`💰 Cambio a devolver: ${formatCurrency(cambio)}`);
        }, 500);
    }
}

// Modificar la función registerSale para que acepte el texto completo del pago
// (La función registerSale ya existe, no necesitas modificarla porque acepta cualquier string)

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
            
        </div>
    `;
    
    content.innerHTML = receipt;
    modal.style.display = 'block';
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
        renderProductWithImage(product, grid);
    });
}

// Mostrar detalle de producto
function showProductDetail(product) {
    const sidebar = document.getElementById('inventorySidebar');
    
    const imgSrc = getValidImageUrl(product.image);
    const stockDisplay = formatStock(product);
    const convertedPrice = settings.convertTo && settings.convertTo !== settings.currency 
        ? formatCurrency(product.price * settings.conversionRate, settings.convertTo) 
        : '';
    
    sidebar.innerHTML = `
        <div class="product-detail">
            <img src="${imgSrc}" alt="${product.name}" 
                 onerror="this.src='${DEFAULT_IMAGE}'; this.onerror=null;">
            <h3>${product.name}</h3>
            <p><strong>Código:</strong> ${product.barcode || 'N/A'}</p>
            <p><strong>Tamaño:</strong> ${product.size || 'N/A'}</p>
            <p><strong>Precio:</strong> ${formatCurrency(product.price)}</p>
            ${convertedPrice ? `<p><strong>Precio convertido:</strong> ${convertedPrice}</p>` : ''}
            <p><strong>Stock:</strong> ${stockDisplay}</p>
            <p><strong>URL Imagen:</strong> <small>${product.image ? product.image.substring(0, 50) + '...' : 'No disponible'}</small></p>
            <button class="btn-inventory" onclick="printProductSingle('${product.id}')">Imprimir</button>
        </div>
    `;
}

// Imprimir un solo producto
function printProductSingle(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product) {
        alert('Producto no encontrado');
        return;
    }
    printProduct(product, 'Detalle de Producto');
}
                
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
    if (confirm('¿Está seguro de eliminar este producto?')) {
        const productId = editingProductId;
        
        // 1. Eliminar localmente
        inventory = inventory.filter(p => p.id !== productId);
        saveData();
        renderInventory();
        
        // 2. Intentar eliminar en Supabase
        if (window.usarSupabase && window.supabaseClient) {
            setTimeout(async () => {
                const exito = await borrarProductoEnSupabase(productId);
                if (!exito) {
                    alert('⚠️ Producto eliminado localmente pero hubo error en la nube');
                }
            }, 100);
        }
        
        closeAddProductModal();
        alert('Producto eliminado' + (window.usarSupabase ? ' (sincronizando...)' : ''));
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
            finalImageUrl = '/icon/icon.ico';
        }
    } catch (error) {
        console.error(error);
        alert('No se pudo subir la imagen. se uasará imagen por defecto.');
        finalImageUrl = '/icon/icon.ico';
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
    
    // ✅ CORREGIDO: Sincronización inmediata con Supabase
    if (window.usarSupabase && window.supabaseClient) {
        setTimeout(async () => {
            try {
                // DETERMINAR EL ID CORRECTO:
                let productId;
                let productToSync;
                
                if (editingProductId) {
                    // Caso 1: Estamos EDITANDO
                    productId = editingProductId;
                    productToSync = inventory.find(p => p.id === editingProductId);
                } else {
                    // Caso 2: Estamos CREANDO
                    productToSync = inventory[inventory.length - 1];
                    productId = productToSync.id;
                }
                
                if (!productToSync) return;
                
                const productoData = {
                    id: productId,
                    codigo: productToSync.barcode || '',
                    name: productToSync.name,
                    size: productToSync.size || '',
                    price: parseFloat(productToSync.price) || 0,
                    stocktype: productToSync.stockType || 'units',
                    unitspercontainer: parseInt(productToSync.unitsPerContainer) || 1,
                    totalunits: parseInt(productToSync.totalUnits) || 0,
                    initialstock: parseInt(productToSync.initialStock) || 0,
                    barcode: productToSync.barcode || '',
                    image: productToSync.image || '/icon/icon.ico'
                };
                
                console.log('📤 Sincronizando producto:', productoData.name);
                
                const { error } = await window.supabaseClient
                    .from('productos')
                    .upsert([productoData], { onConflict: 'id' });
                
                if (error) {
                    console.error('❌ Error:', error);
                } else {
                    console.log('✅ Producto sincronizado');
                }
            } catch (error) {
                console.error('⚠️ Error:', error);
            }
        }, 100);
    }
}); // ← fin del evento submit

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
    if (inventory.length === 0) {
        alert('No hay productos en el inventario');
        return;
    }
    printProduct(inventory, 'Inventario Completo');
}

// Verificar stock bajo
function checkLowStock() {
    inventory.forEach(product => {
        if (product.initialStock > 0) {
            const stockPercentage = (product.totalUnits / product.initialStock) * 100;
            if (stockPercentage <= settings.stockWarning && stockPercentage > 0) {
                //alerta de stock bajo
                //alert(`⚠️ Queda poco Stock de ${product.name}`);
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
// Modifica esta parte en viewSalesRecord (opcional)
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
            
            // Detectar si es pago combinado para mostrarlo bonito
            let paymentDisplay = sale.paymentMethod;
            if (sale.paymentMethod.startsWith('Pago Combinado')) {
                paymentDisplay = `🔄 ${sale.paymentMethod}`; // Agregar un emoji
            }
            
            div.innerHTML = `
                <p><strong>ID:</strong> ${sale.id}</p>
                <p><strong>Fecha:</strong> ${sale.date}</p>
                <p><strong>Forma de pago:</strong> ${paymentDisplay}</p>
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

// Borrar registro de ventas
function deleteSalesRecord() {
    if (confirm('¿Está seguro de borrar todo el registro de ventas?')) {
        // 1. Eliminar localmente
        sales = [];
        saveData();
        
        // 2. Intentar eliminar en Supabase
        if (window.usarSupabase && window.supabaseClient) {
            setTimeout(async () => {
                const exito = await borrarVentasEnSupabase();
                if (!exito) {
                    alert('⚠️ Ventas eliminadas localmente pero hubo error en la nube');
                }
            }, 100);
        }
        
        alert('Registro de ventas eliminado' + (window.usarSupabase ? ' (sincronizando...)' : ''));
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
        
        // Agregar sincronización con Supabase
        if (window.usarSupabase && window.supabaseClient) {
            setTimeout(async () => {
                await borrarVentasEnSupabase();
            }, 100);
        }
        
        localStorage.setItem('lastAutoDeleteCheck', now.toISOString());
    }
}

// ==================== UTILIDADES ====================

// Subir imagen a Cloudinary y devolver la URL
// Modificar uploadImageToCloudinary
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
    
    // IMPORTANTE: Usar la versión https y con transformaciones básicas
    let secureUrl = data.secure_url;
    
    // Agregar timestamp para evitar caché (opcional)
    if (!secureUrl.includes('?')) {
        secureUrl += `?t=${Date.now()}`;
    }
    
    console.log('✅ Imagen subida a Cloudinary:', secureUrl);
    return secureUrl;
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

// Función mejorada para validar y cargar imágenes
function getValidImageUrl(imageUrl) {
    if (!imageUrl || imageUrl === '') {
        return DEFAULT_IMAGE;
    }
    
    // Si es URL de Cloudinary, asegurar que sea https y tenga el formato correcto
    if (imageUrl.includes('cloudinary.com')) {
        // Asegurar que sea HTTPS
        imageUrl = imageUrl.replace('http://', 'https://');
        
        // Agregar parámetros de optimización si no existen
        if (!imageUrl.includes('/upload/')) {
            return imageUrl;
        }
        
        // Agregar transformaciones para mejorar carga
        // q_auto: calidad automática, f_auto: formato automático
        return imageUrl.replace('/upload/', '/upload/q_auto,f_auto/');
    }
    
    // Si es URL relativa, asegurar que empiece con /
    if (imageUrl.startsWith('./') || imageUrl.startsWith('../')) {
        return DEFAULT_IMAGE;
    }
    
    return imageUrl;
}

// Función mejorada para renderizar producto con manejo de errores de imagen
function renderProductWithImage(product, container) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    // Verificar stock bajo
    if (product.initialStock > 0) {
        const stockPercentage = (product.totalUnits / product.initialStock) * 100;
        if (stockPercentage <= settings.stockWarning) {
            card.classList.add('low-stock');
        }
    }
    
    const img = document.createElement('img');
    const imgSrc = getValidImageUrl(product.image);
    img.src = imgSrc;
    img.alt = product.name;
    
    // Manejador de error de imagen
    img.onerror = function() {
        console.warn(`⚠️ Error cargando imagen para ${product.name}, usando fallback`);
        this.src = DEFAULT_IMAGE;
        this.onerror = null; // Prevenir bucle infinito
    };
    
    // Manejador de carga exitosa
    img.onload = function() {
        console.log(`✅ Imagen cargada para ${product.name}`);
    };
    
    card.appendChild(img);
    
    const nameP = document.createElement('p');
    nameP.innerHTML = `<strong>${product.name.substring(0, 35)}</strong>`;
    card.appendChild(nameP);
    
    const sizeP = document.createElement('p');
    sizeP.textContent = product.size || '';
    card.appendChild(sizeP);
    
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
    
    container.appendChild(card);
}

// Función para verificar imágenes guardadas
function checkSavedImages() {
    console.log('🔍 Verificando imágenes guardadas:');
    inventory.forEach(product => {
        console.log(`📸 ${product.name}: ${product.image ? 'URL: ' + product.image.substring(0, 50) + '...' : 'Sin imagen'}`);
    });
}

// Agregar función para recargar imágenes manualmente
function reloadProductImages() {
    console.log('🔄 Recargando todas las imágenes...');
    renderInventory();
    
    // Forzar recarga de imágenes en el sidebar si hay un producto seleccionado
    const sidebar = document.getElementById('inventorySidebar');
    if (sidebar.children.length > 0 && sidebar.children[0].classList.contains('product-detail')) {
        // Hay un producto mostrado, intentar recargar su imagen
        const img = sidebar.querySelector('img');
        if (img) {
            const originalSrc = img.src;
            img.src = ''; // Limpiar
            img.src = originalSrc; // Recargar
        }
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

// Sincronizar manualmente
async function sincronizarManual() {
    if (!window.usarSupabase || !window.supabaseClient) {
        alert('Supabase no disponible');
        return;
    }
    
    const resultado = await sincronizarConSupabase();
    
    if (resultado) {
        alert('✅ Sincronización completada\n\nLos datos locales y en la nube ahora están actualizados.');
    } else {
        alert('❌ Hubo errores en la sincronización\n\nRevisa la consola para más detalles.');
    }
}

// Verificar estado de conexión
function verificarConexionSupabase() {
    if (!window.supabaseClient) {
        return { estado: 'no_configurado', mensaje: 'Supabase no configurado' };
    }
    
    if (!window.usarSupabase) {
        return { estado: 'sin_conexion', mensaje: 'Sin conexión a Supabase' };
    }
    
    return { 
        estado: 'conectado', 
        mensaje: `✅ Conectado a Supabase\nURL: ${window.supabaseClient_CONFIG.url}` 
    };
}

// ==================== REGISTRAR FUNCIONES GLOBALES ====================

// Esta función se ejecutará cuando el script cargue
(function registrarTodasLasFunciones() {
    console.log('📝 Registrando funciones globales...');
    
    // Lista de TODAS las funciones que necesitan ser globales
    const funcionesGlobales = {
        // Sistema básico
        login: login,
        logout: logout,
        showSection: showSection,
        loadData: loadData,
        saveData: saveData,
        
        // Carrito y ventas
        addToCart: addToCart,
        addProductToCart: addProductToCart,
        removeFromCart: removeFromCart,
        addToCartFromCart: addToCartFromCart,
        registerSale: registerSale,
        printReceipt: window.printReceipt,
        continueSale: continueSale,
        cancelSale: cancelSale,
        
        // Escáner
        toggleScanner: toggleScanner,

        // Inventario
        showAddProductModal: showAddProductModal,
        closeAddProductModal: closeAddProductModal,
        openEditProductModal: openEditProductModal,
        deleteCurrentProduct: deleteCurrentProduct,
        updateStockInputs: updateStockInputs,
        deleteInventory: deleteInventory,
        editInventory: editInventory,
        printInventory: window.printInventory,
        checkLowStock: checkLowStock,
        removeZeroStockProducts: removeZeroStockProducts,
        printProductSingle: window.printProductSingle,
        
        // Configuración
        loadSettings: loadSettings,
        saveSettings: saveSettings,
        viewSalesRecord: viewSalesRecord,
        closeSalesRecordModal: closeSalesRecordModal,
        exportSalesRecord: window.exportSalesRecord,
        deleteSalesRecord: deleteSalesRecord,
        
        // Cloudinary
        uploadImageToCloudinary: uploadImageToCloudinary,
        
        // Backup
        mostrarPanelBackup: mostrarPanelBackup,
        cerrarPanelBackup: cerrarPanelBackup,
        exportarBackupManual: exportarBackupManual,
        mostrarImportarBackup: mostrarImportarBackup,
        importarBackupManual: importarBackupManual,
        crearBackupManual: crearBackupManual,
        mostrarAyudaBackup: mostrarAyudaBackup,
        exportarBackupEmergencia: exportarBackupEmergencia,
        
        // Utilidades
        formatCurrency: formatCurrency
    };
    
    // Registrar usando la función del HTML
    if (window.registrarFuncionesGlobales) {
        window.registrarFuncionesGlobales(funcionesGlobales);
    } else {
        // Fallback: registrar manualmente
        for (const [nombre, funcion] of Object.entries(funcionesGlobales)) {
            window[nombre] = funcion;
        }
        console.log(`✅ ${Object.keys(funcionesGlobales).length} funciones registradas`);
    }
    
    console.log('🚀 Sistema universal listo para usar');
    console.log('📷 Sistema de escáner activado y listo');
})();

//=====================BORRAR PRODUCTO EN SUPABASE =====================
async function borrarProductoEnSupabase(productId) {
    if (!window.usarSupabase || !window.supabaseClient) return false;
    
    try {
        console.log(`🗑️ Eliminando producto ${productId} de Supabase...`);
        
        const { error } = await window.supabaseClient
            .from('productos')
            .delete()
            .eq('id', productId);
        
        if (error) {
            console.error('❌ Error eliminando producto:', error);
            return false;
        }
        
        console.log('✅ Producto eliminado de Supabase');
        return true;
        
    } catch (error) {
        console.error('❌ Error en borrado:', error);
        return false;
    }
}

//=====================BORRAR VENTAS EN SUPABASE =====================
async function borrarVentasEnSupabase() {
    if (!window.usarSupabase || !window.supabaseClient) return false;
    
    try {
        console.log('🗑️ Eliminando ventas de Supabase...');
        
        // Opción 1: Borrar todas las ventas
        const { error } = await window.supabaseClient
            .from('ventas')
            .delete()
            .neq('id', ''); // Borra todos
        
        // Opción 2: Borrar por lotes si hay muchas
        if (error) {
            console.error('❌ Error eliminando ventas:', error);
            return false;
        }
        
        console.log('✅ Ventas eliminadas de Supabase');
        return true;
        
    } catch (error) {
        console.error('❌ Error en borrado de ventas:', error);
        return false;
    }
}

// Registrar en el global scope
window.borrarProductoEnSupabase = borrarProductoEnSupabase;
window.borrarVentasEnSupabase = borrarVentasEnSupabase;