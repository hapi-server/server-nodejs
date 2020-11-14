# This tests that metadata in old format works with code that implements
# the new format with backwards compatability. The old format was to
# allow "catalog" to be a json array, file, url, or file and the code determied
# what it was. In the new format, there is catalog_inline, catalog_file,
# catalog_url, and catalog_command.

cd ..
mv metadata metadata-current
mkdir tmp
cd tmp
git clone https://github.com/hapi-server/server-nodejs.git
cd server-nodejs
git reset --hard f68fba11b29a97d9e52a9c178b1b299a32835dfb
cd ..
mv server-nodejs/metadata ..
cd ..
npm test
rm -rf tmp && rm -rf metadata && mv metadata-current metadata
