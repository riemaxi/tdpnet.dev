#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <thread>
#include <memory>
#include <nlohmann/json.hpp>
#include <ixwebsocket/IXWebSocket.h>

using json = nlohmann::json;

// ==========================================
// PACKET CLASSES
// ==========================================

class BitVector {
public:
    std::vector<uint8_t> path;

    BitVector() = default;
    explicit BitVector(const std::string& str_val) {
        path = convert_to_int8_array(str_val);
    }

    static std::vector<uint8_t> convert_to_int8_array(std::string hex_str) {
        if (hex_str.empty()) return {};
        if (hex_str.length() % 2 != 0) hex_str = "0" + hex_str;

        std::vector<uint8_t> bytes;
        for (size_t i = 0; i < hex_str.length(); i += 2) {
            std::string byteString = hex_str.substr(i, 2);
            uint8_t byte = static_cast<uint8_t>(strtol(byteString.c_str(), nullptr, 16));
            bytes.push_back(byte);
        }
        return bytes;
    }

    bool marked(size_t index) const {
        size_t byte_index = index / 8;
        size_t bit_index = 7 - (index % 8);
        if (byte_index >= path.size()) return false;
        return (path[byte_index] & (1 << bit_index)) != 0;
    }

    void mark(size_t index) {
        size_t byte_index = index / 8;
        size_t bit_index = 7 - (index % 8);
        if (byte_index >= path.size()) {
            path.resize(byte_index + 1, 0);
        }
        path[byte_index] |= (1 << bit_index);
    }

    std::string to_string() const {
        std::ostringstream oss;
        for (uint8_t b : path) {
            oss << std::uppercase << std::setfill('0') << std::setw(2) << std::hex << (int)b;
        }
        return oss.str();
    }
};

class Channel {
public:
    BitVector path;
    int layer;
    int signal;

    Channel(const std::string& path_str, int layer, int signal)
        : path(path_str), layer(layer), signal(signal) {}

    bool marked(size_t id_val) const { return path.marked(id_val); }
    void mark(size_t id_val) { path.mark(id_val); }

    int is_signal() const { return signal; }
    void set_signal(int value) { signal = value; }

    bool above(int l) const { return layer > l; }

    std::string to_string() const {
        return path.to_string() + "|" + std::to_string(layer) + "|" + std::to_string(signal);
    }

    static Channel create(const std::string& path, int layer, int signal) {
        return Channel(path, layer, signal);
    }

    static Channel from_string(const std::string& data) {
        std::stringstream ss(data);
        std::string part;
        std::vector<std::string> parts;
        while (std::getline(ss, part, '|')) {
            parts.push_back(part);
        }
        std::string path_str = !parts.empty() ? parts[0] : "";
        int layer = parts.size() > 1 ? std::stoi(parts[1]) : 0;
        int signal = parts.size() > 2 ? std::stoi(parts[2]) : 0;
        return Channel(path_str, layer, signal);
    }
};

class Status {
public:
    int age;
    std::string health;

    Status(int age, std::string health) : age(age), health(std::move(health)) {}

    bool too_old(int max_val) const { return age > max_val; }
    bool ill(const std::string& pattern) const { return health != pattern; }
    void get_older(int inc = 1) { age += inc; }

    std::string to_string() const {
        return std::to_string(age) + "|" + health;
    }

    static Status from_string(const std::string& data) {
        size_t pos = data.find('|');
        if (pos == std::string::npos) return Status(0, "0000");
        int age = std::stoi(data.substr(0, pos));
        std::string health = data.substr(pos + 1);
        return Status(age, health);
    }
};

class Peering {
public:
    int64_t timestamp;
    std::string from_peer;
    std::string to_peer;
    std::string subject;

