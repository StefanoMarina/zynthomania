#!/bin/bash

if [[ $# -eq 0 ]]; then
  UNAME=$(logname)
  HOTSPOTFILE="/home/$UNAME/.zmania/hotspot_status"
else
  HOTSPOTFILE="$1/hotspot_status"
fi
  
WLANFILE="/etc/wpa_supplicant/wpa_supplicant-wlan0.conf"

if [[ -f "$HOTSPOTFILE" ]]; then
  echo "Pi already in hotspot mode. delete $HOTSPOTFILE to force."
  exit 0
fi

# Configuration update
if [[ -f "$WLANFILE.hotspot" ]]; then
  echo "Original file found."
  cp "$WLANFILE.hotspot" "$WLANFILE"
else
  echo "Cannot restore without the .hotspot file. Run install-wifi.sh."
  exit 1
fi

cp "$WLANFILE.hotspot" "$WLANFILE"
if [ $? != 0 ]; then
  echo "hotspot configuration copying failed."
  exit 1
fi

echo "Restarting wpa_supplicant..."
systemctl disable wpa_supplicant.service
systemctl enable wpa_supplicant@wlan0.service
rfkill unblock wlan

echo "Disabling dhcpcd services..."
systemctl daemon-reload
systemctl disable --now ifupdown dhcpcd dhcpcd5 isc-dhcp-client isc-dhcp-common rsyslog
systemctl disable --now avahi-daemon libnss-mdns
apt-mark hold avahi-daemon dhcpcd dhcpcd5 ifupdown isc-dhcp-client isc-dhcp-common libnss-mdns openresolv raspberrypi-net-mods rsyslog

echo "Enabling system..."
systemctl unmask systemd-networkd.service systemd-resolved.service
systemctl enable systemd-networkd.service systemd-resolved.service

echo "Setting $HOTSPOTFILE..."
echo "hotspot" > "$HOTSPOTFILE"

echo '
Please reboot (and cross your fingers)!
'
