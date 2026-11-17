## Hardcore Survival (experimental build, v10.1.3)

An experimental branch (`experimental-hardcore`) that adds a hard survival layer to the whole add-on, in the
spirit of the hardest survival modpacks. Everything in it is this add-on's own: original code, items and art.
It is **not** merged into the main add-on.

### Installing it
- The file is `Overlord_Hardcore_Experimental.mcaddon`. It has its own pack ids, so it installs **beside** the
  normal Overlord add-on instead of replacing it: in the pack list it is called
  *Overlord: Tomb of Nazarick - Hardcore (experimental)*.
- Turn on **one or the other** in a world, never both: they share every item and creature.
- An existing Overlord world can be switched to it (turn the normal packs off and these on). Levels, items and
  progress carry over. Make a copy of the world first.

### Thirst
- A **Water** meter (0-20) on the status bar. It empties by a point every 45 seconds at rest, faster when you
  sprint, overheat, are in the Nether or have parasites.
- At 6 or below you are **parched** (slowed); at 0 you are **dehydrated**: slowed further, and you lose half a
  heart every four seconds.
- **Drinking:**
  - Sneak and look at water with an empty hand to sip from it (a small chance of parasites).
  - Fill a **Leather Waterskin** at water. River water may carry parasites; cook the skin in a furnace or smoker
    or over a campfire to boil it safe. An empty skin comes back after drinking.
  - Water bottles, milk, honey, melons, berries, apples, Sebas's Black Tea and Pestonya's soup all help.

### Body temperature
- From **Freezing** to **Heatstroke**, shown on the status bar.
- **Cold:** snow and ice underfoot, high peaks, the End, nights under the open sky, rain and swimming.
- **Hot:** sand, sandstone and terracotta underfoot (deserts and badlands, cold at night), the Nether, and
  sprinting.
- **Warms you:** campfires, fire, lava, lit furnaces and torches nearby.
- **Cold** slows you; **Freezing** slows you more and hurts. **Hot** weakens you; **Heatstroke** also hurts and
  makes you hungry.
- **Help:**
  - Leather armour keeps you warm (but makes deserts worse).
  - Fire resistance stops the heat.
  - **Cocytus's Frost Draught** (boiled water + a snowball) guards against heat for five minutes.
  - **Demiurge's Ember Draught** (boiled water + blaze powder) guards against cold for five minutes.
  - The Seraph and Supreme Being sets keep you comfortable anywhere.

### Injuries
- **Bleeding:** a heavy blow (4 damage or more) may open a wound that bleeds for 30 seconds. A **Linen Bandage**
  (string + white wool makes three) stops it.
- **Broken leg:** a bad fall (6 damage or more) breaks a leg: slowed for three minutes, or until you use a
  **Splint** (string + two sticks).
- **Parasites:** from dirty water. They make you weak and hungry for a minute; milk and Pestonya's soup purge them.
- **Pestonya's Field Kit** (a splint, two bandages and a Minor Healing Potion) mends everything at once and heals.

### The price of resurrection
- Each death takes a heart, down to a minimum of three.
- A **Crystal of Vitality** restores one. World bosses always carry one, and elites sometimes do (more often
  far from spawn). You can also craft one from gold, Data Crystals and a golden apple.

### The wilds
- Danger rises every 1,000 blocks from the world spawn, from *the Lands of Men* to *the Lands Beyond Reason*
  (danger 0 to 5).
- At each step monsters gain 6 levels and 3% more of them are elites, and they give more XP.
- The Nether counts its distances eightfold and is never safe. The End is always at the highest danger.
- A title shows when you cross into a new zone.

### Fair play
- Thirst, cold, heat and bleeding wear you down to half a heart but never kill you on their own: the monsters do.
- Players in creative or spectator mode are left alone.

### The races
- **Undead:** never thirst, feel neither heat nor cold, and do not bleed.
- **Vampires:** drink from the blows they strike (not on the undead); water does them half as much good.
- **Demons:** cannot overheat, but feel the cold more.
- **Dragonkin:** shrug off both heat and cold.
- **Dark Elves:** cannot catch parasites.

### With RSCraft (v10.1.1)
- RSCraft has its own thirst, temperature, first aid (health per body part) and extra hearts. Running both would
  show two water meters and two temperature gauges, and make the two first-aid systems fight over the health bar.
- So when RSCraft is installed in the world, Hardcore's thirst, body temperature, injuries and price of
  resurrection start **switched off** and RSCraft's are used. Hardcore's **dangerous wilds** stay on.
- Any of them can still be switched on in World rules; a rule changed by hand stays as it was set.
- The Hardcore Survival page says which are off because of RSCraft. No waterskin or bandages are handed out
  while Hardcore's thirst and injuries are both off.

### The status bar beside RSCraft (v10.1.2)
- RSCraft draws its water and temperature icons by writing to the action bar (the line above the hotbar) many
  times a second. Anything else written there is cut into pieces by its screen layout and wipes its icons, so
  Overlord's status bar used to flash up scrambled for a moment and vanish.
- With RSCraft installed, Overlord no longer writes to the action bar. Its short messages go to chat (the same one
  is not repeated within three seconds), and its status line is shown on the Adventurer's Plate.
- The Plate has a button to show Overlord's status bar anyway. It will flicker with RSCraft's icons.
- In the **Overcraft** build (v10.1.3), Overlord's status, and its short messages, show as a small block in the
  top-left corner instead, beside RSCraft's HUD. The Plate's button hides or shows it.

### Settings
- The **Hardcore Survival** page on the Adventurer's Plate shows your water, temperature, injuries, lost hearts
  and danger zone, with a guide.
- Its **World rules** switch each rule on or off for the whole world: thirst, body temperature, injuries, the
  price of resurrection and the dangerous wilds. Only a player in creative mode can change them.
- New players start with a waterskin of boiled water, an empty waterskin and three bandages.
