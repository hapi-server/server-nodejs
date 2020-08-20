NODEV=v6.16.0
NODED=https://nodejs.org/dist/latest-v6.x
# Do not modify following line. Version set by call to
#   npm run update
# which uses version in package.json
VERSION=v1.0.0

# To get other OS-X versions, see
# https://developer.apple.com/forums/thread/111322
OS=darwin-x64
#OS=linux-x64
#OS=linux-armv7l
#OS=win-x64

ifeq ($(OS),linux-x64)
	SERVER=alpine3o
endif
ifeq ($(OS),linux-armv7l)
	SERVER=pi3
endif
ifeq ($(OS),darwin-x64)
	SERVER=pro2
endif

# When NodeJS and Python binaries do not need to be updated.
update:
	sed -E -i '' 's/hapi-server-v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/hapi-server-$(VERSION)/g' ../README.md	
	sed -E -i '' 's/hapi-server:v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/hapi-server:$(VERSION)/g' ../README.md	
	sed -E -i '' 's/VERSION=v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/VERSION=$(VERSION)/g' Makefile
	sed -E -i '' 's/VERSION="v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}"/VERSION="$(VERSION)"/g' ../server.js
	make packages
	rm -rf dist/hapi-server-$(VERSION)/

packages:
	make package OS=darwin-x64 VERSION=$(VERSION)
	make package OS=linux-x64 VERSION=$(VERSION)
	make package OS=linux-armv7l VERSION=$(VERSION)

GITHUB=https://github.com/hapi-server/server-nodejs/releases/download
package:
	make files
	#Do this if compiled binaries change.
	#cp bin/node-$(NODEV)-$(OS) dist/hapi-server-$(VERSION)/bin/node
ifeq ($(OS),win-x64)
	# Not tested
else
	# Use comiled binaries from a previous release
	cd /tmp; curl -L -O $(GITHUB)/v0.9.5/hapi-server-v0.9.5-$(OS).tgz
	cd /tmp; tar zxf hapi-server-v0.9.5-$(OS).tgz \
		hapi-server-v0.9.5/bin/node hapi-server-v0.9.5/bin/python
	mv /tmp/hapi-server-v0.9.5/bin/node dist/hapi-server-$(VERSION)/bin
	mv /tmp/hapi-server-v0.9.5/bin/python dist/hapi-server-$(VERSION)/bin
	rm -f /tmp/hapi-server-v0.9.5-$(OS).tgz
endif
ifeq ($(OS),win-x64)
	make zip OS=$(OS)
else
	make targz OS=$(OS)
endif

files:
	rm -rf dist/hapi-server-$(VERSION)
	mkdir -p dist/hapi-server-$(VERSION)
	rsync -aq \
		--exclude pkg \
		--exclude .git \
		--exclude public/data/QinDenton \
		../ dist/hapi-server-$(VERSION)
	rm -rf dist/hapi-server-$(VERSION)/package*
	rm -rf dist/hapi-server-$(VERSION)/.git*
	rm -rf dist/hapi-server-$(VERSION)/node_modules/moment/src
	rm -rf dist/hapi-server-$(VERSION)/node_modules/moment/min
	rm -rf dist/hapi-server-$(VERSION)/node_modules/moment/locale

zip:
	cd dist; zip -r hapi-server-$(VERSION)-$(OS).zip hapi-server-$(VERSION)

targz:
	cd dist; tar zcvf hapi-server-$(VERSION)-$(OS).tgz hapi-server-$(VERSION)

docker:
	- docker stop hapi-server
	- docker rm hapi-server
	docker build --file Dockerfile -t rweigel/hapi-server:$(VERSION) ../
	docker run -dit --name hapi-server-$(VERSION) --expose 8999 -p 8999:8999 rweigel/hapi-server:$(VERSION)

release:
	cd ..; rm -rf node_modules; npm install --production;
	make update VERSION=$(VERSION);
	cd .. && source pkg/GITHUB_TOKEN && release-it $(VERSION) --preRelease=beta --no-git.requireCleanWorkingDir --no-npm.publish

docker-test:
	docker exec -it hapi-server-$(VERSION) ./hapi-server test
	docker stop hapi-server-$(VERSION)

