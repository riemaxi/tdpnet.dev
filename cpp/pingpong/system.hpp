#pragma once

#include "tdpnet.hpp"

class System : public StandardSession {
public:
    json config;

    explicit System(json config, bool auto_connect = true) : config(std::move(config)) {
        if (auto_connect) {
            connect(get_host(), get_ssl());
        }
    }

    std::string get_ssl() const {
        return config.value("ssl", "");
    }

    std::string get_host() const {
        return config.value("host", "");
    }

    json get_credential() const {
        return config.value("credential", json::object());
    }

    std::string get_address() const {
        return get_credential().value("address", "");
    }

    json get_peers() const {
        return config.value("peers", json::object());
    }

    void on_connected(int64_t timestamp) override {
        signin(get_credential());
    }

    void on_granted(const json& data) override {}
    void on_denied(const json& data) override {}
};