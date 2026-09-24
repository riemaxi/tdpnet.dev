import org.json.JSONObject;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.CompletionStage;

public class SystemNode implements WebSocket.Listener {

    public interface SessionHandler {
        void onGranted(Object data);
        void onDenied(Object data);
        void onRequest(String id, Packet packet);
        void onResponse(String id, Packet packet);
        void onEvent(String id, Packet packet);
    }

    private final JSONObject config;
    private final SessionHandler handler;
    private WebSocket webSocket;
    private final StringBuilder buffer = new StringBuilder();

    public SystemNode(JSONObject config, SessionHandler handler) {
        this.config = config;
        this.handler = handler;
    }

    public void connect(String hostUrl) {
        HttpClient client = HttpClient.newHttpClient();
        client.newWebSocketBuilder()
                .buildAsync(URI.create(hostUrl), this)
                .thenAccept(ws -> {
                    this.webSocket = ws;
                    // Send signin upon establishing connection
                    JSONObject cred = config.getJSONObject("credential");
                    send("signin", cred);
                })
                .exceptionally(ex -> {
                    System.err.println("WebSocket connection failed: " + ex.getMessage());
                    return null;
                });
    }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        buffer.append(data);
        if (last) {
            String fullMessage = buffer.toString();
            buffer.setLength(0);
            try {
                JSONObject msg = new JSONObject(fullMessage);
                String idVal = msg.optString("id");
                Object msgData = msg.opt("data");

                switch (idVal) {
                    case "granted":
                        if (handler != null) handler.onGranted(msgData);
                        break;
                    case "denied":
                        if (handler != null) handler.onDenied(msgData);
                        break;
                    case "signal":
                    case "data":
                        if (msgData instanceof String) {
                            Packet packet = Packet.fromString((String) msgData);
                            String[] parts = packet.peering.subject.split(":", 2);
                            if (parts.length == 2) {
                                String category = parts[0];
                                String subId = parts[1];
                                switch (category) {
                                    case "request":
                                        if (handler != null) handler.onRequest(subId, packet);
                                        break;
                                    case "response":
                                        if (handler != null) handler.onResponse(subId, packet);
                                        break;
                                    case "event":
                                        if (handler != null) handler.onEvent(subId, packet);
                                        break;
                                }
                            }
                        }
                        break;
                }
            } catch (Exception e) {
                System.err.println("Error parsing message: " + e.getMessage());
            }
        }
        return WebSocket.Listener.super.onText(webSocket, data, last);
    }

    @Override
    public void onError(WebSocket webSocket, Throwable error) {
        System.err.println("WebSocket Error: " + error.getMessage());
    }

    public synchronized void send(String id, Object data) {
        if (webSocket != null) {
            JSONObject msg = new JSONObject();
            msg.put("id", id);
            msg.put("data", data);
            webSocket.sendText(msg.toString(), true);
        }
    }

    public void request(String from, String to, String id, Object data) {
        String packetStr = Packet.createSignal(from, to, "request:" + id, data.toString());
        send("signal", packetStr);
    }

    public void response(Packet packet, String id, Object data) {
        packet.peering.timestamp = System.currentTimeMillis();
        String oldFrom = packet.peering.fromPeer;
        packet.peering.fromPeer = packet.peering.toPeer;
        packet.peering.toPeer = oldFrom;
        packet.peering.subject = "response:" + id;
        packet.transformer.data = data.toString();
        packet.channel.signal = 0;
        send("data", packet.toString());
    }

    public void notify(String from, String to, String id, Object data) {
        String packetStr = Packet.createSignal(from, to, "event:" + id, data.toString());
        send("signal", packetStr);
    }
}