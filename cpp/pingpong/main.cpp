#include "system.hpp"

// Equivalent to config.py
const json app_config = {
    {"ponpin", {
        {"host", "ws://213.199.58.37:5000"},
        {"credential", {
            {"accesskey", "PONPIN"},
            {"password", "000000"},
            {"address", "ponpin.aladino.maya.4da"},
            {"context", json::object()}
        }},
        {"peers", {
            {"pinpon", "pinpon.aladino.maya.4da"}
        }}
    }}
};

class Application : public System {
public:
    Application() : System(app_config["ponpin"], false) {}

    void on_denied(const json& data) override {
        std::cout << "denied " << data << std::endl;
    }

    void on_granted(const json& data) override {
        std::cout << "granted " << data << std::endl;
        request(get_address(), get_peers()["pinpon"].get<std::string>(), "ping", 0);
    }

    void on_event(const std::string& id_val, const Packet& packet) override {
        std::string to = packet.peering.from_peer;
        int64_t now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        std::cout << "event " << id_val << " " << to << " " << now << std::endl;

        if (id_val == "ping") {
            delayed_notify(to, "pong", 0, 2000);
        }
    }

    void on_response(const std::string& id_val, const Packet& packet) override {
        int64_t now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        std::cout << "response " << id_val << " " << now << std::endl;

        if (id_val == "pong") {
            delayed_response(packet, "ping", 1, 2000);
        }
    }

    void on_request(const std::string& id_val, const Packet& packet) override {
        int64_t now = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        std::cout << "request " << id_val << " " << now << std::endl;

        if (id_val == "pong") {
            delayed_response(packet, "ping", 1, 1000);
        }
    }

private:
    void delayed_notify(std::string to, std::string event_id, json data, int delay_ms) {
        std::thread([this, to = std::move(to), event_id = std::move(event_id), data = std::move(data), delay_ms]() {
            std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
            this->notify(this->get_address(), to, event_id, data);
        }).detach();
    }

    void delayed_response(Packet packet, std::string response_id, json data, int delay_ms) {
        std::thread([this, packet = std::move(packet), response_id = std::move(response_id), data = std::move(data), delay_ms]() mutable {
            std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
            this->response(packet, response_id, data);
        }).detach();
    }
};

int main() {
    ix::initNetSystem();

    Application app;
    app.connect(app.get_host(), app.get_ssl());

    // Keep the main thread alive (similar to asyncio.Event().wait())
    while (true) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    ix::uninitNetSystem();
    return 0;
}