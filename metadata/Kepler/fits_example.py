# This code computes ISO 8601 time stamps using the data in a fits file
# https://archive.stsci.edu/pub/kepler/lightcurves/0007/000757076/kplr000757076-2009131105131_llc.fits
# Computing the ISO 6801 times requires several calculations that are
# covered in
# https://archive.stsci.edu/kepler/manuals/Data_Characteristics_Handbook_20110201.pdf
# 
# The next step is to create HAPI metadata and dump the data
# as HAPI CSV or binary. To tbl_np, we should add the ISO timestamps.

import numpy as np
from astropy.table import Table
filename = '/tmp/kplr000757076-2009131105131_llc.fits'
tbl    = Table.read(filename)
tbl_np = np.array(tbl)

from astropy.io import fits
hdulist = fits.open(filename)
print(hdulist[1].header)

LC_START     = tbl.meta['LC_START'] # mid point of first cadence in MJD
LC_START_JD  = LC_START + 2400000.5

TSTART       = tbl.meta['TSTART'] # observation start time in BJD-BJDREF
TSTART_BJD   = TSTART + tbl.meta['BJDREFI'] + tbl.meta['BJDREFF']
TSTART_CAL   = tbl.meta['DATE-OBS'] # TSTART as UTC calendar date

TIMSLICE     = tbl.meta['TIMSLICE'] # time-slice readout sequence section

BJDREFI      = tbl.meta['BJDREFI']
BJDREFF      = tbl.meta['BJDREFF']

TIME0        = tbl['TIME'][0] + tbl.meta['BJDREFI'] + tbl.meta['BJDREFF']
TIMECORR0    = tbl['TIMECORR'][0]
TIME0CORR    = TIME0 - TIMECORR0

# Equation TTS is t_ts on pg 38 of
# https://archive.stsci.edu/kepler/manuals/Data_Characteristics_Handbook_20110201.pdf
TTS = (0.25 + 0.62*(5 - TIMSLICE))/86400.0
TIME0CORR_TS =  TIME0 - TIMECORR0 + TTS

#t0 = t['TIME'][0] - time_correction[0] + 2454833

jd = tbl['TIME'].data  + tbl.meta['BJDREFI'] + tbl.meta['BJDREFF'] - tbl['TIMECORR'].data
jd_tts = jd + TTS

print("\n-----")
print(f"LC_START     = {LC_START}    (mid point of first cadence in MJD)")
print(f"LC_START_JD  = {LC_START_JD} (mid point of first cadence in JD)")
print("")
print(f"TSTART       = {TSTART}      (observation start time in BJD-BJDREF)")
print(f"TSTART_BJD   = {TSTART_BJD}  (observation start time in BJD)")
print(f"TSTART_CAL   = {TSTART_CAL}  (observation start time as calander date)")
print("")
print(f"TIME0        = {TIME0}       (first time value in BJD)")
print(f"TIMECORR0    = {TIMECORR0}   (first time correction value")
print(f"TIME0CORR    = {TIME0CORR}   (first time - first time correction)")
print(f"TIME0CORR_TS = {TIME0CORR_TS} (first time - first time correction + t_slice correction)")

print(f"TIMSLICE     = {TIMSLICE}    (time-slice readout sequence section)")
print(f"TTS          = {TTS}         (computed time slice offset)")

# Given that this is zero, LC_START_JD does not have time slice correction added
print("\nLC_START_JD - TIME0CORR = {}".format(LC_START_JD - TIME0CORR))

print("-----\n")

# https://gist.github.com/jiffyclub/1294443#file-jdutil-py-L119
def jd_to_date(jd):
    """
    Convert Julian Day to date.
    
    Algorithm from 'Practical Astronomy with your Calculator or Spreadsheet', 
        4th ed., Duffet-Smith and Zwart, 2011.

    Parameters
    ----------
    jd : float
        Julian Day
        
    Returns
    -------
    year : int
        Year as integer. Years preceding 1 A.D. should be 0 or negative.
        The year before 1 A.D. is 0, 10 B.C. is year -9.
        
    month : int
        Month as integer, Jan = 1, Feb. = 2, etc.
    
    day : float
        Day, may contain fractional part.
        
    Examples
    --------
    Convert Julian Day 2446113.75 to year, month, and day.
    
    >>> jd_to_date(2446113.75)
    (1985, 2, 17.25)
    
    """
    import math
    jd = jd + 0.5
    
    F, I = math.modf(jd)
    I = int(I)
    
    A = math.trunc((I - 1867216.25)/36524.25)
    
    if I > 2299160:
        B = I + 1 + A - math.trunc(A / 4.)
    else:
        B = I
        
    C = B + 1524
    
    D = math.trunc((C - 122.1) / 365.25)
    
    E = math.trunc(365.25 * D)
    
    G = math.trunc((C - E) / 30.6001)
    
    day = C - E + F - math.trunc(30.6001 * G)
    
    if G < 13.5:
        month = G - 1
    else:
        month = G - 13
        
    if month > 2.5:
        year = D - 4716
    else:
        year = D - 4715
        
    return year, month, day


def jd_to_iso(jd):
    import math

    ymd = jd_to_date(jd)
    #ymd = jd_to_date(LC_START_JD)
    y = ymd[0]
    m = ymd[1]
    d = math.floor(ymd[2])

    fd = ymd[2] - math.floor(ymd[2])

    fh = 24*fd
    H = math.floor(fh)

    fm = 60*(fh - H)
    M = math.floor(fm)

    fs = 60*(fm - M)
    S = math.floor(fs)
    
    fn = 1e9*(fs - S)
    N = math.floor(fn)

    #print(y, m, d, H, M, S, N)
    return "{0:4d}-{1:02d}-{2:02d}T{3:02d}:{4:02d}:{5:02d}.{6:09d}Z".format(y, m, d, H, M, S, N)

TIME0CORR_CAL    = jd_to_iso(TIME0CORR)
TIME0CORR_TS_CAL = jd_to_iso(TIME0CORR_TS)
LC_START_CAL     = jd_to_iso(LC_START_JD)

print(f"DATE-OBS         = {tbl.meta['DATE-OBS']} (observation start time)")
print(f"LC_START_CAL     = {LC_START_CAL} (mid point of first cadence)")
print(f"TIME0CORR_CAL    = {TIME0CORR_CAL} (first time value - TIMECORR)")
print(f"TIME0CORR_TS_CAL = {TIME0CORR_TS_CAL} (first time value - TIMECORR + TTS)")
#print(tbl.meta['DATE-END'])

#for key, value in t.meta.items():
#    print(f'{key} = {value}')

#from astropy.time import Time
#t = Time('130.0', format='tdb')
#print(tm)

#t.write('/tmp/a.csv', format='csv')