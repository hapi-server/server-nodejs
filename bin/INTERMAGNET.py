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
parser.add_argument('--id', default='bou/definitive/minute')
parser.add_argument('--start', default='2017-12-01T00:00:00.000000000Z')
parser.add_argument('--stop', default='2017-12-02T00:00:00.000000000Z')
args = vars(parser.parse_args())

id = args['id']
start = args['start']
stop = args['stop']

def download(url, start, stop):

	start = re.sub(r"T"," ", start[0:18])
	stop = re.sub(r"T"," ", stop[0:18])

	path = os.path.dirname(os.path.realpath(sys.argv[0]))
	#print(path)
	path = os.path.join(path,'..','metadata','INTERMAGNET','tmp','intermagnet')
	path = os.path.realpath(path)
	if not os.path.exists(path):
		os.makedirs(path)

	found = False
	filename = os.path.join(path, url.split("/")[-1])
	if os.path.exists(filename):
		#print("Found " + filename)
		found = True
	else:
		#print("Downloading " + url)
		try:
			urllib.request.urlretrieve(url, filename)
			found = True
		except Exception as e:
			with open('bin/INTERMAGNET-error.log','at') as f:
				f.write(e + ": " + url + "\n")
	if not found:
		# Try again with ".gz" removed.
		url = url[0:-3]
		filename = os.path.join(path, url.split("/")[-1])
		if os.path.exists(filename):
			#print("Found " + filename)
			found = True
		else:
			#print("Downloading " + url)
			try:
				urllib.request.urlretrieve(url, filename)
				found = True
			except Exception as e:
				with open('bin/INTERMAGNET-error.log','at') as f:
					f.write(e + ": " + url + "\n")

	if not found:
		return

	#print("Reading " + filename)		
	try:
		if re.search(r'\.gz$', filename):
			#with gzip.open(filename, 'rt', errors='replace') as f: lines = f.readlines()
			with gzip.open(filename, 'rb') as f: lines = f.readlines()
		else:
			#with open(filename, 'rt', errors='replace') as f: lines = f.readlines()
			with open(filename, 'r') as f: lines = f.readlines()
	except Exception as e:
		#print("Problem reading " + filename)
		with open('bin/INTERMAGNET-error.log','at') as f:
			f.write(e + ": " + filename + "\n")
			f.close()
		return



	for line in lines:
		line = line.decode()
		if re.match(r"[0-9]{4}",line):
			if line[0:18] >= start and line[0:18] < stop:
				# Make comma separated
				line = re.sub(r"\s+", ",", line.strip()) 
				# Replace space in 'YYYY-MM-DD HH:MM:SS.FFF' with T
				line = line[0:10] + "T" + line[11:23] + "Z" + line[23:]
				print(line)

if False:
	# Read list of available files. File is large so this slows down process.
	# Instead, create filenames and if file does not exist, return. This will be slow
	# if there are large time gaps.
	path = os.path.dirname(os.path.realpath(sys.argv[0]))
	fnamepkl = os.path.join(path,'..','metadata','INTERMAGNET','INTERMAGNET-manifest.pkl')
	fnamepkl = os.path.realpath(fnamepkl)
	f = open(fnamepkl, 'rb')
	S = pickle.load(f)
	f.close()

id_l = id.split("/")
ext = id_l[1][0] + id_l[2][0:3] + "." + id_l[2][0:3] + ".gz"

startdt = datetime.datetime.strptime(start[0:10], '%Y-%m-%d')
stopdt = datetime.datetime.strptime(stop[0:10], '%Y-%m-%d')
stepdt = datetime.timedelta(days=1)
# If last date is midnight, last date to look for file is before this
# (stop date is exlusive)
if stop[10:] == "T00:00:00.000000000Z":
	stopdt = stopdt - stepdt

while startdt <= stopdt:
	date = startdt.strftime('%Y%m%d')

	# Slow method
	if False and date in S[id]['dates']:
		download(server + S[id]['dates'][date], start, stop)

	url = server + "/intermagnet/" + id_l[2] + "/" + id_l[1]  \
			+ "/IAGA2002/" + date[0:4] + "/" + date[4:6] + "/" \
			+ id_l[0] + date + ext
	download(url, start, stop)
	startdt += stepdt
