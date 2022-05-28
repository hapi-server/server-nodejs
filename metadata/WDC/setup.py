import subprocess

def install(name):
    subprocess.call(['pip', 'install', name])

install('geomagpy')
install('ftputil')