    Peering(std::string from, std::string to, std::string subj, int64_t ts = -1)
        : from_peer(std::move(from)), to_peer(std::move(to)), subject(std::move(subj)) {
        if (ts == -1) {
            timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::system_clock::now().time_since_epoch()).count();
        } else {
            timestamp = ts;
        }
    }

    std::string to_string() const {
        return std::to_string(timestamp) + " " + from_peer + " " + to_peer + " " + subject;
    }

    static Peering from_string(const std::string& data) {
        std::stringstream ss(data);
        std::string ts_str, from, to, subject;
        ss >> ts_str >> from >> to >> subject;
        return Peering(from, to, subject, std::stoll(ts_str));
    }

    static Peering from_map(const json& data) {
        return Peering(data["from"].get<std::string>(), data["to"].get<std::string>(), data["subject"].get<std::string>());
    }
};

class Transformer {
public:
    int pointer;
    std::vector<uint8_t> operators;
    std::string data;

    Transformer(int pointer, std::vector<uint8_t> operators, std::string data)
        : pointer(pointer), operators(std::move(operators)), data(std::move(data)) {}

    int shift(int delta = 1) {
        int p = pointer + delta;
        if (p >= 0 && p < static_cast<int>(operators.size())) {
            pointer = p;
        }
        return pointer;
    }

    void apply() { shift(); }

    std::string to_string() const {
        std::ostringstream oss;
        oss << pointer << "|";
        for (size_t i = 0; i < operators.size(); ++i) {
            oss << (int)operators[i] << (i + 1 < operators.size() ? "," : "");
        }
        oss << "\n" << data;
        return oss.str();
    }

    static Transformer from_strings(const std::vector<std::string>& lst) {
        std::string meta = lst[0];
        std::string data;
        for (size_t i = 1; i < lst.size(); ++i) {
            data += lst[i] + (i + 1 < lst.size() ? "\n" : "");
        }
        size_t pipe_pos = meta.find('|');
        int ptr = std::stoi(meta.substr(0, pipe_pos));
        std::string ops_str = meta.substr(pipe_pos + 1);

        std::vector<uint8_t> ops;
        std::stringstream ss(ops_str);
        std::string token;
        while (std::getline(ss, token, ',')) {
            if (!token.empty()) {
                ops.push_back(static_cast<uint8_t>(std::stoi(token)));
            }
        }
        return Transformer(ptr, ops, data);
    }

    static Transformer from_string(const std::string& str_val) {
        std::stringstream ss(str_val);
        std::string line;
        std::vector<std::string> lines;
        while (std::getline(ss, line)) {
            lines.push_back(line);
        }
        return from_strings(lines);
    }
};

class Packet {
public:
    Channel channel;
    Status status;
    Peering peering;
    Transformer transformer;

    Packet(Channel c, Status s, Peering p, Transformer t)
        : channel(std::move(c)), status(std::move(s)), peering(std::move(p)), transformer(std::move(t)) {}

    std::string to_string() const {
        return channel.to_string() + "\n" +
               status.to_string() + "\n" +
               peering.to_string() + "\n" +
               transformer.to_string();
    }

    static Packet from_string(const std::string& data, char separator = '\n') {
        std::stringstream ss(data);
        std::string line;
        std::vector<std::string> parts;
        while (std::getline(ss, line, separator)) {
            parts.push_back(line);
        }

        Channel ch = Channel::from_string(parts[0]);
        Status st = Status::from_string(parts[1]);
        Peering pe = Peering::from_string(parts[2]);
        std::vector<std::string> trans_parts(parts.begin() + 3, parts.end());
        Transformer tr = Transformer::from_strings(trans_parts);

        return Packet(ch, st, pe, tr);
    }
};

// ==========================================
// HELPER CLASSES
// ==========================================

class Packeter {
public:
    static inline std::vector<uint8_t> ONE_OPERATOR = {0};

    static std::string create_signal(const std::string& from_peer, const std::string& to,
                                     const std::string& data, const std::string& subject,
                                     const std::vector<uint8_t>& operators = ONE_OPERATOR, int pointer = 0) {
        Packet p(
            Channel::create("", 0, 1),
            Status(0, "0000"),
            Peering(from_peer, to, subject),
            Transformer(pointer, operators, data)
        );
        return p.to_string();
    }
};

// ==========================================
// TDPNET & SESSIONS
// ==========================================

