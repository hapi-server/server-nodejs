# See .travis.yml for creating a release through Travis

# To create a release manually
#   1. modify version on line 3 of package.json
#   2. npm run package 			# Creates pkg/*.tgz files with needed binaries from previous release
#   3. npm run test-packages	# Tests packages on locally running VMs
#   4. npm run release         	# Tags release on github

# If a new version of node or python is needed
# On Linux
#   make python
#   make node
# On OS-X (python 2.7 is part of OS distribution, so `make python` not needed.)
#   make node
# On Windows -- Follow instructions for installing dependencies
# in "python" target below. Then
#   make python
#   make node

SHELL := /bin/bash

NODEV=v6.16.0
NODED=https://nodejs.org/dist/

PYTHONV=3.8.5

# Do not modify following line. Version set by call to
#   npm run version
# which uses version in package.json
VERSION=v1.0.12

# To get other OS-X versions, see
# https://developer.apple.com/forums/thread/111322
ifeq ($(shell uname),Darwin)
	OS=darwin-x64
endif
ifeq ($(shell uname),Linux)
	OS=linux-x64
endif
ifeq ($(shell uname),Windows_NT)
	# Not tested
	OS=win-x64
endif
#OS=linux-armv7l

version:
	sed -E -i '' 's/hapi-server-v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/hapi-server-$(VERSION)/g' ../README.md	
	sed -E -i '' 's/hapi-server:v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/hapi-server:$(VERSION)/g' ../README.md	
	sed -E -i '' 's/download\/v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/download\/$(VERSION)/g' ../README.md	
	sed -E -i '' 's/VERSION=v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/VERSION=$(VERSION)/g' Makefile
	sed -E -i '' 's/VERSION="v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}"/VERSION="$(VERSION)"/g' ../server.js

# When NodeJS and Python binaries do not need to be updated.
update:
	make packages VERSION=$(VERSION)
	rm -rf dist/hapi-server-$(VERSION)/

packages:
	make package OS=win-x64 VERSION=$(VERSION)
	make package OS=darwin-x64 VERSION=$(VERSION)
	make package OS=linux-x64 VERSION=$(VERSION)

BINARIES=http://mag.gmu.edu/git-data/server-nodejs/bin
package:
	echo "$(shell uname)"
	echo "$(OS)"
	rm -rf dist/hapi-server-$(VERSION)
	mkdir -p dist/hapi-server-$(VERSION)/bin
ifeq ($(OS),win-x64)
	curl --output dist/hapi-server-$(VERSION)/bin/python.exe $(BINARIES)/python-2.7-win-x64.exe
	curl --output dist/hapi-server-$(VERSION)/bin/node.exe $(BINARIES)/node-v8.17.0-win-x64.exe
else
	cd dist/hapi-server-$(VERSION)/bin/; \
		curl -O $(BINARIES)/node-$(NODEV)-$(OS); \
		ln -s node-$(NODEV)-$(OS) node; \
		chmod 744 node*
endif
ifeq ($(OS),linux-x64)
	cd dist/hapi-server-$(VERSION)/bin/; \
		curl -O $(BINARIES)/python-$(PYTHONV)-$(OS); \
		ln -s python-$(PYTHONV)-$(OS) python; \
		chmod 744 python*
endif
	make files
ifeq ($(OS),win-x64)
	make zip OS=$(OS)
else
	make targz OS=$(OS)
endif

files:
	rsync -aq \
		--exclude metadata/CAIO \
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
	cd dist; zip -q -r hapi-server-$(VERSION)-$(OS).zip hapi-server-$(VERSION)

targz:
	cd dist; tar zcf hapi-server-$(VERSION)-$(OS).tgz hapi-server-$(VERSION)

release:
	cd ..; rm -rf node_modules; npm install --production;
	make update VERSION=$(VERSION);
	npm install release-it;
	cd .. && GITHUB_TOKEN=$(GITHUB_OAUTH_TOKEN) && release-it $(VERSION) \
		--preRelease=beta --no-git.requireCleanWorkingDir --no-npm.publish

