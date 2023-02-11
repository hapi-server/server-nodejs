# Execute using
#  mv timing.log timing.log.last; ./timing.sh >> timing.log 2>&1

time ./timing_serial.sh >> timing.log 2>&1  \
&& \
echo "" >> timing.log 2>&1 \
&& \
time ./timing_parallel.sh >> timing.log 2>&1
