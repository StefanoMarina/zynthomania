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

mkdir $1
cp -a ../default_cartridge/* $1/
sed "s#cartridge_dir\"\s*:\s*\"[^\"]\+\"#cartridge_dir\":\"${1}\"#" $CURRENT_CFG > $1/config.json
echo "$CURRENT_CFG updated."
cp $CURRENT_CFG $1/

echo "a copy of $CURRENT_CFG was made on $1. Zynthomania will look for that when loading."
