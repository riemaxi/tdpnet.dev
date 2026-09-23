package main

import (
	"fmt"
	"log"
	"time"
)

type Application struct {
	System *System
	Config map[string]interface{}
}

func (a *Application) OnGranted(data interface{}) {
	fmt.Println("granted", data)
	address := a.Config["credential"].(map[string]interface{})["address"].(string)
	peers := a.Config["peers"].(map[string]interface{})
	a.System.Request(address, peers["pinpon"].(string), "ping", 0)
}

func (a *Application) OnDenied(data interface{}) {
	fmt.Println("denied", data)
}

func (a *Application) OnEvent(id string, p Packet) {
	to := p.Peering.FromPeer
	fmt.Println("event", id, to, time.Now().UnixMilli())
	if id == "ping" {
		go func() {
			time.Sleep(2 * time.Second)
			address := a.Config["credential"].(map[string]interface{})["address"].(string)
			a.System.Notify(address, to, "pong", 0)
		}()
	}
}

func (a *Application) OnResponse(id string, p Packet) {
	fmt.Println("response", id, time.Now().UnixMilli())
	if id == "pong" {
		go func() {
			time.Sleep(2 * time.Second)
			a.System.Response(p, "ping", 1)
		}()
	}
}

func (a *Application) OnRequest(id string, p Packet) {
	fmt.Println("request", id, time.Now().UnixMilli())
	if id == "pong" {
		go func() {
			time.Sleep(1 * time.Second)
			a.System.Response(p, "ping", 1)
		}()
	}
}

func main() {
	config := map[string]interface{}{
		"host": "ws://213.199.58.37:5000",
		"credential": map[string]interface{}{
			"accesskey": "PONPIN",
			"password":  "000000",
			"address":   "ponpin.aladino.maya.4da",
			"context":   map[string]interface{}{},
		},
		"peers": map[string]interface{}{
			"pinpon": "pinpon.aladino.maya.4da",
		},
	}

	app := &Application{Config: config}
	sys := &System{Config: config, Handler: app}
	app.System = sys

	fmt.Println("Starting Go TDPnet Application...")
	err := sys.Connect(config["host"].(string))
	if err != nil {
		log.Fatal("Connection error:", err)
	}

	// Keep main goroutine alive
	select {}
}