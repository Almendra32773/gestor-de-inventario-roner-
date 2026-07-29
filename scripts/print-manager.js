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
                /* Ajuste de precio convertido en el recibo general */
                .converted {
                    text-align: right;
                    font-size: 15px; /* Aumentado */
                    font-weight: bold;
                    margin-top: 4px;
                }
            </style>
        `,
        parse: function(styles, printerWidth) {
            return styles.replace(/{{printerWidth}}/g, printerWidth);
        }
    };

    // ========== OBTENER DATOS DE LA VENTA ACTUAL ==========
    function getCurrentSaleData() {
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
        
        const modal = document.getElementById('saleModal');
        const receiptContent = document.getElementById('receiptContent');
        
        if (!receiptContent) return null;
        
        const idElement = receiptContent.querySelector('p:first-child');
        const dateElement = receiptContent.querySelector('p:nth-child(2)');
        
        const id = idElement ? idElement.textContent.replace('ID:', '').trim() : 'N/A';
        const date = dateElement ? dateElement.textContent : new Date().toLocaleString();
        
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

    // ========== IMPRIMIR PRODUCTO(S) / ETIQUETAS UNIFICADO ==========
    function printProduct(products, title = 'Producto') {
        const productsArray = Array.isArray(products) ? products : [products];
        
        if (productsArray.length === 0) {
            alert('No hay productos para imprimir');
            return;
        }
        
        let productsHTML = '';
        
        productsArray.forEach((product) => {
            const convertedPrice = settings.convertTo && settings.convertTo !== settings.currency
                ? formatCurrency(product.price * settings.conversionRate, settings.convertTo)
                : '';
            
            productsHTML += `
                <div class="product-page" ${productsArray.length > 1 ? 'style="page-break-after: always;"' : ''}>
                    <!-- NOMBRE GRANDE -->
                    <div style="font-size: 20px; font-weight: bold; text-align: center; margin: 15px 0; color: #1E293B;">
                        ${product.name}
                    </div>
                    
                    <!-- TAMAÑO -->
                    <div style="text-align: center; font-size: 13px; margin-bottom: 12px; color: #64748B;">
                        ${product.size || 'Tamaño no especificado'}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <!-- CÓDIGO DE BARRAS -->
                    <div style="margin: 12px 0; text-align: center;">
                        <div style="font-size: 11px; color: #64748B; margin-bottom: 3px;">Código de barras</div>
                        <div style="font-family: 'Courier New', monospace; font-size: 15px; letter-spacing: 1px; background: #f8fafc; padding: 6px; border-radius: 4px;">
                            ${product.barcode || 'N/A'}
                        </div>
                    </div>
                    
                    <!-- PRECIO NORMAL (REDUCIDO) -->
                    <div style="margin: 10px 0; text-align: center;">
                        <div style="font-size: 11px; color: #64748B; margin-bottom: 2px;">Precio Base</div>
                        <div style="font-size: 13px; font-weight: 600; color: #475569;">
                            ${formatCurrency(product.price)}
                        </div>
                    </div>
                    
                    <!-- PRECIO CONVERTIDO (AUMENTADO Y DESTACADO) -->
                    ${convertedPrice ? `
                        <div style="margin: 12px 0; text-align: center; background: #eff6ff; padding: 10px; border-radius: 8px; border: 1px solid #bfdbfe;">
                            <div style="font-size: 11px; color: #1e40af; margin-bottom: 2px; font-weight: 600;">Precio en ${settings.convertTo}</div>
                            <div style="font-size: 24px; font-weight: 800; color: #2563eb;">
                                ${convertedPrice}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="divider"></div>
                    
                    <div style="font-size: 10px; text-align: center; margin-top: 8px; color: #94a3b8;">
                        ID: ${product.id}
                    </div>
                </div>
            `;
        });
        
        const content = `
            <html>
            <head>
                <title>${title} - ${settings.storeName}</title>
                ${PRINT_STYLES.parse(PRINT_STYLES.base, settings.printerWidth)}
            </head>
            <body>
                ${productsHTML}
            </body>
            </html>
        `;
        
        printDocument(content, title, 400, 600);
    }
    
    // ========== IMPRIMIR RECIBO DE VENTA ==========
    async function printReceipt() {
        const saleData = getCurrentSaleData();
        
        if (!saleData || saleData.items.length === 0) {
            alert('No hay datos de venta para imprimir');
            return;
        }
        
        const idFormatted = saleData.id.toString().replace('ID:', '').trim();
        
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
                <div class="store-name">${settings.storeName}</div>
                
                <div class="id-date">
                    <div>ID: ${idFormatted}</div>
                    <div>${saleData.date}</div>
                </div>
                
                <div class="divider"></div>
                
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
                
                <!-- TOTAL BASE (REDUCIDO) -->
                <div style="margin-top: 5px;">
                    <table style="width: 100%;">
                        <tr>
                            <td style="font-size: 11px;">TOTAL BASE:</td>
                            <td class="text-right" style="font-size: 11px;">${formatCurrency(saleData.total)}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- TOTAL CONVERTIDO (DESTACADO / AUMENTADO) -->
                ${convertedTotal ? `
                    <div class="converted">(${convertedTotal})</div>
                ` : ''}
                
                <div class="divider"></div>
                
                <div style="text-align: center; font-size: 10px; margin-top: 10px;">
                    ¡Gracias por su compra!
                </div>
            </body>
            </html>
        `;
        
        await printDocument(content, 'recibo', 400, 600);
        continueSale();
    }
    
    // ========== REGISTRO EN WINDOW PARA COMPATIBILIDAD ==========
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
    
    window.exportSalesRecord = window.printSalesRecord;
    
    console.log('🖨️ Funciones de impresión registradas en window');
})();
