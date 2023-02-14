#!/bin/sh
#
# NOSA HEADER START
#
# The contents of this file are subject to the terms of the NASA Open 
# Source Agreement (NOSA), Version 1.3 only (the "Agreement").  You may 
# not use this file except in compliance with the Agreement.
#
# You can obtain a copy of the agreement at
#   docs/NASA_Open_Source_Agreement_1.3.txt
# or 
#   https://cdaweb.gsfc.nasa.gov/WebServices/NASA_Open_Source_Agreement_1.3.txt.
#
# See the Agreement for the specific language governing permissions
# and limitations under the Agreement.
#
# When distributing Covered Code, include this NOSA HEADER in each
# file and include the Agreement file at 
# docs/NASA_Open_Source_Agreement_1.3.txt.  If applicable, add the 
# following below this NOSA HEADER, with the fields enclosed by 
# brackets "[]" replaced with your own identifying information: 
# Portions Copyright [yyyy] [name of copyright owner]
#
# NOSA HEADER END
#
# Copyright (c) 2009-2019 United States Government as represented by 
# the National Aeronautics and Space Administration. No copyright is 
# claimed in the United States under Title 17, U.S.Code. All Other 
# Rights Reserved.
#
#

#
# Example client for the CDAS Web services.
#
# Arguments:
#   $1 optional endpoint URL
#   $2 optional dataview
#   $3
#   $4
#   $5
#   $6
#

#set -x
#set -v

# -p below is returning "unknown" on Raspbian (armv7)
userAgent="curlWsExample (`uname -sp`)"
tmpDir=`mktemp -d /tmp/wsXXXXXX`

#
# XSLT script to get the //FileDescription/Name/text() from a 
# DataResult file.  
#
getResultFileName_xslt=${tmpDir}/getResultFileName.xslt
cat > $getResultFileName_xslt << EOF
<xsl:transform version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cdas="http://cdaweb.gsfc.nasa.gov/schema">

  <xsl:output method="text" indent="yes" media-type="text/plain" />
  <xsl:template match="/">
    <xsl:for-each select="//cdas:FileDescription/cdas:Name" >
      <xsl:value-of select="text()" /><xsl:text> </xsl:text>
    </xsl:for-each>
  </xsl:template>
</xsl:transform>
EOF

#
# XSLT script to get the //ThumbnailDescription/Name/text() from 
# a DataResult file.  
#
getThumbnailDescriptionName_xslt=${tmpDir}/getThumbnailDescriptionName.xslt
cat > $getThumbnailDescriptionName_xslt << EOF
<xsl:transform version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cdas="http://cdaweb.gsfc.nasa.gov/schema">

  <xsl:output method="text" indent="yes" media-type="text/plain" />
  <xsl:template match="/">
    <xsl:for-each select="//cdas:ThumbnailDescription/cdas:Name" >
      <xsl:value-of select="text()" />
    </xsl:for-each>
  </xsl:template>
</xsl:transform>
EOF

#
# XSLT script to get the //ThumbnailId/text() from 
# a DataResult file.  
#
getThumbnailId_xslt=${tmpDir}/getThumbnailId.xslt
cat > $getThumbnailId_xslt << EOF
<xsl:transform version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cdas="http://cdaweb.gsfc.nasa.gov/schema">

  <xsl:output method="text" indent="yes" media-type="text/plain" />
  <xsl:template match="/">
    <xsl:for-each select="//cdas:ThumbnailId" >
      <xsl:value-of select="text()" />
    </xsl:for-each>
  </xsl:template>
</xsl:transform>
EOF

#
# XSLT script to transform a DataResult file containing a
# ThumbnailDescription element into a ThumbnailRequest.
#
createThumbnailRequest_xslt=${tmpDir}/createThumbnailRequest.xslt
cat > $createThumbnailRequest_xslt << EOF
<xsl:transform version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:cdas="http://cdaweb.gsfc.nasa.gov/schema">

  <xsl:output method="xml" standalone="yes" 
          media-type="application/xml" />
  <xsl:template match="/">
    <DataRequest xmlns="http://cdaweb.gsfc.nasa.gov/schema">
      <ThumbnailRequest>
        <xsl:copy-of select="//cdas:ThumbnailDescription" />
        <Thumbnail><xsl:value-of select="\$thumbnailNum" /></Thumbnail>
        <ImageFormat>PNG</ImageFormat>
      </ThumbnailRequest>
    </DataRequest>
  </xsl:template>
