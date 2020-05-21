# Usage:
#   python3 create-metadata.py
#   python3 create-metadata.py TMPDIR

import os
import re
import sys
import gzip
import json
import pickle
import urllib.request
import datetime as datetime

def createmanifest(server, fnametxt):
	"""Create list of IAGA 2002 files below /intermagnet directory"""

	# Could also create manifest.txt using
	# lftp ftp://ftp.seismo.nrcan.gc.ca/intermagnet/
	# du -a > manifest.txt

	# This and the above take about an hour.
	import ftputil

	outfile = open(fnametxt, 'w')

	host = ftputil.FTPHost(server,"anonymous", "anonymous")

	paths1 = ["definitive","quasi-definitive","provisional","variation"]
	paths2 = ["minute","second"]

	#paths1 = ["provisional"]
	#paths2 = ["second"]

	for path2 in paths2:
		for path1 in paths1:
			path = "/" + path2 + "/" + path1 + "/" + "IAGA2002"
			print("Finding files under " + "/intermagnet" + path)
			for (dirname, subdirs, files) in host.walk("/intermagnet" + path):
				for f in files:
					outfile.write(dirname + '/' + f + '\n')
					print(dirname + '/' + f)

	print("Wrote " + fnametxt)
	outfile.close()

def header(url, tmpdir):
	"""Extract parts of header from IAGA 2002 file"""

	tmpdir = os.path.join(tmpdir,'INTERMAGNET')
	if not os.path.exists(tmpdir):
		os.makedirs(tmpdir)

	filename = url.split("/")[-1][0:3]
	filename = os.path.join(tmpdir,url.split("/")[-1])
	if not os.path.exists(filename):
		print("Downloading " + url)
		try:
			urllib.request.urlretrieve(url, filename)
		except:
			return (False,False)

	print("Reading " + filename)
	try:
		if re.search(r'\.gz$', filename):
			with gzip.open(filename, 'rt', errors='replace') as f: lines = f.readlines()
		else:
			with open(filename, 'rt', errors='replace') as f: lines = f.readlines()
	except:
		return (False,False)

	sta = url.split("/")[-1]
	lat = "?"
	lon = "?"		
	title = ""
	vars = []
	for line in lines:
		line = line[0:-2]
		if re.match( r' Station (Name)?', line):
			sta = re.sub(r" Station (Name)?(.*)", r"\2", line).strip()
		if re.match( r' Geodetic Latitude', line):
			lat = re.sub(r" Geodetic Latitude(.*)", r"\1", line).strip()
		if re.match( r' Geodetic Longitude', line):
			lon = re.sub(r" Geodetic Longitude(.*)", r"\1", line).strip()
		if re.match( r'DATE ', line):
			vars = re.sub(r"\s+", ",", line).split(",")
			break

	title = sta + "; Geodetic Lat/Long = " + lat + "/" + lon
	if len(vars) == 0:
		return (title, vars)
	return title, vars[2:-1]

def parsemanifest(fnametxt, fnamepkl):
	"""Extract list of datasets by parsing list of files in fnametxt"""

	print('Reading ' + fnametxt)
	with open(fnametxt) as f:
		lines = f.readlines()

	print('Parsing ' + str(len(lines)) + ' lines in ' + fnametxt)
	s = {}
	for line in lines:
		ls = line.split("/")
		file = ls[-1]
		path = line.strip()
		cadence = ls[2]
		quality = ls[3]
		tlc = file[0:3]
		date = file[3:11]
		id = cadence + "/" + quality + "/" + tlc
		if not id in s:
			print('Found first ' + id + ' file in ' + fnametxt)
			s[id] = {}
			s[id]['dates'] = {}
			s[id]['dates'][date] = path
			s[id]['first'] = path
			s[id]['last'] = path
		else:
			s[id]['dates'][date] = path
			s[id]['last'] = path

	f = open(fnamepkl, 'wb')
	pickle.dump(s, f, protocol=2)
	f.close()

def writejson(fnamepkl, fnamejson, tmpdir):

	f = open(fnamepkl, 'rb')
	s = pickle.load(f)
	f.close()

	catalog = []
	problems = []
	for id in s:
		url = "ftp://" + server + s[id]['last']
		# TODO: Make sure header info is same for first and last file
		(title, vars) = header(url, tmpdir) # Get header info for first file
		if title == False: 
			# Problem w/ first file; get header info for last file
			problems.append(url)
			url = "ftp://" + server + s[id]['first']
			(title, vars) = header(url, tmpdir)
			if title == False:
				problems.append(url)
				continue

		catalog.append({})
		catalog[-1]["id"] =  id
		catalog[-1]["title"] = title

		#catalog["catalog"][-1]["id"] =  id
		#catalog["catalog"][-1]["title"] = title
		
		info = {}
		if re.search(r"minute",id):
			info["cadence"] = "PT1M"
		if re.search(r"second",id):
			info["cadence"] = "PT1S"
		info["resourceURL"] = "http://intermagnet.org/"
		info["description"] = "Component names based on components reported in " + url + ". ** Coordinate system of data may not be the same for full time range of available data. In some cases, files initially report HDZ and later XYZ. Check header for files in range of request to determine if coordinate system is correct."

		start = s[id]['first'].split("/")[-1][3:12]
		stop = s[id]['last'].split("/")[-1][3:12]
		info["startDate"] = start[0:4] + "-" + start[4:6] + "-" + start[6:-1] + "Z"
		info["stopDate"] = stop[0:4] + "-" + stop[4:6] + "-" + stop[6:-1] + "Z"

		info["parameters"] = [{ 
				"name": "Time", 
				"type": "isotime", 
				"units": "UTC",
				"fill": "99999.00", 
				"length": 24
			}]

		print(title, start, stop, vars)

		for v in vars:
			if len(v) != 4:
				vn = v # gdh19910101dmin.min has GDHH, GDHD, GDHZ, GDH
			else:
				vn = v[3]
			if v == "DOY":
				info["parameters"] \
					.append(
							{
								"name": "DOY",
								"type": "integer", 
								"units": None, 
								"fill": None
							})
			else:
				if vn == "D" or vn == "I":
					units = "minutes of arc"
				else:
					units = "nT"
				info["parameters"] \
					.append({
								"name": vn,
								"type": "double",
								"units": units,
								"fill": "99999.00"
							})

		catalog[-1]["info"] = info

	print("Wrote " + fnamejson)
	f = open(fnamejson, 'w')
	json.dump(catalog, f, indent=4)
	f.close()
	print("Problem files")
	print(problems)

if len(sys.argv) == 2:
	tmpdir = sys.argv[1]
else:
	tmpdir = '/tmp'

server = 'ftp.seismo.nrcan.gc.ca'
fnametxt = 'INTERMAGNET-manifest.txt'
fnamepkl = 'INTERMAGNET-manifest.pkl'
fnamejson = 'INTERMAGNET-catalog.json'

#createmanifest(server, fnametxt)
parsemanifest(fnametxt, fnamepkl)
writejson(fnamepkl, fnamejson, tmpdir)

ds = datetime.datetime.now().strftime('%Y-%m-%d')

if False:
	import shutil
	print('Copying files to ./out/')
	shutil.copyfile(fnamepkl, 'out/%s-%s.txt' % (fnamepkl[0:-4], ds))
	shutil.copyfile(fnametxt, 'out/%s-%s.txt' % (fnametxt[0:-4], ds))
	shutil.copyfile(fnamejson, 'out/%s-%s.json' % (fnamejson[0:-5], ds))


