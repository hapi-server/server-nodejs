# Dependencies:
#   Python 3.6+
#   pip install ftputil joblib
#
# Usage:
#   python3 INTERMAGNET2HAPI.py
#   python3 INTERMAGNET2HAPI.py TMPDIR
#
# Walks the directory tree of ftp.seismo.nrcan.gc.ca/intermagnet to generate a
# list of files and then writes INTERMAGNET-manifest.{txt,pkl} and then 
# INTERMAGNET-catalog.json, which is HAPI metadata.

# When True, uses 4 parallel FTP connections when updating manifest
parallelize = True

# Update INTERMAGNET-manifest.txt file containing recursive directory
# listing. Takes ~30 minutes when parallelize=True. Set to False if
# only making corrections to HAPI JSON and not updating list
# of available files.
update_manifest = True

# Create a dictionary of the information in INTERMAGNET-manifest.txt
# Takes ~10 seconds.
update_pkl = True

# Write a HAPI JSON file using information in INTERMAGNET-manifest.pkl
# and information in first and last file for each magnetometer.
# Takes ~3.5 hours (1 minute if first and last files found in TMPDIR).
update_json = True 
<<<<<<< HEAD
test_N = 2 # Run test on only first test_N datasets. If test_N = None, process all datasets.
=======
test_N = None # Run test on only first test_N datasets. If test_N = None, process all datasets.
>>>>>>> origin/master

# Regenerate index.htm
update_table = True 

server = 'ftp.seismo.nrcan.gc.ca'

import os
import re
import sys
import gzip
import json
import shutil
import pickle
import tempfile
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

    cadences = ["minute", "second"]

    def cadence_loop(quality):
        fname_out = fnametxt + '.' + quality
        fh_out = open(fname_out, 'w')
        host = ftputil.FTPHost(server, "anonymous", "anonymous")
        for cadence in cadences:
            path = "/" + cadence + "/" + quality + "/" + "IAGA2002"
            print("Finding files under " + "/intermagnet" + path)
            for (dirname, subdirs, files) in host.walk("/intermagnet" + path):
                print('%d files found under %s' % (len(files), dirname))
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


def header(url, tmpdir, id):
    """Extract parts of header from IAGA 2002 file at a URL"""

    path = url.split("/")
    path = tmpdir + "/" + "/".join(path[2:-1])

    if not os.path.exists(path):
        os.makedirs(path)

    filename = url.split("/")[-1][0:3]
    filename = os.path.join(path, url.split("/")[-1])
    if not os.path.exists(filename):
        # Download file if not found in TMPDIR/intermagnet
        print("Downloading " + url)
        print(" to")
        print(path)
        try:
            urllib.request.urlretrieve(url, filename)
        except:
            meta['error'] = "Could not download " + url

    print("Reading " + filename)
    try:
        if re.search(r'\.gz$', filename):
            with gzip.open(filename, 'rt', errors='replace') as f:
                lines = f.readlines()
        else:
            with open(filename, 'rt', errors='replace') as f:
                lines = f.readlines()
    except:
        meta['error'] = filename + " and " + filename + ".gz not found"

    meta = {}
    comment = ''
    N = 1
    for line in lines:
        if line[1] == '#':
            comment = comment + line.rstrip() + '\n'
        elif not re.match(r'DATE', line):
            name = line[0:23]
            value = line[24:-2]
            if name.strip() == 'IAGA CODE': # Common error in metadata
                name = 'IAGA Code'
            meta[name.strip()] = value.strip()
        else:
            meta['comment'] = comment
            meta['parameters'] = re.sub(r"\s+", ",", line[0:-2].rstrip()).split(",")
            break
        N = N + 1

    meta['header_N'] = N

    if False:
        for key in meta:
            print('%s: %s' % (key,meta[key]))

    if not 'parameters' in meta:
        meta['error'] = "No parameters in " + filename

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


