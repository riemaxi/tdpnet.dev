use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// ==========================================
// PACKET TYPES & PARSING
// ==========================================

#[derive(Debug, Clone)]
pub struct Packet {
    pub channel_str: String,
    pub status_str: String,
    pub from_peer: String,
    pub to_peer: String,
    pub subject: String,
    pub timestamp: u64,
    pub transformer_str: String,
}

impl Packet {
    pub fn from_string(s: &str) -> Self {
        let lines: Vec<&str> = s.lines().collect();
        let peering_parts: Vec<&str> = lines[2].split(' ').collect();

        Packet {
            channel_str: lines[0].to_string(),
            status_str: lines[1].to_string(),
            timestamp: peering_parts[0].parse().unwrap_or(0),
            from_peer: peering_parts[1].to_string(),
            to_peer: peering_parts[2].to_string(),
            subject: peering_parts[3].to_string(),
            transformer_str: lines[3..].join("\n"),
        }
    }

    pub fn to_string(&self) -> String {
        format!(
            "{}\n{}\n{} {} {} {}\n{}",
            self.channel_str,
            self.status_str,
            self.timestamp,
            self.from_peer,
            self.to_peer,
            self.subject,
            self.transformer_str
        )
    }
}

pub fn create_signal(from: &str, to: &str, subject: &str, data: &str) -> String {
    format!(
        "|0|1\n0|0000\n{} {} {} {}\n0|0\n{}",
        current_timestamp(),
        from,
        to,
        subject,
        data
    )
}

// ==========================================
// WEBSOCKET CLIENT & APPLICATION HANDLERS
// ==========================================

#[derive(Serialize, Deserialize)]
struct WSMessage {
    id: String,
    data: Value,
}

struct AppContext {
    address: String,
    peer_target: String,
    tx: Mutex<futures_util::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, Message>>,
}

impl AppContext {
    async fn send(&self, id: &str, data: Value) {
        let msg = json!({ "id": id, "data": data });
        let mut tx = self.tx.lock().await;
        let _ = tx.send(Message::Text(msg.to_string())).await;
    }

    async fn request(&self, from: &str, to: &str, id: &str, data: Value) {
        let packet = create_signal(from, to, &format!("request:{}", id), &data.to_string());
        self.send("signal", Value::String(packet)).await;
    }

    async fn response(&self, mut packet: Packet, id: &str, data: Value) {
        packet.timestamp = current_timestamp();
        let old_from = packet.from_peer.clone();
        packet.from_peer = packet.to_peer;
        packet.to_peer = old_from;
        packet.subject = format!("response:{}", id);

        let lines: Vec<&str> = packet.transformer_str.lines().collect();
        let meta = lines.get(0).cloned().unwrap_or("0|0");
        packet.transformer_str = format!("{}\n{}", meta, data);
        packet.channel_str = "|0|0".to_string();

        self.send("data", Value::String(packet.to_string())).await;
    }

    async fn notify(&self, from: &str, to: &str, id: &str, data: Value) {
        let packet = create_signal(from, to, &format!("event:{}", id), &data.to_string());
        self.send("signal", Value::String(packet)).await;
    }
}

#[tokio::main]
async fn main() {
    let host = "ws://213.199.58.37:5000";
    let address = "ponpin.aladino.maya.4da".to_string();
    let peer_target = "pinpon.aladino.maya.4da".to_string();

    let credential = json!({
        "accesskey": "PONPIN",
        "password": "000000",
        "address": address,
        "context": {}
    });

    println!("Starting Rust TDPnet Application...");

    let (ws_stream, _) = connect_async(host).await.expect("Failed to connect");
    let (write, mut read) = ws_stream.split();

    let ctx = Arc::new(AppContext {
        address: address.clone(),
        peer_target,
        tx: Mutex::new(write),
    });

    // Send signin
    ctx.send("signin", credential).await;

    // Incoming Event Loop
    while let Some(msg) = read.next().await {
        if let Ok(Message::Text(text)) = msg {
            if let Ok(ws_msg) = serde_json::from_str::<WSMessage>(&text) {
                match ws_msg.id.as_str() {
                    "granted" => {
                        println!("granted {}", ws_msg.data);
                        let ctx = ctx.clone();
                        tokio::spawn(async move {
                            ctx.request(&ctx.address, &ctx.peer_target, "ping", json!(0)).await;
                        });
                    }
                    "denied" => {
                        println!("denied {}", ws_msg.data);
                    }
                    "signal" | "data" => {
                        if let Some(pkt_str) = ws_msg.data.as_str() {
                            let packet = Packet::from_string(pkt_str);
                            let parts: Vec<&str> = packet.subject.splitn(2, ':').collect();
                            if parts.len() == 2 {
                                let (category, id_val) = (parts[0], parts[1]);
                                match category {
                                    "event" => {
                                        let to = packet.from_peer.clone();
                                        println!("event {} {} {}", id_val, to, current_timestamp());
                                        if id_val == "ping" {
                                            let ctx = ctx.clone();
                                            tokio::spawn(async move {
                                                sleep(Duration::from_secs(2)).await;
                                                ctx.notify(&ctx.address, &to, "pong", json!(0)).await;
                                            });
                                        }
                                    }
                                    "response" => {
                                        println!("response {} {}", id_val, current_timestamp());
                                        if id_val == "pong" {
                                            let ctx = ctx.clone();
                                            tokio::spawn(async move {
                                                sleep(Duration::from_secs(2)).await;
                                                ctx.response(packet, "ping", json!(1)).await;
                                            });
                                        }
                                    }
                                    "request" => {
                                        println!("request {} {}", id_val, current_timestamp());
                                        if id_val == "pong" {
                                            let ctx = ctx.clone();
                                            tokio::spawn(async move {
                                                sleep(Duration::from_secs(1)).await;
                                                ctx.response(packet, "ping", json!(1)).await;
                                            });
                                        }
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
}