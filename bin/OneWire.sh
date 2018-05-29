# Autoplot sends version information to stderr, but server
# wants to save stderr to file. The 2> etc. filters version information.
# See https://stackoverflow.com/a/13564236

if [ $1 = "Temperature" ]
then
	java -Djava.awt.headless=true -cp bin/autoplot.jar org.autoplot.AutoplotDataServer --uri 'vap+dat:file:'$4'/public/data/OneWire/data/10.CF3744000800/$Y/10.CF3744000800.$Y$m$d.csv?time=field0&column=field1&timerange='$2/$3 -f hapi-data 2> >( sed '/Autoplot version/d' >&2 )
else
	java -Djava.awt.headless=true -cp bin/autoplot.jar org.autoplot.AutoplotDataServer --uri 'vap+dat:file:'$4'/public/data/OneWire/data/10.CF3744000800/$Y/10.CF3744000800.$Y$m$d.csv?time=field0&column=field0&timerange='$2/$3 -f hapi-data 2> >( sed '/Autoplot version/d' >&2 )
fi