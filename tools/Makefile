# === Tools ===

# Usage:
# To use this, add the following two lines to your project makefile:
# 1. A variable PATH_TO_TOOLS which points to the folder containing this
#    makefile.
# 2. The line: include $(PATH_TO_TOOLS)/Makefile

TOOLS := node $(PATH_TO_TOOLS)

# Args:
# pathToEnglishDB
# scope
# var_args... pathsToFilesToScan
# outputFileName (strings.json)
ENUMERATE_STRINGS := $(TOOLS)/localise.js enumerate

# Args:
# strings.json
# lang.po
# default.po
# output
MAKE_LANG_MODULE := $(TOOLS)/localise.js makeLangModule

# Args:
# EnglishDB
# Scope
# strings.json
# inputFileName
# outputFileName
INSERT_LOCALE := $(TOOLS)/localise.js insertLocale

# Args:
# Input files
# Output file
CONCATENATE := $(TOOLS)/jstools.js concatenate

# Args:
# Input files
# Output file
MINIFY_JS := $(TOOLS)/jstools.js compress

# Args:
# Input files
# Output file
MINIFY_CSS := $(TOOLS)/csstools.js minify

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

DB_TO_PO := $(TOOLS)/dbTools.js dbToPo

ifeq ($(shell which sha1sum),)
HASH_FILE := md5 -q
else
HASH_FILE := sha1sum
endif

define GZIP_AND_COMPRESS
gzip -c $@ > $@.gz
TYPE=`echo $@ | cut -d . -f 2-`; \
HASH=`$(HASH_FILE) $@ | cut -c 1-8`; \
COMPRESSEDNAME=`echo $@ | sed s/raw/$$HASH/`; \
if [ $$TYPE = js ]; then \
$(MINIFY_JS) $@ $$COMPRESSEDNAME; \
else \
cp $@ $$COMPRESSEDNAME; \
fi; \
gzip -c $$COMPRESSEDNAME > $$COMPRESSEDNAME.gz
endef

define REMOVE_OLD
rm -f $@ $@.gz `echo $@ $@.gz | sed "s/-raw/-????????/g"`
endef
