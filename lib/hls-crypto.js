/**
 * HLS Crypto Loader - Custom loader for hls.js that decrypts .ts.enc segments
 * Usage: Pass this as a custom loader to hls.js config
 */

class HLSCryptoLoader {
    constructor(config) {
        this.config = config;
        if (!config.encryptionKey) {
            throw new Error('Encryption key is required! Pass it in config: { encryptionKey: "your_hex_key" }');
        }
        this.encryptionKey = config.encryptionKey;
    }

    destroy() {
        this.abort();
    }

    abort() {
        if (this.controller) {
            this.controller.abort();
        }
    }

    load(context, config, callbacks) {
        const { url } = context;
        
        // Проверяем, это зашифрованный сегмент?
        const isEncrypted = url.endsWith('.ts.enc');
        
        this.controller = new AbortController();
        const signal = this.controller.signal;

        fetch(url, { signal })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                if (isEncrypted) {
                    // Расшифровываем
                    const decrypted = this.decryptSegment(arrayBuffer);
                    callbacks.onSuccess({
                        url: url,
                        data: decrypted
                    }, { url }, context);
                } else {
                    // Обычный сегмент, передаем как есть
                    callbacks.onSuccess({
                        url: url,
                        data: arrayBuffer
                    }, { url }, context);
                }
            })
            .catch(error => {
                if (error.name === 'AbortError') {
                    callbacks.onAbort({ url }, context);
                } else {
                    callbacks.onError({
                        code: 0,
                        text: error.message
                    }, context);
                }
            });
    }

    decryptSegment(encryptedArrayBuffer) {
        // Конвертируем ArrayBuffer в Uint8Array
        const encryptedBytes = new Uint8Array(encryptedArrayBuffer);
        
        // Первые 16 байт - это IV
        const iv = CryptoJS.lib.WordArray.create(encryptedBytes.slice(0, 16));
        
        // Остальное - зашифрованные данные
        const ciphertext = CryptoJS.lib.WordArray.create(encryptedBytes.slice(16));
        
        // Ключ из hex
        const key = CryptoJS.enc.Hex.parse(this.encryptionKey);
        
        // Расшифровываем
        const decrypted = CryptoJS.AES.decrypt(
            { ciphertext: ciphertext },
            key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );
        
        // Конвертируем обратно в ArrayBuffer
        return this.wordArrayToArrayBuffer(decrypted);
    }

    wordArrayToArrayBuffer(wordArray) {
        const words = wordArray.words;
        const sigBytes = wordArray.sigBytes;
        const u8 = new Uint8Array(sigBytes);
        
        for (let i = 0; i < sigBytes; i++) {
            u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        }
        
        return u8.buffer;
    }
}

// Export для использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HLSCryptoLoader;
}
