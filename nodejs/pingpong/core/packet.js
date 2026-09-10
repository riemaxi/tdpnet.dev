const { Buffer } = require('buffer');
const { parse } = require('path');

class Packet{
  constructor(channel, status, peering, transformer) {
    this.channel = channel;
    this.status = status;
    this.peering = peering;
    this.transformer = transformer;
    this.separator = '\n';
  }

  toString() {
    return [this.channel, this.status, this.peering, this.transformer]
      .map((p) => p.toString())
      .join(this.separator);
  }

  static fromString(data, separator = '\n') {
    const part = data.split(separator);
    return new Packet(
      Channel.fromString(part[0]),
      Status.fromString(part[1]),
      Peering.fromString(part[2]),
      Transformer.fromStrings(part.slice(3))
    );
  }

  static fromSP(json) {
    const data = JSON.parse(json);

    const channel = Channel.fromString(data['channel']);
    const status = Status.fromString('0|0000');
    const peering = Peering.fromMap(data['peering']);
    const transformer = Transformer.fromString(data['transformer']);

    return new Packet(channel, status, peering, transformer);
  }
}


class BitVector {
  constructor(str) {
    this.path = this._convertToInt8Array(str);
  }

  _convertToInt8Array(hex) {
    let str = hex.length % 2 !== 0 ? '0' + hex : hex;
    const size = str.length / 2;
    const buf = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      buf[i] = parseInt(str.substr(i * 2, 2), 16);
    }
    return buf;
  }

  marked(index) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = 7 - (index % 8);
    // If the index is out of bounds, by definition it isn't marked
    if (byteIndex >= this.path.length) return false;
    
    return (this.path[byteIndex] & (1 << bitIndex)) !== 0;
  }

  /**
   * Sets bit at index to 1, expanding the array if necessary
   * @param {number} index 
   */
  mark(index) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = 7 - (index % 8);

    // Expand the array if the byteIndex is outside current bounds
    if (byteIndex >= this.path.length) {
      const newPath = new Uint8Array(byteIndex + 1);
      newPath.set(this.path); // Copy old data to the new buffer
      this.path = newPath;
    }

    this.path[byteIndex] |= (1 << bitIndex);
  }

  toString() {
    return Array.from(this.path)
      .map(byte => byte.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
  }

  toBinaryString(){
    return Array.from(this.path)
      .map(byte => byte.toString(2).padStart(8, '0'))
      .join(' ');
  }
}


class Channel {
  constructor(path, layer, signal) {
    this.path = new BitVector(path); 
    this.layer = layer;
    this.signal = signal;
  }

  marked(id){
    return this.path.marked(id)
  }

  mark(id){
    this.path.mark(id)
  }

  get isSignal() {
    return this.signal;
  }

  set isSignal(value){
    this.signal = value;
  }

  above(layer) {
    return this.layer > layer;
  }

  toString() {
    return `${this.path}|${this.layer}|${this.signal}`;
  }

  static create(path, layer, signal) {
    return new Channel(path, layer, signal);
  }

  static fromString(data) {
    const [pathStr, layer, signal] = data.split('|');
    const path = parseInt(pathStr);
    return new Channel(path, parseInt(layer), parseInt(signal));
  }
}

class Status {
  constructor(age, health) {
    this.age = age;
    this.health = health;
  }

  tooOld(max) {
    return this.age > max;
  }

  ill(pattern) {
    return this.health !== pattern;
  }

  getOlder(inc = 1) {
    this.age += inc;
  }

  toString() {
    return `${this.age}|${this.health}`;
  }

  static fromString(data) {
    const [age, health] = data.split('|');
    return new Status(parseInt(age), health);
  }
}

class Peering {
  constructor(from, to, subject, timestamp = Date.now() * 1000) {
    this.timestamp = timestamp;
    this.from = from;
    this.to = to;
    this.subject = subject;
  }

  toString() {
    return `${this.timestamp} ${this.from} ${this.to} ${this.subject}`;
  }

  static fromString(data) {
    const [timestamp, from, to, subject] = data.split(' ');
    return new Peering(from, to, subject, parseInt(timestamp));
  }

  static fromMap(data) {
    return new Peering(data.from, data.to, data.subject);
  }
}

class Transformer {
  constructor(pointer, operators, data) {
    this.pointer = pointer;
    this.operators = operators; // Buffer
    this.data = data;
  }

  shift(delta = 1) {
    const p = this.pointer + delta;
    const valid = p >= 0 && p < this.operators.length;
    return valid ? (this.pointer = p) : this.pointer;
  }

  apply() {
    this.shift();
  }

  toString() {
    return `${this.pointer}|${[...this.operators].join(',')}\n${this.data}`;
  }

  static fromStrings(list) {
    const [meta, ...dataLines] = list;
    const [pointerStr, opsStr] = meta.split('|');
    const operators = Buffer.from(opsStr.split(',').map(Number));
    return new Transformer(parseInt(pointerStr), operators, dataLines.join('\n'));
  }

  static fromString(str) {
    const lines = str.split('\n');
    const [pointerStr, opsStr] = lines[0].split('|');
    const operators = Buffer.from(opsStr.split(',').map(Number));
    const data = lines.slice(1).join('\n');
    return new Transformer(parseInt(pointerStr), operators, data);
  }
}

module.exports = {
  Packet,
  Peering,
  Transformer, 
  Channel,
  Status
}