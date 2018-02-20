# === Standard Targets ===

.PHONY: all compile install clean clobber

all: compile docs

compile: build/Loader-raw.js build/Overture-raw.js

node_modules/.up-to-date: package.json yarn.lock
	rm -rf node_modules
	yarn
	touch -c node_modules/.up-to-date

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

.SECONDEXPANSION:

MODULE = $(patsubst build/%-raw.js,%,$@)

build/%-raw.js: $$(shell find source -name "*.js") node_modules/.up-to-date | build
	$(REMOVE_OLD)
	yarn run rollup source/$(MODULE).js -o $@ -c
	$(GZIP_AND_COMPRESS)
