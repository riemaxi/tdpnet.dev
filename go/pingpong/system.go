package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type SessionHandler interface {
	OnGranted(data interface{})
	OnDenied(data interface{})
	OnRequest(id string, p Packet)
	OnResponse(id string, p Packet)
	OnEvent(id string, p Packet)
}

type System struct {
	Config  map[string]interface{}
	Conn    *websocket.Conn
	mu      sync.Mutex
	Handler SessionHandler
}

type WSMessage struct {
	ID   string      `json:"id"`
	Data interface{} `json:"data"`
}

func (s *System) Connect(host string) error {
	dialer := websocket.DefaultDialer
	if strings.HasPrefix(host, "wss://") {
		dialer.TLSClientConfig = nil
	}

	conn, _, err := dialer.Dial(host, http.Header{})
	if err != nil {
		return err
	}
	s.Conn = conn

	// Signin
	cred := s.Config["credential"]
	s.Send("signin", cred)

	go s.listen()
	return nil
}

func (s *System) listen() {
	defer s.Conn.Close()
	for {
		_, message, err := s.Conn.ReadMessage()
		if err != nil {
			log.Println("Read error:", err)
			return
		}

		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.ID {
		case "granted":
			if s.Handler != nil {
				s.Handler.OnGranted(msg.Data)
			}
		case "denied":
			if s.Handler != nil {
				s.Handler.OnDenied(msg.Data)
			}
		case "signal", "data":
			if pktStr, ok := msg.Data.(string); ok {
				packet := NewPacketFromString(pktStr)
				parts := strings.SplitN(packet.Peering.Subject, ":", 2)
				if len(parts) == 2 {
					category, idVal := parts[0], parts[1]
					switch category {
					case "request":
						s.Handler.OnRequest(idVal, packet)
					case "response":
						s.Handler.OnResponse(idVal, packet)
					case "event":
						s.Handler.OnEvent(idVal, packet)
					}
				}
			}
		}
	}
}

func (s *System) Send(id string, data interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Conn != nil {
		s.Conn.WriteJSON(WSMessage{ID: id, Data: data})
	}
}

func (s *System) Request(from, to, id string, data interface{}) {
	dataBytes, _ := json.Marshal(data)
	packet := CreateSignal(from, to, "request:"+id, string(dataBytes))
	s.Send("signal", packet)
}

func (s *System) Response(p Packet, id string, data interface{}) {
	dataBytes, _ := json.Marshal(data)
	p.Peering = Peering{
		Timestamp: time.Now().UnixMilli(),
		FromPeer:  p.Peering.ToPeer,
		ToPeer:    p.Peering.FromPeer,
		Subject:   "response:" + id,
	}
	p.Transformer.Data = string(dataBytes)
	p.Channel.Signal = 0
	s.Send("data", p.String())
}

func (s *System) Notify(from, to, id string, data interface{}) {
	dataBytes, _ := json.Marshal(data)
	packet := CreateSignal(from, to, "event:"+id, string(dataBytes))
	s.Send("signal", packet)
}