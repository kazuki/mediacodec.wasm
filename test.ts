declare module Wasm {
    export function instantiateModule(binary: Uint8Array, info: any): any;
}

class WasmLoader {
    onload = () => {};
    exports: any = {};
    HEAPU8: Uint8Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
    _wasm_bin: Uint8Array;
    _wasm_mem: Uint8Array;

    constructor(wasm_url, wasm_mem_url) {
        var remaining = 2;
        var fetch = (url) => {
            var xhr = new XMLHttpRequest();
            xhr.responseType = "arraybuffer";
            xhr.open('GET', url, true);
            xhr.onload = () => {
                if (url == wasm_url)
                    this._wasm_bin = new Uint8Array(xhr.response);
                else if (url == wasm_mem_url)
                    this._wasm_mem = new Uint8Array(xhr.response);
                if (--remaining == 0)
                    this._build();
            };
            xhr.send();
        };
        fetch(wasm_url);
        fetch(wasm_mem_url);
    }

    _build() {
        var align = (x) => (Math.ceil(x / 16) * 16)|0;
        var alignPage = (x) => (Math.ceil(x / 4096) * 4096)|0;
        const TOTAL_STACK = 1024 * 1024 * 5;
        const GLOBAL_BASE = 1024;
        var tempDoublePtr = GLOBAL_BASE + this._wasm_mem.length;
        var STACKTOP = align(tempDoublePtr + 16);
        var abort = (what) => {
            console.log('abort(' + what + ')');
        };
        var sbrk_cur_end = alignPage(STACKTOP + TOTAL_STACK);
        var sbrk = (bytes) => {
            var ret = sbrk_cur_end;
            sbrk_cur_end = alignPage(sbrk_cur_end + bytes);
            return ret;
        };
        var saved_stacks = [];
        var stacksave = () => {
            saved_stacks.push(this.exports.stackSave());
            return saved_stacks.length - 1;
        };
        var stackrestore = (p) => {
            var ret = saved_stacks[p];
            saved_stacks.splice(p, 1);
            this.exports.stackRestore(ret);
        };
        var info = {
            'global': {'NaN': NaN, 'Infinity': Infinity},
            'global.Math': Math,
            'env': {
                abort: abort,
                _abort: () => abort(undefined),
                _sbrk: sbrk,
                _llvm_stacksave: stacksave,
                _llvm_stackrestore: stackrestore,
                _emscripten_memcpy_big: (dest, src, num) => {
                    this.HEAPU8.set(this.HEAPU8.subarray(src, src + num), dest);
                    return dest;
                },
                ___syscall146: (which, varargs) => {
                    var iov = this.HEAPU32[varargs + 4 >> 2];
                    var iovcnt = this.HEAPU32[varargs + 8 >> 2];
                    var ret = 0;
                    var str = '';
                    for (var i = 0; i < iovcnt; i++) {
                        var ptr = this.HEAPU32[iov + i * 8 >> 2];
                        var len = this.HEAPU32[iov + (i * 8 + 4) >> 2];
                        str += this.Pointer_stringify(ptr, len);
                        ret += len;
                    }
                    console.log(str);
                    return ret;
                },
                ___assert_fail: (assertion, file, line, func) => {
                    var msg = this.Pointer_stringify(assertion)
                        + ': ' + this.Pointer_stringify(file)
                        + ':' + line + ' => '
                        + this.Pointer_stringify(func);
                    console.log(msg);
                },
            },
            'asm2wasm': {
                "f64-rem": (x, y) => x % y,
                "f64-to-int": (x) => x | 0
            }
        };
        ['___assert_fail',
         "___cxa_allocate_exception",
         "___cxa_atexit",
         "___cxa_begin_catch",
         "___cxa_pure_virtual",
         "___cxa_throw",
         "___syscall140",
         "___syscall146",
         "___syscall20",
         "___syscall54",
         "___syscall6",
         "_exp2",
         "_gettimeofday",
         "_pthread_attr_destroy",
         "_pthread_attr_init",
         "_pthread_attr_setschedpolicy",
         "_pthread_attr_setscope",
         "_pthread_cleanup_pop",
         "_pthread_cleanup_push",
         "_pthread_create",
         "_pthread_getspecific",
         "_pthread_join",
         "_pthread_key_create",
         "_pthread_mutex_destroy",
         "_pthread_mutex_init",
         "_pthread_once",
         "_pthread_setspecific",
         "_sem_destroy",
         "_sem_init",
         "_sem_post",
         "_sem_wait",
         "_sem_trywait",
         "_usleep"
        ].forEach((name) => {
            if (name in info['env'])
                return;
            info['env'][name] = () => console.log(name + ' not implemented');
        });
        var instance = Wasm.instantiateModule(this._wasm_bin, info);
        this.exports = instance.exports;
        this.exports.establishStackSpace(STACKTOP, STACKTOP + TOTAL_STACK);
        this.HEAPU8 = new Uint8Array(this.exports.memory);
        this.HEAPU32 = new Uint32Array(this.exports.memory);
        this.HEAPF32 = new Float32Array(this.exports.memory);
        this.HEAPU8.set(this._wasm_mem, GLOBAL_BASE);
        this.onload();
    }

