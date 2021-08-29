# Usage:
#   python2 Example.py --start START --stop STOP [-params PARAMETERS -fmt FORMAT]
#
# Generates a HAPI CSV file with a two parameters: a one-column scalar
# and a 3-column vector. The scalar values are the number of minutes
# since 1970-01-01. Vector component i at a given time is the scalar
# value at that time plus i. Only START and STOP are required and they
# must be in HAPI ISO8601 format.
#
# PARAMETERS is a comma-separated list of output parameters and
# can be any combination of Time, scalar, and vector. The default
# is 'Time,scalar,vector'. The order of parameters in the list is
# ignored and Time is always output as the first column.
#
# FORMAT is either 'csv' or 'binary'. The default is 'csv'.
#
# Examples:
#   python2 Example.py --start 1970-01-01T00:00:00.000000Z --stop 1970-01-01T00:10:00.000000Z 
#   python2 Example.py --fmt binary --start 1970-01-01T00:00:00.000000Z --stop 1970-01-01T00:10:00.000000Z 
#   python2 Example.py --params Time --start 1970-01-01T00:00:00.000000Z --stop 1970-01-01T00:10:00.000000Z
#   python2 Example.py --params Time,vector --start 1970-01-01T00:00:00.000000Z --stop 1970-01-01T00:10:00.000000Z

import sys
import struct
import argparse
import datetime
import re

# On windows, error is
#   close failed in file object destructor:
#   sys.excepthook is missing
#   lost sys.stderr
# This is due to
#   https://bugs.python.org/issue11380
# The error message can be ignored.

# Trap broke pipe signal so usage in the form of
# python ./bin/Example.py | python lib/subset.py ...
# does not throw error when subset.py terminates read
# of output of Example.py.
if sys.platform != 'win32':
    from signal import signal, SIGPIPE, SIG_DFL
    signal(SIGPIPE, SIG_DFL)

parser = argparse.ArgumentParser()
parser.add_argument('--id',default='dataset1') # Not used
parser.add_argument('--params',default='')
parser.add_argument('--start',default='1970-01-01T00:00:00.000000000Z')
parser.add_argument('--stop',default='1971-01-01T00:00:00.000000000Z')
parser.add_argument('--fmt',default='csv')

v      = vars(parser.parse_args())
epoch  = datetime.datetime(1970,1,1)
params = v['params']
start  = datetime.datetime.strptime(v['start'][0:26],"%Y-%m-%dT%H:%M:%S.%f")
stop   = datetime.datetime.strptime(v['stop'][0:26],"%Y-%m-%dT%H:%M:%S.%f")
fmt    = v["fmt"]

if params == '':
	params_list = ['scalar','vector']
else:
	params_list = params.split(",")

# Start minute
mo = int((start-epoch).total_seconds()/60.0)
# End minute
mf = int((stop-epoch).total_seconds()/60.0)

dt = (stop-epoch).total_seconds()-(start-epoch).total_seconds()
if dt < 60: mf=mo+1 # To output 1 record if stop < start + 60 sec

# To output 1 record if stop < start + 60 sec
dt = (stop-epoch).total_seconds()-(start-epoch).total_seconds()
if dt < 60: mf=mo+1 

scalar = False
vector = False
if 'scalar' in params_list: scalar = True
if 'vector' in params_list: vector = True

if fmt == 'binary' and sys.version_info[0] == 3:
	# Python 3
	import os
	stdout = os.fdopen(sys.stdout.fileno(), "wb", closefd=False)

for i in range(0,mf-mo):
	d1 = start + datetime.timedelta(minutes=i)
	if fmt == 'binary':
		if sys.version_info[0] == 2:
			sys.stdout.write("%sZ" % d1.isoformat())
			if scalar == True:
				sys.stdout.write(struct.pack('<d',mo+i))
			if vector == True:
				sys.stdout.write(struct.pack('<ddd',mo+i+1,mo+i+2,mo+i+3))
		else:
			# Python 3
			stdout.write(bytes("%sZ" % d1.isoformat(),'ascii'))
			if scalar == True:
				stdout.write(struct.pack('<d',mo+i))
			if vector == True:
				stdout.write(struct.pack('<ddd',mo+i+1,mo+i+2,mo+i+3))
	else:
		sys.stdout.write("%sZ" % d1.isoformat())
		if scalar == True:
			sys.stdout.write(",%d" % (mo+i))
		if vector == True:
			sys.stdout.write(",%d,%d,%d" % (mo+i+1,mo+i+2,mo+i+3))
		sys.stdout.write("\n")

if fmt == 'binary' and sys.version_info[0] == 3:
	stdout.flush()
