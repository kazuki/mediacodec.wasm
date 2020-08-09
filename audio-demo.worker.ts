async function main() {
  const table = new WebAssembly.Table({initial: 64, element: 'anyfunc'});  // 28 entries used in wasm
  const wasm = await WebAssembly.instantiateStreaming(fetch('libmediacodec.wasm'), {
    wasi_snapshot_preview1: {
      proc_exit: (status_code) => {},
      fd_close: (fd) => 0,
      fd_seek: (fd, offset_low, offset_high, whence, newOffset) => {},
      fd_write: (fd, iov, iovcnt, p_written) => 0,
      fd_read: (fd, iov, iovcnt, p_read) => 0,
    },
    env: {
      setTempRet0: () => {},
      round: (x) => Math.round(x),
      table: table,
    },
  });
  const mem = (<WebAssembly.Memory><any>wasm.instance.exports.memory).buffer;
  const exports: any = wasm.instance.exports;
  console.log(exports);
  postMessage({'status': 'ready'});

  let handle: number | null = null;
  let mode: 'encoder' | 'decoder' | null = null;
  let fs: number;
  let ch: number;
  let frame_size = 960;
  let buf_f32: Float32Array;
  let buf_f32_ptr: number = 0;
  let buf_f32_filled = 0;
  const packet_max_size = 1275 * 3 + 7;
  const packet_ptr = exports.malloc(packet_max_size);
  const packet = new Uint8Array(mem, packet_ptr, packet_max_size);
  
  const ptr4 = exports.malloc(4);

  onmessage = (e: MessageEvent) => {
    if (e.data instanceof Float32Array) {
      let pcm = e.data;
      const packets = [];
      const transfers = [];
      while (pcm.length > 0) {
        const sz = Math.min(pcm.length, frame_size * ch - buf_f32_filled);
        buf_f32.set(pcm.subarray(0, sz), buf_f32_filled);
        buf_f32_filled += sz;
        pcm = pcm.subarray(sz);
        if (buf_f32_filled == frame_size * ch) {
          const ret = exports.opus_encode_float(handle, buf_f32_ptr, frame_size, packet_ptr, packet_max_size);
          if (ret > 0) {
            const tmp = new Uint8Array(ret);
            tmp.set(packet.subarray(0, ret));
            packets.push(tmp);
            transfers.push(tmp.buffer);
          }
          buf_f32_filled = 0;
        }
      }
      postMessage({
        packets: packets
      }, transfers);
    } else if (e.data instanceof Uint8Array) {
      packet.set(e.data);
      const ret = exports.opus_decode_float(handle, packet_ptr, e.data.length, buf_f32_ptr, frame_size, 0);
      const tmp = new Float32Array(ret);
      tmp.set(buf_f32.subarray(0, ret));
      postMessage(tmp, [tmp.buffer]);
    } else {
      if (e.data.type === 'encoder') {
        fs = e.data.params.Fs;
        ch = e.data.params.channels;
        frame_size = 960;
        handle = exports.opus_encoder_create(fs, ch, e.data.params.application, ptr4);
        if (!handle) {
          postMessage({'status': 'error'});
          return;
        }
        mode = 'encoder';
        if (buf_f32_ptr)
          exports.free(buf_f32_ptr);
        buf_f32_ptr = exports.malloc(frame_size * 4 * ch);
        if (buf_f32_ptr === 0) {
          postMessage({'status': 'error', 'detail': 'oom'});
          return;
        }
        buf_f32 = new Float32Array(mem, buf_f32_ptr, frame_size * ch);
        postMessage({'status': 'encoder:ok'});
      } else if (e.data.type === 'decoder') {
        fs = e.data.params.Fs;
        ch = e.data.params.channels;
        handle = exports.opus_decoder_create(fs, ch, ptr4);
        if (!handle) {
          postMessage({'status': 'error'});
          return;
        }
        mode = 'decoder';
        frame_size = fs * 60 /* max frame duration[ms] */ / 1000;
        if (buf_f32_ptr)
          exports.free(buf_f32_ptr);
        buf_f32_ptr = exports.malloc(frame_size * 4 * ch);
        if (buf_f32_ptr === 0) {
          postMessage({'status': 'error', 'detail': 'oom'});
          return;
        }
        buf_f32 = new Float32Array(mem, buf_f32_ptr, frame_size * ch);
        postMessage({'status': 'decoder:ok'});
      } else if (e.data.type === 'free') {
        if (mode === 'encoder') {
          exports.opus_encoder_destroy(handle);
        } else if (mode === 'decoder') {
          exports.opus_decoder_destroy(handle);
        }
        handle = 0;
        mode = null;
        postMessage({'status': 'free:ok'});
      }
    }
  };
}

main();
