# Dependencies:
#   pip install ftputil joblib
#
# Usage:
#   python3 INTERMAGNET2HAPI.py
#   python3 INTERMAGNET2HAPI.py TMPDIR
#
# Walks the directory tree of ftp.seismo.nrcan.gc.ca/intermagnet to generate a
# list of files and then writes INTERMAGNET-manifest.{txt,pkl} and then 
# INTERMAGNET-catalog.json, which is HAPI metadata.

# Uses 4 parallel FTP connections
parallelize = True

# Update .txt file containing recursive directory listing.
# Takes ~15 minutes when parallelize=True. Set to False if
# only making corrections to HAPI JSON and not updating list
# of available files.
update_manifest = False  

# Create a dictionary of the information in INTERMAGNET-manifest.txt
# Takes ~10 minutes (1 minute if files found in TMPDIR)
update_pkl = True 

# Write a HAPI JSON file using information in INTERMAGNET-manifest.pkl
# Takes ~10 seconds.
update_json = True 

import os
import re
import sys
import gzip
import json
import shutil
import pickle
import urllib.request
import datetime as datetime


def createmanifest(server, fnametxt):
    """Create list of IAGA 2002 files below /intermagnet directory"""

    # Could also create manifest.txt using
    # lftp ftp://ftp.seismo.nrcan.gc.ca/intermagnet/
    # du -a > manifest.txt

    # This code and and lftp take about an hour.
    # paralleize=True reduces the following to 15 minutes.
    import ftputil

    qualities = [
                "definitive",
                "quasi-definitive",
                "provisional",
                "variation"
            ]

    cadences = ["minute","second"]

    def cadence_loop(quality):
        fname_out = tmpdir + '/' + fnametxt + '.' + quality
        return fname_out
        fh_out = open(fname_out, 'w')
        host = ftputil.FTPHost(server, "anonymous", "anonymous")
        for cadence in cadences:
            path = "/" + cadence + "/" + quality + "/" + "IAGA2002"
            print("Finding files under " + "/intermagnet" + path)
            for (dirname, subdirs, files) in host.walk("/intermagnet" + path):
                print('%d files found under %s' % (len(files), "/intermagnet" + path + dirname))
                for f in files:
                    fh_out.write(dirname + '/' + f + '\n')

        host.close()
        fh_out.close()
        print("Wrote " + fname_out)
        return fname_out

    if parallelize and len(qualities) > 1:
        from joblib import Parallel, delayed    
        files = Parallel(n_jobs=4)(delayed(cadence_loop)(quality) for quality in qualities)
    else:
        files = []
        for quality in qualities:
            files.append(cadence_loop(quality))

    # Concatenate files for each quality
    print("Concatenating \n\t" + ",\n\t".join(files))
    print("into " + fnametxt)
    with open(fnametxt, 'w') as outfile:
        for fname in files:
            with open(fname) as infile:
                outfile.write(infile.read())
    print("Wrote " + fnametxt)


