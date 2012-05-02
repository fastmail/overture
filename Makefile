# === Standard Targets ===

.PHONY: all build install clean

all: build docs

build: build/Loader-raw.js build/Vibrato-raw.js build/ie8patches-raw.js build/Vibrato-node.js

clean:
	rm -rf build docs

# === Tools ===

PATH_TO_TOOLS := tools
include $(PATH_TO_TOOLS)/Makefile

# === Documentation ===

PATH_TO_DOC := tools/docbuilder
PATH_TO_DOC_SOURCES := source/Vibrato
PATH_TO_DOC_OUTPUT := docs
include $(PATH_TO_DOC)/Makefile

# === Build ===

.SECONDEXPANSION:

build/%-raw.js: $$(shell find source/% -name "*.js")
	mkdir -p $(@D)
	$(REMOVE_OLD)
	$(MAKE_MODULE) _ _ $^ $@
	$(GZIP_AND_COMPRESS)

build/Vibrato-node.js: $$(shell find \
    source/Vibrato/core source/Vibrato/datastore source/Vibrato/foundation \
    source/Vibrato/localisation source/Vibrato/validate -name "*.js")
	mkdir -p $(@D)
	$(MAKE_MODULE) _ _ $^ $@