# Push
rsync -avz meta mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/INTERMAGNET
rsync -avz ftp.seismo.nrcan.gc.ca weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/INTERMAGNET

# Pull 
#rsync -avz mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/INTERMAGNET/meta .
#rsync -avz weigel@mag.gmu.edu:/var/www/git-data/server-nodejs/metadata/INTERMAGNET/ftp.seismo.nrcan.gc.ca 
