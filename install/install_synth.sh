#!/bin/bash
ZYN_SOURCE="$HOME/zynaddsubfx"
CURRENT_DIR=`pwd`
echo "Installing required packages...\n"

sudo apt-get --no-install-recommends install jackd2
sudo apt-get install -y a2jmidid autoconf laditools libfltk1.3 libfltk-images1.3 liblo7 libtool libmxml1 premake premake4 cmake-curses-gui libfftw3-dev libmxml-dev zlib1g-dev libjack-jackd2-dev libfltk1.3-dev non-ntk-dev libncurses-dev liblo-dev dssi-dev libjpeg-dev libxpm-dev liblash-compat-dev fontconfig fontconfig-config libfontconfig1-dev libxft-dev libcairo-dev rtirq-init git cmake

if [[ -d "$ZYN_SOURCE" ]]; then
  echo "zynaddsubfx seems to exists already."
  echo "if not, please delete the $ZYN_SOURCE folder."
else
  git clone https://github.com/zynaddsubfx/zynaddsubfx.git $ZYN_SOURCE
fi

cd $ZYN_SOURCE
mkdir -p build
cd build
cmake ..
cmake . -DNoNeonPlease=ON -DBuildOptions_SSE=

echo "ZynAddSubFX is now ready to build.\n"
 
sudo make install
cd $CURRENT_DIR



