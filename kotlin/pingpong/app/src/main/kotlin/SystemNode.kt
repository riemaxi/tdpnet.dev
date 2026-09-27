import org.json.JSONObject
import java.net.URI
import java.net.http.HttpClient
import java.net.http.WebSocket
import java.util.concurrent.CompletionStage

interface SessionHandler {
    fun onGranted(data: Any?)
    fun onDenied(data: Any?)
    fun onRequest(id: String, packet: Packet)
    fun onResponse(id: String, packet: Packet)
    fun onEvent(id: String, packet: Packet)
}

open class SystemNode(
    val config: JSONObject,
    val handler: SessionHandler? = null
) : WebSocket.Listener {

    private var webSocket: WebSocket? = null
    private val buffer = StringBuilder()

    fun connect(hostUrl: String) {
        val client = HttpClient.newHttpClient()
        client.newWebSocketBuilder()
            .buildAsync(URI.create(hostUrl), this)
            .thenAccept { ws ->
                this.webSocket = ws
                val cred = config.getJSONObject("credential")
                send("signin", cred)
            }
            .exceptionally { ex ->
                System.err.println("WebSocket connection failed: ${ex.message}")
                null
            }
    }

    override fun onText(webSocket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*>? {
        buffer.append(data)
        if (last) {
            val fullMessage = buffer.toString()
            buffer.setLength(0)
            try {
                val msg = JSONObject(fullMessage)
                val idVal = msg.optString("id")
                val msgData = msg.opt("data")

                when (idVal) {
                    "granted" -> handler?.onGranted(msgData)
                    "denied" -> handler?.onDenied(msgData)
                    "signal", "data" -> {
                        if (msgData != null) {
                            val packet = Packet.fromString(msgData.toString())
                            val parts = packet.peering.subject.split(":", limit = 2)
                            if (parts.size == 2) {
                                val (category, subId) = parts
                                when (category) {
                                    "request" -> handler?.onRequest(subId, packet)
                                    "response" -> handler?.onResponse(subId, packet)
                                    "event" -> handler?.onEvent(subId, packet)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                System.err.println("Error parsing message: ${e.message}")
            }
        }
        return super.onText(webSocket, data, last)
    }

    override fun onError(webSocket: WebSocket, error: Throwable) {
        System.err.println("WebSocket Error: ${error.message}")
    }

    @Synchronized
    fun send(id: String, data: Any?) {
        webSocket?.let {
            val msg = JSONObject().apply {
                put("id", id)
                put("data", data)
            }
            it.sendText(msg.toString(), true)
        } ?: System.err.println("Cannot send message: WebSocket is not connected yet.")
    }

    fun request(from: String, to: String, id: String, data: Any) {
        val packetStr = Packet.createSignal(from, to, "request:$id", data.toString())
        send("signal", packetStr)
    }

    fun response(packet: Packet, id: String, data: Any) {
        packet.peering.timestamp = System.currentTimeMillis()
        val oldFrom = packet.peering.fromPeer
        packet.peering.fromPeer = packet.peering.toPeer
        packet.peering.toPeer = oldFrom
        packet.peering.subject = "response:$id"
        packet.transformer.data = data.toString()
        packet.channel.signal = 0
        send("data", packet.toString())
    }

    fun notify(from: String, to: String, id: String, data: Any) {
        val packetStr = Packet.createSignal(from, to, "event:$id", data.toString())
        send("signal", packetStr)
    }
}