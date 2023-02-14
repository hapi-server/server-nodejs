all: node_modules
	make cdas
	make hapi

cdas:
	node CDAS2HAPI.js

hapi:
	node HAPI.js

# Install nodejs dependencies
node_modules:
	npm install

clean:
	@rm -f *.json
	@rm -rf hapi/
	@rm -rf cdas/