</xsl:transform>
EOF


#
# Extracts the result filenames (//FileDescription/Name/text()) from a 
# DataResult file and echos the values to standard output.
#
# Arguments:
#   $1 name of file containing a DataResult XML document
#
echoResultFilenames() {

    resultFile=$1

    echo "Result Filenames from ${resultFile}:"
    for resultFileName in `xsltproc $getResultFileName_xslt $resultFile`
    do
        echo "  ${resultFileName}"
    done
}


#
# Creates a DatasetRequest element from the given DatasetId and 
# VariableName values and appends it to the given (DataRequest XML)
# file.
#
# Arguments:
#   $1 name of file to append to
#   $2 DatasetId and VariableName values separated by a '!'
#
appendDatasetRequest() {

datasetId=`echo $2 | awk -F! '{print $1}'`
variableName=`echo $2 | awk -F! '{print $2}'`

cat >> $1 << EOF
    <DatasetRequest>
      <DatasetId>$datasetId</DatasetId>
      <VariableName>$variableName</VariableName>
    </DatasetRequest>
EOF
}


#
# Gets the Last-Modified header value from the given file 
# containing an HTTP response (that includes the headers).
#
# Arguments:
#   $1 name of file containing an HTTP response.
# Returns:
#   value of Last-Modified header
#
getLastModified() {

    awk '/Last-Modified/{printf "%s\n", substr($0, 16, 29)}' $1
}


#
# Pretty prints an XML entity body from the given HTTP 
# response.  The format is that of "xmllint --format" after
# skipping any HTTP headers.
#
# Arguments:
#   $1 name of file containing an HTTP response.
#
printXmlEntity() {

    awk '/^\r$/{eoh = 1;getline;};eoh == 1 {print}' $1 | \
        xmllint --format -
}


#
# Makes an HTTP request for the WADL and echos the results to 
# standard-out.
#
# Arguments:
#   $1 endpoint URL
#
getWadl() {

    endpointUrl=$1/application.wadl

    echo "Invoking HTTP ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" --silent \
        "${endpointUrl}" | xmllint --format - > cdas.wadl
    echo "WADL was saved in cdas.wadl"
    echo "The contents of cdas.wadl:"
    cat cdas.wadl
    echo
    echo
}


#
# Gets (HTTP GET) the dataviews and echos the results to standard-out.
#
# Arguments:
#   $1 endpoint URL
#
getDataviews() {

    endpointUrl=$1/dataviews
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" --silent \
        "${endpointUrl}" | xmllint --format -
    echo
    echo
}


