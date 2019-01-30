NODEV=v6.16.0
NODED=https://nodejs.org/dist/latest-v6.x
VERSION=v0.9.4
OS=darwin-x64 # Did this on High Sierra
#OS=linux-x64 # Did this on Alpine 3.8
#OS=linux-armv7l # Did this on Pi 3+
#OS=win-x64

# To set OS name in OS-X with router, change name of mac to MACBOOK001
# sudo scutil --set HostName MACBOOK001
# (also rebooted; not sure if needed)
# For Linux,
# /etc/init.d/hostname restart
# For both, modify /etc/hostname and /etc/hosts
ifeq ($(OS),linux-x64)
	SERVER=alpine3o
endif
ifeq ($(OS),linux-armv7l)
	SERVER=pi3
endif
ifeq ($(OS),darwin-x64)
	SERVER=osx-el-capitan
endif

docker:
	- docker stop hapi-server
	- docker rm hapi-server
	docker build --file Dockerfile -t rweigel/hapi-server:$(VERSION) ../
	docker run -dit --name hapi-server-$(VERSION) --expose 8999 -p 8999:8999 rweigel/hapi-server:$(VERSION)

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

release:
	cd ..; rm -rf node_modules; npm install --production;
	make update VERSION=$(VERSION);
	cd .. && source pkg/GITHUB_TOKEN && release-it $(VERSION) --preRelease=beta --no-git.requireCleanWorkingDir --no-npm.publish

# When NodeJS and Python binaries do not need to be updated.
update:
	sed -i '' 's/hapi-server-v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}/hapi-server-$(VERSION)/g' tmp.md	
	sed -i '' 's/\/v[0-9]{1,}\.[0-9]{1,}\.[0-9]{1,}\//\/$(VERSION)\//g' tmp.md	
	make package VERSION=$(VERSION) OS=darwin-x64
	make package VERSION=$(VERSION) OS=linux-x64
	make package VERSION=$(VERSION) OS=linux-armv7l
	rm -rf dist/hapi-server-$(VERSION)/

test-packages:
	make package-test VERSION=$(VERSION) OS=darwin-x64
	make package-test VERSION=$(VERSION) OS=linux-x64
	make package-test VERSION=$(VERSION) OS=linux-armv7l

package-test:
	scp dist/hapi-server-$(VERSION)-$(OS).tgz weigel@$(SERVER):
	ssh weigel@$(SERVER) 'tar zxf hapi-server-$(VERSION)-$(OS).tgz; cd hapi-server-$(VERSION); ./hapi-server test'

package:
	make files
	cp bin/node-$(NODEV)-$(OS) dist/hapi-server-$(VERSION)/bin/node
ifeq ($(OS),win-x64)
	make zip OS=$(OS)
else
	make targz OS=$(OS)
endif

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
python: python.py
	cp python.py python/
	cd python/; pyinstaller python.py --onefile
	#cp python/dist/python bin/python-$(OS)

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

clean:
	rm -rf dist/
