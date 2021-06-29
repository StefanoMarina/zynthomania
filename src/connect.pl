#!/bin/perl
use warnings;
use strict;
use Zyntho::Utils;

# Autoconnect service
# waits for zynsubfx to be plugged in
# then waits for an usb device
# if no device is pl

my $DEFAULT_WAIT = 5;

#
# Loop 1
# Waits for ZynAddSubFx to be plugged in
#

my $port_ready = `aconnect -l| grep ZynAddSubFX`;
$port_ready = length($port_ready);

my $time_spent = 0;

# Aspetta che sia pronta la porta
while (!$port_ready && $time_spent < 30) {
  print "<6> Waiting for the synth port to open...\n";
  sleep $DEFAULT_WAIT;
  $time_spent += $DEFAULT_WAIT;
  my $port_ready = `aconnect -l| grep ZynAddSubFX`;
  $port_ready = length($port_ready);

  last if $port_ready;
}

die "<3> synth port waiting timeout" unless $port_ready;

$time_spent = 0;

# Plug loop
my @failed_devices = ();

while (1) {
  
  if (Zyntho::Utils::isSynthConnected()) {
    # sleep
    sleep $DEFAULT_WAIT;
    next;
  }
  
  my @midi_devices = Zyntho::Utils::createDeviceList();
  printf "<6>Connect: found " . scalar(@midi_devices) . " device(s).\n";
  
  # removes any previously failed device.
  foreach my $unsupported_device (@failed_devices) {
    map {delete $midi_devices[$_] if $_ eq $unsupported_device } @midi_devices;
  }
  
  printf "<6>Connect: found " . scalar(@midi_devices) . " supported device(s).\n";
  if (scalar (@midi_devices) == 0) {
    sleep $DEFAULT_WAIT;
    printf "<6>Connect: looking for midi.\n";
    next;
  }
  
  # Connection
  foreach my $device (@midi_devices) {
    printf "<6> Connecting to $device...\n";
    system  ("aconnect '$device':0 'ZynAddSubFX':0");
    if ($@) {
     printf "<3> Connection to $device FAILED.\n";
     push (@failed_devices, $device);
    }
  }
  
  sleep $DEFAULT_WAIT;
}
