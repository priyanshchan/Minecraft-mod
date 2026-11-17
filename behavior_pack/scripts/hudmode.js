// Overlord: Tomb of Nazarick - how the status is shown when another add-on owns the action bar.
//
// Overcraft builds (tools/merge_addons.py --overcraft) switch `title` on. In them, RSCraft's screen layout is taught to
// hide titles tagged "ovl:", and a panel in the top-left corner of the screen shows the last one. So Overlord's status
// (and its short messages) can be sent as hidden titles instead of fighting RSCraft for the action bar.
export const hudMode = { title: false };
