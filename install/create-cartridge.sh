#!/bin/bash

if [[ $1 == "" ]]; then
  echo "usage: ./create-cartridge.sh [cartrdige-dir] [current-config (optional)]";
  exit 0;
fi

if [[ $2 == "" ]]; then
  CURRENT_CFG="~/.zmania/config.json"
else
  CURRENT_CFG=$2
fi

mkdir -p $1/banks
mkdir -p $1/scripts
mkdir -p $1/binds
mkdir -p $1/sessions
mkdir -p $1/units

sed "s#cartridge_dir\"\s*:\s*\"[^\"]\+\"#cartridge_dir\":\"${1}\"#" $CURRENT_CFG > $1/config.json
echo "$CURRENT_CFG updated."
cp $CURRENT_CFG $1/

echo "a copy of $CURRENT_CFG was made on $1. Zynthomania will look for that when loading."
