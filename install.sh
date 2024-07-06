#!/bin/bash

function version_gt() { test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"; }

ZYNTHODIR=`pwd`
echo "[INSTALL] User: $USER, zynthomania dir: $ZYNTHODIR"

set -e

# Node -prefer nvm
if [[ -v NVM_DIR ]]; then
  if ! [[ -x $NVM_DIR/nvm.sh ]]; then
    echo "[INSTALL] enabling executable permissions to nvm script..."
    chmod +x $NVM_DIR/nvm.sh
  fi
  source $NVM_DIR/nvm.sh
  NODE_PATH=`nvm which current`
elif [ -f /usr/bin/node ]; then
  NODE_PATH="/usr/bin/node"
else
  echo "[INSTALL] Installing node..\n";
  sudo apt-get install -y nodejs npm
  NODE_PATH="/usr/bin/node"
fi

echo "[INSTALL] Node.js found on $NODE_PATH"

NODE_VER=`$NODE_PATH -v`
if version_gt "16.0.0" "$NODE_VER"; then
  echo "[INSTALL] Node version '$NODE_VER' seems to be under 16. please install node.js (nodejs) v16 or higher.\n";
  exit 1;
fi

# Node.js package manager (npm)
if ! command -v npm &> /dev/null
then
  echo "[INSTALL] Installing NPM...";
  sudo apt install npm
fi

# JackDaemon
if [ ! -f /usr/bin/jackd ]; then
  echo "[INSTALL] Installing jack...\n";
  sudo apt-get install --no-recommends jackd2
  sudo /sbin/setcap cap_ipc_lock,cap_sys_nice=ep /usr/bin/jackd
fi

echo "[INSTALL] Installing/updating dependencies...\n";
sudo apt-get install -yq git perl libjson-perl libasound2-dev

# submodules check
if [[ -f $ZYNTHODIR/configure.pl ]]; then
  echo "[INSTALL] missing sysjack modules. updating modules."
  git submodule update --init
fi

# install everything
echo "[INSTALL] Installing KNOT dependencies..."
cd app/knot
npm install
echo "[INSTALL] Installing Zynthomania dependencies..."
cd ..
npm install
echo "[INSTALL] Dependencies installed."
cd ..

# copies/overrides service.in for zynthomania and zynaddsubfx
echo "[INSTALL] Creating sysjack configuration..."
cp install/*.service.in sysjack/src/

INSTALL=$(sed -e "s/USERNAME/${USER}/g" -e "s#ZYNTHODIR#${ZYNTHODIR}#g" -e "s#NODEJS#${NODE_PATH}#g" ./install/default.json)
echo "$INSTALL" 1> install.json
echo "[INSTALL] Done."

# Zynthomania default cartridge
echo "[INSTALL] Creating default cartridge..."
if [[ ! -d $HOME/.zmania ]]; then 
  mkdir -p $HOME/.zmania
fi

if [[ ! -d $HOME/.zmania ]]; then 
  echo "[INSTALL] ERROR: could not create directory $HOME/.zmania";
  exit 1
fi

if [[ ! -f $HOME/.zmania/config.json ]]; then
  ./install/create-cartridge.sh $HOME/.zmania install.json
else
  read -p "Override ${HOME}/.zmania/config.json? (y)es, any other key no:" answer
  if [[ answer =~ /[yY]/ ]]; then
    rm $HOME/.zmania/config.json
    ./install/create-cartridge.sh $HOME/.zmania install.json
  fi
fi

rm install.json
echo "[INSTALL] Done."

# Zynthomania utils
if ! [[ -f $HOME/.zmania/zmania.source ]]; then
  echo "[INSTALL] Installing source helpers..."

  cp ./install/zmania.source $HOME/.zmania
  SOURCE="/home/${USER}/.zmania/zmania.source"

  echo "export ZYNTHO_DIR=${ZYNTHODIR}" >> $SOURCE
  chmod +x $SOURCE
  source $SOURCE

  if ! grep zmania $HOME/.bashrc; then
    echo "source /home/${USER}/.zmania/zmania.source" >> $HOME/.bashrc
  fi
fi
