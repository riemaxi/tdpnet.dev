import kotlinx.coroutines.*
import org.json.JSONObject

class Application(config: JSONObject) : SessionHandler {

    private val systemNode = SystemNode(config, this)
    private val configObj = config

    fun start() {
        println("Starting Kotlin TDPnet Application...")
        systemNode.connect(configObj.getString("host"))
    }

    override fun onGranted(data: Any?) {
        println("granted $data")
        val address = configObj.getJSONObject("credential").getString("address")
        val peerTarget = configObj.getJSONObject("peers").getString("pinpon")
        systemNode.request(address, peerTarget, "ping", 0)
    }

    override fun onDenied(data: Any?) {
        println("denied $data")
    }

    override fun onEvent(id: String, packet: Packet) {
        val to = packet.peering.fromPeer
        println("event $id $to ${System.currentTimeMillis()}")
        if (id == "ping") {
            CoroutineScope(Dispatchers.Default).launch {
                delay(2000)
                val address = configObj.getJSONObject("credential").getString("address")
                systemNode.notify(address, to, "pong", 0)
            }
        }
    }

    override fun onResponse(id: String, packet: Packet) {
        println("response $id ${System.currentTimeMillis()}")
        if (id == "pong") {
            CoroutineScope(Dispatchers.Default).launch {
                delay(2000)
                systemNode.response(packet, "ping", 1)
            }
        }
    }

    override fun onRequest(id: String, packet: Packet) {
        println("request $id ${System.currentTimeMillis()}")
        if (id == "pong") {
            CoroutineScope(Dispatchers.Default).launch {
                delay(1000)
                systemNode.response(packet, "ping", 1)
            }
        }
    }
}

fun main() = runBlocking {
    val cred = JSONObject().apply {
        put("accesskey", "PONPIN")
        put("password", "000000")
        put("address", "ponpin.aladino.maya.4da")
        put("context", JSONObject())
    }

    val peers = JSONObject().apply {
        put("pinpon", "pinpon.aladino.maya.4da")
    }

    val config = JSONObject().apply {
        put("host", "ws://213.199.58.37:5000")
        put("credential", cred)
        put("peers", peers)
    }

    val app = Application(config)
    app.start()

    // Keep application alive
    awaitCancellation()
}