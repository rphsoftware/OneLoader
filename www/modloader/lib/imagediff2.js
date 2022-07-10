let wasm_bindgen;
(function() {
    const __exports = {};
    let wasm;

    /**
    * @returns {number}
    */
    __exports.tile_size = function() {
        var ret = wasm.tile_size();
        return ret >>> 0;
    };

    let cachegetUint32Memory0 = null;
    function getUint32Memory0() {
        if (cachegetUint32Memory0 === null || cachegetUint32Memory0.buffer !== wasm.memory.buffer) {
            cachegetUint32Memory0 = new Uint32Array(wasm.memory.buffer);
        }
        return cachegetUint32Memory0;
    }

    let WASM_VECTOR_LEN = 0;

    function passArray32ToWasm0(arg, malloc) {
        const ptr = malloc(arg.length * 4);
        getUint32Memory0().set(arg, ptr / 4);
        WASM_VECTOR_LEN = arg.length;
        return ptr;
    }

    let cachegetInt32Memory0 = null;
    function getInt32Memory0() {
        if (cachegetInt32Memory0 === null || cachegetInt32Memory0.buffer !== wasm.memory.buffer) {
            cachegetInt32Memory0 = new Int32Array(wasm.memory.buffer);
        }
        return cachegetInt32Memory0;
    }

    let cachegetUint8Memory0 = null;
    function getUint8Memory0() {
        if (cachegetUint8Memory0 === null || cachegetUint8Memory0.buffer !== wasm.memory.buffer) {
            cachegetUint8Memory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachegetUint8Memory0;
    }

    function getArrayU8FromWasm0(ptr, len) {
        return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
    }
    /**
    * @param {Uint32Array} source
    * @param {Uint32Array} target
    * @returns {Uint8Array}
    */
    __exports.create_diff = function(source, target) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            var ptr0 = passArray32ToWasm0(source, wasm.__wbindgen_malloc);
            var len0 = WASM_VECTOR_LEN;
            var ptr1 = passArray32ToWasm0(target, wasm.__wbindgen_malloc);
            var len1 = WASM_VECTOR_LEN;
            wasm.create_diff(retptr, ptr0, len0, ptr1, len1);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v2 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 1);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    function passArray8ToWasm0(arg, malloc) {
        const ptr = malloc(arg.length * 1);
        getUint8Memory0().set(arg, ptr / 1);
        WASM_VECTOR_LEN = arg.length;
        return ptr;
    }

    function getArrayU32FromWasm0(ptr, len) {
        return getUint32Memory0().subarray(ptr / 4, ptr / 4 + len);
    }
    /**
    * @param {Uint32Array} source
    * @param {Uint8Array} diff_stream
    * @returns {Uint32Array}
    */
    __exports.apply_diff = function(source, diff_stream) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            var ptr0 = passArray32ToWasm0(source, wasm.__wbindgen_malloc);
            var len0 = WASM_VECTOR_LEN;
            var ptr1 = passArray8ToWasm0(diff_stream, wasm.__wbindgen_malloc);
            var len1 = WASM_VECTOR_LEN;
            wasm.apply_diff(retptr, ptr0, len0, ptr1, len1);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v2 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 4);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    };

    async function load(module, imports) {
        if (typeof Response === 'function' && module instanceof Response) {
            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    return await WebAssembly.instantiateStreaming(module, imports);

                } catch (e) {
                    if (module.headers.get('Content-Type') != 'application/wasm') {
                        console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                    } else {
                        throw e;
                    }
                }
            }

            const bytes = await module.arrayBuffer();
            return await WebAssembly.instantiate(bytes, imports);

        } else {
            const instance = await WebAssembly.instantiate(module, imports);

            if (instance instanceof WebAssembly.Instance) {
                return { instance, module };

            } else {
                return instance;
            }
        }
    }

    async function init(input) {
        if (typeof input === 'undefined') {
            let src;
            if (typeof document === 'undefined') {
                src = location.href;
            } else {
                src = document.currentScript.src;
            }
            input = src.replace(/\.js$/, '_bg.wasm');
        }
        const imports = {};


        if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
            input = fetch(input);
        }



        const { instance, module } = await load(await input, imports);

        wasm = instance.exports;
        init.__wbindgen_wasm_module = module;

        return wasm;
    }

    wasm_bindgen = Object.assign(init, __exports);

})();
