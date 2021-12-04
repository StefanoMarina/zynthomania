# Zynthomania Manual

The web interface is composed by 2 elements: the top bar, for part navigation,
and the main tab.

The top bar is used to navigate **Parts**, while the tab panel will allow various
functions.

Interface is pretty straigthforeward, there are 2 custom components though:

- **Swipeable selections** are always between < >. You can swipe left or right
to select your value, or click on them to make a list selection appear;
- **Knobs** are 3 digit numbers under a black round background. Those controls will
raise by 32 if clicked, or raise/lower by 8 if swiped. Going over 127 resets them to 0.

## Top bar
1. **Favorite** (star icon): this will put your currently selected instrument inside your Favorites' list.
2. **Part selection** is a swipeable select that allows you to set the current part.
3. **Volume and pan knobs** knobs. Remember central panning is 64.
4. **Edit part channel** will allow you to change the current part channel (default is 1:1). This change is saved onto the session and is not general.
5. **Clear part** (waste bin): This will clear and disable the current part. Try to have no more than 2 parts enabled!

### Managing parts
ZynAddSubFX supports up to 16 parts, each one can be bound to a different instrument 
and midi channel. By default, each part is assigned to a channel, so part 1 is channel 1,
etc.

You need to **enable a part** to be able to hear it. This is done automatically by clicking
on the power icon near the 'Disabled' text, or just load an instrument by touching 'Banks',
selecting a bank and then an instrument.

You can change part's default channel by clicking on the edit button on the top bar.

### Related OSC
If using KNOT, remember you can put ${ch} for channel-to-part midi binding.
Any of those OSC, if sent without parameter, will return the value.

|OSC | Value |
|:---|:------|
|/part\[0,15\]/Penabled TF | Enable / Disable part |
|/part\[0,15\]/Prcvchn i   | Set midi channel (1,16) for part |
|/part\[0,15\]/Pvolume i   | Set part volume |
|/part\[0,15\]/Ppanning i   | Set part volume |
|/part\[0,15\]/Pname s   | Set part name|

## Main text