def createjson(fnamepkl, fnamejson, fnametableinfo, tmpdir):

    def datainfo(s, id, meta):

        info = {}
        if re.search(r"minute", id):
            info["cadence"] = "PT1M"
        if re.search(r"second", id):
            info["cadence"] = "PT1S"

        p = id.split("/")
        purl = "ftp://ftp.seismo.nrcan.gc.ca/intermagnet/" + p[2] + "/" + p[1] + "/IAGA2002/"
        info["resourceURL"] = "http://intermagnet.org/"
        info["description"] = "" \
            + "This is a pass-through HAPI server of data from " + purl + "." \
            + "This server responds to requests by fetching the required files and concatenating or " \
            + "subsetting them (as needed). The numbers in a response will exactly match the numbers in the contributing " \
            + "files. The metadata for the files used to for the response can be found by either (1) making a request for metadata " \
            + "using http://hapi-server.org/INTERMAGNET/hapi/info?id=" + id + "/metadata&time.min=START&time.max=STOP, "\
            + "where START/STOP are the start/stop dates of interest or (2) reading the headers in the files " \
            + "associated with the requested timerange at " + purl + "."

        info["x_terms_of_use"] = "See https://intermagnet.github.io/data_conditions.html (Creative Commons Attribution-NonCommercial 4.0 International License)"
        info["x_acknowledgement"] = "See https://intermagnet.org/data-donnee/data-eng.php#conditions"

        start = s[id]['first'].split("/")[-1][3:11]
        stop = s[id]['last'].split("/")[-1][3:11]
        info["startDate"] = start[0:4] + "-" + start[4:6] + "-" + start[6:8] + "Z"
        info["stopDate"] = stop[0:4] + "-" + stop[4:6] + "-" + stop[6:8] + "Z"

        info["parameters"] = [{ 
                                "name": "Time", 
                                "type": "isotime", 
                                "units": "UTC",
                                "fill": None,
                                "length": 24
                            }]

        info["parameters"].append({
                                    "name": "DOY",
                                    "type": "integer", 
                                    "units": None, 
                                    "fill": None
                                })

        for i in range(2,6):
            info["parameters"] \
                    .append(
                        {
                            "name": "Component " + str(i-1),
                            "type": "double",
                            "units": None,
                            "fill": "99999.00",
                            "description": "" \
                                + "Data column #" + str(i-1) + " in the data file " \
                                + "(4th column in the data file. "\
                                + "See http://hapi-server.org/INTERMAGNET/hapi/info?id=" \
                                + id + "/metadata&parameters=Components,units&time.min=START&time.max=STOP, " \
                                + "where START/STOP are the start/stop dates of interest for the " \
                                + "component name (e.g., D, I, F, H, X, Y, Z, E, G, or V). " \
                                + "The component name may not be constant over the duration of available data."
                            }) 
        return info


    def metainfo(s, id, meta):

        info = {}
        info["cadence"] = "PT1D"

        info["resourceURL"] = "http://intermagnet.org/"
        info["description"] = "This is metadata extracted from the header of the IAGA 2002 " \
                            + "formatted data file associated with the dataset with id = " \
                            + id + " (the metadata for some data parameters changes with time). " \
                            + "The definitions of the parameters are given at " \
                            + "https://www.ngdc.noaa.gov/IAGA/vdat/IAGA2002/iaga2002format.html"

        info["x_terms_of_use"] = "See https://intermagnet.github.io/data_conditions.html (Creative Commons Attribution-NonCommercial 4.0 International License)"
        info["x_acknowledgement"] = "See https://intermagnet.org/data-donnee/data-eng.php#conditions"

        start = s[id]['first'].split("/")[-1][3:11]
        stop = s[id]['last'].split("/")[-1][3:11]
        info["startDate"] = start[0:4] + "-" + start[4:6] + "-" + start[6:8] + "Z"
        info["stopDate"] = stop[0:4] + "-" + stop[4:6] + "-" + stop[6:8] + "Z"

        tmp = datetime.datetime.strptime(stop[0:8],"%Y%m%d") - datetime.timedelta(days=3)
        info["sampleStartDate"] = datetime.datetime.strftime(tmp, '%Y-%m-%dZ')
        info["sampleStopDate"] = info["stopDate"]

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

        # 70*40 for header length corresponds to a guess of 40 as
        # the maximum number of header lines. Max encountered is 33.

        info["parameters"] = [{ 
                                "name": "Time", 
                                "type": "isotime", 
                                "units": "UTC",
                                "fill": None,
                                "length": 10
                            }]

        info["parameters"].append({
                                    "name": "Components",
                                    "type": "string", 
                                    "units": None, 
                                    "fill": None,
                                    "size": [4],
                                    "length": 1
                                })

        for i in range(len(keys)):
            info["parameters"] \
                    .append(
                        {
                            "name": keys[i][0],
                            "type": keys[i][1],
                            "units": keys[i][2],
                            "fill": keys[i][3]
                        })

            if keys[i][4] != None:
                info["parameters"][-1]['length'] = keys[i][4]

        return info


    print('Reading ' + fnamepkl)
    with open(fnamepkl, 'rb') as f:
        s = pickle.load(f)

    catalog = []
    meta_problems = {}
    meta_errors = {}
    meta_first = {}
    meta_last = {}
    k = 0
    for id in s:

        if test_N:
            k = k + 1
            if k == test_N: break

        dates = list(s[id]['dates'].keys())
        
        # Get header info for first file
        url = "ftp://" + server + s[id]['dates'][dates[0]]
        meta_first[id] = header(url, tmpdir, id)
        meta_first[id]['URL'] = url
        meta_first[id]['Date'] = s[id]['first'].split("/")[-1][3:11]

        # Get header info for last file
        url = "ftp://" + server + s[id]['dates'][dates[-1]]
        meta_last[id] = header(url, tmpdir, id) 
        meta_last[id]['URL'] = url
        meta_last[id]['Date'] = s[id]['last'].split("/")[-1][3:11]
        
        if 'error' in meta_first[id] and 'error' in meta_last[id]:
            meta_errors[id] = {
                "meta_first": meta_first[id],
                "meta_last": meta_last[id],
                "what": [meta_first[id]['error'], meta_last[id]['error']]
            }
            continue

        what = []
        if meta_first[id].keys() != meta_last[id].keys():
            what.append('keys')

        meta_common_keys = list(set(meta_first[id].keys()).intersection(meta_last[id].keys()))
        for key in meta_common_keys:
            if meta_first[id][key] != meta_last[id][key]:
                what.append(key)

        if len(what) > 0:
            meta_problems[id] = {
                "meta_first": meta_first[id],
                "meta_last": meta_last[id],
                "what": what
            }

        if not 'error' in meta_last[id]:
            meta = meta_last[id]
        else:
            meta = meta_first[id]

        # Regular data dataset
        catalog.append({})
        catalog[-1]["id"] =  id
        if 'Station Name' in meta:
            catalog[-1]["title"] = meta['Station Name']
        elif 'Name' in meta:
            catalog[-1]["title"] = meta['Name']
        else:
            catalog[-1]["title"] = ''

        catalog[-1]["title"] = catalog[-1]["id"] + " @ " + catalog[-1]["title"]
        
        catalog[-1]["info"] = datainfo(s, id, meta)

        # Metadata dataset
        catalog.append({})
        catalog[-1]["id"] =  id + "/metadata"
        if 'Station Name' in meta:
            catalog[-1]["title"] = meta['Station Name']
        elif 'Name' in meta:
            catalog[-1]["title"] = meta['Name']
        else:
            catalog[-1]["title"] = ''

        catalog[-1]["title"] = catalog[-1]["id"] + " @ " + catalog[-1]["title"]
        
        catalog[-1]["info"] = metainfo(s, id, meta)


    print("Writing " + fnamejson)
    with open(fnamejson, 'w') as f:
        json.dump(catalog, f, indent=4)

    print("Writing " + fnametableinfo)
    meta_all = {
                    "first": meta_first,
                    "last": meta_last,
                    "errors": meta_errors
                }
    with open(fnametableinfo, 'wb') as f:
        pickle.dump(meta_all, f, protocol=2)

    if len(meta_problems.keys()) > 0:
        print("%s/%s files with metadata problems:" \
                % (len(meta_problems.keys()), len(s.keys())))
        for id in meta_problems.keys():
            print('%s: %s' % (id, ",".join(meta_problems[id]['what'])))
    else:
        print("No files with metadata differences.")

    if len(meta_errors.keys()) > 0:
        print("%s/%s files with metadata errors:" \
                % (len(meta_errors.keys()), len(s.keys())))
        for id in meta_errors.keys():
            print('%s: %s' % (id, ",".join(meta_errors[id]['what'])))
    else:
        print("No files with metadata differences.")


