# === Standard Targets ===

.PHONY: all compile install clean clobber

all: compile docs

compile: build/Overture-raw.js

node_modules: package-lock.json
	npm ci $(NPM_INSTALL_FLAGS)

build:
	mkdir -p build

clean:
	rm -rf build

clobber: clean
	rm -rf node_modules

# === Documentation ===

PATH_TO_DOC := tools/docbuilder
PATH_TO_DOC_SOURCES := source
PATH_TO_DOC_OUTPUT := build/docs
include $(PATH_TO_DOC)/Makefile

# === Build ===

SRC_FILES := $(shell find source -name "*.js")

build/Overture-raw.js: $(SRC_FILES) node_modules
	rm -rf build
	npm run build
