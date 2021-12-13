# Zynthomania

## Features

- ZynAddSubFX, one of the most heavy-duty synths out there;
- Simplified JACKD control as a system process;
- Mobile-first web interface: manage everything from your device;
- Extended midi binding engine: you can now bind multiple controls, even shell scripts, in any way you want. Control your raspberry from your midi controller;
- Dry/Route FX: put some global FX and automatically route any similar instrument fx to your choice!
- Unified ADSR: sync up to 5 ADSR (volume, cutoff, amplitude, cutoff values, amplitude values) to just 5 controls, sensible to channel;
- Extended sessions: customize midi binds just by selecting a session, a keyboard or even an instrument.

## Requirements

### Operating system

Zynthomania has been tested on a raspberry pi3b and a raspberry pi4. Nothing stops
you from trying on "lower" models.

This is not a compatibility issue, but if you want a good live response you need
to install **low latency kernels**. To find out if yours kernels are realtime, type ``uname -a`` on your raspberry pi shell.
if PREEMPT is present in the name of your operating system, you have
low latency kernels. If not, you can [try to build one](https://github.com/dddomin3/DSPi) instead.

Give a chance to the [64 bit edition of Raspberry OS](https://downloads.raspberrypi.org/raspios_lite_arm64/images/), as of 5.10 Raspberry Pi OS is pre-built for low latency.

Also, you may want to give a boost by using **perfomance mode** for pi's processors. On pi.os 5.10<, add

```bash
echo "performance" > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
echo "performance" > /sys/devices/system/cpu/cpu1/cpufreq/scaling_governor
echo "performance" > /sys/devices/system/cpu/cpu2/cpufreq/scaling_governor
echo "performance" > /sys/devices/system/cpu/cpu3/cpufreq/scaling_governor
```

on /etc/bash.rc to set performance scaling governor. Keep in mind that this will stress more your pi
and requires more power (I think).

### Audio card
This project is set to use linux' standard on low latency audio, the JACK server. I use my own script,
sysjack, to ease configuration.

However, no matter how hard I tried, I can't seem to run JACK with the pi's default audio card. if you want
to use ALSA with zynaddsubfx, you'll just have to change the default output port. 

### MIDI devices

I will use ALSA for midi, instead, as jack midi is less straightforeward and requires more apps and headaches. This
is unfortunately not as easy as audio to change, unless you know a bit of linux shell and want to get your hands dirty
with node.js code.

The realtime midi library is used by the [midi module](https://www.npmjs.com/package/midi). Note that some controllers,
such as my Impact LX25+, are not handled correctly: altough amidi shows all midi messages, the node.js midi module does not
seem to read some of the buttons. Let me know how it goes with yours!

### Flash card and usb card

Zynthomania is meant to be used with a **cartridge** approach: the sd card should be read-only FS, so you can plug off without
fear of losing data (as any real keyboard), and store/load anything on a usb stick (cartridge).

This is an optional step: by default, Zynthomania will put his "base cartridge" on .zmania under user's home. Instructions are
given separately as how to lock your system read-only.

### Connectivity

Since the whole idea is to replace GUI with a web page, either you must be able to connect to the raspberry or the raspberry must be
connected to a lan port.

wifi is another resource-eater, so if you feel like you don't need zmania's interface, turn off the wifi!

# Installation

## Operating system
Follow the links above to get a realtime kernel OS or to build a new one.
make sure you enable ssh, do ``sudo raspi-config`` and enable SSH server.

### Running headless
You may experience some problems when trying to run raspberry os without a monitor. One thing that helped me was
forcing hdmi mode.

If your pi doesn't run without a monitor, set this into ``/boot/config.txt``:

```
hdmi_group=1
hdmi_mode=1
hdmi_force_hotplug=1
```

## Node.js
First thing first, let's install node.js, version 16 or better. I reccomend using [**nvm**](https://github.com/nvm-sh/nvm)
as it allows simpler and better handling of node.js versions:

```shell
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 16
nvm use 16
```
or
```shell
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 16
nvm use 16
```
16.4.2 it's the minimum version required, better should be ok.


## Zynthomania

Clone this repo:

```bash
sudo apt-get install git
git clone --recurse-submodules  ~/zynthomania
```
the --recurse submodule will install KNOT and SYSJACK under the zynthomania dir in HOME.

### Build ZynAddSubFX
Now, as a first step, we will build ZynAddSubFX from scratch, using information found on this
[Great blog entry](https://lucidbeaming.com/blog/setting-up-a-raspberry-pi-3-to-run-zynaddsubfx-in-a-headless-configuration/):

```bash
cd ~/zynthomania/install
chmod +x *.sh
chmod +x install_synth.sh
./install_synth.sh
```

### Build Zynthomania
After this, we may install the Zynthomania server:

```bash
cd ~/zynthomania
chmod +x install.sh
chmod +x install/*.sh
./install.sh
```

This will enable the install scripts and launch the installation. Do **not** launch it as sudo, as the script
will need to check out the username and home dir. ``sudo`` will be executed when neeeded, so some user interaction
is required.

The install script will, in order:
1. Check out/install your node.js version
2. Install JACK and perl, with some requirements (for sysjack). Note that this will require you to **accept realtime scheduling**.
3. Force realtime schedule on jackd by doing ``sudo /sbin/setcap cap_ipc_lock,cap_sys_nice=ep /usr/bin/jackd``;
4. Check out if the modules are downloaded correctly;
5. Build dependencies for zynthomania and knot;
6. Prepare a cartridge under .zmania and create a default configuration;
7. Add some shell commands through zmania.source.

## Configuration
Make sure you have your audio card plugged in.

do ``source ~/.bashrc`` to enable the new commands. you can now input ``zyn-configure-jack`` as a command to configure JACK server.

A lot of questions on configuring stuff. After selecting your audio card, you can just press 'ENTER' until everything is ok.

Some advices:
- Buffer size is the queen of 'latency settings'. Try to find the lowest number possibile, from 128 to lower (not 0, unfortunately);
- If you are using an USB audio card, as I hope, the [JACKD manual](https://linux.die.net/man/1/jackd) recommends using 3 playback latency periods instead of 2;
- Use playback only if you don't plan to put a mic or use input, half duplex seems more stable and less-resource-heavy;
- You can skip the 'set as default ALSA card'. It is useful if you plan to add more plugins or functions to your pi as it identifies the sysjack server;

if the config is created, you are ready-ish. run ``zyn-update-services`` to create 3 systemd services: JACKD, ZynAddSubFX and Zynthomania.
They will be launched at startup, and restart if crash, no other hassle needed.

If you want to change the configuration, just run ``zyn-configure-jack`` first and ``zyn-update-services`` then.

After this, reboot. Check if systems are running: 

```bash
sudo systemctl status jackd | grep Active
sudo systemctl status zynaddsubfx | grep Active
sudo systemctl status zynthomania | grep Active
```
Check out the logs or open an issue if something is not working.

### Accessing zynthomania
Zynthomania control is due via web interface. You will have to connect to the pi via browser.

First, grab your **pi's ip address**, under pi's shell, do ``ifconfig | grep wlan -A 2`` 
or ``ifconfig | grep eth -A 2`` if you are using LAN cable.

if your raspberry pi is connected to a local network, run the following address on any browser under the same net:

```
http://{your\_raspberry\_address}
```

Replace *your\_raspberry\_address* with your real address. Zynthomania should start!

### Enable midi device

If the zynthomania interface loads, go to "System" > "MIDI" and click on your MIDI device name (may be multiple).
This will plug your device to Zynthomania. You're ready to go!

### Testing, testing

Try out some sounds, expecially pads (they are cpu consuming). If there is too much latency and/or sound quality is
bad (xruns), run ``zyn-configure-jack`` or edit config.json, tweak some params and apply with ``zyn-update-services``
until you find your comfort zone. If you haven't tried, try to apply the cpu perfomance and check it out.

### Setting up startup

Zynthomania will load any filename with 'default' as a name. So default.xmz under the session/ folder will be loaded as
the default session, default.json under binds/ will be loaded as the default midi bind, default.osc under scripts/ will
be launched after everything is loaded.

If you want a **specific midi binding for your keyboard**, create a midi bind then name it after your keyboard name. Use
the **EXACT** (case sensitive) name that appears under System > MIDI. The binding will be loaded automatically everytime
you plug your device into zynthomania.

I.E. if your controller shows up as "AKAI Mono II MIDI Input" create a file under binds/ called "AKAI Mono II MIDI Input.json".

Check out the manual and KNOT's OSC syntax for major details.

## Advanced config

The configuration file is found on .zmania/config.json. it is a JSON file, which has a really simple syntax ([see here](https://www.tutorialspoint.com/json/json_syntax.htm)). 

If you want to do manual changes to jackd, zynaddsubfx or zymthomania startup, do a backup copy of config.json first - you never know! - then run ``zyn-update-services`` to apply your changes.

Let's see some of the properties: 

| Property | Type | Meaning |
|:---:|:----:|:----|
| cartrigde_dir | path | External usb stick cartridge dir. This is meaningful only on the core .zmania dir.|
| fallback_dir  | path | On cartridge mode, this is the cartridge directory that will be used if the cartridge is missing.|
| bank_dir | path | zynaddsubfx default banks directory. |
| user | string | default user |
| dry  | Array | JSON list of effects to be turned down when recognized. |
| route| Object |see below |
| uadsr | Object |unified adsr configuration; see below |
| services Object | sysjack configuration |

For dry mode, valid entries are *Reverb*, *Echo*, *Chorus*, *Phaser*, *Alienwah*, *EQ*, *DynamicFilter*, *Distorsion*.

Route configuration: 

| Property | Type  | Meaning |
|:---:|:----:|:----|
| send | number| General send to system fx when a matching part fx is found |
| fx | Array | similar to *dry*, a list of fx names that should be routed |

UADSR configuration:

| Property | Type  | Meaning |
|:---:|:----:|:----|
| mode | string| uadsr mode. can be 'uadsr4', 'uadsr8', 'none' |
| uadsr4\_binds | Array| 4 numbers representing (in order) CC to be used for A,D,S,R and switch |
| uadsr8\_binds | Array| 8 numbers representing ADSR for volume and cutoff |

### Services 
Services configuration is detailed in the sysjack manual. The following additions are made:

Services/User:

| Property | Type  | Meaning |
|:---:|:----:|:----|
| zyn\_oscillator\_size| integer | zynaddsubfx oscillator size on startup |
| osc\_local\_port | integer | on which port zynthomania will listen. zmania OSC are accepted.
| zyn\_osc\_port  | integer | zynaddsubfx OSC port. messages sent here will ignore zmania OSC.
| remote\_port    | integer | which port to listen for zynthomania. default is https' 80. |

Services/Unit:

The zynaddsubfx and zynthomania units are listed here. if you want to change their shell commands,
you can change them here.

**NOTE** please refer to sysjack approach, put values under "user" and use ``{user/myvalue}`` in the unit path.
Some of those values, i.e. *zyn\_osc\_port*, are used by zynthomania to match configuration.

## Danger zone

### Running pi as an access point

If you want to bring your synth along with you, your'e gonna need to have the pi as
an access point, so you don't need a router or internet to connect to zynthomania.

If you do not plan to move your synth outside your house/studio, just consider either disabling ethernet o wireless lan,
as they both consume resources required by ZynAddSubFX.

That being said, after pain and tears, I gave up the hostapd/dnsmasq apporach and found a **much easier** way
of turning the pi into an access point. Following [the best guide available](https://raspberrypi.stackexchange.com/questions/88214/setting-up-a-raspberry-pi-as-an-access-point-the-easy-way)
, I've created a simple script to help switch from dhcp to systemd network and create a simple access point.

**Important Stuff about this**:
- You need to do this from a screen, as changing the network configuration will break any remote connection. 
- This is no trivial task, so be sure to know what you're doing.

That being said, run this **after** you installed zynthomania:

```shell
cd ~/zynthomania/install
chmod +x install_wifi.sh
sudo ./install_wifi.sh
```

And answer all the questions.

If your internet breaks up forever and you don't know what to do,
keep in mind that A) I warned you B) any modified file has a backup copy on .zmania home directory.

Note that the script does not remove unused packages, if everything works and you are satisfied, do:

```shell
sudo apt --autoremove purge ifupdown dhcpcd dhcpcd5 isc-dhcp-client isc-dhcp-common rsyslog
sudo rm -r /etc/network /etc/dhcp
sudo apt --autoremove purge avahi-daemon
```
