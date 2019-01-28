# If file given on command line, eval it.

#import sys
#sys.path.insert(0, 'example.zip')

# If file not given on command line, drop to shell.
#import code
#code.interact(local=locals())

with open('script.py', 'r') as myfile:
  code = myfile.read()

exec(code,globals(),locals())

