# Usage:
#  python TestDataSimple.py --start 1970-01-01 --stop 1970-01-01T00:10:00
#
# Generates a HAPI CSV file with a scalar parameter that is the
# number of minutes since 1970-01-01.
#
#  python TestDataSimple.py --start 1970-01-01 --stop 1970-01-01T00:10:00 --format binary
#  Generates a HAPI Binary file.

import sys
import struct
import argparse
import datetime
import dateutil.parser
import re

parser = argparse.ArgumentParser()
parser.add_argument('--id') # ignored
parser.add_argument('--parameters') # ignored
parser.add_argument('--start')
parser.add_argument('--stop')
parser.add_argument('--format')

v      = vars(parser.parse_args())
epoch  = datetime.datetime(1970,1,1)
start  = dateutil.parser.parse(re.sub("Z$","",v['start']))
stop   = dateutil.parser.parse(re.sub("Z$","",v['stop']))
format = v["format"]

mo = int((start-epoch).total_seconds()/60.0)
mf = int((stop-epoch).total_seconds()/60.0)

dt = (stop-epoch).total_seconds()-(start-epoch).total_seconds()
if dt < 60: mf=mo+1 # To output 1 record if stop < start + 60 sec
for i in xrange(0,mf-mo):
       d1 = start + datetime.timedelta(minutes=i)
       if format == 'binary':
           sys.stdout.write("%sZ" % d1.isoformat())
           sys.stdout.write(struct.pack('>d',mo+i))
       else:
           print "%sZ,%d" % (d1.isoformat(),mo+i)