def archive(fname):
    ds = datetime.datetime.now().strftime('%Y-%m-%d')
    if os.path.exists(fname):
        fname_old = 'old/%s-%s.txt' % (fname[0:-5], ds)
        print('Moving ./' + fname + ' to ' + fname_old)
        os.makedirs('old', exist_ok=True)
        shutil.move(fname, fname_old)


def createtable():

    with open(fnametableinfo, 'rb') as f:
        meta_all = pickle.load(f)

    keys = [
            "Last File",
            "IAGA Code",
            "Data Type",
            "Start",
            "Stop",
            "Station Name",
            "Geodetic Latitude",
            "Geodetic Longitude",
            "Reported",
            "Sensor Orientation",
            "Digital Sampling"
            ]

    max_header_N = 0
    datasets = list(meta_all['first'].keys())
    for ds in datasets:
        header_N = meta_all['first'][ds]['header_N']
        if header_N > max_header_N:
            max_header_N = header_N

    datasets = list(meta_all['last'].keys())
    for ds in datasets:
        header_N = meta_all['first'][ds]['header_N']
        if header_N > max_header_N:
            max_header_N = header_N
    print('Max # of header lines = ' + str(max_header_N))

    l  = ""
    l  = "<p>Last updated: " + datetime.datetime.now().isoformat() + "</p>" 
    l += "<table id='example' class='display dataTable' role='grid'>\n"
    l += "    <tfoot>\n"
    l += "        <tr>\n"
    for column in keys:
        if column != 'parameters' and column != 'Format':
            l += "            <th>" + column + "</th>\n" 
    l += "        </tr>\n"
    l += "    </tfoot>\n"
    l += "    <thead>\n"
    l += "        <tr>\n"
    for column in keys:
        if column != 'parameters' and column != 'Format':
            l += "            <th>" + column + "</th>\n" 
    l += "        </tr>\n"
    l += "    </thead>\n"
    l += "    <tbody>\n"
    for dataset in datasets:
        l += "        <tr>\n"
        url = meta_all['last'][dataset]["URL"]
        url = "<a href='" + url + "'>" + url.split("/")[-1] + "</a>"
        meta_all['last'][dataset]["Last File"] = url
        meta_all['last'][dataset]["Start"] = meta_all['first'][dataset]["Date"]
        meta_all['last'][dataset]["Stop"] = meta_all['last'][dataset]["Date"]
        for column in keys:
            s = ""
            if column in meta_all['last'][dataset]:
                s = meta_all['last'][dataset][column]
            l += "            <td>" + str(s) + "</td>\n" 

        l += "        </tr>\n"
    l += "    </tbody>\n"
    l += "</table>\n"
    l += "</body>\n</html>\n"

    print("Writing " + "html/index.htm")
    with open('html/index.htm','w') as f:
        with open('html/index-head.htm','r') as fh:
            l = "".join(fh.readlines()) + l
        with open('html/index-tail.htm','r') as ft:
            l = l + "".join(ft.readlines())
        f.writelines(l)


if len(sys.argv) == 2:
    tmpdir = sys.argv[1]
else:
    tmpdir = os.path.dirname(os.path.abspath(__file__))


if not os.path.exists('meta'):
    os.makedirs('meta')
    
fnametxt = 'meta/INTERMAGNET-manifest.txt'
fnamepkl = 'meta/INTERMAGNET-manifest.pkl'
fnamejson = 'meta/INTERMAGNET-catalog.json'
fnametableinfo = 'meta/INTERMAGNET-tableinfo.pkl'
fnametable = 'meta/INTERMAGNET-tableinfo.html'

if update_manifest:
    archive(fnametxt)
    createmanifest(server, fnametxt)

if update_pkl:
    archive(fnamepkl)
    parsemanifest(fnametxt, fnamepkl)

if update_json:
    archive(fnamejson)
    createjson(fnamepkl, fnamejson, fnametableinfo, tmpdir)

if update_table:
    createtable()