class TDPnet {
protected:
    ix::WebSocket _webSocket;

public:
    virtual ~TDPnet() {
        _webSocket.stop();
    }

    void connect(const std::string& host, const std::string& ca = "") {
        _webSocket.setUrl(host);

        if (host.rfind("wss://", 0) == 0) {
            ix::SocketTLSOptions tlsOptions;
            tlsOptions.caFile = ca;
            tlsOptions.disable_hostname_validation = true;
            _webSocket.setTLSOptions(tlsOptions);
        }

        _webSocket.setOnMessageCallback([this](const ix::WebSocketMessagePtr& msg) {
            if (msg->type == ix::WebSocketMessageType::Open) {
                int64_t now = std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count();
                this->on_connected(now);
            } else if (msg->type == ix::WebSocketMessageType::Message) {
                try {
                    auto m = json::parse(msg->str);
                    this->handle_event(m.value("id", ""), m.value("data", json{}));
                } catch (const std::exception& e) {
                    this->on_error(e.what());
                }
            } else if (msg->type == ix::WebSocketMessageType::Error) {
                this->on_connection_error(msg->errorInfo.reason);
            }
        });

        _webSocket.start();
    }

    virtual void on_connected(int64_t timestamp) {}
    virtual void on_error(const std::string& err) { std::cerr << "Error: " << err << std::endl; }
    virtual void on_connection_error(const std::string& err) { std::cerr << "Conn Error: " << err << std::endl; }
    virtual void handle_event(const std::string& id_val, const json& data) {}

    void send(const std::string& id_val, const json& data) {
        json j = {{"id", id_val}, {"data", data}};
        _webSocket.send(j.dump());
    }
};

class Session : public TDPnet {
public:
    void signin(const json& data) { send("signin", data); }
    void signoff(const json& data) { send("signoff", data); }
    void send_data(const std::string& data) { send("data", data); }
    void send_signal(const std::string& data) { send("signal", data); }

    void handle_event(const std::string& id_val, const json& data) override {
        if (id_val == "error") on_error(data.dump());
        else if (id_val == "open") on_open(data);
        else if (id_val == "signal") on_signal(data.get<std::string>());
        else if (id_val == "data") on_data(data.get<std::string>());
        else if (id_val == "granted") on_granted(data);
        else if (id_val == "denied") on_denied(data);
    }

    virtual void on_open(const json& data) {}
    virtual void on_granted(const json& data) {}
    virtual void on_denied(const json& data) {}
    virtual void on_signal(const std::string& data) {}
    virtual void on_data(const std::string& data) {}
};

class StandardSession : public Session {
public:
    void on_signal(const std::string& e) override {
        Packet packet = Packet::from_string(e);
        size_t pos = packet.peering.subject.find(':');
        if (pos != std::string::npos) {
            std::string category = packet.peering.subject.substr(0, pos);
            std::string id_val = packet.peering.subject.substr(pos + 1);

            if (category == "request") on_request(id_val, packet);
            else if (category == "response") on_response(id_val, packet);
            else if (category == "event") on_event(id_val, packet);
        }
    }

    void on_data(const std::string& e) override {
        on_signal(e); // Same parsing logic
    }

    virtual void on_request(const std::string& id_val, const Packet& p) {}
    virtual void on_response(const std::string& id_val, const Packet& p) {}
    virtual void on_event(const std::string& id_val, const Packet& p) {}

    void request(const std::string& from_peer, const std::string& to, const std::string& id_val, const json& data) {
        std::string packet = Packeter::create_signal(from_peer, to, data.dump(), "request:" + id_val);
        send_signal(packet);
    }

    void response(Packet packet, const std::string& id_val, const json& data) {
        packet.peering = Peering(packet.peering.to_peer, packet.peering.from_peer, "response:" + id_val);
        packet.transformer.data = data.dump();
        packet.channel.set_signal(0);
        send_data(packet.to_string());
    }

    void notify(const std::string& from_peer, const std::string& to, const std::string& id_val, const json& data) {
        std::string packet = Packeter::create_signal(from_peer, to, data.dump(), "event:" + id_val);
        send_signal(packet);
    }
};