#!/bin/bash

export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/dbus/system_bus_socket

if pgrep zynaddsubfx
 then
 echo "<5> Zynaddsubfx is already singing."
 exit 0
 else
 zynaddsubfx -U -A=0 -o 512 -r 48000 -b 512 -I alsa -O alsa -P 7777 -L "/usr/local/share/zynaddsubfx/banks/Choir and Voice/0034-Slow Morph_Choir.xiz" &
 sleep 4

   if pgrep zynaddsubfx
   then
   echo "<6> Zyn is singing."
   exit 0
   else
   echo "<3> Zyn blorked. Epic Fail."
   exit 1
   fi
fi