def header(url, tmpdir):
    """Extract parts of header from IAGA 2002 file at a URL"""

    tmpdir = os.path.join(tmpdir,'intermagnet')
    if not os.path.exists(tmpdir):
        os.makedirs(tmpdir)

    filename = url.split("/")[-1][0:3]
    filename = os.path.join(tmpdir,url.split("/")[-1])
    if not os.path.exists(filename):
        # Download file if not found in TMPDIR/intermagnet
        print("Downloading " + url)
        try:
            urllib.request.urlretrieve(url, filename)
        except:
            return -1

    print("Reading " + filename)
    try:
        if re.search(r'\.gz$', filename):
            with gzip.open(filename, 'rt', errors='replace') as f:
                lines = f.readlines()
        else:
            with open(filename, 'rt', errors='replace') as f:
                lines = f.readlines()
    except:
            return -2

    meta = {}
    comment = ''
    for line in lines:
        if line[1] == '#':
            comment = comment + line.rstrip() + '\n'
        elif not re.match(r'DATE', line):
            name = line[0:23]
            value = line[24:-2]
            meta[name.strip()] = value.strip()
        else:
            meta['comment'] = comment
            meta['parameters'] = re.sub(r"\s+", ",", line[0:-2].rstrip()).split(",")
            break

    if False:
        for key in meta:
            print('%s: %s' % (key,meta[key]))

    if not 'parameters' in meta:
        return -3

    return meta


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
            #id = cadence + "/" + quality + "/" + tlc
            id = tlc + "/" + quality + "/" + cadence
            if not id in s:
                #print('Found first ' + id + ' file in ' + fnametxt)
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

    print('Reading ' + fnamepkl)
    with open(fnamepkl, 'rb') as f:
        s = pickle.load(f)

    catalog = []
    meta_problems = {}
    k = 0
    for id in s:

        k = k + 1
        #if k == 10: break

        dates = list(s[id]['dates'].keys())
        
        # Get header info for first file
        url = "ftp://" + server + s[id]['dates'][dates[0]]
        meta_first = header(url, tmpdir)

        # Get header info for last file
        url = "ftp://" + server + s[id]['dates'][dates[-1]]
        meta_last = header(url, tmpdir) 
        
        if (type(meta_first) == int) or (type(meta_last) == int):
            meta_problems[id] = {
                "meta_first": meta_first,
                "meta_last": meta_last,
                "what": [str(meta_first), str(meta_last)]
            }
            continue

        what = []
        if meta_first.keys() != meta_last.keys():
            what.append('keys')

        meta_common_keys = list(set(meta_first.keys()).intersection(meta_last.keys()))
        for key in meta_common_keys:
            if meta_first[key] != meta_last[key]:
                what.append(key)

        if len(what) > 0:
            meta_problems[id] = {
                "meta_first": meta_first,
                "meta_last": meta_last,
                "what": what
            }

        meta = meta_last

        catalog.append({})
        catalog[-1]["id"] =  id
        if 'Station Name' in meta:
            catalog[-1]["title"] = meta['Station Name']
        elif 'Name' in meta:
            catalog[-1]["title"] = meta['Name']
        else:
            catalog[-1]["title"] = ''


        catalog[-1]["title"] = id + '; ' + catalog[-1]["title"]

        info = {}
        if re.search(r"minute", id):
            info["cadence"] = "PT1M"
        if re.search(r"second", id):
            info["cadence"] = "PT1S"

        info["resourceURL"] = "http://intermagnet.org/"
        info["description"] = "" \
            + "This is a pass-through HAPI server of data from ftp://ftp.seismo.nrcan.gc.ca/intermagnet. " \
            + "This server responds to requests by fetching the required files and concatenating or " \
            + "subsetting them. The numbers in a response will exactly match the numbers in the contributing " \
            + "files. The metadata for the files used can be found by reading the headers in the appropriate " \
            + "files at ftp://ftp.seismo.nrcan.gc.ca/intermagnet."

        info["_terms_of_use"] = "See https://intermagnet.github.io/data_conditions.html (Creative Commons Attribution-NonCommercial 4.0 International License)"
        info["_acknowledgement"] = "See https://intermagnet.org/data-donnee/data-eng.php#conditions"

        info["_metadata"] = {}
        info["_metadata"]['note'] = "" \
                + "first_metadata/last_metadata is the header extracted from first_file/last_file." \
                + "The keys of any value that differs are reported in 'differences'. If the keys differ, 'keys' is used." \
                + " If there are no differences, 'differences' = []."
        if len(what) == 0:
            info["_metadata"]['differences'] = []
        else:
            info["_warning"] = "" \
                + "Metadata this for dataset varies with time. Column names and units correspond to those in the most recent file. See '_metadata' in the HAPI JSON for this dataset and read the headers for the files " \
                + "associated with the selected time range."
            info["description"] = info["description"] + ' !!! ' + info["_warning"] + ' !!!'
            if 'parameters' in 'differences':
                info["_warning"] += "" \
                    " Parameter names correspond to those in 'last_file' and these parameter names" \
                    " differ from those in the first file."
            info["_metadata"]['differences'] = what
        info["_metadata"]['first_file'] = "ftp://" + server + s[id]['dates'][dates[0]]
        info["_metadata"]['first_metadata'] = meta_first
        info["_metadata"]['last_file'] = "ftp://" + server + s[id]['dates'][dates[-1]]
        info["_metadata"]['last_metadata'] = meta_last
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

        for parameter in meta['parameters'][2:]:
            if parameter == "DOY":
                info["parameters"] \
                    .append(
                        {
                            "name": "DOY",
                            "type": "integer", 
                            "units": None, 
                            "fill": None
                        })
            else:
                if parameter == "D" or parameter == "I":
                    units = "minutes of arc"
                else:
                    units = "nT"

                info["parameters"] \
                        .append(
                            {
                                "name": parameter,
                                "type": "double",
                                "units": units,
                                "fill": "99999.00"
                               })

        catalog[-1]["info"] = info


    print("Writing " + fnamejson)
    with open(fnamejson, 'w') as f:
        json.dump(catalog, f, indent=4)

    if len(meta_problems.keys()) > 0:
        print("%s/%s files with metadata problems:" \
                % (len(meta_problems.keys()), len(s.keys())))
        for id in meta_problems.keys():
            print('%s: %s' % (id, ",".join(meta_problems[id]['what'])))
    else:
        print("No files with metadata differences.")


def archive(fname):
    ds = datetime.datetime.now().strftime('%Y-%m-%d')
    if os.path.exists(fname):
        fname_old = 'old/%s-%s.txt' % (fname[0:-4], ds)
        print('Moving ./' + fname + ' to ' + fname_old)
        os.makedirs('old', exist_ok=True)
        shutil.move(fname, fname_old)


if len(sys.argv) == 2:
    tmpdir = sys.argv[1]
else:
    tmpdir = '/tmp'

server = 'ftp.seismo.nrcan.gc.ca'
fnametxt = 'INTERMAGNET-manifest.txt'
fnamepkl = 'INTERMAGNET-manifest.pkl'
fnamejson = 'INTERMAGNET-catalog.json'

if update_manifest:
    archive(fnametxt)
    createmanifest(server, fnametxt)

if update_pkl:
    archive(fnamepkl)
    parsemanifest(fnametxt, fnamepkl)

if update_json:
    archive(fnamejson)
    writejson(fnamepkl, fnamejson, tmpdir)