#
# Gets (HTTP GET) the specified dataview's observatory groups.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 instrumentTypes optional list of instrument types
#
getObservatoryGroups() {

    endpointUrl="$1/dataviews/$2/observatoryGroups?"
    if [ $# -eq 3 ]
    then
        for iType in $3
        do
            endpointUrl="${endpointUrl}instrumentType=${iType}&"
        done
    fi
    endpointUrl=`echo $endpointUrl | sed -e 's/?$//' -e 's/&$//'`
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" --globoff --silent \
        $traceOption "${endpointUrl}" | xmllint --format -
    echo
    echo
}


#
# Gets (HTTP GET) the specified dataview's instrument types.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#
getInstrumentTypes() {

    endpointUrl="$1/dataviews/$2/instrumentTypes"
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" --globoff --silent \
        $traceOption "${endpointUrl}" | xmllint --format -
    echo
    echo
}


#
# Gets (HTTP GET) the specified dataview's instruments.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#
getInstruments() {

    endpointUrl="$1/dataviews/$2/instruments"
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" --globoff --silent \
        $traceOption "${endpointUrl}" | xmllint --format -
    echo
    echo
}


#
# Gets (HTTP GET) the specified dataview's observatories.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#
getObservatories() {

    endpointUrl="$1/dataviews/$2/observatories"
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" --globoff --silent \
        $traceOption "${endpointUrl}" | xmllint --format -
    echo
    echo
}


#
# Gets (HTTP GET) the specified dataview's datasets.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#
getDatasets() {

    endpointUrl="$1/dataviews/$2/datasets"
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" --globoff --silent \
        $traceOption "${endpointUrl}" | xmllint --format -
    echo
    echo
}


#
# Gets (HTTP GET) the specified dataset's inventory.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 dataset
#   $4 optional start time of interval
#   $5 optional end time of interval
#
getInventory() {

    if [ -z "$4" ]
    then
        endpointUrl="$1/dataviews/$2/datasets/$3/inventory/"
    else
        endpointUrl="$1/dataviews/$2/datasets/$3/inventory/$4,$5"
    fi
    resultFile=${tmpDir}/getInventory.xml

    if [ "$endpointUrl" = "$lastInventoryUrl" ]
    then
        echo "Invoking HTTP conditional GET ${endpointUrl}"
        echo "If-Modified-Since: ${lastInventoryLM}" 
        curl $caCert --user-agent "${userAgent}" $traceOption \
             --header "If-Modified-Since: ${lastInventoryLM}" \
             --silent --include "${endpointUrl}"
    else
        echo "Invoking HTTP GET ${endpointUrl}"
        curl $caCert --user-agent "${userAgent}" $traceOption \
             --globoff --silent --include \
             --output $resultFile "${endpointUrl}"

        printXmlEntity ${resultFile}

        lastInventoryUrl=$endpointUrl
        lastInventoryLM=`getLastModified ${resultFile}`

        rm -f $resultFile
    fi
    echo
    echo
}


#
# Gets (HTTP GET) the specified dataset's variables.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 dataset
#
getVariables() {

    endpointUrl="$1/dataviews/$2/datasets/$3/variables"
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" $traceOption \
        --globoff --silent "${endpointUrl}" | xmllint --format -
    echo
    echo
}


#
# Performs an HTTP POST with the specified data.
#
# Arguments:
#   $1 endpoint URL
#   $2 name of file containing POST data
#   $3 name of file to store results in
#
doPost() {

    endpointUrl=$1
    postDataFile=$2
    outFile=$3
    postOutputFile=${tmpDir}/post.out
    printf "Invoking HTTP POST %s\n" "${endpointUrl}"
    printf "With %s\n" "${postDataFile}"
    xmllint --format $postDataFile
    curl $caCert --user-agent "${userAgent}" $traceOption \
        --globoff --silent  --header "Content-Type: application/xml" \
        --header "Accept: application/xml" \
        --include \
        --data-ascii "@${postDataFile}" --output ${postOutputFile} \
        "${endpointUrl}" 

    printXmlEntity ${postOutputFile} > ${outFile}
    lastPostLastModified=`getLastModified ${postOutputFile}`
#lastPostLastModified=`date -u +"%a, %d %b %Y %H:%M:%S GMT"`
    if [ -n "${lastPostLastModified}" ]
    then
        printf "Invoking Conditional HTTP POST %s\n" "${endpointUrl}"
        printf "With file %s and \nIf-Modified-Since: %s\n" \
            "${postDataFile}" "${lastPostLastModified}"
        curl $caCert --user-agent "${userAgent}" $traceOption \
            --globoff --silent  --header "Content-Type: application/xml" \
            --header "Accept: application/xml" \
            --header "If-Modified-Since: ${lastPostLastModified}" \
            --include \
            --data-ascii "@${postDataFile}" "${endpointUrl}" 
    fi

}


#
# Gets (HTTP POST) the specified data in a textual representation.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 start time
#   $4 end time
#   $5 dataset id/variable name
#
getTextData() {

    postData=${tmpDir}/getDataPost.xml
cat > $postData << EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<DataRequest xmlns="http://cdaweb.gsfc.nasa.gov/schema">
  <TextRequest>
    <TimeInterval>
      <Start>$3</Start>
      <End>$4</End>
    </TimeInterval>
EOF
appendDatasetRequest $postData $5
cat >> $postData << EOF
    <Compression>Uncompressed</Compression>
    <Compression>Zip</Compression>
    <Compression>Gzip</Compression>
    <Compression>Bzip2</Compression>
  </TextRequest>
</DataRequest>
EOF

    resultFile=${tmpDir}/getTextData.xml

    endpointUrl="$1/dataviews/$2/datasets"
    doPost $endpointUrl $postData $resultFile
    xmllint --format $resultFile
    echo
    echoResultFilenames $resultFile

    rm -f $postData $resultFile
    echo
    echo
}


#
# Gets (HTTP POST) the specified data in a graphical representation.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 start time
#   $4 end time
#   $5 dataset id/variable name list
#
getGraphData() {

    postData=${tmpDir}/getDataPost.xml
cat > $postData << EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<DataRequest xmlns="http://cdaweb.gsfc.nasa.gov/schema">
  <GraphRequest>
    <TimeInterval>
      <Start>$3</Start>
      <End>$4</End>
    </TimeInterval>
EOF
for i in $5
do
  appendDatasetRequest $postData $i
done
cat >> $postData << EOF
    <GraphOption>CoarseNoiseFilter</GraphOption>
    <GraphOption>DoubleHeightYAxis</GraphOption>
    <GraphOption>CombineGraphs</GraphOption>
    <ImageFormat>PNG</ImageFormat>
  </GraphRequest>
</DataRequest>
EOF

    resultFile=${tmpDir}/getGraphData.xml
    endpointUrl="$1/dataviews/$2/datasets"

    doPost $endpointUrl $postData $resultFile

    echo "Contents of ${resultFile}:"
    xmllint --format $resultFile
    echo
    echoResultFilenames $resultFile
    echo
    echo

    thumbnailName=`xsltproc $getThumbnailDescriptionName_xslt $resultFile`
    thumbnailNum=1
    thumbnailRequest=${tmpDir}/thumbnailRequest.xml
    if [ -n "${thumbnailName}" ]
    then
        echo "The graph contains thumbnail images"
        xsltproc --stringparam thumbnailNum $thumbnailNum \
            $createThumbnailRequest_xslt $resultFile \
            > $thumbnailRequest
        echo "Requesting expanded thumbnail image ${thumbnailNum}"
        doPost $endpointUrl $thumbnailRequest $resultFile
        echo "Contents of ${resultFile}:"
        xmllint --format $resultFile
        echo
        echoResultFilenames $resultFile
    fi

    rm -f $postData $thumbnailRequest $resultFile
    echo
    echo
}


#
# Gets (HTTP POST) the specified data in a CDF representation.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 start time
#   $4 end time
#   $5 dataset id/variable name
#   $6 output format.  Default is "Binary".  Other valid values are:
#          CDFML, GzipCDFML, ZipCDFML, ICDFML, NetCdf.
#
getCdfData() {

    if [ -z "$6" ]
    then
        format="Binary"
    else
        format=$6
    fi

    postData=${tmpDir}/getDataPost.xml
cat > $postData << EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<DataRequest xmlns="http://cdaweb.gsfc.nasa.gov/schema">
  <CdfRequest>
    <TimeInterval>
      <Start>$3</Start>
      <End>$4</End>
    </TimeInterval>
EOF
appendDatasetRequest $postData $5
cat >> $postData << EOF
    <CdfVersion>3</CdfVersion>
    <CdfFormat>$format</CdfFormat>
  </CdfRequest>
</DataRequest>
EOF

    resultFile=${tmpDir}/getCdfData.xml

    endpointUrl="$1/dataviews/$2/datasets"
    doPost $endpointUrl $postData $resultFile
    xmllint --format $resultFile
    echo
    echoResultFilenames $resultFile

    rm -f $postData $resultFile
    echo
    echo
}


#
# Gets (HTTP GET) the specified data in a CDF representation.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 start time
#   $4 end time
#   $5 dataset id/variable name
#   $6 output format.  Default is "cdf".  Other valid values are:
#          text, cvs, nc, audio, gif, png, ps, pdf, icdfml.
#
getCdfDataGET() {

    if [ -z "$6" ]
    then
        format="cdf"
    else
        format=$6
    fi
    datasetId=`echo $5 | awk -F! '{print $1}'`
    variableName=`echo $5 | awk -F! '{print $2}'`

    resultFile=${tmpDir}/getCdfData.xml

    endpointUrl="$1/dataviews/$2/datasets/$datasetId/data/$3,$4/$variableName?format=${format}"
    printf "Invoking HTTP GET %s\n" "${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" $traceOption \
        --globoff --silent  --include --header "Accept: application/xml" \
        --output $resultFile "${endpointUrl}" 

    printXmlEntity ${resultFile}
    printf "\n"

    cdfDataGetLM=`getLastModified ${resultFile}`
    printf "Retrying HTTP GET %s with Last-Modified = %s\n" \
    "${endpointUrl}" "${cdfDataGetLM}"
    curl $caCert --user-agent "${userAgent}" $traceOption \
        --globoff --silent  \
        --include --header "Accept: application/xml" \
        --header "If-Modified-Since: ${cdfDataGetLM}" "${endpointUrl}" 

    rm -f $postData $resultFile
    echo
    echo
}


#
# Gets (HTTP GET) the specified original data.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 start time
#   $4 end time
#   $5 dataset id
#
getOrigCdfDataGET() {

    datasetId=$5

    resultFile=${tmpDir}/getOrigCdfData.xml

    endpointUrl="$1/dataviews/$2/datasets/$datasetId/orig_data/$3,$4/"
    echo "Invoking HTTP GET ${endpointUrl}"
    curl $caCert --user-agent "${userAgent}" $traceOption \
        --globoff --silent --header "Accept: application/xml" \
        --output $resultFile "${endpointUrl}" 
    xmllint --format $resultFile
    echo
    echoResultFilenames $resultFile

    rm -f $postData $resultFile
    echo
    echo
}


#
# Gets a JSON representation of the XML DataRequest.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 dataset id
#   $4 start time
#   $5 end time
#   $6 variable name
#
echoDataRequest() {

    postData=${tmpDir}/getDataPost.xml
cat > $postData << EOF
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<DataRequest xmlns="http://cdaweb.gsfc.nasa.gov/schema">
  <GraphRequest>
    <TimeInterval>
      <Start>$4</Start>
      <End>$5</End>
    </TimeInterval>
    <DatasetRequest>
      <DatasetId>$3</DatasetId>
      <VariableName>$6</VariableName>
    </DatasetRequest>
    <GraphOption>DoubleHeightYAxis</GraphOption>
    <ImageFormat>GIF</ImageFormat>
  </GraphRequest>
</DataRequest>
EOF

    resultFile=${tmpDir}/getGraphData.xml
    endpointUrl="$1/echoDataRequest"

    echo "Invoking HTTP POST ${endpointUrl}"
    echo "With ${postData}"
    xmllint --format $postData
    echo "Reply:"
    curl $caCert --user-agent "${userAgent}" $traceOption \
        --globoff --silent  --header "Content-Type: application/xml" \
        --header "Accept: application/json" \
        --data-ascii "@${postData}" --output $resultFile \
        "${endpointUrl}" 

    echo "Contents of ${resultFile}:"
    cat $resultFile
    echo
}


#
# Gets a graph using a JSON representation.
# The result is displayed to standard-out.
#
# Arguments:
#   $1 endpoint URL
#   $2 dataview
#   $3 dataset id
#   $4 start time
#   $5 end time
#   $6 variable name
#
getGraphDataJson() {

    postData="{\"DataRequest\":{\"GraphRequest\":{\"TimeInterval\":{\"Start\":\"2005-01-01T00:00:00.000Z\",\"End\":\"2005-01-02T00:00:00.000Z\"},\"DatasetRequest\":{\"DatasetId\":\"IM_K0_EUV\",\"VariableName\":[\"IMAGE\"]},\"GraphOption\":[\"DoubleHeightYAxis\"],\"ImageFormat\":[\"GIF\"]}}}"
#    postData="{\"GraphRequest\":{\"TimeInterval\":{\"Start\":\"2005-01-01T00:00:00.000Z\",\"End\":\"2005-01-02T00:00:00.000Z\"},\"DatasetRequest\":{\"DatasetId\":\"IM_K0_EUV\",\"VariableName\":\"IMAGE\"},\"GraphOption\":\"DoubleHeightYAxis\",\"ImageFormat\":\"GIF\"}}"

    resultFile=${tmpDir}/getGraphData.xml
    endpointUrl="$1/dataviews/$2/datasets"

    echo "Invoking HTTP POST ${endpointUrl}"
    echo "With ${postData}"
    echo "Reply:"
    curl $caCert --user-agent "${userAgent}" $traceOption \
        --globoff --silent --header "Content-Type: application/json" \
        --header "Accept: application/json" \
        --data-ascii "${postData}" --output $resultFile \
        "${endpointUrl}" 

    echo "Contents of ${resultFile}:"
    cat $resultFile
    echo
}


#
# Main part of example.
#

# default parameter values
#
#endpoint=https://cdaweb.gsfc.nasa.gov/WS/cdasr/1
#endpoint=http://cdaweb.gsfc.nasa.gov/WS/cdasr/1
endpoint=https://cdaweb-dev.sci.gsfc.nasa.gov/WS/cdasr/1
#endpoint=http://cdaweb-dev.sci.gsfc.nasa.gov/WS/cdasr/1
#endpoint=https://cdaweb-tmp.sci.gsfc.nasa.gov/WS/cdasr/1
#endpoint=https://cdaweb-su.sci.gsfc.nasa.gov/WS/cdasr/1
#endpoint=https://cdaweb1.sci.gsfc.nasa.gov/WS/cdasr/1
#endpoint=http://cdaweb1.sci.gsfc.nasa.gov/WS/cdasr/1
#endpoint=http://localhost:8084/WS/cdasr/1
dataview=sp_phys
#dataview=cnofs
# Dataset producing thumbnail images.  
# **** But don't ask for a listing of this.  ****
#datasetVar="IM_K0_EUV!IMAGE"
#start="2005-01-01T00:00:00.000Z"
#end="2005-01-02T00:00:00.000Z"
#datasetVar=spase://VSPO/NumericalData/ACE/MAG/L2/PT16S!Magnitude
#datasetVar="AC_H0_MFI!Magnitude"
#datasetVar="AC_H0_MFI!ALL-VARIABLES"
#datasetVar=spase://VHO/NumericalData/WIND/MFI/PT03S!BGSE
#datasetVar="WI_H0_MFI!BGSE"
#start="2005-01-01T00:00:00.000Z"
#end="2005-01-01T01:00:00.000Z"
#datasetVar="PO_H0_UVI!IMAGE_DATA PO_H1_UVI!IMAGE_DATA PO_K0_MFE!BT"
#start="1998-05-08T19:00:00.000Z"
#end="1998-05-09T19:00:00.000Z"
# 10.21978/P8PG8V is ISEE2_4SEC_MFI
#datasetVar="10.21978/P8PG8V!BT"
#start="1987-09-24T15:00:00.000Z"
#end="1987-09-25T15:00:00.000Z"

start="2015-01-01T00:00:00.123456Z"
end="2015-01-01T01:00:00.000Z"
datasetVar="RBSP-B_MAGNETOMETER_4SEC-SM_EMFISIS-L3!Magnitude"


#caCert=
caCert="-k"
#caCert="--cacert spdfVH_ca.crt"
#caCert="--cacert ca-bundle.crt"

#traceOption="--header 'X-Jersy-Trace-Accept: true'"


case $# in
1)
    endpoint=$1
    ;;
