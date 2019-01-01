NODE=node6
VERSION=0.9.1
DIST=osx-x64

# Need to do this on an old Linux distribution.
# Did this on Alpine Linux 3.8 and executable worked on
# Mint 18/19 and Ubuntu 10.04.
# Will not work for OS-X. Probably need to compile on
# an old version of OS-X to ensure it will work on older
# versions. Not sure about Windows. Probably just copy the
# the precompiled binary.
node:
	sudo apt install curl python build-base gcc abuild binutils binutils-doc gcc-doc linux-headers
	cd tgz; tar zxvf node-v6.16.0.tar.gz
	cd node-v6.16.0; ./configure --fully-static
	cd node-v6.16.0; make -j4

# Should work on all operating systems. Use old OS.
python:
	pyinstaller python.py --onefile

files:
	rm -rf dist/hapi-server-v$(VERSION)
	mkdir -p dist/hapi-server-v$(VERSION)
	rsync -aq \
		--exclude pkg \
		--exclude .git \
		--exclude public/data/QinDenton \
		../ dist/hapi-server-v$(VERSION)/
	cd dist/hapi-server-v$(VERSION); \
		rm -f *.md \
		rm -f package* \
		rm -rf .git* \
		rm -rf node_modules/src \
		rm -rf node_modules/min

bin: main.js
	- mkdir node_modules
	pkg . -t $(NODE)-$(DIST) -o dist/bin/hapi-server-$(DIST)
	#--out-path dist/hapi-server-v$npm_package_version/

zip:
	cd dist; zip -qr \
		hapi-server-$(NODE)-$(DIST)-v$(VERSION).zip \
		hapi-server-v$(VERSION)

pkg:
	make files DIST=$(DIST)
	make bin DIST=$(DIST)
	cp dist/bin/hapi-server-$(DIST) dist/hapi-server-v$(VERSION)
	make zip DIST=$(DIST)

linux:
	make pkg DIST=linux-x64

alpine:
	make pkg DIST=alpine-x64

osx:
	make pkg DIST=osx-x64

win:
	make pkg DIST=win-x64

all:
	make linux
	make alpine
	make osx
	make win

clean:
	rm -rf dist/
