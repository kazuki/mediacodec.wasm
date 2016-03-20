subdirs := native
.PHONY: $(subdirs)

all: test.js $(subdirs)

clean:
	rm -f test.js
	-for d in $(subdirs); do $(MAKE) -C $$d clean; done

test.js: test.ts
	tsc -out $@ test.ts

$(subdirs):
	$(MAKE) -C $@
