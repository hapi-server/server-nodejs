#curl -H "Accept: application/json" "https://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/observatories" > observatories.json

#curl -O https://spdf.gsfc.nasa.gov/pub/catalogs/all.xml

ID=AC_H2_CRIS
PARAMETERS=flux_B
START="2010-06-21T14:50:52Z"
STOP="2010-07-30T14:50:52Z"

#Fails for both
#ID=A2_K0_MPA
#PARAMETERS=dens_lop
#START="2003-10-29T00:03:04Z"
#STOP="2003-10-31T00:03:04.000Z"

START_STR=${START//-/}
START_STR=${START_STR//:/}
STOP_STR=${STOP//-/}
STOP_STR=${STOP_STR//:/}

base="https://cdaweb.gsfc.nasa.gov/WS/cdasr/1/dataviews/sp_phys/datasets"
url="$base/$ID/data/$START_STR,$STOP_STR/$PARAMETERS?format=text"

echo $url
time curl -s $url > a

url="https://cdaweb.gsfc.nasa.gov/hapi/data?id=$ID&parameters=$PARAMETERS&time.min=$START&time.max=$STOP"
echo $url
time curl -s $url > b