2)
    endpoint=$1
    dataview=$2
    ;;
esac

dataset=`echo $datasetVar | awk -F! '{print $1}'`

echo "curl Example"

getWadl $endpoint 

getDataviews $endpoint 

#instrumentTypes="Engineering Ground-Based%20VLF/ELF/ULF,%20Photometers"
instrumentTypes="Magnetic%20Fields%20(space)"

getObservatoryGroups $endpoint $dataview "${instrumentTypes}"

getInstrumentTypes $endpoint $dataview

getInstruments $endpoint $dataview

getObservatories $endpoint $dataview

getDatasets $endpoint $dataview

getInventory $endpoint $dataview $dataset

getInventory $endpoint $dataview $dataset

getInventory $endpoint $dataview MMS1_FPI_BRST_L2_DES-MOMS 20180830T080953Z 20180830T085200Z

getVariables $endpoint $dataview $dataset

getTextData $endpoint $dataview $start $end "$datasetVar"

getGraphData $endpoint $dataview $start $end "$datasetVar"

getCdfData $endpoint $dataview $start $end "$datasetVar" "Binary"
getCdfData $endpoint $dataview $start $end "$datasetVar" "NetCdf"

#
# convert extended ISO 8601 times to basic (minimal separators)
#
start=`echo $start | awk -F. '{printf "%sZ", $1}' - | tr -d "\-:."`
end=`echo $end | awk -F. '{printf "%sZ", $1}' - | tr -d "\-:."`

getCdfDataGET $endpoint $dataview $start $end "$datasetVar"
getCdfDataGET $endpoint $dataview $start $end "$datasetVar" "text"
getCdfDataGET $endpoint $dataview $start $end "$datasetVar" "png"
getCdfDataGET $endpoint $dataview $start $end "$datasetVar" "audio"
getCdfDataGET $endpoint $dataview $start $end "$datasetVar" "nc"

getOrigCdfDataGET $endpoint $dataview $start $end "$dataset"

##echoDataRequest $endpoint $dataview $dataset $start $end $var

##getGraphDataJson $endpoint $dataview $dataset $start $end $var


rm -rf ${tmpDir}

exit 0
