import sys
import argparse
if sys.version_info[0] > 2:
	from urllib.request import urlopen
else:
	from urllib2 import urlopen

# Read before implementing binary subsetting
# https://stackoverflow.com/questions/2872381/how-to-read-a-file-byte-by-byte-in-python-and-how-to-print-a-bytelist-as-a-binar
# https://stackoverflow.com/questions/48725405/how-to-read-binary-data-over-a-pipe-from-another-process-in-python
# https://stackoverflow.com/questions/2850893/reading-binary-data-from-stdin

parser = argparse.ArgumentParser()
parser.add_argument('--columns', default=None)
parser.add_argument('--start', default='0001-01-01T00:00:00.000000000Z')
parser.add_argument('--stop', default='9999-12-31T23:59:59.999999999Z')
parser.add_argument('--file', default=None)
parser.add_argument('--url', default=None)
parser.add_argument('--format', default='csv')
args = parser.parse_args()

start = args.start
stop = args.stop
startlen = len(args.start)
stoplen = len(args.stop)

if args.columns is not None:
	# Convert, e.g, "1,2,4-6" to [1,2,4,5,6] - 1
	tmp = args.columns.split(",")
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

if args.file is not None:
	if args.format != 'csv':
		raise Error('Only --format=csv is implemented')
	f = open(args.file,'r').readlines()
elif args.url is not None:
	f = urlopen(args.url)
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