import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:web_socket_channel/web_socket_channel.dart';

// ==========================================
// PACKET CLASSES
// ==========================================

class BitVector {
  Uint8List path = Uint8List(0);

  BitVector(String hexStr) {
    path = convertToInt8Array(hexStr);
  }

  static Uint8List convertToInt8Array(String hexStr) {
    if (hexStr.isEmpty) return Uint8List(0);
    if (hexStr.length % 2 != 0) {
      hexStr = '0$hexStr';
    }
    final bytes = <int>[];
    for (var i = 0; i < hexStr.length; i += 2) {
      bytes.add(int.parse(hexStr.substring(i, i + 2), radix: 16));
    }
    return Uint8List.fromList(bytes);
  }

  bool marked(int index) {
    final byteIndex = index ~/ 8;
    final bitIndex = 7 - (index % 8);
    if (byteIndex >= path.length) return false;
    return (path[byteIndex] & (1 << bitIndex)) != 0;
  }

  void mark(int index) {
    final byteIndex = index ~/ 8;
    final bitIndex = 7 - (index % 8);

    if (byteIndex >= path.length) {
      final newPath = Uint8List(byteIndex + 1);
      newPath.setRange(0, path.length, path);
      path = newPath;
    }
    path[byteIndex] |= (1 << bitIndex);
  }

  @override
  String toString() {
    return path.map((b) => b.toRadixString(16).padLeft(2, '0').toUpperCase()).join();
  }
}

class Channel {
  BitVector path;
  int layer;
  int signal;

  Channel(String pathStr, this.layer, this.signal)
      : path = BitVector(pathStr);

  int get isSignal => signal;
  set isSignal(int value) => signal = value;

  @override
  String toString() => '$path|$layer|$signal';

  factory Channel.fromString(String data) {
    final parts = data.split('|');
    final pathStr = parts.isNotEmpty ? parts[0] : '';
    final layer = parts.length > 1 ? (int.tryParse(parts[1]) ?? 0) : 0;
    final signal = parts.length > 2 ? (int.tryParse(parts[2]) ?? 0) : 0;
    return Channel(pathStr, layer, signal);
  }
}

class Status {
  int age;
  String health;

  Status(this.age, this.health);

  @override
  String toString() => '$age|$health';

  factory Status.fromString(String data) {
    final parts = data.split('|');
    final age = int.tryParse(parts[0]) ?? 0;
    final health = parts.length > 1 ? parts[1] : '0000';
    return Status(age, health);
  }
}

class Peering {
  int timestamp;
  String fromPeer;
  String toPeer;
  String subject;

  Peering(this.fromPeer, this.toPeer, this.subject, [int? ts])
      : timestamp = ts ?? DateTime.now().millisecondsSinceEpoch;

  @override
  String toString() => '$timestamp $fromPeer $toPeer $subject';

  factory Peering.fromString(String data) {
    final parts = data.split(' ');
    final ts = int.parse(parts[0]);
    return Peering(parts[1], parts[2], parts[3], ts);
  }
}

class Transformer {
  int pointer;
  Uint8List operators;
  String data;

  Transformer(this.pointer, this.operators, this.data);

  @override
  String toString() {
    final opsStr = operators.join(',');
    return '$pointer|$opsStr\n$data';
  }

  factory Transformer.fromStrings(List<String> lines) {
    final meta = lines[0];
    final dataLines = lines.sublist(1);
    final parts = meta.split('|');
    final ptr = int.parse(parts[0]);
    final opsList = parts.length > 1 && parts[1].isNotEmpty
        ? parts[1].split(',').where((x) => x.isNotEmpty).map(int.parse).toList()
        : <int>[];
    return Transformer(ptr, Uint8List.fromList(opsList), dataLines.join('\n'));
  }
}

class Packet {
  Channel channel;
  Status status;
  Peering peering;
  Transformer transformer;

  Packet(this.channel, this.status, this.peering, this.transformer);

  @override
  String toString() {
    return '${channel.toString()}\n${status.toString()}\n${peering.toString()}\n${transformer.toString()}';
  }

  factory Packet.fromString(String data) {
    final lines = LineSplitter.split(data).toList();
    return Packet(
      Channel.fromString(lines[0]),
      Status.fromString(lines[1]),
      Peering.fromString(lines[2]),
      Transformer.fromStrings(lines.sublist(3)),
    );
  }
}

// ==========================================
// PACKETER HELPER
// ==========================================

class Packeter {
  static String createSignal({
    required String fromPeer,
    required String to,
    required String subject,
    required String data,
    Uint8List? operators,
    int pointer = 0,
  }) {
    final packet = Packet(
      Channel('', 0, 1),
      Status(0, '0000'),
      Peering(fromPeer, to, subject),
      Transformer(pointer, operators ?? Uint8List.fromList([0]), data),
    );
    return packet.toString();
  }
}

// ==========================================
// SYSTEM & SESSION LOGIC
// ==========================================

abstract class System {
  final Map<String, dynamic> config;
  WebSocketChannel? _channel;

  System(this.config, {bool connect = true}) {
    if (connect) {
      this.connect(host, ssl);
    }
  }

