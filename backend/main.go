package main

import (
	"database/sql"
	"encoding/binary"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
	"log"
	"math"
	"miner-backend/game"
	"net/http"
	"os"
	"sync"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

// Protocol constants
const (
	ProtocolVersion byte = 1

	OpStart     byte = 0x01
	OpOpenCell  byte = 0x02
	OpCashOut   byte = 0x03
	OpAdjustBet byte = 0x04

	MsgState byte = 0x10
	MsgError byte = 0x11
)

// Binary State Layout (MsgState 0x10):
// [0]   MsgState
// [1]   protocolVersion
// [2]   cellCount (uint8)
// [3..6]   balance int32 LE
// [7..10]  netWin int32 LE
// [11..14] betPerClick int32 LE (renamed from betAmount)
// [15..18] totalWin int32 LE
// [19..22] totalBet int32 LE (new field)
// [23] flags: bit0 gameActive, bit1 betLocked, bit2 energized
// [24..27] globalStack float32 LE (new field)
// [28] bombCount uint8 (new field)
// [29] revealedCount uint8 (new field)
// [30] activeGlobalsCount uint8 (new field)
// [31] messageLen (uint8) = N
// [32..31+N] ASCII message bytes
// Then activeGlobals (3 bytes each): tier, remaining, cellIndex
// Then per cell (7 bytes each):
//   b0 flags/type bits: bit0 open,1 strike,2 disabled,3 wiggling,4-6 type(0..4),7 bonusExhausted
//   b1..b2 amount uint16 LE
//   b3..b4 multiplier *100 uint16 LE
//   b5 bonusTimer (0 if none)
//   b6 globalTier (for WIN_X2 cells)

func encodeState(st game.State) []byte {
	cellCount := len(st.Cells)
	activeGlobalsCount := len(st.ActiveGlobals)
	msgBytes := []byte(st.Message)
	if len(msgBytes) > 255 {
		msgBytes = msgBytes[:255]
	}
	headerLen := 32 + len(msgBytes) + activeGlobalsCount*3
	frameLen := headerLen + cellCount*7 // Updated to 7 bytes per cell
	buf := make([]byte, frameLen)

	buf[0] = MsgState
	buf[1] = ProtocolVersion
	buf[2] = byte(cellCount)

	// Cast to int32 for wire (clamp if needed)
	binary.LittleEndian.PutUint32(buf[3:7], uint32(int32(st.Balance)))
	binary.LittleEndian.PutUint32(buf[7:11], uint32(int32(st.NetWin)))
	binary.LittleEndian.PutUint32(buf[11:15], uint32(int32(st.BetPerClick))) // Renamed
	binary.LittleEndian.PutUint32(buf[15:19], uint32(int32(st.TotalWin)))
	binary.LittleEndian.PutUint32(buf[19:23], uint32(int32(st.TotalBet))) // New field

	var flags byte
	if st.IsGameActive {
		flags |= 1 << 0
	}
	if st.IsBetLocked {
		flags |= 1 << 1
	}
	if st.IsEnergized {
		flags |= 1 << 2
	}
	buf[23] = flags

	// Encode globalStack as float32
	binary.LittleEndian.PutUint32(buf[24:28], math.Float32bits(st.GlobalStack))

	buf[28] = st.BombCount
	buf[29] = st.RevealedCount
	buf[30] = byte(activeGlobalsCount)
	buf[31] = byte(len(msgBytes))

	copy(buf[32:32+len(msgBytes)], msgBytes)

	// Encode active globals
	off := 32 + len(msgBytes)
	for _, global := range st.ActiveGlobals {
		buf[off] = global.Tier
		buf[off+1] = global.Remaining
		buf[off+2] = global.CellIndex
		off += 3
	}

	// Encode cells
	for i := 0; i < cellCount; i++ {
		c := st.Cells[i]
		var cflags byte
		if c.IsOpen {
			cflags |= 1 << 0
		}
		if c.IsStrike {
			cflags |= 1 << 1
		}
		if c.IsDisabled {
			cflags |= 1 << 2
		}
		if c.IsWiggling {
			cflags |= 1 << 3
		}
		// type in bits 4-6 (3 bits for 0-4 types)
		cflags |= (byte(c.Type) & 0x07) << 4
		if c.BonusExhausted {
			cflags |= 1 << 7
		}

		buf[off] = cflags
		binary.LittleEndian.PutUint16(buf[off+1:off+3], uint16(c.WinAmount)) // Send actual win amount
		mult := uint16(c.Multiplier*100 + 0.5)                               // scale *100
		binary.LittleEndian.PutUint16(buf[off+3:off+5], mult)
		buf[off+5] = c.BonusTimer
		buf[off+6] = c.GlobalTier
		off += 7
	}
	return buf
}

func encodeError(msg string) []byte {
	if len(msg) > 255 {
		msg = msg[:255]
	}
	b := []byte(msg)
	frame := make([]byte, 2+len(b))
	frame[0] = MsgError
	frame[1] = byte(len(b))
	copy(frame[2:], b)
	return frame
}

type Session struct {
	mu   sync.Mutex
	eng  *game.Engine
	conn *websocket.Conn
}

var db *sql.DB

func (s *Session) sendState() error {
	s.mu.Lock()
	st := s.eng.State
	s.mu.Unlock()
	frame := encodeState(st)
	return s.conn.WriteMessage(websocket.BinaryMessage, frame)
}

func (s *Session) sendError(msg string) {
	_ = s.conn.WriteMessage(websocket.BinaryMessage, encodeError(msg))
}

func (s *Session) handleMessages() {
	defer s.conn.Close()
	for {
		mt, data, err := s.conn.ReadMessage()
		if err != nil {
			return
		}
		if mt != websocket.BinaryMessage || len(data) == 0 {
			continue
		}
		op := data[0]
		s.mu.Lock()
		switch op {
		case OpStart:
			s.eng.StartGame()
		case OpOpenCell:
			if len(data) >= 2 {
				s.eng.OpenCell(uint8(data[1]))
			}
		case OpCashOut:
			s.eng.CashOut()
		case OpAdjustBet:
			if len(data) >= 3 {
				delta := int16(binary.LittleEndian.Uint16(data[1:3]))
				s.eng.AdjustBet(int64(delta))
			}
		default:
			s.mu.Unlock()
			s.sendError("unknown op")
			continue
		}
		s.mu.Unlock()
		if err := s.sendState(); err != nil {
			return
		}
	}
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	sid := uuid.NewString()
	sess := &Session{eng: game.NewEngine(10000, db, sid), conn: c}
	_ = sess.sendState()
	go sess.handleMessages()
}

func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres:postgres@db:5432/miner?sslmode=disable"
	}
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	if err = db.Ping(); err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS game_events(
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        event_type INT NOT NULL,
        details TEXT,
        amount_delta BIGINT NOT NULL,
        balance_after BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`)
	if err != nil {
		log.Fatal(err)
	}
}

func main() {
	initDB()
	http.HandleFunc("/ws", wsHandler)
	log.Println("WS server on :8080/ws (protocol v", ProtocolVersion, ")")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
