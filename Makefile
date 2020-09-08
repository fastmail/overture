
build: build/Overture-raw.js

node_modules: package-lock.json
	npm ci $(NPM_INSTALL_FLAGS)

SRC_FILES := $(shell find source -name "*.js")

build/Overture-raw.js: $(SRC_FILES) node_modules
	rm -rf build
	npm run build

clean:
	rm -rf build

clobber: clean
	rm -rf node_modules
