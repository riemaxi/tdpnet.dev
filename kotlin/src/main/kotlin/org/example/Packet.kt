import java.util.HexFormat

class BitVector(hexStr: String) {
    val path: ByteArray

    init {
        val sanitized = if (hexStr.length % 2 != 0) "0$hexStr" else hexStr
        path = if (sanitized.isEmpty()) {
            ByteArray(0)
        } else {
            HexFormat.of().parseHex(sanitized)
        }
    }

    override fun toString(): String {
        return HexFormat.of().formatHex(path).uppercase()
    }
}

data class Channel(
    val path: BitVector,
    var layer: Long,
    var signal: Long
) {
    override fun toString(): String = "$path|$layer|$signal"

    companion object {
        fun fromString(s: String): Channel {
            val parts = s.split("|")
            val pathStr = parts.getOrNull(0) ?: ""
            val layer = parts.getOrNull(1)?.toLongOrNull() ?: 0L
            val signal = parts.getOrNull(2)?.toLongOrNull() ?: 0L
            return Channel(BitVector(pathStr), layer, signal)
        }
    }
}

data class Status(
    val age: Long,
    val health: String
) {
    override fun toString(): String = "$age|$health"

    companion object {
        fun fromString(s: String): Status {
            val parts = s.split("|")
            val age = parts.getOrNull(0)?.toLongOrNull() ?: 0L
            val health = parts.getOrNull(1) ?: "0000"
            return Status(age, health)
        }
    }
}

data class Peering(
    var timestamp: Long,
    var fromPeer: String,
    var toPeer: String,
    var subject: String
) {
    override fun toString(): String = "$timestamp $fromPeer $toPeer $subject"

    companion object {
        fun fromString(s: String): Peering {
            val parts = s.split(" ")
            val ts = parts.getOrNull(0)?.toLongOrNull() ?: 0L
            val from = parts.getOrNull(1) ?: ""
            val to = parts.getOrNull(2) ?: ""
            val subj = parts.getOrNull(3) ?: ""
            return Peering(ts, from, to, subj)
        }
    }
}

data class Transformer(
    val pointer: Long,
    val operators: ByteArray,
    var data: String
) {
    override fun toString(): String {
        val opsStr = operators.joinToString(",")
        return "$pointer|$opsStr\n$data"
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as Transformer
        return pointer == other.pointer && operators.contentEquals(other.operators) && data == other.data
    }

    override fun hashCode(): Int {
        var result = pointer.hashCode()
        result = 31 * result + operators.contentHashCode()
        result = 31 * result + data.hashCode()
        return result
    }

    companion object {
        fun fromStrings(lines: List<String>): Transformer {
            val metaLine = lines.firstOrNull() ?: "0|0"
            val parts = metaLine.split("|")
            val ptr = parts.getOrNull(0)?.toLongOrNull() ?: 0L

            val ops = parts.getOrNull(1)?.split(",")
                ?.filter { it.isNotBlank() }
                ?.map { it.trim().toByte() }
                ?.toByteArray() ?: byteArrayOf(0)

            val dataStr = if (lines.size > 1) lines.drop(1).joinToString("\n") else ""
            return Transformer(ptr, ops, dataStr)
        }
    }
}

data class Packet(
    val channel: Channel,
    val status: Status,
    val peering: Peering,
    val transformer: Transformer
) {
    override fun toString(): String {
        return "$channel\n$status\n$peering\n$transformer"
    }

    companion object {
        fun fromString(s: String): Packet {
            val lines = s.lines()
            val ch = Channel.fromString(lines.getOrElse(0) { "" })
            val st = Status.fromString(lines.getOrElse(1) { "" })
            val pr = Peering.fromString(lines.getOrElse(2) { "" })
            val tr = Transformer.fromStrings(if (lines.size > 3) lines.drop(3) else emptyList())
            return Packet(ch, st, pr, tr)
        }

        fun createSignal(from: String, to: String, subject: String, data: String): String {
            val p = Packet(
                channel = Channel("", 0, 1),
                status = Status(0, "0000"),
                peering = Peering(System.currentTimeMillis(), from, to, subject),
                transformer = Transformer(0, byteArrayOf(0), data)
            )
            return p.toString()
        }
    }
}