# To log in to server, use, e.g.,
# docker exec -it hapi-server-v1.0.0 /bin/bash
docker:
	- docker stop hapi-server-$(VERSION)
	- docker rm hapi-server-$(VERSION)
	docker build --file Dockerfile -t rweigel/hapi-server:$(VERSION) ../
	docker run -dit --name hapi-server-$(VERSION) --expose 8999 -p 8999:8999 rweigel/hapi-server:$(VERSION)


docker-test:
	docker exec -it hapi-server-$(VERSION) ./hapi-server test
	docker stop hapi-server-$(VERSION)

docker-release:
	docker login
	docker tag rweigel/hapi-server:$(VERSION) rweigel/hapi-server:$(VERSION)
	docker push rweigel/hapi-server:$(VERSION)
	- #make docker-release-test VERSION=$(VERSION)

docker-release-test:
	- docker stop hapi-server-release-$(VERSION)
	- docker rm hapi-server-release-$(VERSION)
	docker system prune -af
	docker pull rweigel/hapi-server:$(VERSION)
	docker run -dit --name hapi-server-release-$(VERSION) --expose 8998 -p 8998:8998 rweigel/hapi-server:$(VERSION)
	docker exec -it hapi-server-release-$(VERSION) ./hapi-server test
	docker stop hapi-server-release-$(VERSION)

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

########################################################################################################
# Stand-alone node executables
########################################################################################################

node:
ifeq ($(OS),win-x64)
	nvm install 8.17.0
	cd ..;npm install
	npm test
	scp "C:\Program Files\nodejs\node.exe" \
		weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/bin/node-8.17.0-win-x64.exe
else
	- mkdir tgz
	cd tgz; curl -O $(NODED)/$(NODEV)/node-$(NODEV)-$(OS).tar.gz;
	cd tgz; tar zxf node-$(NODEV)-$(OS).tar.gz
	scp tgz/node-$(NODEV)-$(OS)/bin/node \
		weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/bin/node-$(NODEV)-$(OS)
endif

node-static:
	- # apk add is for Alpine Linux
	- # Will staticx work for node binary so that compilation is not needed?
	sudo apk add curl python build-base gcc abuild binutils binutils-doc gcc-doc linux-headers
	- mkdir tgz;
	cd tgz; curl -O $(NODED)/$(NODEV)/node-$(NODEV).tar.gz;
	cd tgz; tar zxvf node-$(NODEV).tar.gz
	cd node-$(NODEV); ./configure --fully-static
	cd node-$(NODEV); make -j4
	cp node-$(NODEV)/bin/node bin/node-$(NODEV)-$(OS)

########################################################################################################

########################################################################################################
# Stand-alone Python executables
########################################################################################################
python:
ifeq ($(OS),win-x64)
	- # Do this on Windows 10
	- # First install
	- # https://www.python.org/ftp/python/2.7.18/python-2.7.18.amd64.msi
	- # https://github.com/coreybutler/nvm/releases
	- # https://chocolatey.org/install
	- # choco install make
	- # then
	- #   make python
	- # should work.
	C:\Python27\Scripts\pip.exe install pyinstaller==3.6
	C:\Python27\Scripts\pyinstaller.exe python.py --onefile
	scp dist\python.exe weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/bin/python-2.7-win-x64.exe
endif
ifeq ($(OS),linux-x64)
	-#conda create -y --name $(PYTHONV) python=$(PYTHONV)
	source /home/parallels/miniconda3/etc/profile.d/conda.sh
	conda env list
	- rm -rf tmp/;
	mkdir tmp;
	cp python.py tmp/
	pip install pyinstaller
	cd tmp; pyinstaller --onefile --clean python.py
	pip install staticx
	sudo apt install patchelf
	staticx tmp/dist/python tmp/python
	./tmp/python ../bin/Example.py | head -1
	test $(shell ./python ../bin/Example.py | head -1) = "1970-01-01T00:00:00Z,0,1,2,3"
	scp tmp/python weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/bin/python-$(PYTHONV)-$(OS)
endif
########################################################################################################

python-alpine:
	docker pull six8/pyinstaller-alpine
	docker run --rm \
		-v "${PWD}:/src" \
		six8/pyinstaller-alpine \
		--noconfirm \
		--onefile \
		--log-level DEBUG \
		--clean \
		python/python.py


