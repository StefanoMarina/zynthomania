package Zyntho::Utils;

use strict;
use warnings;


# Creates a midi device list

sub createDeviceList() {
  my @var = `aconnect -o | grep client`;
  my @result = ();
  my $name ="";
  
  foreach my $single (@var) {
    my $first = index ($single, '\'');
    my $last = rindex ($single, '\'');
    my $name = substr($single, $first+1, ($last-1)-$first);
    
    # remove any non-card instrument
    # Seems that only usb instruments have the 'card' flag, but this
    # requires further proof and no documentation available :(
    
    if (index ($single, 'card') > 0) {
      push (@result, $name)
    }
  }
  
  return @result;
}

# Check if 'connected' is written on zynaddsubfx status

sub isSynthConnected() {
  my $query = `aconnect -l | grep ZynAddSubFX -A 1`;
  return (index($query, 'Connected From') > 0);
}

1;
