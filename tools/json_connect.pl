#!/usr/bin/perl

## Usage
## json_connect [clientName]
## look for specific client
##

use strict;
use warnings;
use JSON;

my ($clientName) = @ARGV;

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


my $JSON = JSON->new->ascii;

my @rawdata;

@rawdata = `aconnect -lio`;

my $currentID;
my @json = ();
my $name = "";
my $latest_item;

foreach (@rawdata) {
  if ($_ =~ /client (\d+):.*/) {
    $currentID = $1;
    if (defined $clientName && !($_ =~ /$clientName/g)) {
      $currentID = undef;
    }
    next;
  }
  
  next if (not defined $currentID);
  
## I/O definition line
  if ($_ =~ /(\d+) \'([^\']+)\'/){
    my %item = ();
    $latest_item = \%item;
    $item{'plug'} = "$currentID:$1";
    $name = $2;
    $name =~ s/ +$//;
    $item{'name'} = $name;
    
    push @json, \%item;
  } else {
    ## connections
    my $link = $_;
    my @connections = ();
    while ($link =~ /(\d+:\d+)/g) {
        push @connections, $1;
    }
    $latest_item->{'connections'} = \@connections;
  }
}

print JSON->new->utf8->encode(\@json);
