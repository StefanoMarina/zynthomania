#!/bin/bash

WLANFILE="/etc/wpa_supplicant/wpa_supplicant-wlan0.conf"

if [[ $1 == "-f" ]]; then
  FORCED=1
else
  FORCED=0
fi

#check systemctl status
status=$(systemctl is-active dhcpcd)

if [[ $FORCED == 0 && "$status" == "active" ]]; then
  echo "Pi not in hotspot mode. pass -f to force"
  exit 0
fi

# Configuration update
if [[ -f "$WLANFILE.original" ]]; then
  echo "Original file found."
  cp "$WLANFILE.original" "$WLANFILE"
else
  echo "Cannot restore without the .original file. Run install-wifi.sh."
  exit 1
fi

cp "$WLANFILE.original" "$WLANFILE"
if [ $? != 0 ]; then
  echo "original configuration copying failed."
  exit 1
fi

echo "Disabling system. THIS WILL CLOSE ANY CONNECTIONS!!"
systemctl disable systemd-networkd.service systemd-resolved.service
systemctl mask systemd-networkd.service systemd-resolved.service

echo "Restoring dhcpcd services..."

apt-mark unhold avahi-daemon dhcpcd dhcpcd5 ifupdown isc-dhcp-client isc-dhcp-common libnss-mdns openresolv raspberrypi-net-mods rsyslog
SYSS="libnss-mdns avahi-daemon rsyslog isc-dhcp-common isc-dhcp-client dhcpcd5 dhcpcd ifupdown"
for systemService in $SYSS; do
  found=$(systemctl list-unit-files | grep -e "^$systemService.service")
  if [ "$found" != "" ]; then
   echo "Found service $systemService. enabling..."
   systemctl enable $systemService
  fi
done

systemctl daemon-reload

echo "Restarting wpa_supplicant..."
systemctl disable wpa_supplicant.service
systemctl enable wpa_supplicant



