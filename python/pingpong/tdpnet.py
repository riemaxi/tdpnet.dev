import asyncio
import json
import ssl
import time
import websockets

# ==========================================
# PACKET CLASSES (from packet.js)
# ==========================================

class BitVector:
    def __init__(self, str_val: str):
        self.path = self._convert_to_int8_array(str_val)

    def _convert_to_int8_array(self, hex_str: str) -> bytearray:
        if not hex_str:
            return bytearray()
        if len(hex_str) % 2 != 0:
            hex_str = '0' + hex_str
        return bytearray(bytes.fromhex(hex_str))

    def marked(self, index: int) -> bool:
        byte_index = index // 8
        bit_index = 7 - (index % 8)
        if byte_index >= len(self.path):
            return False
        return (self.path[byte_index] & (1 << bit_index)) != 0

    def mark(self, index: int):
        byte_index = index // 8
        bit_index = 7 - (index % 8)

        if byte_index >= len(self.path):
            extension = bytearray(byte_index + 1 - len(self.path))
            self.path.extend(extension)

        self.path[byte_index] |= (1 << bit_index)

    def __str__(self) -> str:
        return ''.join(f'{b:02X}' for b in self.path)

    def to_binary_string(self) -> str:
        return ' '.join(f'{b:08b}' for b in self.path)


class Channel:
    def __init__(self, path: str, layer: int, signal: int):
        self.path = BitVector(str(path))
        self.layer = layer
        self.signal = signal

    def marked(self, id_val: int) -> bool:
        return self.path.marked(id_val)

    def mark(self, id_val: int):
        self.path.mark(id_val)

    @property
    def is_signal(self) -> int:
        return self.signal

    @is_signal.setter
    def is_signal(self, value: int):
        self.signal = value

    def above(self, layer: int) -> bool:
        return self.layer > layer

    def __str__(self) -> str:
        return f"{self.path}|{self.layer}|{self.signal}"

    @classmethod
    def create(cls, path: str, layer: int, signal: int):
        return cls(path, layer, signal)

    @classmethod
    def from_string(cls, data: str):
        parts = data.split('|')
        path_str = parts[0]
        layer = int(parts[1]) if len(parts) > 1 else 0
        signal = int(parts[2]) if len(parts) > 2 else 0
        return cls(path_str, layer, signal)


class Status:
    def __init__(self, age: int, health: str):
        self.age = age
        self.health = health

    def too_old(self, max_val: int) -> bool:
        return self.age > max_val

    def ill(self, pattern: str) -> bool:
        return self.health != pattern

    def get_older(self, inc: int = 1):
        self.age += inc

    def __str__(self) -> str:
        return f"{self.age}|{self.health}"

    @classmethod
    def from_string(cls, data: str):
        age, health = data.split('|')
        return cls(int(age), health)


class Peering:
    def __init__(self, from_peer: str, to_peer: str, subject: str, timestamp: int = None):
        self.timestamp = int(time.time() * 1000) if timestamp is None else timestamp
        self.from_peer = from_peer
        self.to_peer = to_peer
        self.subject = subject

    def __str__(self) -> str:
        return f"{self.timestamp} {self.from_peer} {self.to_peer} {self.subject}"

    @classmethod
    def from_string(cls, data: str):
        timestamp, from_peer, to_peer, subject = data.split(' ')
        return cls(from_peer, to_peer, subject, int(timestamp))

    @classmethod
    def from_map(cls, data: dict):
        return cls(data['from'], data['to'], data['subject'])


class Transformer:
    def __init__(self, pointer: int, operators: bytes, data: str):
        self.pointer = pointer
        self.operators = bytes(operators)
        self.data = data

    def shift(self, delta: int = 1) -> int:
        p = self.pointer + delta
        valid = 0 <= p < len(self.operators)
        if valid:
            self.pointer = p
        return self.pointer

    def apply(self):
        self.shift()

    def __str__(self) -> str:
        ops_str = ','.join(str(b) for b in self.operators)
        return f"{self.pointer}|{ops_str}\n{self.data}"

    @classmethod
    def from_strings(cls, lst: list):
        meta = lst[0]
        data_lines = lst[1:]
        pointer_str, ops_str = meta.split('|')
        operators = bytes([int(x) for x in ops_str.split(',') if x != ''])
        return cls(int(pointer_str), operators, '\n'.join(data_lines))

    @classmethod
    def from_string(cls, str_val: str):
        lines = str_val.split('\n')
        pointer_str, ops_str = lines[0].split('|')
        operators = bytes([int(x) for x in ops_str.split(',') if x != ''])
        data = '\n'.join(lines[1:])
        return cls(int(pointer_str), operators, data)


class Packet:
    def __init__(self, channel: Channel, status: Status, peering: Peering, transformer: Transformer):
        self.channel = channel
        self.status = status
        self.peering = peering
        self.transformer = transformer
        self.separator = '\n'

    def __str__(self) -> str:
        return self.separator.join([
            str(self.channel),
            str(self.status),
            str(self.peering),
            str(self.transformer)
        ])

    @classmethod
    def from_string(cls, data: str, separator: str = '\n'):
        part = data.split(separator)
        return cls(
            Channel.from_string(part[0]),
            Status.from_string(part[1]),
            Peering.from_string(part[2]),
            Transformer.from_strings(part[3:])
        )

    @classmethod
    def from_sp(cls, json_str: str):
        data = json.loads(json_str)
        channel = Channel.from_string(data['channel'])
        status = Status.from_string('0|0000')
        peering = Peering.from_map(data['peering'])
        transformer = Transformer.from_string(data['transformer'])
        return cls(channel, status, peering, transformer)


