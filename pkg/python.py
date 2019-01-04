# If file given on command line, eval it.

# If file not given on command line, drop to shell.
import code
code.interact(local=locals())
