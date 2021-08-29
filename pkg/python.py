# This python script is converted into a stand-alone binary
# using pyinstaller. When this script is executed, exec is
# used to call the file passes as the first argument to the binary.

# Note - all of the imports used by any script will be need to
# be imported in this script.
import sys

# Used by Example.py
import struct
import argparse
import datetime
import re

com = sys.argv[1]
#print("Executing " + com)
sys.argv.pop(1) # Don't pass name of script being executed as argument to script.
exec(open(com).read(), globals())