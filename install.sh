#!/bin/bash

function version_gt() { test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"; }

ZYNTHODIR=`pwd`
echo "User: $USER, zynthomania dir: $ZYNTHODIR"

set -e

# Node -prefer nvm
if [[ -v NVM_DIR ]]; then
  if ! [[ -x $NVM_DIR/nvm.sh ]]; then
    echo "enabling executable permissions to nvm script..."
    chmod +x $NVM_DIR/nvm.sh
  fi
  source $NVM_DIR/nvm.sh
  NODE_PATH=`nvm which current`
elif [ -f /usr/bin/node ]; then
  NODE_PATH="/usr/bin/node"
else
  echo "Installing node..\n";
  sudo apt-get install -y nodejs npm
  NODE_PATH="/usr/bin/node"
fi

echo "Node.js found on $NODE_PATH"

NODE_VER=`$NODE_PATH -v`
if version_gt "16.0.0" "$NODE_VER"; then
  echo "Node version '$NODE_VER' seems to be under 16. please install node.js (nodejs) v16 or higher.\n";
  exit 1;
fi

# JackDaemon
if [ ! -f /usr/bin/jackd ]; then
  echo "Installing jack...\n";
  sudo apt-get install --no-recommends jackd2
  sudo /sbin/setcap cap_ipc_lock,cap_sys_nice=ep /usr/bin/jackd
fi

echo "Installing/updating dependencies...\n";
sudo apt-get install -yq git perl libjson-perl libasound2-dev

# submodules check
if [[ -f $ZYNTHODIR/configure.pl ]]; then
  echo "missing sysjack modules. updating modules."
  git submodule update --init
fi

# install everything
cd app/knot
npm install
cd ..
npm install
cd ..

# copies/overrides service.in for zynthomania and zynaddsubfx
cp -pa install/*.service.in sysjack/src/

INSTALL=$(sed -e "s/USERNAME/${USER}/g" -e "s#ZYNTHODIR#${ZYNTHODIR}#g" -e "s#NODEJS#${NODE_PATH}#g" ./install/default.json)
echo "$INSTALL" 1> install.json

# Zynthomania default cartridge
if [[ ! -d ~/.zmania ]]; then 
  mkdir -p ~/.zmania
fi

if [[ ! -f ~/.zmania/config.json ]]; then
  ./install/create-cartridge.sh ~/.zmania install.json
else
  read -p "Override ${HOME}/.zmania/config.json? (y)es, any other key exit:" answer
  if [[ answer =~ /[yY]/ ]]; then
    rm ~/.zmania/config.json
    ./install/create-cartridge.sh ~/.zmania install.json
  fi
fi

rm install.json

# Zynthomania utils
if ! [[ -f ~/.zmania/zmania.source ]]; then
  echo "Installing source helpers..."

  cp ./install/zmania.source ~/.zmania
  SOURCE="/home/${USER}/.zmania/zmania.source"

  echo "export ZYNTHO_DIR=${ZYNTHODIR}" >> $SOURCE
  chmod +x $SOURCE
  source $SOURCE

  if ! grep zmania ~/.bashrc; then
    echo "source /home/${USER}/.zmania/zmania.source" >> ~/.bashrc
  fi
fi
