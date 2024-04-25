#!/bin/bash

source utils.source

echo '
Zynthomania wifi-access installation script utility.
please refer to README.md for more details.

DO NOT RUN IF:
- YOU DO NOT KNOW WHAT YOU ARE DOING;
- You have a special configuration for your wifi and do not wish to change it;
- You are currently on a ssh or remote shell.
- You do not have superuser privileges. run as sudo!
- You need to do other stuff; this script will reboot the pi.

Please run this script only from direct monitoring and sudo.

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

WLANFILE="/etc/wpa_supplicant/wpa_supplicant-wlan0.conf"

if [[ -f "$WLANFILE" ]]; then
  echo "Creating original configuration as $WLANFILE.original"
  cp "$WLANFILE" "$WLANFILE.original"
  if [ $? != 0 ]; then
    echo "The copying failed. you probably do not have admin priviledges. aborting."
    exit 1
  fi
  ## safe_replace_file "wpa_supplicant-wlan0.conf" "/etc/wpa_supplicant"
fi

echo "Creating hotspot configuration.."
mv ./wpa_supplicant-wlan0.conf "$WLANFILE.hotspot"

sed -e "s/__ROUTER/${ROUTER}/" -e "s/__RANGE/${ADDRANGE}/" 08-wlan0.source > 08-wlan0.network
mv 08-wlan0.network /etc/systemd/network
# safe_replace_file "08-wlan0.network" "/etc/systemd/network"

if [[ -f /etc/systemd/network/04-eht0.network ]]; then
  echo "LAN connection found."
else
  read -p "Do you want to use your ethernet to connect the pi to the internet? (y)es or no:" ANSWER

  if [[ "$ANSWER" == "y" ]]; then
    cp 04-eth0.network /etc/systemd/network
    #safe_replace_file '04-eth0.network' "/etc/systemd/network"
  else
    echo "you can always copy 04-eth0.network file to /etc/systemd/network."
  fi
fi

echo "Do you want to install the network checkout system?
This will check if you are connected to a router on dhcp and eventually
restore hotspot.

This is useful only if you shift from hotspost and bring your zyntho device 
around - this will avoid lock you outside of pi if you forget to switch back
to hotspot!

( should any problem arise, mount your microsd into another device and remove 
/etc/systemd/system/net-checker.service ) 
"
read -p "Install network check? (y)es or (n)o:" ANSWER

if [[ "$ANSWER" == "y" ]]; then
  chmod +x check-network.sh
  sed -e "s#COMMAND_LINE#$ZYNTHO_DIR/install/check-network.sh#" net-checker.service.in > net-checker.service
  sudo mv net-checker.service /etc/systemd/system/
  sudo systemctl enable net-checker.service
fi

echo "Installing systemd-resolve service and network service..."
apt install libnss-resolve
ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf

echo "running set-hotspot.sh"
bash ./set-hotspot.sh
