import re
import os
import sys
import urllib3
import argparse
from datetime import datetime, timedelta

http = urllib3.PoolManager()

# If stream = True, each line is written as processed.
# If False, lines from each file are accumulated then
# written after looping through lines of file. Not much 
# difference in speed if stream = True vs. False; Most
# time spent on d/l.
stream = True
ROOT = 'https://hapi-server.org/urlwatcher/'
#ROOT = 'http://localhost:4444/'

parser = argparse.ArgumentParser()
parser.add_argument('--dataset',default='AMDA/landing')
parser.add_argument('--start',default='2022-09-21T22:59:26.795Z')
parser.add_argument('--stop',default='2023-09-30T23:42:55.832Z')
parser.add_argument('--parameters',default='')
args = vars(parser.parse_args())

start, stop = args['start'][0:26], args['stop'][0:26]

subset = False
if args['parameters'] != '':
  subset = True
  parameters = 'status,ttfb,dl,total,size,fails'.split(",")
  parameters_req = args['parameters'].split(",")
  idxs = []
  for parameter in parameters_req:
    try:
      idx = parameters.index(parameter)
      idxs.append(idx+1)
    except:
      pass
  idxs.sort()

def dump(data, start, stop):
  n = 0
  lines = ""
  for line in data:
    timestr = line[0:24]
    if subset == True:
      line_list = line.split(",")
      line = line_list[0] + ","
      for idx in idxs:
        line = line + line_list[idx] + ","

    # First line is header, so print only if n > 0
    if n > 0 and timestr >= start and timestr < stop:
      if stream == True:
        sys.stdout.write(line[:-1] + "\n")
      else:
        lines = lines + line[:-1] + "\n"
    if n > 0 and timestr >= stop:
      break
    n = n + 1

  if stream == False:
    sys.stdout.write(lines)

  sys.stdout.flush()

startdt = datetime.strptime(start[0:10], '%Y-%m-%d')
stopdt = datetime.strptime(stop[0:10], '%Y-%m-%d')

date = startdt
while date <= stopdt:
  file_date = date.strftime('%Y-%m-%d')
  file_url = ROOT + f'log/{args["dataset"]}/log/{file_date}.csv'
  date = date + timedelta(days=1)
  try:
    http = urllib3.PoolManager()
    r = http.request('GET', file_url)
    data = r.data.decode('utf-8').split("\n")
    dump(data, start, stop)
  except:
    pass
