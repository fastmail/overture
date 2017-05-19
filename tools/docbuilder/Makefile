# === Documentation generation ===

# Usage:
# To use this, add the following two lines to your project makefile:
# 1. A variable PATH_TO_DOC_SOURCES which points to the folder containing the
#    source code you want to generate documentation for.
# 2. A variable PATH_TO_DOC_OUTPUT which points to the folder you wish to put
#    the generated documentation in.
# 3. A variable PATH_TO_DOC which points to the folder containing this
#    makefile.
# 4. The line: include $(PATH_TO_DOC)/Makefile
# You can then do `make docs` to make your documentation.

DOCS_STEMS := $(patsubst $(PATH_TO_DOC_SOURCES)/%.js,%,$(shell find $(PATH_TO_DOC_SOURCES) -name "*.js" ))
DOCS_JSON := $(addsuffix .json,$(addprefix $(PATH_TO_DOC_OUTPUT)/_parse/,$(DOCS_STEMS)))
DOCS := $(addsuffix .html,$(addprefix $(PATH_TO_DOC_OUTPUT)/,$(DOCS_STEMS)))

DOCS_STYLES := $(PATH_TO_DOC_OUTPUT)/main.css $(PATH_TO_DOC_OUTPUT)/reset.css
DOCS_SCRIPTS := $(PATH_TO_DOC_OUTPUT)/main.js $(PATH_TO_DOC_OUTPUT)/search.js $(PATH_TO_DOC_OUTPUT)/index.js

.PHONY: docs

docs: $(DOCS_STYLES) $(DOCS_SCRIPTS) $(DOCS) $(PATH_TO_DOC_OUTPUT)/index.html
	cp -r $(PATH_TO_DOC)/images $(PATH_TO_DOC_OUTPUT)

$(PATH_TO_DOC_OUTPUT)/%.js: $(PATH_TO_DOC)/scripts/%.js
	mkdir -p $(@D)
	$(UGLIFY_JS) $< -c warnings=false -m -o $@

$(PATH_TO_DOC_OUTPUT)/index.js: $(PATH_TO_DOC_OUTPUT)/_parse/index.json
	node $(PATH_TO_DOC)/engine/writeSearchIndex.js $^ $@

$(PATH_TO_DOC_OUTPUT)/%.css: $(PATH_TO_DOC)/styles/%.less
	mkdir -p $(@D)
	$(MINIFY_CSS) $< $@

$(PATH_TO_DOC_OUTPUT)/%.css: $(PATH_TO_DOC)/styles/%.css
	mkdir -p $(@D)
	$(MINIFY_CSS) $< $@

$(PATH_TO_DOC_OUTPUT)/_parse/index.json: $(DOCS_JSON)
	node $(PATH_TO_DOC)/engine/makeIndex.js $^ $@

$(PATH_TO_DOC_OUTPUT)/_parse/%.json: $(PATH_TO_DOC_SOURCES)/%.js
	mkdir -p $(@D)
	node $(PATH_TO_DOC)/engine/extract.js $< $@

$(PATH_TO_DOC_OUTPUT)/index.html: $(PATH_TO_DOC_OUTPUT)/_parse/index.json
	mkdir -p $(@D)
	node $(PATH_TO_DOC)/engine/write.js $(PATH_TO_DOC)/templates/index.html $(PATH_TO_DOC_OUTPUT)/_parse/index.json $^ $@

$(PATH_TO_DOC_OUTPUT)/%.html: $(PATH_TO_DOC_OUTPUT)/_parse/%.json $(PATH_TO_DOC_OUTPUT)/_parse/index.json
	mkdir -p $(@D)
	node $(PATH_TO_DOC)/engine/write.js $(PATH_TO_DOC)/templates/file.html $^ $@
