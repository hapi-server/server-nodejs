import os
import re
import sys
import gzip
import pickle
import ftputil
import argparse
import datetime
import tempfile
import urllib.request

server = 'ftp.seismo.nrcan.gc.ca'

tmpdir = os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','metadata','INTERMAGNET')

parser = argparse.ArgumentParser()
parser.add_argument('--id', default='ams/definitive/minute')
parser.add_argument('--start', default='2013-12-01T00:00:00.000000000Z')
parser.add_argument('--stop', default='2013-12-02T00:00:00.000000000Z')
#parser.add_argument('--id', default='bou/definitive/minute')
#parser.add_argument('--start', default='2017-12-01T00:00:00.000000000Z')
#parser.add_argument('--stop', default='2017-12-02T00:00:00.000000000Z')
parser.add_argument('--tmpdir', default=tmpdir)
parser.add_argument('--refresh', default=False)
args = vars(parser.parse_args())

id = args['id']
start = args['start']
stop = args['stop']


def download(url, start, stop):

	start = re.sub(r"T"," ", start[0:19])
	stop = re.sub(r"T"," ", stop[0:19])

	p = id.split("/")
	path = os.path.join(args['tmpdir'], server,
				'intermagnet', p[2], p[1],
				'IAGA2002', start[0:4], start[5:7])

	if not os.path.exists(path):
		os.makedirs(path)

	found = False
	filename = os.path.join(path + "/" + url.split("/")[-1])
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

	if args['refresh'] and found:
		# Very slow.
		host = ftputil.FTPHost(server, "anonymous", "anonymous")		
		host.download_if_newer(url.split(server)[-1], filename)

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

	# TODO: Similar array appears in INTERMAGNET2HAPI.py
	keys = [
			['Source_of_Data', "string", None, None, 70],
			['Station_Name', "string", None, None, 70],
			['Geodetic_Latitude', "double", "degrees", None, None],
			['Geodetic_Longitude', "double", "degrees", None, None],
			['Elevation', "string", "double", "meters", None],
			['Reported', "string", None, None, 70],
			['Sensor_Orientation', "string", None, None, 70],
			['Digital_Sampling', "string", None, None, 70],
			['Data_Interval_Type', "string", None, None, 70],
			['Publication_Date', "string", None, None, 70],
			['Header', "string", None, None, 70*40],
	]

	# TODO: Similar code appears in INTERMAGNET2HAPI.py
	if '/metadata' in id:
		meta = {}
		comment = '\n'
		for line in lines:
			line = line.decode()
			if line[1] == '#':
				comment = comment + line.rstrip() + "\n"
			elif not re.match(r'DATE', line):
				comment = comment + line.rstrip() + "\n"
				name = line[0:23]
				value = line[24:-2]
				meta[name.strip()] = value.strip()
			else:
				meta['comment'] = comment
				meta['parameters'] = re.sub(r"\s+", ",", line[0:-2].rstrip()).split(",")
				break
				k = k + 1

		date = url.split("/")[-1][3:11]
		linel = line.split(" ")	
		outline = date[0:4] + "-" + date[4:6] + "-" + date[6:8] + "Z,"
		#print(",".join(meta['parameters']))
		for i in range(3,len(meta['parameters'])):
			if len(meta['parameters'][i]) != 4:    		
				meta['parameters'][i] = "?"
			else:
				meta['parameters'][i] = meta['parameters'][i][-1]

		outline = outline + ','.join(meta['parameters'][3:])
		for i in range(len(keys)):
			key = keys[i][0].replace("_"," ")
			if key in meta:
				if "," in meta[key]:
					outline = outline + ',' + '"' + meta[key] + '"'
				else:
					outline = outline + "," + meta[key]
			else:
					outline = outline + ","
		print(outline + "," + '"' + comment + '"')
	else:
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

	url = "ftp://" + server + "/intermagnet/" + id_l[2] + "/" + id_l[1]  \
			+ "/IAGA2002/" + date[0:4] + "/" + date[4:6] + "/" \
			+ id_l[0] + date + ext
	download(url, start, stop)
	startdt += stepdt
