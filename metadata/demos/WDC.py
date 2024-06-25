import json
import requests
import requests_cache

default_params = {
    'params': None,  # Dictionary, list of tuples or bytes to send in the query string for the Request
    'headers': None,  # Dictionary of HTTP Headers to send with the Request
    'timeout': None,  # Float or a (connect timeout, read timeout) tuple
    'allow_redirects': True,  # Boolean. Enable/Disable redirection
    'stream': False,  # if False, the response content will be immediately downloaded
}

catalog_url = 'https://app-geomag.bgs.ac.uk/wdc/stations'

def catalog(catalog_url, session):
  try:
      response = session.get(catalog_url)
      response.raise_for_status()  # raise exception if invalid response
      try:
        print(response.from_cache)
        return json.loads(response.text)
      except:
        print('Error. Could not parse catalog. Response given below.')
        print(response.text)
  except requests.exceptions.HTTPError as errh:
      print ("HTTP Error:", errh)
  except requests.exceptions.ConnectionError as errc:
      print ("Error Connecting:", errc)
  except requests.exceptions.Timeout as errt:
      print ("Timeout Error:", errt)
  except requests.exceptions.RequestException as err:
      print ("Something went wrong with the request:", err)

def toISO(year):
  return f'{year}-01-01'

session = requests_cache.CachedSession('cache', expire_after=600)

catalog_dict = catalog(catalog_url, session)
catalog_json = json.dumps(catalog_dict, indent=2)
#print(catalog_json)
datasets_hour = []
datasets_minute = []
for key, value in catalog_dict.items():
  dataset = {'id': value['code'], 'title': value['name'], 'info': {'startDate': None, 'stopDate': None}}
  #print(value['dataAvailability'])
  if 'hour' in value['dataAvailability']:
    dataset['info']['startDate'] = toISO(value['dataAvailability']['hour']['earliest'])
    dataset['info']['stopDate'] = toISO(value['dataAvailability']['hour']['latest'])
    dataset['info']['cadence'] = 'PT1H'
    datasets_hour.append(dataset)
  if 'minute' in value['dataAvailability']:
    dataset['info']['startDate'] = toISO(value['dataAvailability']['minute']['earliest'])
    dataset['info']['stopDate'] = toISO(value['dataAvailability']['minute']['latest'])
    dataset['info']['cadence'] = 'PT1M'
    datasets_minute.append(dataset)

print(json.dumps(datasets_hour, indent=2))
print(json.dumps(datasets_minute, indent=2))
print(len(datasets_hour))
print(len(datasets_minute))
