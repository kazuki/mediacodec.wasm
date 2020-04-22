JOBS:=$(shell grep -c ^processor /proc/cpuinfo 2>/dev/null)
EMCC_OPTS:=-O2 -s FILESYSTEM=0 -s INITIAL_MEMORY=134217728

MC_TARGET:=libmediacodec.wasm

OPUS_DIR:=opus
OPUS_OBJ:=$(OPUS_DIR)/.libs/libopus.a
OPUS_EXPORTS:='_opus_get_version_string','_opus_encoder_create','_opus_encode_float','_opus_encoder_ctl','_opus_encoder_destroy','_opus_decoder_create','_opus_decode_float','_opus_decoder_ctl','_opus_decoder_destroy'

SPEEXDSP_DIR:=speexdsp
SPEEXDSP_OBJ:=$(SPEEXDSP_DIR)/libspeexdsp/.libs/libspeexdsp.a
SPEEXDSP_EXPORTS:='_speex_resampler_init','_speex_resampler_destroy','_speex_resampler_process_interleaved_float'

AOM_DIR:=aom
AOM_LIB:=$(AOM_DIR)/build_wasm/libaom.a
AOM_EXPORTS:='_aom_codec_enc_init_ver','_aom_codec_enc_config_default','_aom_codec_enc_config_set','_aom_codec_get_global_headers','_aom_codec_encode','_aom_codec_set_cx_data_buf','_aom_codec_get_cx_data','_aom_codec_get_preview_frame','_aom_codec_dec_init_ver','_aom_codec_peek_stream_info','_aom_codec_get_stream_info','_aom_codec_decode','_aom_codec_get_frame','_aom_codec_version_str','_aom_codec_version_extra_str','_aom_codec_iface_name','_aom_codec_error','_aom_codec_error_detail','_aom_codec_destroy','_aom_codec_get_caps','_aom_img_alloc','_aom_img_free'

all: $(MC_TARGET)
clean:
	rm -f $(MC_TARGET)
	-for d in $(OPUS_DIR) $(SPEEXDSP_DIR) $(AOM_DIR); do (cd $$d; rm -rf *; git reset --hard); done

$(MC_TARGET): $(OPUS_OBJ) $(SPEEXDSP_OBJ) $(AOM_LIB)
	emcc -o $(MC_TARGET) $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(OPUS_EXPORTS),$(SPEEXDSP_EXPORTS),$(AOM_EXPORTS)]" $^

$(OPUS_OBJ): $(OPUS_DIR)/Makefile
	cd $(OPUS_DIR); emmake make -j$(JOBS)
$(OPUS_DIR)/Makefile: $(OPUS_DIR)/configure
	cd $(OPUS_DIR); emconfigure ./configure --disable-extra-programs --disable-doc --disable-asm --disable-rtcd --disable-intrinsics --disable-stack-protector
$(OPUS_DIR)/configure:
	cd $(OPUS_DIR); ./autogen.sh

$(SPEEXDSP_OBJ): $(SPEEXDSP_DIR)/Makefile
	cd $(SPEEXDSP_DIR); emmake make -j$(JOBS)
$(SPEEXDSP_DIR)/Makefile: $(SPEEXDSP_DIR)/configure
	cd $(SPEEXDSP_DIR); emconfigure ./configure --disable-examples
$(SPEEXDSP_DIR)/configure:
	cd $(SPEEXDSP_DIR); ./autogen.sh

$(AOM_LIB): $(AOM_DIR)/build_wasm/Makefile
	cd $(AOM_DIR)/build_wasm; emmake make -j$(JOBS)
$(AOM_DIR)/build_wasm/Makefile:
	cd $(AOM_DIR); \
	mkdir -p build_wasm; \
	cd build_wasm; \
	emcmake cmake -DCMAKE_BUILD_TYPE=Release -DENABLE_CCACHE=1 -DAOM_TARGET_CPU=generic -DENABLE_DOCS=0 -DENABLE_TESTS=0 -DCONFIG_MULTITHREAD=0 -DCONFIG_RUNTIME_CPU_DETECT=0 -DCONFIG_WEBM_IO=0 ..
