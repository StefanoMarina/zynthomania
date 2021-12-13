#!/bin/bash

safe_replace_file($filename, $path) {
  if [[ -f "$path/$filename" ]]; then
    cp "$path/$filename" ~/.zmania/"$filename".`date +%s`.bak
  fi
  mv ./$filename $path
}

echo '
Zynthomania wifi-access installation script utility.
please refer to README.md for more details.

DO NOT RUN IF:
- YOU DO NOT KNOW WHAT YOU ARE DOING;
- You have a special configuration for your wifi and do not wish to change it;
- You are currently on a ssh or remote shell.
- You do not have superuser privileges. run as sudo!
- You need to do other stuff; this script will reboot the pi.

Please run this script only from direct monitoring.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
'

read -p 'If you agree, write (y)es or any other key to skip.' ANSWER
if [[ "$ANSWER" != "y" ]]; then
  exit
fi

# name
ACCESSNAME="zynthomania"

read -p "Input access point name (default is zynthomania):" ACCESSNAME

if [[ "" == "$ACCESSNAME" ]]; then
  ACCESSNAME="zynthomania"
fi
echo "Access point name will be $ACCESSNAME."

# country
COUNTRY=""

while ! [[ "$COUNTRY" =~ [A-Z]{2,} ]]; do
  read -p "Country (2 letters, i.e. US, UK, IT, DE, GR, UPPER CASE): " COUNTRY
done
echo "Country will be $COUNTRY."

# address
ROUTER=""

while ! [[ "$ROUTER" =~ ^([0-9]{1,3}\.){3}([0-9]{1,3})$ ]]; do
  read -p "Enter your desired ip address for the pi. Default is 192.168.2.1: " ROUTER
  if [[ "" == "$ROUTER" ]]; then
    ROUTER="192.168.2.1"
  fi
done

# range
VALUE="${BASH_REMATCH[2]}"
ADDRANGE=`expr $VALUE + 23`;

echo "Address is $ROUTER and range will be ${ADDRANGE}."

# password
NEWPWD="a"
AGAINPWD="b"

while [[ "$NEWPWD" != "$AGAINPWD" ]]; do
  read -sp "Input access point password: " NEWPWD
  echo ""
  read -sp "Input password again: " AGAINPWD
  echo ""
done

echo "Configuration:
Access point SSID: $ACCESSNAME
Country: $COUNTRY
Access point address: $ROUTER
IPs up to: $ADDRANGE
Password: $NEWPWD
"
read -p "Is this ok? (y)es or abort:" ANSWER

if ! [[ "$ANSWER" == "y" ]]; then
  exit
fi

sed -e "s/__SSIDNAME/${ACCESSNAME}/" -e "s/__COUNTRY/${COUNTRY}/" -e "s/__PASSWORD/${NEWPWD}/" wpa_supplicant-wlan0.source > wpa_supplicant-wlan0.conf

safe_replace_file ("wpa_supplicant-wlan0.conf", "/etc")
chmod 600 /etc/wpa_supplicant/wpa_supplicant-wlan0.conf

sed -e "s/__ROUTER/${ROUTER}/" -e "s/__RANGE/${ADDRANGE}/" 08-wlan0.source > 08-wlan0.network
safe_replace_file ("08-wlan0.network", "/etc/systemd/network")

read -p "Do you want to use your ethernet to connect the pi to the internet? (y)es or no:" ANSWER

if [[ "$ANSWER" == "y" ]]; then
  safe_replace_file ('04-eth0.network', "/etc/systemd/network")
else
  echo "you can always copy 04-eth0.network file to /etc/systemd/network."
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

echo "Installing/enabling systemd-resolve service and network service..."
apt install libnss-resolve
ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf

echo "Enabling system..."
systemctl enable systemd-networkd.service systemd-resolved.service

echo '
Please reboot (and cross your fingers)!
'