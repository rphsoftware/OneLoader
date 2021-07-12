# OneLoader
High performance mod loader for OMORI

## Credits/Licensing
This project contains in part or in full the following projects:

- [GOMORI](https://github.com/gilbert142/gomori) | License: **MIT** | Degree of use: Certain encryption primitives, the index.html used for backwards compatibility
- [node-stream-zip](https://github.com/antelle/node-stream-zip) | License: **MIT** | Degree of use: Library used in full to process mods bundled in zip files
- [JSON-Patch](https://github.com/Starcounter-Jack/JSON-Patch) | License: **MIT** | Degree of use: Library used in full to apply patches to game data

Additionally, I'd like to thank the developers of GOMORI for kick-starting the modding community and laying the necessary ground work for modloader development.

## Installation
### New users:
- Download the latest release from the github releases panel (Or [click here](https://github.com/rphsoftware/OneLoader/releases/latest))
- From the downloaded zip, extract the `www` folder into the main folder of the game (For instance `C:\Program Files (x86)\Steam\steamapps\common\OMORI`)
- You should get prompted to replace the index.html file in the game folder. Select yes, that's needed to get the modloader working.
- Run the game once so that the modloader can create all the required files and folders.
- After closing the game, go to the following folder in the games directory structure: `www\mods` (If it's not present, make it) and drop in your mod folders and zips (You can download mod zips either from [mods.one](https://mods.one) or the #modding-showcase channel on the [OMORI discord](https://discord.gg/omori))

### GOMORI users:
- Follow the instructions for new users. You do not need to remove gomori, OneLoader will handle it for you.
- It's recommended you temporarily remove all your mods from the mods folder and run the game cleanly once to allow the modloader to restore and create required files.
- Re-add your mods. **NOTE:** If you keep the `gomori` mod installed, you will see a bogus gomori version on the title screen. It's safe to remove that mod.
- In case anything is broken, or your GOMORI installation had troubles beforehand, you can always re-verify game integrity using Steam and re-install the mod loader according to new user instructions.

## Making mods
Because this modloader aims to be a drop-in GOMORI replacement, you can follow mod making instructions from the [GOMORI repository](https://github.com/gilbert142/gomori). As more features are added to OneLoader that GOMORI doesn't implement, they will be implemented here.

## Usage
- **Logging:** OneLoader writes a text file into the game's main folder called `latest.log`. It contains a timestamped list of everything that has happened since the game started that has relevance to the debugging of OneLoader.
- **Command line parameters:** While OMORI by default doesn't accept any command line parameters, and worse, breaks, OneLoader allows you to specify command line options and itself accepts two:
  - `--no-mods`: Start the game in safe mode, skip loading and injection of any mods
  - `--dump-overlay`: Dumps all "built" files to a directory on disk for debugging purposes. Can be used to create modloader-less mods that simply replace game files
- **Conflict resolution:** When you add any mods that conflict with each other, please be prepared to use a mouse to select which mod to prefer during the conflict resolution step.

## Advantages and Disadvantages vs GOMORI
### Advantages
- OneLoader is capable of loading large mods in a short amount of time
- OneLoader has a significantly smaller memory footprint (Tested on the [OMOCORD MOD](https://mods.one/mod/omocord), GOMORI used 1.6 GB on game main menu, OneLoader used 200 MB). This means that you can actually run larger amounts of mods on weaker machines (or powerful machines hindered by high idle memory usage or a low amount of memory available in the first place)
- OneLoader has a semi-graceful system for handling file conflicts: When 2 mods attempt to modify the same file, OneLoader will prompt the user asking which mod they would like to prioritize. GOMORI on the other falls back to undefined/undocumented behaviour and throws an error.
- OneLoader produces a human-readable and fairly precise log file which can significantly aid in mod and modloader debugging.
- On SSD systems, OneLoader is much gentler when it comes to write cycles: The only writes it does are when creating logs, meaning around 50 KB per game session. GOMORI on the other hand has to patch all game files on disk every time it starts, causing significant wear with large mods or mod packs.
- OneLoader doesn't leave any residue in main game files and assets (Unlike GOMORI's .BASIL files mandatory for restoring removed mods)
- OneLoader doesn't require that your zips and mod folders be named precisely following the mod id, they can have any name.
- OneLoader will run even without a `mods` folder or a `save` folder present. It will simply create them.

### Disadvantages
- GOMORI has theoretically marginally higher runtime performance than OneLoader, although the difference is small enough that on most machines it doesn't matter.
- GOMORI doesn't lock the mods folder, allowing you to edit it while the game is running
- OneLoader cannot load mods that utilize the `exec` field in the `mod.json`. (According to internal analysis, no mod on mods.one makes use of that field)

## Reporting issues
If you encounter any issue or bug, please open a github issue in this repository and attach the following:
- List of all mods you have installed (download links or files)
- A copy of the `latest.log` file from the game session where the bug/error occured

## Get in touch with the developer
You can reach me via Discord through DMs ( Rph#9999 is my tag ), via the [OMORI discord](https://discord.gg/omori) (Simply tag me in modding-discussion) or via the [mods.one discord](https://discord.gg/EDTMF85Hnp)

### Roadmap:
- [x] Preview 1 (We are here)

- [X] Preview 2 
  - [X] In-game mod manager akin to that of gomori
  - [X] Functionalities of the PlaytestMaker built-in to the in-game helper mod

- [X] Preview 3
  - [X] Replacement for the exec field (most likely `asyncExec`)
  - [ ] Bug fixes

- [ ] Full release v1.0.0
  - [ ] Improvements to the loading UI
  - [ ] More bug fixes
