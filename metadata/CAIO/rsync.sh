# Push
rsync -avz meta mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/CAIO
rsync -avz tmp weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/CAIO
rsync -avz *.json weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/CAIO

# Pull 
#rsync -avz mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/INTERMAGNET/meta .
#rsync -avz weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/INTERMAGNET/ftp.seismo.nrcan.gc.ca 
