subdirs := native
.PHONY: $(subdirs)

all: audio-demo.js audio-demo.worker.js $(subdirs) libmediacodec.wasm

clean:
	rm -f *.js
	-for d in $(subdirs); do $(MAKE) -C $$d clean; done

%.worker.js: %.worker.ts
	tsc --lib es2017,webworker -t ES2017 -out $@ $^

%.js: %.ts
	tsc -t ES2017 -out $@ $^

$(subdirs):
	$(MAKE) -C $@

libmediacodec.wasm: native/libmediacodec.wasm
	cp native/$@ $@

native/libmediacodec.wasm: $(subdirs)
