ID      := $(shell sed -n 's/^id: //p' plugin.yaml)
VERSION := $(shell sed -n 's/^version: //p' plugin.yaml)
ZIP     := dist/$(ID)-$(VERSION).zip

.PHONY: zip test clean

# What a site installs.
zip:
	mkdir -p dist
	rm -f $(ZIP)
	zip -qr $(ZIP) $(wildcard plugin.yaml assets i18n README.md LICENSE)
	@echo $(ZIP)

# The script, run against a fake page.
test:
	node --test test/comments.test.js

clean:
	rm -rf dist
