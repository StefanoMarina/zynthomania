# OSC Cookbook

## OSC commands

Some OSC commands are presented here. KNOT notation is used:

| Symbol | Meaning | Usage Example|
|:------:|:--------------:|:------|
|   i   | Integer | /part0/PVolume **64** | 
|   s   | String  | /zmania/load_xiz 0 **'/home/pi/my_instrument.xiz'** | 
|   b   | Blob    | /sysefx0/paste **'base64;SGVsbG8gV29ybGQ='** |
|   f   | Float   | /part0/Volume **0.40** |
|   T   | True    | /part0/Penabled **T** |
|   F   | False   | /part0/Penabled **F** |

An OSC message is but a path and some parameters. An OSC **bundle** is a bunch of commands
send together, expecting to be handled simultaneusly but in non-guaranteed order.

write ``zynaddsubfx -D=output.xml`` or ``zynaddsubfx -d=output.json`` for a list of zynaddsubfx's osc commands. That list is huge!!

Note: There are multiple versions of the same control. For example, ``/part0/Volume`` takes a float,
``/part0/Pvolume`` takes a integer, where 0 is minimum and 127 is max. As a general rule, paths with 'P' in their
last element take either an integer or the T/F boolean pair.

Plus, KNOT allows the following special characters:

| Keyword | Meaning |
|:------:|:--------:|
| ${val}  | Value as specified by the fader |
| ${ch}   | Channel as in 0-15 |
| ${CH}   | Channel as in 1-16 |
| ${sb}   | Status byte |
| ${d1}   | Data 1 byte (CC, note  or MSB)|
| ${d2}   | Data 2 byte (value, velocity or LSB ) |

Refer to the [KNOT Manual](https://github.com/StefanoMarina/knot/blob/main/SYNTAX.md) for more
info.

## General rules

- **All arrays start with 0**: Altough all MIDI/Part id reference is 1-16, in OSC it is actually 0-15. So part 1 
is ``part0``, kit 1 is ``kit0``, etc.
- By default, each part is assigned to a different MIDI channel. If you keep that you can use ``/part${val}`` in your
paths to make bind controls part-sensitive. You can do this trick with everything: i.e ``sysefx${ch}`` will trigger a system efx with the corresponding midi
channel (1 to 4). Add all binds under the **all** section.

## Basic stuff

### A single fader/knob for portamento/polyphonic mode

This will bind a single fader/knob to portamento. I'm using CC 16 as an example. Will affect **all** parts
(0-15), if you want a specific part use a 0-15 number or ``${ch}``.

```json
{
  "all" : [
    {
      "cc" : 16,
      "switch": {
        "0" : "/part[0-15]/polyType 0",
        "64": "/part[0-15]/polyType 1",
        "127": "/part[0-15]/polyType 2"
      }
    }
  ]
}
```

**Portamento** is by default bound on CC 65. Let's say you want to auto enable portamento when you enable
"Legato" mode (127):

```json
{
  "all" : [
    {
      "cc" : 16,
      "switch": {
        "0" : "/part[0-15]/polyType 0",
        "64": "/part[0-15]/polyType 1",
        "127": "/part[0-15]/polyType 2"
      }
    },
    {
      "cc" : 16,
      "fader": "bool",
      "max": 126,
      "osc" : "/part0/ctl/portamento.portamento ${-val}"
    }
  ]
}
```

