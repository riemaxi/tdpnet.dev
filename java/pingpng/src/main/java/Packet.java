import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class Packet {

    public static class BitVector {
        public byte[] path;

        public BitVector(String hexStr) {
            if (hexStr == null || hexStr.isEmpty()) {
                this.path = new byte[0];
                return;
            }
            if (hexStr.length() % 2 != 0) {
                hexStr = "0" + hexStr;
            }
            int len = hexStr.length();
            byte[] data = new byte[len / 2];
            for (int i = 0; i < len; i += 2) {
                data[i / 2] = (byte) ((Character.digit(hexStr.charAt(i), 16) << 4)
                                     + Character.digit(hexStr.charAt(i+1), 16));
            }
            this.path = data;
        }

        @Override
        public String toString() {
            StringBuilder sb = new StringBuilder();
            for (byte b : path) {
                sb.append(String.format("%02X", b));
            }
            return sb.toString();
        }
    }

    public static class Channel {
        public BitVector path;
        public long layer;
        public long signal;

        public Channel(String pathStr, long layer, long signal) {
            this.path = new BitVector(pathStr);
            this.layer = layer;
            this.signal = signal;
        }

        public static Channel fromString(String s) {
            String[] parts = (s != null ? s : "").split("\\|");
            String pathStr = parts.length > 0 ? parts[0] : "";
            long layer = parts.length > 1 && !parts[1].isEmpty() ? Long.parseLong(parts[1]) : 0;
            long signal = parts.length > 2 && !parts[2].isEmpty() ? Long.parseLong(parts[2]) : 0;
            return new Channel(pathStr, layer, signal);
        }

        @Override
        public String toString() {
            return path.toString() + "|" + layer + "|" + signal;
        }
    }

    public static class Status {
        public long age;
        public String health;

        public Status(long age, String health) {
            this.age = age;
            this.health = health;
        }

        public static Status fromString(String s) {
            String[] parts = (s != null ? s : "").split("\\|");
            long age = parts.length > 0 && !parts[0].isEmpty() ? Long.parseLong(parts[0]) : 0;
            String health = parts.length > 1 ? parts[1] : "0000";
            return new Status(age, health);
        }

        @Override
        public String toString() {
            return age + "|" + health;
        }
    }

    public static class Peering {
        public long timestamp;
        public String fromPeer;
        public String toPeer;
        public String subject;

        public Peering(long timestamp, String fromPeer, String toPeer, String subject) {
            this.timestamp = timestamp;
            this.fromPeer = fromPeer;
            this.toPeer = toPeer;
            this.subject = subject;
        }

        public static Peering fromString(String s) {
            String[] parts = (s != null ? s : "").split(" ");
            long ts = parts.length > 0 && !parts[0].isEmpty() ? Long.parseLong(parts[0]) : 0;
            String from = parts.length > 1 ? parts[1] : "";
            String to = parts.length > 2 ? parts[2] : "";
            String subj = parts.length > 3 ? parts[3] : "";
            return new Peering(ts, from, to, subj);
        }

        @Override
        public String toString() {
            return timestamp + " " + fromPeer + " " + toPeer + " " + subject;
        }
    }

    public static class Transformer {
        public long pointer;
        public byte[] operators;
        public String data;

        public Transformer(long pointer, byte[] operators, String data) {
            this.pointer = pointer;
            this.operators = operators;
            this.data = data;
        }

        public static Transformer fromStrings(List<String> lines) {
            String metaLine = lines.size() > 0 ? lines.get(0) : "0|0";
            String[] parts = metaLine.split("\\|");
            long ptr = parts.length > 0 && !parts[0].isEmpty() ? Long.parseLong(parts[0]) : 0;
            
            List<Byte> ops = new ArrayList<>();
            if (parts.length > 1 && !parts[1].isEmpty()) {
                for (String opStr : parts[1].split(",")) {
                    if (!opStr.trim().isEmpty()) {
                        ops.add((byte) Integer.parseInt(opStr.trim()));
                    }
                }
            } else {
                ops.add((byte) 0);
            }

            byte[] opsArr = new byte[ops.size()];
            for (int i = 0; i < ops.size(); i++) opsArr[i] = ops.get(i);

            String dataStr = lines.size() > 1 ? String.join("\n", lines.subList(1, lines.size())) : "";
            return new Transformer(ptr, opsArr, dataStr);
        }

        @Override
        public String toString() {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < operators.length; i++) {
                sb.append(operators[i]);
                if (i < operators.length - 1) sb.append(",");
            }
            return pointer + "|" + sb.toString() + "\n" + data;
        }
    }

    public Channel channel;
    public Status status;
    public Peering peering;
    public Transformer transformer;

    public Packet(Channel channel, Status status, Peering peering, Transformer transformer) {
        this.channel = channel;
        this.status = status;
        this.peering = peering;
        this.transformer = transformer;
    }

    public static Packet fromString(String s) {
        String[] lines = s.split("\r?\n");
        Channel ch = Channel.fromString(lines.length > 0 ? lines[0] : "");
        Status st = Status.fromString(lines.length > 1 ? lines[1] : "");
        Peering pr = Peering.fromString(lines.length > 2 ? lines[2] : "");
        
        List<String> tLines = new ArrayList<>();
        for (int i = 3; i < lines.length; i++) {
            tLines.add(lines[i]);
        }
        Transformer tr = Transformer.fromStrings(tLines);

        return new Packet(ch, st, pr, tr);
    }

    @Override
    public String toString() {
        return channel.toString() + "\n" +
               status.toString() + "\n" +
               peering.toString() + "\n" +
               transformer.toString();
    }

    public static String createSignal(String from, String to, String subject, String data) {
        Packet p = new Packet(
            new Channel("", 0, 1),
            new Status(0, "0000"),
            new Peering(System.currentTimeMillis(), from, to, subject),
            new Transformer(0, new byte[]{0}, data)
        );
        return p.toString();
    }
}