docker-release:
	docker login
	docker tag rweigel/hapi-server:$(VERSION) rweigel/hapi-server:$(VERSION)
	docker push rweigel/hapi-server:$(VERSION)
	#make docker-release-test VERSION=$(VERSION)

docker-release-test:
	- docker stop hapi-server-release-$(VERSION)
	- docker rm hapi-server-release-$(VERSION)
	docker system prune -af
	docker pull rweigel/hapi-server:$(VERSION)
	docker run -dit --name hapi-server-release-$(VERSION) --expose 8998 -p 8998:8998 rweigel/hapi-server:$(VERSION)
	docker exec -it hapi-server-release-$(VERSION) ./hapi-server test

test-packages:
	make test-package VERSION=$(VERSION) OS=darwin-x64
	make test-package VERSION=$(VERSION) OS=linux-x64
	make test-package VERSION=$(VERSION) OS=linux-armv7l

test-package:
	scp dist/hapi-server-$(VERSION)-$(OS).tgz $(SERVER):
	ssh $(SERVER) 'tar zxf hapi-server-$(VERSION)-$(OS).tgz; \
		cd hapi-server-$(VERSION); ./hapi-server test'

clean:
	rm -rf dist/



# Did this on High Sierra
darwin-x64: 
	make node0 OS=darwin-x64
	make package OS=darwin-x64

# Did this on Pi 3+
linux-armv7l:
	make node0 OS=linux-armv7l
	make python OS=linux-armv7l
	make package OS=linux-armv7l

# Did this on Alpine 3.8
linux-x64:
	make node OS=linux-x64
	make python OS=linux-x64
	make package OS=linux-x64

# This was working at one point.
win-x64:
	copy bin/node-$(NODEV)-$(OS).exe dist/hapi-server-$(VERSION)/bin/node.exe
	copy python.py python/
	cd python/; C:\Python2.7\Scripts\pyinstaller python.py --onefile
	copy python/dist/python.exe bin/python-$(OS).exe
	make package OS=win-x64

node0:
	cd tgz; curl -O $(NODED)/node-$(NODEV)-$(OS).tar.gz;
	cd tgz; tar zxf node-$(NODEV)-$(OS).tar.gz
	cp tgz/node-$(NODEV)-$(OS)/bin/node bin/node-$(NODEV)-$(OS)

# Did this on Alpine Linux 3.8 and executable worked on
# Mint 18/19 and Ubuntu 10.04. Will not work for OS-X (as per
# note in configure file in node tarball). Compile also worked on
# Raspberry Pi 3+, but the apt install command below had to be modified.
# (Some packages were not available and apparently were not needed. Need to document
# the working command)
node:
	# apk add is for Apline Linux
	sudo apk add curl python build-base gcc abuild binutils binutils-doc gcc-doc linux-headers
	#sudo apt install curl python build-base gcc abuild binutils binutils-doc gcc-doc linux-headers
	cd tgz; curl -O $(NODED)/node-$(NODEV).tar.gz;
	cd tgz; tar zxvf node-$(NODEV).tar.gz
	cd node-$(NODEV); ./configure --fully-static
	cd node-$(NODEV); make -j4
	cp node-$(NODEV)/bin/node bin/node-$(NODEV)-$(OS)

# Use old Linux system to compile.
# Don't need to do for OS-X as it ships with OS. Smaller Linux
# distros don't include Python, so have it in case needed.
# TODO: Finish python.py.
# Works, but no easy way to copy binary to local ...
pythoni:
	docker pull six8/pyinstaller-alpine
	docker run --rm \
		-v "${PWD}:/src" \
		six8/pyinstaller-alpine \
		--noconfirm \
		--onefile \
		--log-level DEBUG \
		--clean \
		python/python.py

pv=`python --version 2>&1 | cut -d' ' -f2`
python:
	cd python/; mkdir tmp; cp python.py tmp/
	cd python/tmp; pyinstaller python.py --onefile
	cp python/tmp/dist/python bin/python-$(pv)-$(OS)
	ln -s bin/python-$(pv)-$(OS) bin/python
