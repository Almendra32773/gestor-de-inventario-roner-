gemini este es un script que imprime tikects de un minimarket quiero reducir el tamaño del precio y aumentar el tamaño del precio convertido indentifica que debo modificar:
// ==================== PRINT MANAGER - SISTEMA DE IMPRESIÓN PROFESIONAL ====================
(function() {
    console.log('🖨️ Print Manager cargado');
    
    // Estilos base para todas las impresiones
    const PRINT_STYLES = {
        base: `
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: {{printerWidth}}mm auto; margin: 5mm; }
                body { 
                    font-family: 'Courier New', monospace;
                    width: {{printerWidth}}mm;
                    margin: 0 auto;
                    padding: 3mm;
                    background: white;
                    color: #000;
                    line-height: 1.4;
                    font-size: 12px;
                }
                .store-name {
                    font-size: 16px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 5px;
                }
                .id-date {
                    text-align: center;
                    margin-bottom: 10px;
                    font-size: 11px;
                }
                .divider {
                    border-top: 1px dashed #000;
                    margin: 8px 0;
                }
                .receipt-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }
                .receipt-table th {
                    text-align: left;
                    font-weight: bold;
                    border-bottom: 1px solid #000;
                    padding: 3px 0;
                }
                .receipt-table td {
                    padding: 2px 0;
                }
                .text-right {
                    text-align: right;
                }
                .total-row {
                    font-weight: bold;
                    margin-top: 5px;
                }
                .converted {
                    text-align: right;
                    font-size: 10px;
                    margin-top: 2px;
                }
            </style>
        `,
        parse: function(styles, printerWidth) {
            return styles.replace(/{{printerWidth}}/g, printerWidth);
        }
    };

    // ========== OBTENER DATOS DE LA VENTA ACTUAL ==========
    function getCurrentSaleData() {
        // Intentar obtener de la última venta en el array sales
        if (sales.length > 0) {
            const lastSale = sales[sales.length - 1];
            return {
                id: lastSale.id,
                date: lastSale.date,
                items: lastSale.items,
                total: lastSale.total,
                convertedTotal: lastSale.convertedTotal
            };
        }
        
        // Si no hay ventas, obtener del DOM
        const modal = document.getElementById('saleModal');
        const receiptContent = document.getElementById('receiptContent');
        
        if (!receiptContent) return null;
        
        // Extraer ID y fecha
        const idElement = receiptContent.querySelector('p:first-child');
        const dateElement = receiptContent.querySelector('p:nth-child(2)');
        
        const id = idElement ? idElement.textContent.replace('ID:', '').trim() : 'N/A';
        const date = dateElement ? dateElement.textContent : new Date().toLocaleString();
        
        // Extraer items de la tabla
        const items = [];
        const rows = receiptContent.querySelectorAll('tbody tr');
        let total = 0;
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
                const nombre = cells[0].textContent;
                const tamaño = cells[1].textContent;
                const cantidad = parseInt(cells[2].textContent);
                const precioTotal = cells[4].textContent;
                
                // Limpiar precio total para obtener el número
                const precioNumerico = parseFloat(precioTotal.replace(/[^0-9.-]+/g, ''));
                if (!isNaN(precioNumerico)) total += precioNumerico;
                
                items.push({
                    name: nombre,
                    size: tamaño,
                    quantity: cantidad,
                    price: precioNumerico / cantidad
                });
            }
        });
        
        // Obtener total del DOM si no se pudo calcular
        if (total === 0) {
            const totalElement = receiptContent.querySelector('p:contains("TOTAL:")');
            if (totalElement) {
                const totalText = totalElement.textContent.replace('TOTAL:', '').trim();
                total = parseFloat(totalText.replace(/[^0-9.-]+/g, ''));
            }
        }
        
        return {
            id: id,
            date: date,
            items: items,
            total: total,
            convertedTotal: total * (settings.conversionRate || 1)
        };
    }
    
    // Función base para imprimir
    async function printDocument(content, title = 'Documento', width = 400, height = 600) {
        return new Promise((resolve, reject) => {
            try {
                const printWindow = window.open('', '', `width=${width},height=${height}`);
                if (!printWindow) {
                    alert('Por favor, permita las ventanas emergentes para imprimir');
                    reject('Popup bloqueado');
                    return;
                }
                
                printWindow.document.write(content);
                printWindow.document.close();
                printWindow.focus();
                
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                    resolve();
                }, 250);
            } catch (error) {
                console.error('Error imprimiendo:', error);
                reject(error);
            }
        });
    }
    
    // ========== IMPRIMIR RECIBO DE VENTA (DISEÑO EXACTO DE LA IMAGEN) ==========
    async function printReceipt() {
        // Obtener datos de la venta
        const saleData = getCurrentSaleData();
        
        if (!saleData || saleData.items.length === 0) {
            alert('No hay datos de venta para imprimir');
            return;
        }
        
        // Formatear ID (quitar prefijo si existe)
        const idFormatted = saleData.id.toString().replace('ID:', '').trim();
        
        // Construir tabla de productos
        let tableRows = '';
        saleData.items.forEach(item => {
            const nombreCompleto = item.size 
                ? `${item.name} ${item.size}`
                : item.name;
            
            const precioTotal = item.price * item.quantity;
            
            tableRows += `
                <tr>
                    <td>${nombreCompleto}</td>
                    <td class="text-right">${item.quantity}</td>
                    <td class="text-right">${formatCurrency(precioTotal)}</td>
                </tr>
            `;
        });
        
        // Formatear total convertido si existe
        const convertedTotal = settings.convertTo && settings.convertTo !== settings.currency
            ? formatCurrency(saleData.total * settings.conversionRate, settings.convertTo)
            : '';
        
        const content = `
            <html>
            <head>
                <title>Recibo - ${settings.storeName}</title>
                ${PRINT_STYLES.parse(PRINT_STYLES.base, settings.printerWidth)}
            </head>
            <body>
                <!-- NOMBRE DE LA TIENDA -->
                <div class="store-name">${settings.storeName}</div>
                
                <!-- ID Y FECHA -->
                <div class="id-date">
                    <div>ID: ${idFormatted}</div>
                    <div>${saleData.date}</div>
                </div>
                
                <div class="divider"></div>
                
                <!-- ENCABEZADOS DE TABLA -->
                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th class="text-right">Cant.</th>
                            <th class="text-right">Precio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                
                <div class="divider"></div>
                
                <!-- TOTAL -->
                <div style="margin-top: 5px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="font-weight: bold;">TOTAL:</td>
                            <td class="text-right" style="font-weight: bold;">${formatCurrency(saleData.total)}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- TOTAL CONVERTIDO (si existe) -->
                ${convertedTotal ? `
                    <div class="converted">(${convertedTotal})</div>
                ` : ''}
                
                <div class="divider"></div>
                
                <!-- GRACIAS (opcional, no está en la imagen pero es buena práctica) -->
                <div style="text-align: center; font-size: 10px; margin-top: 10px;">
                    ¡Gracias por su compra!
                </div>
            </body>
            </html>
        `;
        
        await printDocument(content, 'recibo', 400, 600);
        continueSale();
    }
    
    // ========== IMPRIMIR PRODUCTO(S) ==========
    function printProduct(products, title = 'Producto') {
        const productsArray = Array.isArray(products) ? products : [products];
        
        if (productsArray.length === 0) {
            alert('No hay productos para imprimir');
            return;
        }
        
        let productsHTML = '';
        
        productsArray.forEach((product, index) => {
            const convertedPrice = settings.convertTo && settings.convertTo !== settings.currency
                ? formatCurrency(product.price * settings.conversionRate, settings.convertTo)
                : '';
            
            productsHTML += `
                <div class="product-page" ${productsArray.length > 1 ? 'style="page-break-after: always;"' : ''}>
                    <!-- NOMBRE GRANDE -->
                    <div style="font-size: 24px; font-weight: bold; text-align: center; margin: 20px 0; color: #000;">
                        ${product.name}
                    </div>
                    
                    <!-- TAMAÑO -->
                    <div style="text-align: center; font-size: 14px; margin-bottom: 20px;">
                        ${product.size || ''}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <!-- CÓDIGO DE BARRAS -->
                    <div style="margin: 15px 0;">
                        <div style="font-size: 11px; margin-bottom: 3px;">Código:</div>
                        <div style="font-family: 'Courier New', monospace; font-size: 16px;">
                            ${product.barcode || 'N/A'}
                        </div>
                    </div>
                    
                    <!-- PRECIO -->
                    <div style="margin: 15px 0;">
                        <div style="font-size: 11px; margin-bottom: 3px;">Precio:</div>
                        <div style="font-size: 15px; font-weight: bold;">
                            ${formatCurrency(product.price)}
                        </div>
                    </div>
                    
                    <!-- PRECIO CONVERTIDO -->
                    ${convertedPrice ? `
                        <div style="margin: 15px 0; font-size: 25px; font-weight: bold;"">
                            ${convertedPrice}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        const content = `
            <html>
            <head>
                <title>${title} - ${settings.storeName}</title>
                ${PRINT_STYLES.parse(PRINT_STYLES.base, settings.printerWidth)}
                <style>
                    body { font-family: Arial, sans-serif; }
                </style>
            </head>
            <body>
                ${productsHTML}
            </body>
            </html>
        `;
        
        printDocument(content, title, 400, 600);
    }
    
    // ========== FUNCIONES DE COMPATIBILIDAD ==========
    window.printProduct = printProduct;
    
    window.printProductSingle = function(productId) {
        const product = inventory.find(p => p.id === productId);
        if (!product) {
            alert('Producto no encontrado');
            return;
        }
        printProduct(product, 'Detalle de Producto');
    };
    
    window.printInventory = function() {
        if (inventory.length === 0) {
            alert('No hay productos en el inventario');
            return;
        }
        printProduct(inventory, 'Inventario Completo');
    };
    
    window.printReceipt = printReceipt;
    
    window.printSalesRecord = function() {
        if (sales.length === 0) {
            alert('No hay ventas para imprimir');
            return;
        }
        
        let ventasHTML = '';
        let totalIngresos = 0;
        
        sales.slice().reverse().forEach((sale, index) => {
            totalIngresos += sale.total;
            
            let itemsHTML = '';
            sale.items.forEach(item => {
                itemsHTML += `${item.name} ${item.size || ''} x${item.quantity} - ${formatCurrency(item.price * item.quantity)}\n`;
            });
            
            ventasHTML += `
                <div style="margin-bottom: 15px; page-break-inside: avoid;">
                    <div><strong>ID:</strong> ${sale.id}</div>
                    <div><strong>Fecha:</strong> ${sale.date}</div>
                    <div><strong>Pago:</strong> ${sale.paymentMethod}</div>
                    <div style="margin: 5px 0;">${itemsHTML.replace(/\n/g, '<br>')}</div>
                    <div><strong>Total:</strong> ${formatCurrency(sale.total)}</div>
                    ${index < sales.length - 1 ? '<hr>' : ''}
                </div>
            `;
        });
        
        const content = `
            <html>
            <head>
                <title>Ventas - ${settings.storeName}</title>
                ${PRINT_STYLES.parse(PRINT_STYLES.base, settings.printerWidth)}
                <style>
                    body { font-family: Arial, sans-serif; }
                </style>
            </head>
            <body>
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2>${settings.storeName}</h2>
                    <h3>Registro de Ventas</h3>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <strong>Total Ventas:</strong> ${sales.length}<br>
                    <strong>Total Ingresos:</strong> ${formatCurrency(totalIngresos)}<br>
                    <strong>Promedio:</strong> ${formatCurrency(totalIngresos / sales.length)}
                </div>
                
                <hr>
                
                ${ventasHTML}
                
                <hr>
                
                <div style="text-align: center; font-size: 10px; margin-top: 20px;">
                    Reporte generado: ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;
        
        printDocument(content, 'ventas', 600, 800);
    };
    
    window.exportSalesRecord = window.printSalesRecord; // Alias para compatibilidad
    
    console.log('🖨️ Funciones de impresión registradas en window');
})();