  String? get ssl => config['ssl'] as String?;
  String get host => config['host'] as String;
  Map<String, dynamic> get credential =>
      (config['credential'] as Map<String, dynamic>?) ?? {};
  String get address => credential['address'] as String;
  Map<String, dynamic> get peers =>
      (config['peers'] as Map<String, dynamic>?) ?? {};

  void connect(String hostUrl, [String? sslCa]) {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(hostUrl));
      onConnected(DateTime.now().millisecondsSinceEpoch);

      _channel!.stream.listen(
        (message) {
          final dataMap = json.decode(message as String) as Map<String, dynamic>;
          _handleEvent(dataMap['id'] as String?, dataMap['data']);
        },
        onError: (error) => onError(error),
        onDone: () => onConnectionError('Connection closed'),
      );
    } catch (e) {
      onConnectionError(e);
    }
  }

  void send(String idVal, dynamic data) {
    if (_channel != null) {
      _channel!.sink.add(json.encode({'id': idVal, 'data': data}));
    }
  }

  void signin(Map<String, dynamic> data) => send('signin', data);

  void sendSignal(String data) => send('signal', data);

  void sendData(String data) => send('data', data);

  void request(String fromPeer, String to, String idVal, dynamic data) {
    final packet = Packeter.createSignal(
      fromPeer: fromPeer,
      to: to,
      subject: 'request:$idVal',
      data: json.encode(data),
    );
    sendSignal(packet);
  }

  void response(Packet packet, String idVal, dynamic data) {
    packet.peering = Peering(
      packet.peering.toPeer,
      packet.peering.fromPeer,
      'response:$idVal',
    );
    packet.transformer.data = json.encode(data);
    packet.channel.isSignal = 0;
    sendData(packet.toString());
  }

  void notify(String fromPeer, String to, String idVal, dynamic data) {
    final packet = Packeter.createSignal(
      fromPeer: fromPeer,
      to: to,
      subject: 'event:$idVal',
      data: json.encode(data),
    );
    sendSignal(packet);
  }

  void _handleEvent(String? idVal, dynamic data) {
    if (idVal == 'granted') {
      onGranted(data);
    } else if (idVal == 'denied') {
      onDenied(data);
    } else if (idVal == 'signal' || idVal == 'data') {
      final packet = Packet.fromString(data as String);
      final parts = packet.peering.subject.split(':');
      if (parts.length == 2) {
        final category = parts[0];
        final subId = parts[1];
        if (category == 'request') onRequest(subId, packet);
        if (category == 'response') onResponse(subId, packet);
        if (category == 'event') onEvent(subId, packet);
      }
    }
  }

  void onConnected(int timestamp) => signin(credential);
  void onGranted(dynamic data) {}
  void onDenied(dynamic data) {}
  void onRequest(String idVal, Packet packet) {}
  void onResponse(String idVal, Packet packet) {}
  void onEvent(String idVal, Packet packet) {}
  void onError(dynamic err) => print('Error: $err');
  void onConnectionError(dynamic err) => print('Connection Error: $err');
}

// ==========================================
// APPLICATION
// ==========================================

class Application extends System {
  Application(Map<String, dynamic> config) : super(config, connect: false);

  @override
  void onDenied(dynamic data) {
    print('denied $data');
  }

  @override
  void onGranted(dynamic data) {
    print('granted $data');
    request(address, peers['pinpon'] as String, 'ping', 0);
  }

  @override
  void onEvent(String idVal, Packet packet) {
    final to = packet.peering.fromPeer;
    print('event $idVal $to ${DateTime.now().millisecondsSinceEpoch}');
    if (idVal == 'ping') {
      _delayedNotify(to, 'pong', 0, const Duration(seconds: 2));
    }
  }

  @override
  void onResponse(String idVal, Packet packet) {
    print('response $idVal ${DateTime.now().millisecondsSinceEpoch}');
    if (idVal == 'pong') {
      _delayedResponse(packet, 'ping', 1, const Duration(seconds: 2));
    }
  }

  @override
  void onRequest(String idVal, Packet packet) {
    print('request $idVal ${DateTime.now().millisecondsSinceEpoch}');
    if (idVal == 'pong') {
      _delayedResponse(packet, 'ping', 1, const Duration(seconds: 1));
    }
  }

  void _delayedNotify(String to, String eventId, dynamic data, Duration delay) {
    Future.delayed(delay, () {
      notify(address, to, eventId, data);
    });
  }

  void _delayedResponse(Packet packet, String responseId, dynamic data, Duration delay) {
    Future.delayed(delay, () {
      response(packet, responseId, data);
    });
  }
}

void main() async {
  final config = {
    'ponpin': {
      'host': 'ws://213.199.58.37:5000',
      'credential': {
        'accesskey': 'PONPIN',
        'password': '000000',
        'address': 'ponpin.aladino.maya.4da',
        'context': <String, dynamic>{}
      },
      'peers': {
        'pinpon': 'pinpon.aladino.maya.4da'
      }
    }
  };

  print('Starting Dart TDPnet Application...');
  final app = Application(config['ponpin'] as Map<String, dynamic>);
  app.connect(app.host, app.ssl);

  // Keep event loop alive
  await Completer<void>().future;
}