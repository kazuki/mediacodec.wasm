/// <reference path="riff_pcm_wave_reader.ts" />
interface OpusConfig {
  //frame_duration: number;
  application: number;
}

class AsyncWorker {
  _worker: Worker;
  _waiting_resolve: ((_: MessageEvent) => void) | null = null;
  _waiting_reject: ((_: any) => void) | null = null;
  _queue = new Array<MessageEvent | ErrorEvent>();

  constructor(w: Worker) {
    this._worker = w;
    const handler = (m: MessageEvent | ErrorEvent) => {
      this._queue.push(m);
      this._check_queue();
    };
    w.onmessage = (m: MessageEvent) => handler(m);
    w.onerror = (e: ErrorEvent) => handler(e);
  }

  private _check_queue() {
    const resolve = this._waiting_resolve;
    const reject = this._waiting_reject;
    if (this._queue.length === 0 || resolve === null)
      return;
    this._waiting_resolve = null;
    this._waiting_reject = null;
    const m = this._queue.shift();
    if (m instanceof MessageEvent) {
      resolve(m);
    } else if (m instanceof ErrorEvent) {
      reject(m);
    } else {
      console.error('unknown type:', m);
    }
  }

  postMessage(m: any, transfer?: Transferable[]): void {
    this._worker.postMessage(m, transfer);
  }

  async recv(): Promise<MessageEvent> {
    return new Promise<MessageEvent>((resolve, reject) => {
      this._waiting_resolve = resolve;
      this._waiting_reject = reject;
      this._check_queue();
    });
  }
}

async function benchmark(file: File, opus_cfg: OpusConfig) {
  const reader = new RiffPcmWaveReader();
  const audio_info = await reader.open(file);
  const worker = new AsyncWorker(new Worker('audio-demo.worker.js'));
  const pcm_blocks = new Array<Float32Array>();
  const packets = new Array<Uint8Array>();

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
  worker.postMessage({type: 'free'});
  await worker.recv();
  const encode_end = performance.now();
  console.log('done: ' + packets.length.toString() + ' packets');
  console.log('encode ' + (encode_end - encode_start) + 'ms, speed: ' +
              ((total_samples / audio_info.num_of_channels / audio_info.sampling_rate) / ((encode_end - encode_start) / 1000)).toString() + 'x');
}

async function realtime_sample(opus_cfg: OpusConfig) {
}

function opus_config(): OpusConfig {
  const app_str = (<HTMLSelectElement>document.getElementById('opus_app')).value;
  return {
    //frame_duration: parseFloat((<HTMLSelectElement>document.getElementById('opus_frame_duration')).value),
    application: {
      voip: 2048,
      audio: 2049,
      lowdelay: 2051,
    }[app_str],
  }
}

function main() {
  document.getElementById('start-benchmark').addEventListener('click', () => {
    const files = (<HTMLInputElement>document.getElementById('input_filedata')).files;
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
