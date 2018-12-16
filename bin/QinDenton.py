import re
import os
import sys
import argparse
from datetime import datetime

parser = argparse.ArgumentParser()
parser.add_argument('--start',default='1964-01-01T00:00:00.000Z')
parser.add_argument('--stop',default='1964-01-02T00:00:00.000Z')
args = vars(parser.parse_args())

start, stop = args['start'], args['stop']

def convert(timestr):
    timestr = re.sub(r'(.*) 00([0-9])',r"\1   \2", timestr)
    timestr = re.sub(r'(.*) 0([0-9]{2})',r"\1  \2", timestr)
    timestr = re.sub(r'(.*) 0([0-9])',r"\1  \2", timestr)
    return timestr

# Convert from input ISO 8601 time to format used in file
startp = datetime.strptime(start,"%Y-%m-%dT%H:%M:%S.%fZ").strftime(" %Y %j %H")
stopp = datetime.strptime(stop,"%Y-%m-%dT%H:%M:%S.%fZ").strftime(" %Y %j %H")

# Strip out leading zeros as in file
startp = convert(startp)
stopp = convert(stopp)

# Save file locally if not found
filename = './public/data/QinDenton/WGhour.d'
if not os.path.exists('./public/data/QinDenton/WGhour.d'):
    import urllib.request
    os.makedirs('./public/data/QinDenton/')
    url = 'http://mag.gmu.edu/ftp/QinDenton/hour/merged/latest/WGhour-latest.d'
    print('QinDenton.py: Downloading %s' % url)
    urllib.request.urlretrieve(url, filename)

file = open(filename, "r")

# The following avoids the use of date parsing by using fact that
# ASCII values for time in the file are monotonically increasing 
# so that >= and < can be used to find start and stop times.
n = 0
for line in file:
    timestr = line[0:24]
    if n > 0 and timestr >= startp and timestr < stopp:
        data = re.sub(r"\s+", ",", line[14:-1].strip())
        sys.stdout.write('%s-%03dT%02dZ,%s\n' % (line[1:5],int(line[6:9]),int(line[10:12]),data))
    if n > 0 and timestr >= stopp:
        sys.stdout.flush()
        break
    n = n + 1
