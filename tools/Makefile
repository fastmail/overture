# === Tools ===

# Usage:
# To use this, add the following two lines to your project makefile:
# 1. A variable PATH_TO_TOOLS which points to the folder containing this
#    makefile.
# 2. The line: include $(PATH_TO_TOOLS)/Makefile

TOOLS := node $(PATH_TO_TOOLS)

# Args:
# Comma separated list of defined vars
# inputFileName
# outputFileName
IFDEF := $(TOOLS)/ifdef.js

# Args:
# pathToEnglishDB
# var_args... pathsToFilesToScan
# outputFileName (strings.json)
ENUMERATE_STRINGS := $(TOOLS)/localise.js enumerate

# Args:
# pathToEnglishDB
# var_args... pathsToFilesToScan
# outputFileName (strings.json)
ENUMERATE_STRING_USAGE := $(TOOLS)/localise.js findUses

# Args:
# strings.json
# lang.po
# output
MAKE_LANG_MODULE := $(TOOLS)/localise.js makeLangModule

# Args:
# EnglishDB
# strings.json
# inputFileName
# outputFileName
INSERT_LOCALE := $(TOOLS)/localise.js insertLocale

# Args:
# EnglishDB
# inputFileName
# outputFileName
INSERT_ENGLISH := $(TOOLS)/localise.js insertEnglish

# Args:
# Input files
# Output file
CONCATENATE := $(TOOLS)/jstools.js concatenate

# Args:
# Input files (LESS/CSS)
# Output file
MINIFY_CSS := $(TOOLS)/csstools.js minify

# Args:
# Input files (CSS only)
# Output file
MINIFY_CSS_ONLY := $(TOOLS)/csstools.js minifyCSSOnly

# Converts any LESS files to CSS and concatenates.
# Args:
# var_args... input less files
# outputFileName
LESS_TO_CSS := $(TOOLS)/csstools.js less

# LESS->CSS, + include all linked files + include all images.
# Args:
# Input files
# output file
MAKE_SINGLE_CSS := $(TOOLS)/csstools.js makeSingleIncImages

# Replace file names
# Args:
# var_args... List of file names
# file in
# file out
REPLACE_FILE_NAMES := $(TOOLS)/module.js replaceFileNames

# Args:
# module set name
# var_args... modules
# input
# output
ADD_MODULE_LIST := $(TOOLS)/module.js addModuleList

# Args:
# themeManagerPath
# theme
# var_args... input files
# output
MAKE_MODULE := $(TOOLS)/module.js makeModule

MAKE_TZ := $(TOOLS)/olsonParser.js

UPDATE_PO := $(TOOLS)/localise.js updatePo
DB_TO_PO := $(TOOLS)/localise.js dbToPo

ifeq ($(wildcard node_modules/.bin/uglifyjs),)
UGLIFY_JS := uglifyjs
else
UGLIFY_JS := node_modules/.bin/uglifyjs
endif

ifeq ($(shell which sha1sum),)
HASH_FILE := md5 -q
else
HASH_FILE := sha1sum
endif

define GZIP_AND_COMPRESS
gzip -9c $@ > $@.gz
TYPE=`echo $@ | cut -d . -f 2-`; \
HASH=`$(HASH_FILE) $@ | cut -c 1-8`; \
COMPRESSEDNAME=`echo $@ | sed s/raw/$$HASH/`; \
if [ $$TYPE = js ]; then \
$(UGLIFY_JS) $@ -m > $$COMPRESSEDNAME || exit 1; \
elif [ $$TYPE = css ]; then \
$(MINIFY_CSS_ONLY) $@ $$COMPRESSEDNAME || exit 1; \
else \
cp $@ $$COMPRESSEDNAME; \
fi; \
gzip -9c $$COMPRESSEDNAME > $$COMPRESSEDNAME.gz
endef

define REMOVE_OLD
rm -f $@ $@.gz `echo $@ $@.gz | sed "s/-raw/-????????/g"`
endef
