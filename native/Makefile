JOBS:=$(shell grep -c ^processor /proc/cpuinfo 2>/dev/null)
EMCC_OPTS:=-O2 --llvm-lto 1 --memory-init-file 1 -s NO_FILESYSTEM=1 -s BINARYEN=1 -s TOTAL_MEMORY=134217728
# -s BINARYEN_METHOD="'native-wasm'"

MC_TARGET_BASE:=libmediacodec
MC_TARGET:=$(MC_TARGET_BASE).wasm

BINDING_SOURCES:=daala_binding.c

OPUS_DIR:=opus
OPUS_OBJ:=$(OPUS_DIR)/.libs/libopus.a
OPUS_EXPORTS:='_opus_get_version_string','_opus_encoder_create','_opus_encode_float','_opus_encoder_ctl','_opus_encoder_destroy','_opus_decoder_create','_opus_decode_float','_opus_decoder_ctl','_opus_decoder_destroy'

SPEEXDSP_DIR:=speexdsp
SPEEXDSP_OBJ:=$(SPEEXDSP_DIR)/libspeexdsp/.libs/libspeexdsp.a
SPEEXDSP_EXPORTS:='_speex_resampler_init','_speex_resampler_destroy','_speex_resampler_process_interleaved_float'

OGG_DIR:=ogg
OGG_LIB:=$(OGG_DIR)/src/.libs/libogg.a

DAALA_DIR:=daala
DAALA_LIB:=$(DAALA_DIR)/src/.libs/libdaalabase.a $(DAALA_DIR)/src/.libs/libdaalaenc.a $(DAALA_DIR)/src/.libs/libdaaladec.a
DAALA_EXPORTS:='_daala_comment_create','_daala_decode_create','_daala_decode_header_in','_daala_decode_img_out','_daala_decode_packet_in','_daala_encode_create','_daala_encode_ctl','_daala_encode_flush_header','_daala_encode_img_in','_daala_encode_packet_out','_daala_info_create','_daala_info_init','_daala_setup_free','_daala_version_string','_daala_image_create','_EXP_CDF_TABLE','_od_accounting_init','_od_apply_prefilter_frame_sbs','_od_apply_qm','_od_codedquantizer_to_quantizer','_od_ec_dec_init','_od_ec_tell_frac','_od_hv_intra_pred','_od_log_matrix_uchar','_od_postfilter_split','_od_pvq_decode','_od_state_init'

AOM_DIR:=aom
AOM_LIB:=$(AOM_DIR)/libaom.a
AOM_EXPORTS:='_aom_codec_enc_init_ver','_aom_codec_enc_config_default','_aom_codec_enc_config_set','_aom_codec_get_global_headers','_aom_codec_encode','_aom_codec_set_cx_data_buf','_aom_codec_get_cx_data','_aom_codec_get_preview_frame','_aom_codec_dec_init_ver','_aom_codec_peek_stream_info','_aom_codec_get_stream_info','_aom_codec_decode','_aom_codec_get_frame','_aom_codec_version_str','_aom_codec_version_extra_str','_aom_codec_iface_name','_aom_codec_error','_aom_codec_error_detail','_aom_codec_destroy','_aom_codec_get_caps','_aom_img_alloc','_aom_img_free'

all: $(MC_TARGET)
clean:
	rm -f $(MC_TARGET_BASE).*
	-for d in $(OPUS_DIR) $(SPEEXDSP_DIR) $(OGG_DIR) $(DAALA_DIR) $(AOM_DIR); do (cd $$d; rm -rf *; git reset --hard); done

$(MC_TARGET): $(OPUS_OBJ) $(SPEEXDSP_OBJ) $(DAALA_LIB) $(OGG_LIB) $(AOM_LIB) $(BINDING_SOURCES)
	emcc -o $(MC_TARGET_BASE).js $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(OPUS_EXPORTS),$(SPEEXDSP_EXPORTS),$(DAALA_EXPORTS),$(AOM_EXPORTS)]" $^

$(OPUS_OBJ): $(OPUS_DIR)/Makefile
	cd $(OPUS_DIR); emmake make -j$(JOBS)
$(OPUS_DIR)/Makefile: $(OPUS_DIR)/configure
	cd $(OPUS_DIR); emconfigure ./configure --disable-extra-programs --disable-doc --disable-asm --disable-rtcd --disable-intrinsics
$(OPUS_DIR)/configure:
	cd $(OPUS_DIR); ./autogen.sh

$(SPEEXDSP_OBJ): $(SPEEXDSP_DIR)/Makefile
	cd $(SPEEXDSP_DIR); emmake make -j$(JOBS)
$(SPEEXDSP_DIR)/Makefile: $(SPEEXDSP_DIR)/configure
	cd $(SPEEXDSP_DIR); emconfigure ./configure --disable-examples
$(SPEEXDSP_DIR)/configure:
	cd $(SPEEXDSP_DIR); ./autogen.sh

$(OGG_LIB): $(OGG_DIR)/Makefile
	cd $(OGG_DIR); emmake make -j$(JOBS)
$(OGG_DIR)/Makefile: $(OGG_DIR)/configure
	cd $(OGG_DIR); emconfigure ./configure
$(OGG_DIR)/configure: ogg.patch
	cd $(OGG_DIR); ../try-patch.sh ../ogg.patch && ./autogen.sh

$(DAALA_LIB): $(DAALA_DIR)/Makefile $(OGG_LIB)
	cd $(DAALA_DIR); emmake make -j$(JOBS)
$(DAALA_DIR)/Makefile: $(DAALA_DIR)/configure $(OGG_LIB)
	cd $(DAALA_DIR); OGG_CFLAGS=-I../ogg/include OGG_LIBS=-L../ogg/src/.libs \
	emconfigure ./configure --disable-examples --disable-player --disable-tools --disable-openmp --disable-unit-tests --disable-doc --disable-asm --disable-accounting
$(DAALA_DIR)/configure: $(OGG_LIB)
	cd $(DAALA_DIR); ./autogen.sh

$(AOM_LIB): $(AOM_DIR)/Makefile
	cd $(AOM_DIR); emmake make -j$(JOBS)
$(AOM_DIR)/Makefile:
	cd $(AOM_DIR); \
	emconfigure ./configure --target=generic-gnu --disable-examples --disable-docs --disable-multithread --disable-runtime-cpu-detect && \
	sed -i "s/-crs/crs/" libs-generic-gnu.mk && \
	sed -i "s/HAVE_GNU_STRIP=yes/HAVE_GNU_STRIP=no/" libs-generic-gnu.mk
