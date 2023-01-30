import os
import glob
import json

base = '/Users/weigel/ep/urlwatcher/log'
catalog_inline = []

parameters = [
    {
      'name': 'Time',
      'label': 'Time of test',
      'type': 'isotime',
      'units': 'UTC',
      'fill': ''
    },
    {
      'name': 'status',
      'label': 'HTTP status code',
      'type': 'integer',
      'units': None,
      'fill': "-1"
    },
    {
      'name': 'ttfb',
      'label': 'Time to First Byte',
      'type': 'integer',
      'units': 'ms',
      'fill': "-1"
    },
    {
      'name': 'dl',
      'label': 'Download time',
      'type': 'integer',
      'units': 'ms',
      'fill': "-1"
    },
    {
      'name': 'total',
      'label': 'Total request time',
      'type': 'integer',
      'units': 'ms',
      'fill': "-1"
    },
    {
      'name': 'size',
      'label': 'Response size',
      'type': 'integer',
      'units': 'bytes',
      'fill': "-1"
    },
    {
      'name': 'fails',
      'label': '# of test failures',
      'type': 'integer',
      'units': None,
      'fill': "-1"
    }
  ]

for root, dirs, files in os.walk(base):
  path = root.split(os.sep)
  if len(path) == 1 and path[0] == '.':
    continue

  if root.endswith("/log"):

    files = glob.glob(os.path.join(root,"*.csv"))
    files.sort()

    if len(files) > 0:
      key = root.split(base)[1].split("/")[1:-1]
      print(root + ": " + "/".join(key) + " (" + str(len(files)) + " files)")

      with open(os.path.join(root,'..','settings.json')) as f:
        settings = json.load(f)

      dataset = {}
      dataset['id'] = "/".join(key)
      dataset['title'] = settings['url']
      dataset['info'] = {
          "startDate": files[0].split("/")[-1].split(".")[0] + "Z",
          "stopDate": files[-1].split("/")[-1].split(".")[0] + "Z",
          "cadence": "PT{0:.0f}S".format(int(settings['interval'])/1000),
          "parameters": parameters
      }

      catalog_inline.append(dataset)
      break

catalog_inline = json.dumps(catalog_inline, indent = 4)
with open("catalog.json", "w") as f:
  f.write(catalog_inline)
