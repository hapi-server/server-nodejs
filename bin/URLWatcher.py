import re
import os
import sys
import urllib3
import argparse
http = urllib3.PoolManager()
from datetime import datetime, timedelta

ROOT = 'https://hapi-server.org/urlwatcher/'
ROOT = 'http://localhost:4444/'

parser = argparse.ArgumentParser()
parser.add_argument('--dataset',default='AMDA/landing')
parser.add_argument('--start',default='2022-09-21T22:59:26.795Z')
parser.add_argument('--stop',default='2022-09-24T23:42:55.832Z')
args = vars(parser.parse_args())

start, stop = args['start'][0:26], args['stop'][0:26]

def dump(data, start, stop):
  n = 0
  for line in data:
      timestr = line[0:24]
      if n > 0 and timestr >= start and timestr < stop:
        sys.stdout.write(line + "\n")
      if n > 0 and timestr >= stop:
        sys.stdout.flush()
        break
      n = n + 1

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
    #print(r.status)
    dump(data, start, stop)
  except:
    pass
