import org.json.JSONObject;

import java.util.concurrent.CompletableFuture;

public class Main implements SystemNode.SessionHandler {

    private SystemNode systemNode;
    private final JSONObject config;

    public Main() {
        JSONObject cred = new JSONObject()
                .put("accesskey", "PONPIN")
                .put("password", "000000")
                .put("address", "ponpin.aladino.maya.4da")
                .put("context", new JSONObject());

        JSONObject peers = new JSONObject()
                .put("pinpon", "pinpon.aladino.maya.4da");

        this.config = new JSONObject()
                .put("host", "ws://213.199.58.37:5000")
                .put("credential", cred)
                .put("peers", peers);
    }

    public void start() {
        System.out.println("Starting Java TDPnet Application...");
        this.systemNode = new SystemNode(config, this);
        this.systemNode.connect(config.getString("host"));
    }

    @Override
    public void onGranted(Object data) {
        System.out.println("granted " + data);
        String address = config.getJSONObject("credential").getString("address");
        String peerTarget = config.getJSONObject("peers").getString("pinpon");
        systemNode.request(address, peerTarget, "ping", 0);
    }

    @Override
    public void onDenied(Object data) {
        System.out.println("denied " + data);
    }

    @Override
    public void onEvent(String id, Packet packet) {
        String to = packet.peering.fromPeer;
        System.out.println("event " + id + " " + to + " " + System.currentTimeMillis());
        if ("ping".equals(id)) {
            CompletableFuture.runAsync(() -> {
                try {
                    Thread.sleep(2000);
                    String address = config.getJSONObject("credential").getString("address");
                    systemNode.notify(address, to, "pong", 0);
                } catch (InterruptedException ignored) {}
            });
        }
    }

    @Override
    public void onResponse(String id, Packet packet) {
        System.out.println("response " + id + " " + System.currentTimeMillis());
        if ("pong".equals(id)) {
            CompletableFuture.runAsync(() -> {
                try {
                    Thread.sleep(2000);
                    systemNode.response(packet, "ping", 1);
                } catch (InterruptedException ignored) {}
            });
        }
    }

    @Override
    public void onRequest(String id, Packet packet) {
        System.out.println("request " + id + " " + System.currentTimeMillis());
        if ("pong".equals(id)) {
            CompletableFuture.runAsync(() -> {
                try {
                    Thread.sleep(1000);
                    systemNode.response(packet, "ping", 1);
                } catch (InterruptedException ignored) {}
            });
        }
    }

    public static void main(String[] args) throws Exception {
        Main app = new Main();
        app.start();

        // Keep main process alive
        synchronized (Main.class) {
            Main.class.wait();
        }
    }
}