# ==========================================
# HELPER CLASSES (from helper.js)
# ==========================================

class Packeter:
    ONE_OPERATOR = bytes([0])

    @classmethod
    def create_ad(cls, from_peer: str, to: str = '', name: str = None, description: str = None, status: str = None, subject: str = 'signin'):
        name = name if name is not None else from_peer
        if status:
            data = json.dumps({'name': name, 'status': status, 'description': description})
        else:
            data = json.dumps({'name': name, 'description': description})

        return cls.create_signal(
            from_peer=from_peer,
            to=to,
            data=data,
            subject=subject
        )

    @classmethod
    def create_signal(cls, from_peer: str, to: str, data: str, subject: str, operators: bytes = None, pointer: int = 0):
        ops = operators if operators is not None else cls.ONE_OPERATOR
        return str(Packet(
            Channel.create('', 0, 1),
            Status(0, '0000'),
            Peering(from_peer, to, subject),
            Transformer(pointer, ops, data)
        ))

    @classmethod
    def create_data(cls, channel: Channel, status: Status, peering: Peering, transformer: Transformer):
        return str(Packet(channel, status, peering, transformer))


# ==========================================
# TDPNET CLASSES (from tdpnet.js)
# ==========================================

class TDPnet:
    def __init__(self):
        self._socket = None
        self._listen_task = None

    async def connect(self, host: str, ca: str = None):
        ssl_context = None
        if host.startswith("wss://"):
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            if ca:
                ssl_context.load_verify_locations(cafile=ca)

        try:
            self._socket = await websockets.connect(host, ssl=ssl_context)
            self.on_connected(int(time.time() * 1000))
            self._listen_task = asyncio.create_task(self._listen())
        except Exception as e:
            self.on_connection_error(e)
            raise e

    async def _listen(self):
        try:
            async for message in self._socket:
                try:
                    m = json.loads(message)
                    self.handle_event(m.get('id'), m.get('data'))
                except Exception as err:
                    self.on_error(err)
        except websockets.exceptions.ConnectionClosed:
            self.on_connection_error('Connection closed')
        except Exception as e:
            self.on_error(e)

    def on_connected(self, timestamp: int):
        pass

    def on_error(self, err):
        pass

    def on_connection_error(self, err):
        pass

    def handle_event(self, id_val, data):
        pass

    # Ensure this is defined as async def
    async def send(self, id_val, data):
        if self._socket:
            try:
                await self._socket.send(json.dumps({'id': id_val, 'data': data}))
            except websockets.exceptions.ConnectionClosed:
                self.on_error('Socket is not open.')
        else:
            self.on_error('Socket is not open.')    

class Session(TDPnet):
    async def signin(self, data):
        await self.send('signin', data)

    async def signoff(self, data):
        await self.send('signoff', data)

    async def send_data(self, data):
        await self.send('data', data)

    async def send_signal(self, data):
        await self.send('signal', data)

    def handle_event(self, id_val, data):
        if id_val == 'error':
            self.on_error(data)
        elif id_val == 'open':
            self.on_open(data)
        elif id_val == 'signal':
            self.on_signal(data)
        elif id_val == 'data':
            self.on_data(data)
        elif id_val == 'granted':
            self.on_granted(data)
        elif id_val == 'denied':
            self.on_denied(data)

    def on_open(self, data):
        pass

    def on_granted(self, data):
        pass

    def on_denied(self, data):
        pass

    def on_signal(self, data):
        pass

    def on_data(self, data):
        pass


class StandardSession(Session):
    def __init__(self):
        super().__init__()

    def on_signal(self, e):
        packet = Packet.from_string(e)
        category, id_val = packet.peering.subject.split(':', 1)
        if category == 'request':
            self.on_request(id_val, packet)
        elif category == 'response':
            self.on_response(id_val, packet)
        elif category == 'event':
            self.on_event(id_val, packet)

    def on_data(self, e):
        packet = Packet.from_string(e)
        category, id_val = packet.peering.subject.split(':', 1)
        if category == 'request':
            self.on_request(id_val, packet)
        elif category == 'response':
            self.on_response(id_val, packet)
        elif category == 'event':
            self.on_event(id_val, packet)

    def on_request(self, id_val, p: Packet):
        pass

    def on_response(self, id_val, p: Packet):
        pass

    def on_event(self, id_val, p: Packet):
        pass

    async def request(self, from_peer: str, to: str, id_val: str, data: dict):
        packet = Packeter.create_signal(
            from_peer=from_peer,
            to=to,
            subject='request:' + id_val,
            data=json.dumps(data)
        )
        await self.send_signal(packet)

    async def response(self, packet: Packet, id_val: str, data: dict):
        packet.peering = Peering(
            from_peer=packet.peering.to_peer,
            to_peer=packet.peering.from_peer,
            subject='response:' + id_val
        )
        packet.transformer.data = json.dumps(data)
        packet.channel.is_signal = 0
        await self.send_data(str(packet))

    async def notify(self, from_peer: str, to: str, id_val: str, data: dict):
        packet = Packeter.create_signal(
            from_peer=from_peer,
            to=to,
            subject='event:' + id_val,
            data=json.dumps(data)
        )
        await self.send_signal(packet)