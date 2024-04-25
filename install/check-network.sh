#!/bin/bash

#
# This will check if zyntho is connected to a router.
# If not, it will restore hotspot mode and auto reboot.
# Useful if you bring your zynthomania pi around and forget to change
# the web address!
#

INSTALL_DIR=$(dirname "$0")

if [[ $(ip route) ]]; then
  echo "Everything is ok - no need to force hotspot mode."
else
  echo "Reverting to hotspot."
  #run set hotspot
  $INSTALL_DIR/set-hotspot.sh
  reboot
fi

