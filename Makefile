# === Standard Targets ===

.PHONY: all compile install clean clobber

all: compile docs

compile: build/Loader.js build/Overture.js build/Loader-raw.js build/Overture-raw.js

node_modules/.up-to-date: package.json package-lock.json
	npm install
	touch node_modules/.stamp

build:
	mkdir -p build

clean:
	rm -rf build

clobber: clean
	rm -rf node_modules

# === Tools ===

PATH_TO_TOOLS := tools
include $(PATH_TO_TOOLS)/Makefile

# === Documentation ===

PATH_TO_DOC := tools/docbuilder
PATH_TO_DOC_SOURCES := source
PATH_TO_DOC_OUTPUT := build/docs
include $(PATH_TO_DOC)/Makefile

# === Build ===

build/Overture.js: source/Overture.js node_modules/.stamp | build
	npm run build:overture

build/Loader.js: source/Loader.js node_modules/.stamp | build
	npm run build:loader

.SECONDEXPANSION:

MODULE = $(patsubst build/%-raw.js,%,$@)

build/%-raw.js: $$(shell find source -name "*.js") node_modules/.stamp | build
	$(REMOVE_OLD)
	$(shell npm bin)/rollup source/$(MODULE).js -o $@ -c
	$(GZIP_AND_COMPRESS)
