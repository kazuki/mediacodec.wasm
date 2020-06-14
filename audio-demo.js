class RiffPcmWaveReader {
    constructor() {
        // 読み込みカーソル位置(data_offsetからの相対位置)
        this.read_pos = 0;
        this.reader = new FileReader();
    }
    open(file) {
        return new Promise((resolve, reject) => {
            this.file = file;
            if (!(this.file instanceof File)) {
                reject('invalid params');
                return;
            }
            this.readHeader().then((info) => {
                this.info = info;
                resolve(info);
            }, reject);
        });
    }
    read(samples_per_ch) {
        let bytes = samples_per_ch * (this.bits_per_sample / 8) * this.info.num_of_channels;
        if (this.read_pos + bytes > this.data_bytes) {
            bytes = this.data_bytes - this.read_pos;
        }
        if (this.output === undefined || this.output.length < (samples_per_ch * this.info.num_of_channels)) {
            this.output = new Float32Array(samples_per_ch * this.info.num_of_channels);
        }
        return new Promise((resolve, reject) => {
            this.readBytes(this.data_offset + this.read_pos, bytes).then((data) => {
                this.read_pos += data.byteLength;
                try {
                    resolve(this.convert(data));
                }
                catch (e) {
                    console.log(data);
                    throw e;
                }
            }, (e) => {
                reject({
                    pos: this.data_offset + this.read_pos,
                    len: bytes,
                    reason: e.reason,
                });
            });
        });
    }
    close() {
    }
    readHeader() {
        var off = 0;
        var state = 0;
        var chunk_size = 0;
        var found_fmt_chunk = false;
        var found_data_chunk = false;
        var info = {
            sampling_rate: 0,
            num_of_channels: 0
        };
        var equals = (txt, bytes) => {
            if (txt.length !== bytes.length)
                return false;
            var txt2 = String.fromCharCode.apply(String, bytes);
            return (txt === txt2);
        };
        return new Promise((resolve, reject) => {
            var parse = (data) => {
                var v8 = new Uint8Array(data);
                switch (state) {
                    case 0: // RIFF Header
                        if (equals('RIFF', v8.subarray(0, 4)) && equals('WAVE', v8.subarray(8, 12))) {
                            state = 1;
                            off = 12;
                            this.readBytes(off, 8).then(parse, reject);
                        }
                        else {
                            reject('invalid RIFF');
                        }
                        return;
                    case 1: // find fmt/data chunk
                        chunk_size = v8[4] | (v8[5] << 8) | (v8[6] << 16) | (v8[7] << 24);
                        if (equals('fmt ', v8.subarray(0, 4))) {
                            state = 2;
                            off += 8;
                            this.readBytes(off, chunk_size).then(parse, reject);
                            return;
                        }
                        else if (equals('data', v8.subarray(0, 4))) {
                            this.data_offset = off + 8;
                            this.data_bytes = chunk_size;
                            if (found_fmt_chunk) {
                                resolve(info);
                                return;
                            }
                            else {
                                found_data_chunk = true;
                            }
                        }
                        off += chunk_size;
                        this.readBytes(off, 8).then(parse, reject);
                        return;
                    case 2: // parse fmd chunk
                        var v16 = new Uint16Array(data);
                        var v32 = new Uint32Array(data);
                        if (v16[0] != 1 && v16[0] != 3) {
                            reject('not PCM wave');
                            return;
                        }
                        info.num_of_channels = v16[1];
                        info.sampling_rate = v32[1];
                        this.bits_per_sample = v16[7];
                        this.convert = null;
                        if (v16[0] == 1) {
                            // Integer PCM
                            if (this.bits_per_sample == 8) {
                                this.convert = this.convert_from_i8;
                            }
                            else if (this.bits_per_sample == 16) {
                                this.convert = this.convert_from_i16;
                            }
                            else if (this.bits_per_sample == 24) {
                                this.convert = this.convert_from_i24;
                            }
                        }
                        else if (v16[0] == 3) {
                            // Floating-point PCM
                            if (this.bits_per_sample == 32) {
                                this.convert = this.convert_from_f32;
                            }
                        }
                        if (!this.convert) {
                            reject('not supported format');
                            return;
                        }
                        if (found_data_chunk) {
                            resolve(info);
                        }
                        else {
                            state = 1;
                            off += chunk_size;
                            found_fmt_chunk = true;
                            this.readBytes(off, 8).then(parse, reject);
                        }
                        return;
                }
            };
            off = 0;
            this.readBytes(off, 12).then(parse, reject);
        });
    }
    readBytes(offset, bytes) {
        return new Promise((resolve, reject) => {
            this.reader.onloadend = (ev) => {
                var ret = this.reader.result;
                if (ret) {
                    resolve(ret);
                }
                else {
                    reject({
                        reason: this.reader.error
                    });
                }
            };
            this.reader.readAsArrayBuffer(this.file.slice(offset, offset + bytes));
        });
    }
    convert_from_i8(data) {
        var view = new Int8Array(data);
        var out = this.output;
        for (var i = 0; i < view.length; ++i) {
            out[i] = view[i] / 128.0;
        }
        if (view.length != out.length)
            return out.subarray(0, view.length);
        return out;
    }
    convert_from_i16(data) {
        var view = new Int16Array(data);
        var out = this.output;
        for (var i = 0; i < view.length; ++i) {
            out[i] = view[i] / 32768.0;
        }
        if (view.length != out.length)
            return out.subarray(0, view.length);
        return out;
    }
    convert_from_i24(data) {
        var v0 = new Int8Array(data);
        var v1 = new Uint8Array(data);
        var out = this.output;
        var out_samples = v0.length / 3;
        for (var i = 0; i < out_samples; ++i) {
            var lo = v1[i * 3];
            var md = v1[i * 3 + 1] << 8;
            var hi = v0[i * 3 + 2] << 16;
            out[i] = (hi | md | lo) / 8388608.0;
        }
        if (out_samples != out.length)
            return out.subarray(0, out_samples);
        return out;
    }
    convert_from_f32(data) {
        return new Float32Array(data);
    }
}
/// <reference path="riff_pcm_wave_reader.ts" />
class AsyncWorker {
    constructor(w) {
        this._waiting_resolve = null;
        this._waiting_reject = null;
        this._queue = new Array();
        this._worker = w;
        const handler = (m) => {
            this._queue.push(m);
            this._check_queue();
        };
        w.onmessage = (m) => handler(m);
        w.onerror = (e) => handler(e);
    }
    _check_queue() {
        const resolve = this._waiting_resolve;
        const reject = this._waiting_reject;
        if (this._queue.length === 0 || resolve === null)
            return;
        this._waiting_resolve = null;
        this._waiting_reject = null;
        const m = this._queue.shift();
        if (m instanceof MessageEvent) {
            resolve(m);
        }
        else if (m instanceof ErrorEvent) {
            reject(m);
        }
        else {
            console.error('unknown type:', m);
        }
    }
    postMessage(m, transfer) {
        this._worker.postMessage(m, transfer);
    }
    async recv() {
        return new Promise((resolve, reject) => {
            this._waiting_resolve = resolve;
            this._waiting_reject = reject;
            this._check_queue();
        });
    }
}
async function benchmark(file, opus_cfg) {
    const reader = new RiffPcmWaveReader();
    const audio_info = await reader.open(file);
    const worker = new AsyncWorker(new Worker('audio-demo.worker.js'));
    const pcm_blocks = new Array();
    const packets = new Array();
    let m = await worker.recv();
    if (m.data.status !== 'ready') {
        alert(m.data);
        return;
    }
    worker.postMessage({
        type: 'encoder',
        params: {
            Fs: audio_info.sampling_rate,
            channels: audio_info.num_of_channels,
            application: opus_cfg.application,
        }
    });
    m = await worker.recv();
    if (m.data.status !== 'encoder:ok') {
        alert(m.data);
        return;
    }
    let total_samples = 0;
    while (true) {
        const samples = await reader.read(8192);
        if (samples.length === 0)
            break;
        total_samples += samples.length;
        pcm_blocks.push(new Float32Array(samples));
    }
    const encode_start = performance.now();
    for (let i = 0; i < pcm_blocks.length; ++i) {
        worker.postMessage(pcm_blocks[i], [pcm_blocks[i].buffer]);
        (await worker.recv()).data.packets.forEach(x => packets.push(x));
    }
    worker.postMessage({ type: 'free' });
    await worker.recv();
    const encode_end = performance.now();
    console.log('done: ' + packets.length.toString() + ' packets');
    console.log('encode ' + (encode_end - encode_start) + 'ms, speed: ' +
        ((total_samples / audio_info.num_of_channels / audio_info.sampling_rate) / ((encode_end - encode_start) / 1000)).toString() + 'x');
}
async function realtime_sample(opus_cfg) {
}
function opus_config() {
    const app_str = document.getElementById('opus_app').value;
    return {
        //frame_duration: parseFloat((<HTMLSelectElement>document.getElementById('opus_frame_duration')).value),
        application: {
            voip: 2048,
            audio: 2049,
            lowdelay: 2051,
        }[app_str],
    };
}
function main() {
    document.getElementById('start-benchmark').addEventListener('click', () => {
        const files = document.getElementById('input_filedata').files;
        if (files.length !== 1) {
            alert('please choose the wave file');
            return;
        }
        const file = files[0];
        benchmark(file, opus_config());
    });
    document.getElementById('play').addEventListener('click', () => {
        realtime_sample(opus_config());
    });
}
window.addEventListener('DOMContentLoaded', _ => {
    main();
});
