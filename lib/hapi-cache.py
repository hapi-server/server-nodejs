deschead="""
Cache HAPI data with input from stdin, file, or URL

Version: 0.0.1
"""

desctail="""
Examples:

-----------------------------------------
# HAPI info response is included as a part of input

$ URLbase = 'http://hapi-server.org/TestData/hapi
$ URLargs = '/data?id=dataset1&parameters=scalar,vector&start=1970-01-01Z&stop=1970-01-02'
$ curl $URLbase$URLargs'&include=header' | python hapi-cache.py

# The following is equivalent (--info argument is used to get HAPI info response)

$ URLargs = '/info?id=dataset1&parameters=scalar,vector'
$ curl $URLbase$URLargs | python hapi-cache.py --info $URLinfo

-----------------------------------------
# HAPI_DATA can be set on command line or set as shell environment variable

$ curl $URL'&include=header' | python hapi-cache.py --HAPI_DATA=/tmp

# The following is equivalent

$ HAPI_DATA=/tmp
$ curl $URL'&include=header' | python hapi-cache.py    

-----------------------------------------
"""

import sys
import optparse

if sys.version_info[0] > 2:
	from urllib.request import urlopen
else:
	from urllib2 import urlopen

# Read before implementing binary:
# https://stackoverflow.com/questions/2872381/how-to-read-a-file-byte-by-byte-in-python-and-how-to-print-a-bytelist-as-a-binar
# https://stackoverflow.com/questions/48725405/how-to-read-binary-data-over-a-pipe-from-another-process-in-python
# https://stackoverflow.com/questions/2850893/reading-binary-data-from-stdin

parser = optparse.OptionParser(usage='python hapi-cache.py [options]', add_help_option=False)

parser.add_option('-h', '--help', dest='help', action='store_true', help='Show this help message and exit')
parser.add_option('--dir', default='/tmp', help='Cache directory will be DIR/hapi-data')
parser.add_option('--info', help='URL or file for info response associated with input. Required if input does not contain HAPI info header.')
parser.add_option('--file', default=None, help='File containing HAPI data')
parser.add_option('--url', default=None, help='URL with response of HAPI data')
parser.add_option('--format', default='csv', help='Format of input')

(options, args) = parser.parse_args()

if options.help:
    print(deschead)
    parser.print_help()
    print(desctail)
    sys.exit(0)

start = options.start
stop = options.stop
startlen = len(start)
stoplen = len(stop)

if options.columns is not None:
	# Convert, e.g, "1,2,4-6" to [1,2,4,5,6] - 1
	tmp = options.columns.split(",")
	tmparr = [ i for i in tmp ]
	columnsarr = []
	for i in tmp:
		if i.find("-") == -1:
			columnsarr.append(int(i)-1)
		else:
			tmp = i.split("-")
			expanded = list(range(int(tmp[0])-1,int(tmp[1])))
			columnsarr = columnsarr + expanded
else:
	columnsarr = None

if options.file is not None:
	if options.format != 'csv':
		raise Error('Only --format=csv is implemented')
	f = open(options.file,'r').readlines()
elif options.url is not None:
	f = urlopen(options.url)
else:
	f = sys.stdin

l = 0
for line in f:

	if args.url is not None:
		line = line.decode('utf8')

	if True and l == 0:
		# l == 0 condition alone assumes length of time in 
		# lines does not change (it should not according to spec). 
		# It is better to not assume it will always be the same
		# length. If needed, add a command line switch that
		# says --validcsv to indicate that we only need
		# to check first line to get time length. 
		i = line.find(",")
		m = min([startlen,stoplen,i])
		start = start[0:m-1] + "Z"
		stop = stop[0:m-1] + "Z"

	time = line[0:m-1] + "Z"
	if time >= stop:
		sys.exit(0)

	#print(time,start,stop)
	l = l+1
	if time >= start and time < stop:
		if columnsarr is None:
			sys.stdout.write(line)
		else:
			linearr = line.rstrip().split(",")
			print(",".join([ linearr[i] for i in columnsarr ]))