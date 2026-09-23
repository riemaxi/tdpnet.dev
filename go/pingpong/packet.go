package main

import (
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// BitVector
type BitVector struct {
	Path []byte
}

func NewBitVector(hexStr string) BitVector {
	if len(hexStr)%2 != 0 {
		hexStr = "0" + hexStr
	}
	bytes, _ := hex.DecodeString(hexStr)
	return BitVector{Path: bytes}
}

func (bv *BitVector) String() string {
	return strings.ToUpper(hex.EncodeToString(bv.Path))
}

// Channel
type Channel struct {
	Path   BitVector
	Layer  int
	Signal int
}

func NewChannelFromString(s string) Channel {
	parts := strings.Split(s, "|")
	pathStr := ""
	if len(parts) > 0 {
		pathStr = parts[0]
	}
	layer := 0
	if len(parts) > 1 {
		layer, _ = strconv.Atoi(parts[1])
	}
	signal := 0
	if len(parts) > 2 {
		signal, _ = strconv.Atoi(parts[2])
	}
	return Channel{Path: NewBitVector(pathStr), Layer: layer, Signal: signal}
}

func (c Channel) String() string {
	return fmt.Sprintf("%s|%d|%d", c.Path.String(), c.Layer, c.Signal)
}

// Status
type Status struct {
	Age    int
	Health string
}

func NewStatusFromString(s string) Status {
	parts := strings.Split(s, "|")
	age := 0
	if len(parts) > 0 {
		age, _ = strconv.Atoi(parts[0])
	}
	health := "0000"
	if len(parts) > 1 {
		health = parts[1]
	}
	return Status{Age: age, Health: health}
}

func (s Status) String() string {
	return fmt.Sprintf("%d|%s", s.Age, s.Health)
}

// Peering
type Peering struct {
	Timestamp int64
	FromPeer  string
	ToPeer    string
	Subject   string
}

func NewPeeringFromString(s string) Peering {
	parts := strings.Split(s, " ")
	ts, _ := strconv.ParseInt(parts[0], 10, 64)
	return Peering{Timestamp: ts, FromPeer: parts[1], ToPeer: parts[2], Subject: parts[3]}
}

func (p Peering) String() string {
	return fmt.Sprintf("%d %s %s %s", p.Timestamp, p.FromPeer, p.ToPeer, p.Subject)
}

// Transformer
type Transformer struct {
	Pointer   int
	Operators []byte
	Data      string
}

func NewTransformerFromStrings(lines []string) Transformer {
	meta := lines[0]
	parts := strings.Split(meta, "|")
	ptr, _ := strconv.Atoi(parts[0])

	var ops []byte
	if len(parts) > 1 && parts[1] != "" {
		for _, opStr := range strings.Split(parts[1], ",") {
			if opStr != "" {
				op, _ := strconv.Atoi(opStr)
				ops = append(ops, byte(op))
			}
		}
	}
	data := strings.Join(lines[1:], "\n")
	return Transformer{Pointer: ptr, Operators: ops, Data: data}
}

func (t Transformer) String() string {
	var opsStrs []string
	for _, op := range t.Operators {
		opsStrs = append(opsStrs, strconv.Itoa(int(op)))
	}
	return fmt.Sprintf("%d|%s\n%s", t.Pointer, strings.Join(opsStrs, ","), t.Data)
}

// Packet
type Packet struct {
	Channel     Channel
	Status      Status
	Peering     Peering
	Transformer Transformer
}

func NewPacketFromString(s string) Packet {
	lines := strings.Split(s, "\n")
	return Packet{
		Channel:     NewChannelFromString(lines[0]),
		Status:      NewStatusFromString(lines[1]),
		Peering:     NewPeeringFromString(lines[2]),
		Transformer: NewTransformerFromStrings(lines[3:]),
	}
}

func (p Packet) String() string {
	return fmt.Sprintf("%s\n%s\n%s\n%s", p.Channel, p.Status, p.Peering, p.Transformer)
}

// Helper Packeter
func CreateSignal(from, to, subject, data string) string {
	p := Packet{
		Channel: Channel{Path: NewBitVector(""), Layer: 0, Signal: 1},
		Status:  Status{Age: 0, Health: "0000"},
		Peering: Peering{
			Timestamp: time.Now().UnixMilli(),
			FromPeer:  from,
			ToPeer:    to,
			Subject:   subject,
		},
		Transformer: Transformer{Pointer: 0, Operators: []byte{0}, Data: data},
	}
	return p.String()
}