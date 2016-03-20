# mediacodec.wasm

以下のライブラリのWebAssembly版

* https://github.com/kazuki/opus.js-sample (libopusのasm.js)
* https://github.com/kazuki/video-codec.js (openh264, daala, libvpxのasm.js)

だけとほとんど動いてない...
一応Opusのエンコードは動いているっぽいけど，出力ビットストリームが正しいかは未検証

## ビルドに必要なもの

* https://github.com/kripken/emscripten
* https://github.com/WebAssembly/sexpr-wasm-prototype
* http://www.typescriptlang.org/

* (これはまだダメ) https://github.com/WebAssembly/binaryen