The main text gives info on the current zynthomania activites. It is composed by:
1. Current part id (#01, #02, ecc), or the power on button if the part is disabled;
2. Current Instrument name;
3. An icon on the far right representing REST status.

When doing a REST, The main text will change to moving dots '....' until the server answers.

## Banks

This is the intrument selection panel. On the **left side**, a bank list will be shown. this list is
a combination of zynaddsubfx's default banks, user banks and favorites. 

All cartridge/user banks start with the dollar sign '$'. To add custom banks folder, put them inside
the 'banks' folder in your cartridge.

*Favorites* is always the first choice. Note that the favorites bank is not a real bank: is a list of any instrument you marked as favorite.
To mark an instrument as favorite, load it then click on the star icon on the Top bar. click again to unmark.
You will find the star icon in the Banks list too. You may click on the star icon to remove the favorite status.

Favorite is a .json list saved unto the user folder, so you cannot save favorites if your system is read only and
no cartridge is used. it is a system feature.

### Related OSC
|OSC | Value |
|:---|:------|
|/load_xiz i s | Unofficial - loads xiz. This won't update zynthomania. Parameters are part id and file with full path|
|/zmania/load_xiz i s | Zynthomania's way of loading an instruments. parameters as above.

## FX
ZynAddSubFx sports 8 built-in FX. They can be routed in any way imaginable, similar to a DAW.
Each instrument has some presets and a lot of controls for customization.

There are 3 layers of FX management:
- Part FX: those are the instrument's built in fx and are loaded when you load the instrument. You have up to 3
part fx slots.
- Insert FX: there are 8 slots for effects which can be used as insert fxes.
- System FX: 4 fx slots can be used as classic 'master' effects.

Zynthomania focuses on the 'keyboard' way of handling fx, so insertion effects are disregarded. You can still use
them, but you cannot change them via the ZM interface.

### Routing
As for part effects, they are useful when you work one instrument at a time. But what if you load two instruments,
each with is own Reverb? what if you have a Reverb or a Delay on a master FX and an instruments gets in the way?

Enter Dry and Route mode. Dry mode will automatically turn off (bypass) a Part FX from a list of blacklisted fxes.
This is useful if you want to avoid huge consumption fx such as distortion or reverb, or you have your own external
fxes.

Route mode is more complicated. When an instrument is loaded, ZM will check what System FX you are using. If any system fx
matches a part fx in his type, the part fx is bypassed, and the parts' send to that fx is automatically raised to a number
of your choice. This is good if you want to 'replace' any part fx with your own.

### Dry Panel

The dry panel is pretty straightforeward: Turn on/off any fx you want dried, and click 'apply'. This will apply to
the current instrument and any future instrument you load.

Drying is saved as a global feature.

### Part/System FX
The Part FX is composed by 3 FX panels and the Part to System FX Send.

Each FX panel allows:
- Bypass or not the fx (volume icon);
- Select the fx (swipeable selection);
- Select the preset (the number on the right - touch to advance).

The 4 knobs representing system fx send tells how much you want the part to be send to the system fx.
Touch/Click on 'Send all to Max' if you want to use System FX as insertion.

System FXes do not allow bypass.

System/Part fx are saved as a session feature.

### Route

FX Route panel is similar to the dry panel, only you can set how much a part fx should go to the
routed effect using the knob in the first row.

FX Route is saved as a global feature.

### Sported OSC

I'll be using {FXNAME} as a placeholder for the FX name.

|OSC | Value |
|:---|:------|
|/part\[0-15\]/partefx\[0-2\]/efftype i| sets the FX by using its id (0-8) |
|/part\[0-15\]/Pefxbypass\[0-2\] TF | Enable/Disable bypass on part fx |
|/Psysefxvol\[0-3\]/part\[0-15\] i | Part send to System FX |
|/part\[0-15\]/partefx\[0-2\]/*{FXNAME}*/preset i| Set preset for that part/partefx effect |
|/sysefx\[0-3\]/efftype i| FX id for system fx |
|/sysefx\[0-3\]/*{FXNAME}*/preset i| Set preset for that systemfx effect |

## Binds

Binds are one of the builtin Zynthomania features. ZM uses KNOT to bind. Refer to its manual
if you want to write your own bind file using json. Binds go to the binds/ folder.

Binds work on a **chain principle** - a bind file is loaded, the next bind file will replace any
matching binds. When a chain is removed, the whole list is reparsed, with the exception of the 
instrument bind, which is always the last one.

1. If a default.json bind is present, this will always be the first one. It is loaded on server start.
2. When you plug a MIDI device, any binding file matching its name will automatically be loaded second.
3. Any user loaded bind file is loaded then;
4. If a session is loaded (other than default), any binding file matching the session filename is loaded then;
5. If UADSR is used, the UADSR bindings are loaded;
6. If a binding file with the same filename as the instrument filename is found, it is loaded last.

This seems a lot! Let's put some of those bindings in context.

Let's say you want to bind a single keyboard only, with static bindings - you don't change too much stuff,
you just want to load some instrument. 

1. Create every bind and put them under 'default.json'
2. If you use multiple keyboard, but not all at the same time, do separate bindings.
3. Nothing else necessary.

Let's say you want special bindings - when you load certain instruments, you want your 3-4 trustworthy
buttons to do different things!

1. Create a binding file with the exact filename of the instrument. Remember that zyn's xiz files have a numeric
id on the front.
2. Each time you load that instrument, the bind is automatically done. No other stuff needed!

The same principles apply if you have i.e. 1 session file per song. Just create a binding with the session name.

Now let's say you want to use your 8 knobs to change dynamically 8 specific parameters for each of the 8 fx. unless
you get 64 knobs, you need to rethink your binds. Here is how you do it:

- Create a binding file for each of the fxes;
- You can now add/remove your bindings from the Binds/Chain menu.
- If you want to this live, you can use zmania's ``/zmania/bind/load`` and ``/zmania/bind/remove`` osc to bind this on a default control!

### Chain

This panel shows the current chain. click on any loaded bind to remove it.

### File

This shows a list of the cartridge's ``bind`` directory.

- Click/Touch on 'add to chain' if you want to add as a custom chain;
- Click on 'Edit' to open it as the 'session' bind;
- Click on 'Save' (if available) to save it. Select a filename or 'New file' first.

### Edit

This is a small binding editor. Any bind is added to the session bind list. Refer to KNOT's
manual for more detailed instructions.

- *Channel* : set the binding channel or 'all';
- *Binding source*: you can select a note or a cc. Select then the note's pitch or the cc's number;
- *Binding type*: All types supported by knot. 

For **triggers**, type the CC value. For **switches** it is a bit more complex.

- Press the '+' button to create a new switch entry, a random number will be set;
- Set the CC value and the OSC parameters for the entry;
- Click the 'Update' button when done;
- If you want to remove a switch entry, click on the entry and the waste bin button near the '+'.

Write the osc parameters using the KNOT syntax, separate them with a new line for a bundle:

```
/part${ch}/Penabled T
/part${ch}/Pvolume 127
```
This will, for example, enable and set the volume to the max to a part numbered with the
OG midi channel (0-15, not 1-16). So, if you trigger this on channel 6, part 6 will be affected.

Click 'add' to add this bind to the list or 'Update' to update the current bind. Click on 'Edit'
again to add a new bind.

**Note**: Zynthomania interface does not enable shell scripts, although they are supported. You have
to create a bind file manually for that.
 
### Session

This is the session bind's list. It will show a summery of the session's current bindings.

Note that those bindings will be **automatically saved** on the binds folder when you save
your session.

The table will show:
- Each entry's (Ch)annell;
- The event, summarized as event type (Trigger, Fader, Switch), event source (CC or noteon) and
event value;
- Edit toolbar, where you can edit the current bind or remove it.

### Sported OSC

|OSC | Value |
|:---|:------|
|/zmania/bind/load s| Add a bind to the chain
|/zmania/bind/remove s | Remove a bind from the chain

## Script

Zynthomania allows OSC scripts to be readed and parsed. This is useful if you need big packages of
messages to be sent, or if you want an OSC bundle to be reusable. Scripts can be triggered using
the ``/zmania/run_script`` osc command.

OSC syntax is the same as KNOT, only two rules are added:

1. Messages are separated by newlines;
2. If you want to send a bundle, put **\[** into a line, write each command then close with **\]**.

Example:

```
/part${ch}/Penabled T
/part${ch}/Pvolume 127
```
This will execute Penabled first, then Pvolume.

```
[
/part${ch}/Penabled T
/part${ch}/Pvolume 127
]
```

This will send enabled and volume on the same package.

The **console** follows the same parameters. Notice that on a console \[\] are not supported:
Multiline osc commands will always be handled as a bundle.

### Sported OSC

|OSC | Value |
|:---|:------|
|/zmania/run_script s | execute *s* script (full path). |

## System

### MIDI

This is where you can enable your midi devices. This will not connect the device to zynaddsubfx, it will
connect it to zynthomania's own KNOT port, which in turn is connected to the synth. This should not really
create latency problems, as virtual port are opened using real time midi engine.

### Session

You can load/save sessions here. Click on ``(save to new session)`` then save to save on a new file.
On the top of the file list, the current session file is presented.

### Unified ADSR (UADSR)

One of the problems with ZynAddSubFX is that it does not natively support multiple bindings to the same
CC. This can be an issue if you want to adjust or play with the ADSR, but your sound uses multiple synths.
UADSR binds all possibile ADSR values from the 3 synths to a single CC, thanks to KNOT!

There are 2 types of UADSR: 8 cc and 4 cc. **8 mode* is the simplest: 4 events will be bound to amplitude's
ADSR, 4 events will be bound to resonance ADDR - Attack, Decay time, Decay value, Release.

UADS4 mode is more complex. UADSR4 sports 5 cc: one for specific control and one, preferibly a fader or a knob,
to select which ADSR you want to change.

Below there is the **uadsr4 switch list**:

| CC value | ADSR | 
|:--:|:------|
| 0  | Amplitude |
| 32 | Filter (time) |
| 64 | Filter (values) |
| 96 | Frequency tone |
| 127 | Frequency tone values |

So, moving the switch CC to the middle (64) will trigger filter values mode, putting it to the top (127)
will trigger frequency tones.

CCs can be customized, so I will refer them in order as 1,2,3,4.
#### U4 Amplitude mode (0)
| CC | Changes | OSC last path|
|:--:|:------|:-------|
| 1  | Attack time | /AmpEnvelope/PA_dt |
| 2  | Decay time  | /AmpEnvelope/PD_dt |
| 3  | Sustain value | /AmpEnvelope/PS_val |
| 4  |Release time | /AmpEnvelope/PR_dt |

#### U4 Filter Time Mode (32)
| CC | Changes | OSC last path|
|:--:|:------|:-------|
| 1  | Attack time | /FilterEnvelope/PA_dt |
| 2  | Decay time  | /FilterEnvelope/PD_dt |
| 3  | Base Frequency | /FilterEnvelope/Pfreq |
| 4  | Release time | /FilterEnvelope/PR_dt |

#### U4 Filter Value Mode (64)
| CC | Changes | OSC last path|
|:--:|:------|:-------|
| 1  | Attack value | /FilterEnvelope/PA_val |
| 2  | Decay value  | /FilterEnvelope/PD_val |
| 3  | Q  | /FilterEnvelope/Pq |
| 4  | Release value | /FilterEnvelope/PR_val |

#### U4 Frequency Value Mode (96)
| CC | Changes | OSC last path|
|:--:|:------|:-------|
| 1  | Attack time | /FreqEnvelope/PA_dt |
| 2  | Attack value  | /FreqEnvelope/PA_val |
| 3  | Release time | /FreqEnvelope/PR_dt |
| 4  | Release value | /FreqEnvelope/PR_val |

#### U4 Frequency Madness Mode (127)
| CC | Changes | OSC last path|
|:--:|:------|:-------|
| 1  | LFO frequency | /FreqLFO/Pfreq |
| 2  | LFO Intensity  | /FreqLFO/Pintensity |
| 3  | Detune (works bad) | /PDetune |
| 4  | LFO Type | /FreqLFO/PLFOtype |

#### Customize UADSR

The core paths are inside bind files under the ``data`` directory into zynthomania dir.

UADSR is a system setting. Future releases will make it keyboard specific.
