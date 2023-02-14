IDREGEX=^AC_

all: node_modules
	make cdas
	make hapi

# Install nodejs dependencies
node_modules:
	npm install

cdas:
	node CDAS2HAPI.js --idregex '$(IDREGEX)'

hapi:
	node HAPI.js --idregex '$(IDREGEX)'	

distclean:
	@rm -rf node_modules/

clean-cdas:
	@rm -f all-cdas.json
	@rm -f all-cdas-full.json
	@rm -rf cdas/

clean-hapi:
	@rm -f all-hapi.json
	@rm -rf hapi/

clean:
	make clean-cdas
	make clean-hapi
	@rm -f package-lock.json
