#!/bin/bash

UNAME=$(logname)
HOTSPOTFILE="/home/$UNAME/.zmania/hotspot_status"
WLANFILE="/etc/wpa_supplicant/wpa_supplicant-wlan0.conf"


if [[ -f "$HOTSPOTFILE" ]]; then
  echo "Hotspot status detected."
else
  echo "Hotspot status not detected. use touch $HOTSPOTFILE to force"
  exit
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

echo "Removing hotspot status..."
rm $HOTSPOTFILE




