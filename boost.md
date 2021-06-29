# Audio boost

1. Audio group: sudo usermod -a -G audio pi
2. privileges to audio group
3. sudo /sbin/sysctl -w vm.swappiness=10

# Files and lines to add

## /etc/security/limits.d/audio.conf
@audio - rtprio 80
@audio - memlock unlimited

## /etc/rc.local

echo "performance" > /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
echo "performance" > /sys/devices/system/cpu/cpu1/cpufreq/scaling_governor
echo "performance" > /sys/devices/system/cpu/cpu2/cpufreq/scaling_governor
echo "performance" > /sys/devices/system/cpu/cpu3/cpufreq/scaling_governor

sudo /sbin/sysctl -w vm.swappiness=10
