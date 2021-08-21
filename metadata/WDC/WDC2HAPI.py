# Dependencies:
#   Python 3.6+
#   pip install ftputil joblib
#   sudo pip3 install geomagpy
#
# Usage:
#   python3 WDC2HAPI.py
#
# Walks the directory tree of ftp.nmh.ac.uk/wdc to generate a
# list of files and then writes WDC-manifest.{txt,pkl} and then
# WDC-catalog.json, which is HAPI metadata.

# Update WDC-manifest.txt file containing recursive directory
# listing.
import glob
from ftplib import FTP
update_manifest = True
import shutil, zipfile
from magpy.stream import *

# Create a dictionary of the information in WDC-manifest.txt
update_pkl = True

# Write a HAPI JSON file using information in WDC-manifest.pkl
# and information in first and last file for each magnetometer.
update_json = True
N_years = 3

# Regenerate index.htm
update_table = True

server = 'ftp.nmh.ac.uk'
ftp = FTP(server)

import os
import sys
import shutil
import pickle
import urllib.request
import datetime as datetime


list_dict = {}
date_dict = {}


def createmanifest(server, fnametxt):
    print("In createmanifest : " + server)
    import ftputil
    path = "/" + "wdc" + "/" + "obsdata"
    allFiles = {}
    def cadence_loop():
        count = 0
        fname_out = fnametxt
        fh_out = open(fname_out, 'w')
        host = ftputil.FTPHost(server, "anonymous", "anonymous")
        names = host.listdir(host.curdir)
        for (dirname, subdir, files) in host.walk(path + "/" + "1minval"):
            if count < N_years:
                print('%d files found under %s' % (len(files), dirname))
                count = count + 1
                for f in files:
                    if f.endswith('.zip'):
                        if f[0:3] in allFiles:
                            allFiles[f[0:3]].append(dirname + '/' + f)
                        else:
                            allFiles[f[0:3]] = [dirname + '/' + f]
                        fh_out.write(dirname + '/' + f + "\n")
                        url = server + dirname + '/' + f
                        path1 = url.split("/")
                        path1 = tmpdir + "/" + "/".join(path1[2:-1])
                        if not os.path.exists(path1):
                            os.makedirs(path1)
                        filename = url.split("/")[-1][0:3]
                        filename = os.path.join(path1, url.split("/")[-1])
                        if not os.path.exists(filename):
                            try:
                                urllib.request.urlretrieve("ftp://" + url, filename)
                                files = os.listdir(path1)
                                for f in files:
                                    if f[0:3] in list_dict.keys():
                                        list_dict[f[0:3]].append(path1 + "/"+f)
                                    else:
                                        list_dict[f[0:3]] = [path1 + "/"+f]
                            except:
                                error = "Could not download " + url
                                print(error)
            else:
                break
        host.close()
        fh_out.close()
        print("Wrote " + fname_out)
        return fname_out
    files = []
    files.append(cadence_loop())


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
            cadence = ls[3]
            tlc = file[0:3]
            date = file[3:7]
            id = tlc + "/" + date
            if not id in s:
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


def createDateDict():

    path = os.getcwd() + "/obsdata"
    for (dirname, subdir, files) in os.walk(path + "/" + "1minval"):
        for f in files:
            if not f.startswith('.') and f.endswith('.zip'):
                zip_ref = zipfile.ZipFile(dirname + "/" + f)
                zip_ref.extractall(dirname)
                zip_ref.close()
                os.remove(dirname + "/" + f)
    for key in list_dict:
        path1 = os.getcwd() + "/obsdata/1minval/"+list_dict[key][0][-9:-5]
        glob_list = glob(path1 + "/"+key + '*.wdc')
        glob_list = sorted(glob_list)
        date_dict[key] = {'startDate': list_dict[key][0][-9:-5] + '-' + glob_list[0][-7:-5] +
                          '-01', 'endDate': list_dict[key][-1][-9:-5] + '-' + glob_list[-1][-7:-5] + '-01'}

def archive(fname):
    ds = datetime.datetime.now().strftime('%Y-%m-%d')
    if os.path.exists(fname):
        fname_old = 'old/%s-%s.txt' % (fname[0:-4   ], ds)
        print('Moving ./' + fname + ' to ' + fname_old)
        os.makedirs('old/meta', exist_ok=True)
        shutil.move(fname, fname_old)


if len(sys.argv) == 2:
    tmpdir = sys.argv[1]
else:
    tmpdir = os.path.dirname(os.path.abspath(__file__))


if not os.path.exists('meta'):
    os.makedirs('meta')

fnametxt = 'meta/WDC-manifest.txt'
fnamepkl = 'meta/WDC-manifest.pkl'
fnamejson = 'WDC-catalog.json'
fnametableinfo = 'meta/WDC-tableinfo.pkl'
fnametable = 'meta/WDC-tableinfo.html'

if update_manifest:
    archive(fnametxt)
    path1 = os.getcwd() + "/obsdata/1minval/"
    try:
        shutil.rmtree(path1)
    except OSError as e:
        print("Error!")
    createmanifest(server, fnametxt)
    createDateDict()
    print("List DICT : ")
    print(list_dict) #Dictionary1
    print("DATE_DICT : ")
    print(date_dict)  #Dictionary2


if update_pkl:
    archive(fnamepkl)
    parsemanifest(fnametxt, fnamepkl)



# if update_json:
#     archive(fnamejson)
#     createjson(fnamepkl, fnamejson, fnametableinfo, tmpdir)

# if update_table:
#     createtable()