    Pointer_stringify(ptr, length=undefined) {
        if (length === 0 || !ptr)
            return "";
        if (!length)
            for (length = 0; this.HEAPU8[ptr + length] != 0; ++length);
        return String.fromCharCode.apply(String, this.HEAPU8.subarray(ptr, ptr + length));
    }
};

document.addEventListener("DOMContentLoaded", () => {
    var loader = new WasmLoader('native/libmediacodec.wasm', 'native/libmediacodec.js.mem');
    loader.onload = () => {
        var check_opus = () => {
            if (!loader.Pointer_stringify(loader.exports._opus_get_version_string()).startsWith('libopus')) {
                console.log('opus: fail (static-memory)');
                return;
            }
            var err = loader.exports._malloc(4);
            var max_packet_size = 1275 * 3 + 7;
            var pcm = loader.exports._malloc(4 * 960 * 2);
            var data = loader.exports._malloc(max_packet_size);
            var handle = loader.exports._opus_encoder_create(48000, 2, 2049, err);
            if (handle <= 0) {
                console.log('opus: fail');
                return;
            }
            var debug = loader.exports._malloc(4);
            if (debug < 10000)
                console.log('malloc failure: ' + debug);
            loader.exports._free(debug);
            for (var i = pcm / 4, j = 0.0; i < pcm / 4 + 960 * 2 - 1; i += 2) {
                loader.HEAPF32[i] = Math.cos(j);
                loader.HEAPF32[i+1] = Math.sin(j);
                j += 0.1;
            }
            var sum = 0, loop = 1000;
            var start = performance.now();
            for (var i = 0; i < loop; ++i)
                sum += loader.exports._opus_encode_float(handle, pcm, 960, data, max_packet_size);
            var end = performance.now();
            debug = loader.exports._malloc(4);
            if (debug < 10000)
                console.log('malloc failure: ' + debug);
            loader.exports._free(debug);
            loader.exports._free(pcm);
            loader.exports._free(data);
            loader.exports._free(err);
            loader.exports._opus_encoder_destroy(handle);
            console.log('opus: ok ('
                        + loader.Pointer_stringify(loader.exports._opus_get_version_string())
                        +', speed: x' + (960 / 48000 * loop) / ((end - start) / 1000) + ')');
        };
        var check_openh264 = () => {
            var ver = loader.exports._malloc(4 * 4);
            loader.exports._WelsGetCodecVersionEx(ver);
            ver = loader.HEAPU32[ver / 4] + '.' +
                loader.HEAPU32[ver / 4 + 1] + '.' +
                loader.HEAPU32[ver / 4 + 2] + '.' +
                loader.HEAPU32[ver / 4 + 3];

            var w = 1280, h = 720;
            var tmp = loader.exports._malloc(4);
            var ret = loader.exports._WelsCreateSVCEncoder(tmp);
            var handle = loader.HEAPU32[tmp / 4];
            var params = loader.exports._CreateEncParamExt(handle, w, h, 1.0);
            ret = loader.exports._WelsInitializeSVCEncoder(handle, params);
            loader.exports._free(params);
            loader.exports._free(tmp);
            if (ret != 0) {
                console.log('openh264: fail (WelsInitializeSVCEncoder)');
                return;
            }
            console.log('openh264: ok (' + ver + ')');
        };
        var check_daala = () => {
            var ver = loader.Pointer_stringify(loader.exports._daala_version_string());
            if (!ver.startsWith('Xiph') || !ver.includes('daala')) {
                console.log('daala: fail (static-memory)');
                return;
            } else {
                ver = ver.substr(ver.indexOf('daala'));
            }
            var w = 1280, h = 720;
            var val = loader.exports._malloc(4);
            var op = loader.exports._malloc(4 * 8);
            var di = loader.exports._daala_info_create(w, h, 1, 1, 1, 1, 1);
            var dc = loader.exports._daala_comment_create();
            var img = loader.exports._daala_image_create(w, h);
            var handle = loader.exports._daala_encode_create(di);
            if (handle == 0) {
                console.log('daala: fail (daala_encode_create)');
                return;
            }
            for (var i = 0;; ++i) {
                var ret = loader.exports._daala_encode_flush_header(handle, dc, op);
                if ((i == 0 && ret <= 0) || (i > 0 && ret < 0)) {
                    console.log('daala: fail (daala_encode_flush_header)');
                    return;
                }
                if (ret == 0)
                    break;
            }
            if (loader.exports._daala_encode_img_in(handle, img, 0) != 0) {
                console.log('daala: fail (daala_encode_img_in)');
                return;
            }
            while (1) {
                var ret = loader.exports._daala_encode_packet_out(handle, 1, op);
                if (ret == 0)
                    break;
                if (ret < 0) {
                    console.log('daala: fail (daala_encode_packet_out)');
                    return;
                }
            }
            loader.exports._daala_encode_free(handle);
            loader.exports._free(di);
            loader.exports._free(dc);
            loader.exports._free(img);
            loader.exports._free(op);
            console.log('daala: ok (' + ver + ')');
        };
        check_opus();
        check_openh264();
        //check_daala();
    };
});
