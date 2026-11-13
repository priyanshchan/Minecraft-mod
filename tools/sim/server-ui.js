export const script = []; export const shown = [];
export class ActionFormData { constructor() { this.b = []; } title(t) { this.t = t; return this; } body(t) { this.bd = t; return this; } button(t) { this.b.push(t); return this; }
  show() { shown.push({ title: this.t, body: this.bd, buttons: this.b }); const s = script.shift(); return Promise.resolve(s === undefined ? { canceled: true } : { canceled: false, selection: s }); } }
export const modalScript = [];
export class ModalFormData { title() { return this; } textField() { return this; } dropdown() { return this; }
  show() { const v = modalScript.shift(); return Promise.resolve(v === undefined ? { canceled: true } : { canceled: false, formValues: v }); } }
