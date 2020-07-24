import os
import re
import sys
import gzip
import pickle
import argparse
import datetime
import urllib.request

# TODO:
#   * Read INTERMAGNET-info.pkl (Convert INTERMAGNET-info.json
#     to pkl in create_manifest.pkl)

server = 'ftp://ftp.seismo.nrcan.gc.ca'

parser = argparse.ArgumentParser()
parser.add_argument('--id', default='bou/minute/definitive')
parser.add_argument('--start', default='2017-12-01T00:00:00.000000000Z')
parser.add_argument('--stop', default='2017-12-02T00:00:00.000000000Z')
args = vars(parser.parse_args())

id = args['id']
start = args['start']
stop = args['stop']

def download(url, start, stop):
	""""""
	start = re.sub(r"T"," ", start[0:18])
	stop = re.sub(r"T"," ", stop[0:18])

	path = os.path.dirname(os.path.realpath(sys.argv[0]))
	#print(path)
	path = os.path.join(path,'..','metadata','INTERMAGNET','tmp','intermagnet')
	path = os.path.realpath(path)
	if not os.path.exists(path):
		os.makedirs(path)

	filename = os.path.join(path, url.split("/")[-1])
	if not os.path.exists(filename):
		#print("Downloading " + url)
		try:
			urllib.request.urlretrieve(url, filename)
		except Exception as e:
			with open('bin/INTERMAGNET-error.log','at') as f:
				f.write(e + ": " + url + "\n")
				f.close()
			return

	#print("Reading " + filename)		
	try:
		if re.search(r'\.gz$', filename):
			with gzip.open(filename, 'rt', errors='replace') as f: lines = f.readlines()
		else:
			with open(filename, 'rt', errors='replace') as f: lines = f.readlines()
	except Exception as e:
		#print("Problem reading " + filename)
		with open('bin/INTERMAGNET-error.log','at') as f:
			f.write(e + ": " + filename + "\n")
			f.close()
		return

	for line in lines:
		if re.match(r"[0-9]{4}",line):
			if line[0:18] >= start and line[0:18] < stop:
				# Make comma separated
				line = re.sub(r"\s+", ",", line.strip()) 
				# Replace space in 'YYYY-MM-DD HH:MM:SS.FFF' with T
				line = line[0:10] + "T" + line[11:23] + "Z" + line[23:]
				print(line)

path = os.path.dirname(os.path.realpath(sys.argv[0]))
#print(path)
fnamepkl = os.path.join(path,'..','metadata','INTERMAGNET','INTERMAGNET-manifest.pkl')
fnamepkl = os.path.realpath(fnamepkl)
#print(fnamepkl)

f = open(fnamepkl, 'rb')
S = pickle.load(f)
f.close()
#print(S[id])
#print(S[id]['dates'])

startdt = datetime.datetime.strptime(start[0:10], '%Y-%m-%d')
stopdt = datetime.datetime.strptime(stop[0:10], '%Y-%m-%d')
stepdt = datetime.timedelta(days=1)
#print(startdt)
#print(stopdt)
# If last date is midnight, last date to look for file is before this
# (stop date is exlusive)
if stop[10:] == "T00:00:00.000000000Z":
	stopdt = stopdt - stepdt

while startdt <= stopdt:
	date = startdt.strftime('%Y%m%d')
	if date in S[id]['dates']:
		#print("File exists for " + date)
		#print("Downloading " + S[id]['dates'][date])
		download(server + S[id]['dates'][date], start, stop)
	startdt += stepdt
