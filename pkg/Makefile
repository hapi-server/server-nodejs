NODEV=v6.16.0
NODED=https://nodejs.org/dist/latest-v6.x
VERSION=v0.9.2
DIST=darwin-x64
# Did this on High Sierra
#DIST=linux-x64 # Did this on Alpine 3.8
#DIST=linux-armv7l # Did this on Pi 3+
#DIST=win-x64

release:
	cd ..; rm -rf node_modules; npm install --production; 
	make update VERSION=$(VERSION);
	cd ..; source pkg/GITHUB_TOKEN && release-it $(VERSION) --preRelease=beta --no-git.requireCleanWorkingDir --no-npm.publish

# When node and python binaries do not need to be updated.
update:
	make package OS=darwin-x64
	make package OS=linux-x64
	make package OS=linux-armv7l
	rm -rf dist/hapi-server-$(VERSION)/
	#make package OS=win-x64

package:
	make files
	cp bin/node-$(NODEV)-$(OS) dist/hapi-server-$(VERSION)/bin/node
	# cp bin/python-$(OS) dist/hapi-server-$(VERSION)/bin/python
	make targz OS=$(OS)
	#make zip OS=$(OS)

darwin-x64: 
	make node0 OS=darwin-x64
	make package OS=darwin-x64

linux-armv7l:
	make node0 OS=linux-armv7l
	make python OS=linux-armv7l
	make package OS=linux-armv7l

# Do this on an old x64 Linux distribution
linux-x64:
	make node OS=linux-x64
	make python OS=linux-x64
	make package OS=linux-x64

win-x64:
	copy bin/node-$(NODEV)-$(OS).exe dist/hapi-server-$(VERSION)/bin/node.exe
	copy python.py python/
	cd python/; C:\Python2.7\Scripts\pyinstaller python.py --onefile
	copy python/dist/python.exe bin/python-$(OS).exe
	make package OS=win-x64

zip:
	cd dist; zip -r hapi-server-$(VERSION)-$(OS).zip hapi-server-$(VERSION)

targz:
	cd dist; tar zcvf hapi-server-$(VERSION)-$(OS).tgz hapi-server-$(VERSION)

node0:
	cd tgz; curl -O $(NODED)/node-$(NODEV)-$(OS).tar.gz;
	cd tgz; tar zxf node-$(NODEV)-$(OS).tar.gz
	cp tgz/node-$(NODEV)-$(OS)/bin/node bin/node-$(NODEV)-$(OS)

# Did this on Alpine Linux 3.8 and executable worked on
# Mint 18/19 and Ubuntu 10.04. Will not work for OS-X (as per
# note in configure file in node tarball). 
node:
	sudo apt install curl python build-base gcc abuild binutils binutils-doc gcc-doc linux-headers
	cd tgz; curl -O $(NODED)/node-$(NODEV).tar.gz;
	cd tgz; tar zxvf node-$(NODEV).tar.gz
	cd node-$(NODEV); ./configure --fully-static
	cd node-$(NODEV); make -j4
	cp node-$(NODEV)/bin/node bin/node-$(NODEV)-$(OS)

# Use old Linux system to compile.
# Don't need to do for OS-X as it ships with OS. Smaller Linux
# distros don't include Python, so have it in case needed.
python:
	cp python.py python/
	cd python/; pyinstaller python.py --onefile
	cp python/dist/python bin/python-$(OS)

files:
	rm -rf dist/hapi-server-$(VERSION)
	mkdir -p dist/hapi-server-$(VERSION)
	rsync -aq \
		--exclude pkg \
		--exclude .git \
		--exclude public/data/QinDenton \
		../ dist/hapi-server-$(VERSION)
	rm -f dist/hapi-server-$(VERSION)/*.md
	rm -rf dist/hapi-server-$(VERSION)/.git*
	rm -rf dist/hapi-server-$(VERSION)/node_modules/moment/src
	rm -rf dist/hapi-server-$(VERSION)/node_modules/moment/min
	rm -rf dist/hapi-server-$(VERSION)/node_modules/moment/locale

clean:
	rm -rf dist/
