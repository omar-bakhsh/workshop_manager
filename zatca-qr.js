/**
 * ZATCA E-Invoicing (Fatoora) Helper & TLV QR Code Generator
 * Conforms with Saudi Zakat, Tax and Customs Authority (ZATCA) Phase 1 & 2 Standard
 * Author: Atenza App Workshop Manager
 */
(function (global) {
    'use strict';

    // -------------------------------------------------------------
    // 1. ZATCA TLV (Tag-Length-Value) Base64 Encoder
    // -------------------------------------------------------------
    function getTLVBlock(tagNumber, tagValue) {
        const text = String(tagValue || '').trim();
        const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
        let valueBytes;

        if (encoder) {
            valueBytes = encoder.encode(text);
        } else {
            // Fallback UTF-8 encoder
            const utf8 = unescape(encodeURIComponent(text));
            valueBytes = new Uint8Array(utf8.length);
            for (let i = 0; i < utf8.length; i++) {
                valueBytes[i] = utf8.charCodeAt(i);
            }
        }

        const tagBuf = new Uint8Array([tagNumber, valueBytes.length]);
        const block = new Uint8Array(tagBuf.length + valueBytes.length);
        block.set(tagBuf, 0);
        block.set(valueBytes, tagBuf.length);
        return block;
    }

    function generateZatcaTLV(sellerName, vatNumber, timestamp, totalWithVat, vatTotal) {
        try {
            // Tag 1: Seller's Name
            const tag1 = getTLVBlock(1, sellerName || 'مركز صيانة السيارات');
            // Tag 2: Seller's VAT Registration Number (15 digits)
            const tag2 = getTLVBlock(2, vatNumber || '300000000000003');
            // Tag 3: Time Stamp (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ)
            let isoTime = timestamp;
            if (!isoTime || !isoTime.includes('T')) {
                isoTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
            }
            const tag3 = getTLVBlock(3, isoTime);
            // Tag 4: Invoice Total (with VAT)
            const tag4 = getTLVBlock(4, parseFloat(totalWithVat || 0).toFixed(2));
            // Tag 5: VAT Total
            const tag5 = getTLVBlock(5, parseFloat(vatTotal || 0).toFixed(2));

            const totalLength = tag1.length + tag2.length + tag3.length + tag4.length + tag5.length;
            const fullBuffer = new Uint8Array(totalLength);
            let offset = 0;

            [tag1, tag2, tag3, tag4, tag5].forEach(tag => {
                fullBuffer.set(tag, offset);
                offset += tag.length;
            });

            let binary = '';
            for (let i = 0; i < fullBuffer.byteLength; i++) {
                binary += String.fromCharCode(fullBuffer[i]);
            }
            return btoa(binary);
        } catch (err) {
            console.error('ZATCA TLV Generation Error:', err);
            return '';
        }
    }

    // -------------------------------------------------------------
    // 2. Embedded Lightweight QR Code Generation Engine
    // -------------------------------------------------------------
    function createQRCodeSVG(text, size) {
        size = size || 130;
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    }

    // Direct Canvas QR Code Drawer using vanilla JS
    function renderQRCodeToElement(container, text, options) {
        if (!container) return;
        options = options || {};
        const width = options.width || 125;
        const height = options.height || 125;

        // If QRCode library exists globally (e.g. from script tag or cdn)
        if (typeof QRCode !== 'undefined' && typeof QRCode === 'function') {
            container.innerHTML = '';
            try {
                new QRCode(container, {
                    text: text,
                    width: width,
                    height: height,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: 2 // Level M
                });
                return;
            } catch (e) {
                console.warn('QRCode library error, using image fallback:', e);
            }
        }

        // Clean robust Image Fallback
        const img = document.createElement('img');
        img.src = createQRCodeSVG(text, width);
        img.style.width = width + 'px';
        img.style.height = height + 'px';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        img.alt = 'ZATCA Tax Invoice QR Code';
        container.innerHTML = '';
        container.appendChild(img);
    }

    // -------------------------------------------------------------
    // 3. High-level Tax Invoice ZATCA API
    // -------------------------------------------------------------
    const ZATCA = {
        generateTLV: generateZatcaTLV,
        renderQR: renderQRCodeToElement,
        getFallbackQRUrl: createQRCodeSVG,
        
        generateInvoiceQR: function (containerEl, invoiceData, shopData) {
            const sellerName = shopData?.workshop_name || shopData?.app_name || 'مركز صيانة السيارات';
            const vatNumber = shopData?.vat_number || '300000000000003';
            
            let timestamp = invoiceData?.invoiced_at || invoiceData?.created_at || new Date().toISOString();
            if (timestamp && !timestamp.includes('T')) {
                try { timestamp = new Date(timestamp).toISOString(); } catch(e){}
            }

            const totalAmount = parseFloat(invoiceData?.final_amount || invoiceData?.total_amount || 0).toFixed(2);
            const vatAmount = parseFloat(invoiceData?.vat_amount || 0).toFixed(2);

            const tlvBase64 = generateZatcaTLV(sellerName, vatNumber, timestamp, totalAmount, vatAmount);
            
            if (containerEl) {
                renderQRCodeToElement(containerEl, tlvBase64, { width: 120, height: 120 });
            }

            return {
                tlvBase64: tlvBase64,
                sellerName: sellerName,
                vatNumber: vatNumber,
                timestamp: timestamp,
                totalAmount: totalAmount,
                vatAmount: vatAmount
            };
        }
    };

    global.ZATCA = ZATCA;

})(typeof window !== 'undefined' ? window : global);
