
build: dist/O.js

node_modules: package-lock.json
	npm ci $(NPM_INSTALL_FLAGS)

SRC_FILES := $(shell find source -name "*.js")

dist/O.js: $(SRC_FILES) node_modules
	rm -rf dist
	npm run build

clean:
	rm -rf dist

clobber: clean
	rm -rf node_modules
