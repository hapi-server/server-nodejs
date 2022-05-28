import os

from magpy.stream import read
from fnmatch import fnmatch

root = os.getcwd() + "/obsdata/1minval"
pattern = "*.wdc"

table_dict = {}

for path, subdirs, files in os.walk(root):
    for name in files:
        if fnmatch(name, pattern):
            name = os.path.join(path, name)
            data = read(os.path.join(path, name))
            print(os.path.join(path, name))
            print(data)
            print(data.header)
            print()
            print()
            if data.header['StationID'] not in table_dict.keys():
                table_dict[data.header['StationID']] = {'XYZF': [], 'HDZF': []}

            table_dict[data.header['StationID']][data.header['DataComponents']].append(
                name[-17:-13] + '-' + name[-7:-5])
print(table_dict)
