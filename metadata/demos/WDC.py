import json

# Execute curl -O stations.json "https://app-geomag.bgs.ac.uk/wdc/stations"
# then
#  python WDC.py --output catalog-all
# or 
#  python WDC.py --output catalog

output = {"help": "catalog or catalog-combined"}
import argparse
parser = argparse.ArgumentParser()
parser.add_argument(f'--output', **output)
args = vars(parser.parse_args())

with open('stations.json', 'r') as f:
  catalog_dict = json.loads(f.read())

def toISO(year):
  return f'{year}-01-01'

def _dataset(id, title, startDate, stopDate, cadence):
  return {
    'id': id,
    'title': title,
    'info': {
      'startDate': startDate,
      'stopDate': stopDate,
      'cadence': cadence,
      "maxRequestDuration": "P366D",
      "description": "",
      "coordinateSystemSchema": "spase2.4.1",
      "resourceURL": "https://wdcapi.bgs.ac.uk/doc",
      "citation": "https://wdcapi.bgs.ac.uk/doc",
      "contact": "",
      "x_latitude": 0.0,
      "x_longitude": 38.77,
      "x_elevation": 2441,
      "parameters": [
          {
            "name": "Time",
            "type": "isotime",
            "length": 17,
            "units": "UTC",
            "fill": None,
            "description": "The UTC date and time for the data from ...",
            "label": "Date/time"
          },
          {
            "name": "XYZ",
            "type": "double",
            "size": [
              3
            ],
            "units": [
              "nT",
              "nT",
              "nT"
            ],
            "coordinateSystemName": "Cartesian",
            "vectorComponents": [
              "x",
              "y",
              "z"
            ],
            "fill": "99999.0",
            "description": "",
            "label": [
              "X",
              "Y",
              "Z"
            ]
          },
          {
            "name": "HDZ",
            "type": "double",
            "size": [
              3
            ],
            "units": [
              "nT",
              "degrees",
              "nT"
            ],
            "coordinateSystemName": "Cylindrical",
            "vectorComponents": [
              "r",
              "theta",
              "z"
            ],
            "fill": "99999.0",
            "description": "",
            "label": [
              "H",
              "D",
              "Z"
            ]
          }
        ]
    }
  }

datasets = []
for key, value in catalog_dict.items():
  print(value)
  #print(value['dataAvailability'])
  if 'hour' in value['dataAvailability']:
    dataset = _dataset(value['code'] + '/hour', value['name'], toISO(value['dataAvailability']['hour']['earliest']), toISO(value['dataAvailability']['hour']['latest']), 'PT1H')
    datasets.append(dataset)
  if 'minute' in value['dataAvailability']:
    dataset = _dataset(value['code'] + '/minute', value['name'], toISO(value['dataAvailability']['hour']['earliest']), toISO(value['dataAvailability']['hour']['latest']), 'PT1H')
    datasets.append(dataset)
  print(dataset['id'])
  break

if args['output'] == 'catalog-all':
  print(json.dumps(datasets, indent=2))

if args['output'] == 'catalog':
  datasets = datasets.copy()
  for dataset in datasets:
    print(dataset['id'])
    print(dataset)
    del dataset['info']
  print(json.dumps(datasets, indent=2))
